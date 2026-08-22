import sql from "@/app/api/utils/sql";

// Helper: Real road distance via OSRM with Haversine fallback
async function getRoadDistanceKm(lat1, lon1, lat2, lon2) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.code === "Ok" && data.routes && data.routes.length > 0) {
      return data.routes[0].distance / 1000;
    }
  } catch (e) {
    console.warn("OSRM fallback to Haversine:", e.message);
  }

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
    const rawPhone = searchParams.get("phone");

    if (!rawPhone || !rawPhone.trim()) {
      return Response.json({ hasLocation: false, message: "Phone number required" });
    }

    let clean = rawPhone.replace(/\D/g, "");
    if (clean.startsWith("00")) clean = clean.slice(2);
    if (clean.startsWith("0")) clean = `961${clean.slice(1)}`;
    if (!clean.startsWith("961") && clean.length >= 7 && clean.length <= 8) clean = `961${clean}`;
    const short7 = clean.slice(-7);
    const short8 = clean.slice(-8);

    // Look for latest location in whatsapp_conversations
    const rows = await sql`
      SELECT 
        phone,
        latest_location_lat::float as lat,
        latest_location_lng::float as lng,
        latest_location_address as address,
        latest_location_url as url,
        latest_location_at,
        EXTRACT(EPOCH FROM (NOW() - latest_location_at)) / 60 as minutes_ago
      FROM whatsapp_conversations
      WHERE (
        REPLACE(phone, ' ', '') = ${clean}
        OR REPLACE(phone, ' ', '') = ${'+' + clean}
        OR phone LIKE ${'%' + short7}
        OR phone LIKE ${'%' + short8}
        OR phone LIKE ${'%' + rawPhone.replace(/\D/g, '')}
      )
      AND (latest_location_lat IS NOT NULL OR latest_location_url IS NOT NULL)
      AND latest_location_at >= NOW() - INTERVAL '24 hours'
      ORDER BY latest_location_at DESC
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) {
      return Response.json({ hasLocation: false });
    }

    const row = rows[0];
    let lat = row.lat;
    let lng = row.lng;
    let url = row.url;
    let address = row.address;

    // If we have URL but no lat/lng, attempt quick parse
    if ((!lat || !lng) && url) {
      const match = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[2]);
      }
    }

    // Default branch location (OVR LOAD Badaro)
    let branchLat = 33.876514;
    let branchLng = 35.517225;

    let distanceKm = null;
    let deliveryFee = 2.0;

    if (lat && lng) {
      distanceKm = await getRoadDistanceKm(branchLat, branchLng, lat, lng);
      distanceKm = parseFloat(distanceKm.toFixed(2));

      // Query active pricing rules
      try {
        const rules = await sql`
          SELECT delivery_cost 
          FROM delivery_pricing_rules 
          WHERE is_active = true 
            AND min_distance_km::float <= ${distanceKm} 
            AND max_distance_km::float > ${distanceKm}
          ORDER BY min_distance_km::float DESC
          LIMIT 1;
        `;
        if (rules && rules.length > 0) {
          deliveryFee = parseFloat(rules[0].delivery_cost);
        } else {
          // Default fallbacks based on distance
          if (distanceKm <= 3) deliveryFee = 2.0;
          else if (distanceKm <= 6) deliveryFee = 3.0;
          else if (distanceKm <= 10) deliveryFee = 4.0;
          else deliveryFee = 5.0;
        }
      } catch (err) {
        console.warn("Error checking pricing rules:", err.message);
      }
    }

    return Response.json({
      hasLocation: true,
      lat,
      lng,
      mapUrl: url || (lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : null),
      address: address || (lat && lng ? `GPS Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})` : "Pinned Location"),
      distanceKm,
      deliveryFee,
      receivedMinutesAgo: Math.round(row.minutes_ago || 0),
      receivedAt: row.latest_location_at
    });
  } catch (error) {
    console.error("Error in GET /api/pos/whatsapp-latest-location:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
