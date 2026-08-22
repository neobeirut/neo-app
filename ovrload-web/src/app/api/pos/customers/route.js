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

    let cleanDigits = query.replace(/\D/g, "");
    if (cleanDigits.startsWith("00")) cleanDigits = cleanDigits.slice(2);
    if (cleanDigits.startsWith("0")) cleanDigits = cleanDigits.slice(1);
    if (cleanDigits.startsWith("961")) cleanDigits = cleanDigits.slice(3);
    const pattern = `%${query}%`;
    const digitPattern = cleanDigits ? `%${cleanDigits}%` : pattern;
    const last7 = cleanDigits.length >= 4 ? cleanDigits.slice(-7) : "";
    const last7Pattern = last7 ? `%${last7}%` : pattern;

    const rows = await sql`
      WITH raw_customers AS (
        SELECT 
          name as customer_name,
          phone as customer_phone,
          NULL as delivery_address
        FROM auth_users
        WHERE name ILIKE ${pattern} 
           OR phone ILIKE ${pattern} 
           OR phone ILIKE ${digitPattern}
           OR phone ILIKE ${last7Pattern}

        UNION ALL

        SELECT 
          customer_name,
          customer_phone,
          delivery_address
        FROM orders
        WHERE (customer_name ILIKE ${pattern} 
           OR customer_phone ILIKE ${pattern}
           OR customer_phone ILIKE ${digitPattern}
           OR customer_phone ILIKE ${last7Pattern})
          AND (customer_name IS NOT NULL AND customer_name != '')

        UNION ALL

        SELECT 
          'WhatsApp Customer' as customer_name,
          phone as customer_phone,
          COALESCE(latest_location_address, latest_location_url) as delivery_address
        FROM whatsapp_conversations
        WHERE (phone ILIKE ${pattern} 
           OR phone ILIKE ${digitPattern}
           OR phone ILIKE ${last7Pattern})
          AND (latest_location_lat IS NOT NULL OR latest_location_url IS NOT NULL)
      ),
      deduped AS (
        SELECT DISTINCT ON (RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(customer_phone, ''), customer_name), '[^0-9]', '', 'g'), 7))
          customer_name,
          customer_phone,
          delivery_address
        FROM raw_customers
        ORDER BY RIGHT(REGEXP_REPLACE(COALESCE(NULLIF(customer_phone, ''), customer_name), '[^0-9]', '', 'g'), 7), 
                 CASE WHEN customer_name != 'WhatsApp Customer' THEN 0 ELSE 1 END,
                 delivery_address DESC NULLS LAST
      )
      SELECT 
        d.customer_name,
        d.customer_phone,
        d.delivery_address,
        wc.latest_location_lat::float as lat,
        wc.latest_location_lng::float as lng,
        wc.latest_location_address as address,
        wc.latest_location_url as url,
        wc.latest_location_at,
        EXTRACT(EPOCH FROM (NOW() - wc.latest_location_at)) / 60 as minutes_ago
      FROM deduped d
      LEFT JOIN whatsapp_conversations wc 
        ON (RIGHT(REGEXP_REPLACE(wc.phone, '[^0-9]', '', 'g'), 7) = RIGHT(REGEXP_REPLACE(d.customer_phone, '[^0-9]', '', 'g'), 7))
        AND (wc.latest_location_lat IS NOT NULL OR wc.latest_location_url IS NOT NULL)
      ORDER BY wc.latest_location_at DESC NULLS LAST
      LIMIT 10;
    `;

    // Process WhatsApp locations & compute fees
    const branchLat = 33.876514;
    const branchLng = 35.517225;

    const customers = await Promise.all(
      (rows || []).map(async (c) => {
        let waLocation = null;
        if (c.lat && c.lng) {
          const lat = parseFloat(c.lat);
          const lng = parseFloat(c.lng);
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
            mapUrl: c.url || `https://maps.google.com/?q=${lat},${lng}`,
            address: c.address || `GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
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
