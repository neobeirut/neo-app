import sql from "../../utils/sql";

// Helper: Real road distance via OSRM with Haversine fallback
async function getRoadDistanceKm(lat1, lon1, lat2, lon2) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000;
    }
  } catch (e) {}

  // Haversine fallback
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").trim();

    if (!query || query.length < 2) {
      return Response.json({ customers: [] });
    }

    const pattern = `%${query}%`;
    let rawDigits = query.replace(/\D/g, "");
    if (rawDigits.startsWith("00")) rawDigits = rawDigits.slice(2);
    if (rawDigits.startsWith("0")) rawDigits = rawDigits.slice(1);
    if (rawDigits.startsWith("961")) rawDigits = rawDigits.slice(3);
    const shortPattern = rawDigits.length >= 4 ? `%${rawDigits}%` : pattern;

    const rows = await sql`
      WITH combined AS (
        SELECT 
          name as customer_name,
          phone as customer_phone,
          NULL as delivery_address,
          NULL::float as latest_location_lat,
          NULL::float as latest_location_lng,
          NULL as latest_location_address,
          NULL as latest_location_url,
          NULL::timestamp as latest_location_at
        FROM auth_users
        WHERE (name ILIKE ${pattern} OR phone ILIKE ${pattern} OR phone ILIKE ${shortPattern})

        UNION ALL

        SELECT 
          customer_name,
          customer_phone,
          delivery_address,
          NULL::float as latest_location_lat,
          NULL::float as latest_location_lng,
          NULL as latest_location_address,
          NULL as latest_location_url,
          NULL::timestamp as latest_location_at
        FROM orders
        WHERE (customer_name ILIKE ${pattern} OR customer_phone ILIKE ${pattern} OR customer_phone ILIKE ${shortPattern})
          AND (customer_name IS NOT NULL AND customer_name != '')

        UNION ALL

        SELECT 
          'WhatsApp Customer' as customer_name,
          phone as customer_phone,
          COALESCE(latest_location_address, latest_location_url) as delivery_address,
          latest_location_lat::float,
          latest_location_lng::float,
          latest_location_address,
          latest_location_url,
          latest_location_at
        FROM whatsapp_conversations
        WHERE (phone ILIKE ${pattern} OR phone ILIKE ${shortPattern})
          AND (latest_location_lat IS NOT NULL OR latest_location_url IS NOT NULL)
      )
      SELECT DISTINCT ON (LOWER(COALESCE(NULLIF(customer_phone, ''), customer_name)))
        customer_name,
        customer_phone,
        delivery_address,
        latest_location_lat,
        latest_location_lng,
        latest_location_address,
        latest_location_url,
        latest_location_at,
        EXTRACT(EPOCH FROM (NOW() - latest_location_at)) / 60 as minutes_ago
      FROM combined
      ORDER BY LOWER(COALESCE(NULLIF(customer_phone, ''), customer_name)), latest_location_at DESC NULLS LAST, delivery_address DESC NULLS LAST
      LIMIT 10;
    `;

    // Process WhatsApp locations & compute fees
    const branchLat = 33.876514;
    const branchLng = 35.517225;

    const customers = await Promise.all(
      (rows || []).map(async (c) => {
        let waLocation = null;
        if (c.latest_location_lat && c.latest_location_lng) {
          const lat = parseFloat(c.latest_location_lat);
          const lng = parseFloat(c.latest_location_lng);
          let distKm = await getRoadDistanceKm(branchLat, branchLng, lat, lng);
          distKm = parseFloat(distKm.toFixed(2));

          let fee = 2.0;
          try {
            const rules = await sql`
              SELECT delivery_cost 
              FROM delivery_pricing_rules 
              WHERE is_active = true 
                AND min_distance_km::float <= ${distKm} 
                AND max_distance_km::float > ${distKm}
              ORDER BY min_distance_km::float DESC
              LIMIT 1;
            `;
            if (rules && rules.length > 0) {
              fee = parseFloat(rules[0].delivery_cost);
            } else {
              if (distKm <= 3) fee = 2.0;
              else if (distKm <= 6) fee = 3.0;
              else if (distKm <= 10) fee = 4.0;
              else fee = 5.0;
            }
          } catch (e) {}

          waLocation = {
            hasLocation: true,
            lat,
            lng,
            mapUrl: c.latest_location_url || `https://maps.google.com/?q=${lat},${lng}`,
            address: c.latest_location_address || `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            distanceKm: distKm,
            deliveryFee: fee,
            receivedMinutesAgo: Math.round(c.minutes_ago || 0),
            receivedAt: c.latest_location_at
          };
        }

        return {
          customer_name: c.customer_name === "WhatsApp Customer" ? "" : c.customer_name,
          customer_phone: c.customer_phone,
          delivery_address: c.delivery_address,
          whatsapp_location: waLocation
        };
      })
    );

    return Response.json({ customers });
  } catch (error) {
    console.error("Error in GET /api/pos/customers:", error);
    return Response.json(
      { error: "Failed to search customers: " + error.message },
      { status: 500 }
    );
  }
}
