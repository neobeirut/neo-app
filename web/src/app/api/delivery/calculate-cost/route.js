import sql from "@/app/api/utils/sql";

/**
 * Calculate driving distance between two points using Google Routes API (New)
 * Replaces deprecated Distance Matrix API
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // 1.3x multiplier estimates real road driving distance vs straight line
  return parseFloat((R * c * 1.3).toFixed(2));
}

async function calculateDistance(origin, destination) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;
      const requestBody = {
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        languageCode: "en-US",
        units: "METRIC",
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      const route = data.routes?.[0];
      if (route && route.distanceMeters) {
        return route.distanceMeters / 1000;
      }
    } catch (err) {
      console.warn("[ROUTES API ERROR - FALLING BACK TO HAVERSINE]", err.message);
    }
  }

  // Haversine fallback if API key is missing or Routes API fails
  return haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
}

/**
 * Convert address text or coordinate string into lat/lng
 */
async function geocodeAddress(addressText) {
  if (!addressText) return null;

  // Check if text itself contains lat,lng coordinates e.g. "33.8938, 35.5018"
  const coordMatch = addressText.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    return {
      lat: parseFloat(coordMatch[1]),
      lng: parseFloat(coordMatch[2]),
    };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressText)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch (err) {
    console.error("[GEOCODE ERROR]", err);
  }
  return null;
}

/**
 * Find active free delivery period for given branch and distance
 */
async function findActiveFreeDelivery(branchId, distanceKm) {
  const now = new Date().toISOString();

  const [period] = await sql`
    SELECT *
    FROM free_delivery_periods
    WHERE is_active = true
      AND start_at <= ${now}
      AND end_at >= ${now}
      AND (max_distance_km IS NULL OR max_distance_km >= ${distanceKm})
      AND (branch_ids IS NULL OR ${branchId} = ANY(branch_ids))
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return period;
}

/**
 * Find applicable delivery pricing rule for given branch and distance
 */
async function findDeliveryRule(branchId, distanceKm) {
  // First try branch-specific rules
  const [branchRule] = await sql`
    SELECT *
    FROM delivery_pricing_rules
    WHERE branch_id = ${branchId}
      AND is_active = true
      AND min_distance_km::numeric <= ${distanceKm}
      AND max_distance_km::numeric >= ${distanceKm}
    ORDER BY display_order, id
    LIMIT 1
  `;

  if (branchRule) {
    return branchRule;
  }

  // Fall back to global rules (branch_id IS NULL)
  const [globalRule] = await sql`
    SELECT *
    FROM delivery_pricing_rules
    WHERE branch_id IS NULL
      AND is_active = true
      AND min_distance_km::numeric <= ${distanceKm}
      AND max_distance_km::numeric >= ${distanceKm}
    ORDER BY display_order, id
    LIMIT 1
  `;

  return globalRule;
}

/**
 * POST /api/delivery/calculate-cost
 * Calculate delivery cost based on distance
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { branchId, addressId, latitude, longitude } = body;

    if (!branchId) {
      return Response.json({ error: "Branch ID is required" }, { status: 400 });
    }

    // Get branch location
    const [branch] = await sql`
      SELECT id, name, location
      FROM branches
      WHERE id = ${branchId}
    `;

    if (!branch) {
      return Response.json({ error: "Branch not found" }, { status: 404 });
    }

    // Parse branch coordinates from location field
    let branchLat, branchLng;

    if (branch.location) {
      // Try to parse from location field if it contains coordinates
      const coords = branch.location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
      if (coords) {
        branchLat = parseFloat(coords[1]);
        branchLng = parseFloat(coords[2]);
      }
    }

    console.log("[BRANCH COORDINATES]", {
      branchId,
      branchName: branch.name,
      location: branch.location,
      parsedLat: branchLat,
      parsedLng: branchLng,
    });

    if (!branchLat || !branchLng) {
      return Response.json(
        { error: "Branch location not configured" },
        { status: 400 },
      );
    }

    // Get delivery address coordinates
    let deliveryLat, deliveryLng;

    if (addressId) {
      const [address] = await sql`
        SELECT latitude, longitude
        FROM user_addresses
        WHERE id = ${addressId}
      `;

      if (!address || !address.latitude || !address.longitude) {
        return Response.json(
          { error: "Address coordinates not found" },
          { status: 400 },
        );
      }

      deliveryLat = parseFloat(address.latitude);
      deliveryLng = parseFloat(address.longitude);
    } else if (latitude && longitude) {
      deliveryLat = parseFloat(latitude);
      deliveryLng = parseFloat(longitude);
    } else if (body.address && body.address.trim()) {
      const addressStr = body.address.trim();

      // Check if address text explicitly specifies distance e.g. "5.1 km" or "5.1km"
      const distMatch = addressStr.match(/(\d+\.?\d*)\s*km/i);
      if (distMatch) {
        const distanceKm = parseFloat(distMatch[1]);
        const rule = await findDeliveryRule(branchId, distanceKm);
        const cost = rule ? parseFloat(rule.delivery_cost) : 0;
        return Response.json({
          distanceKm,
          deliveryCost: cost,
          isFreeDelivery: cost === 0,
          inDeliveryZone: !!rule,
          calculationMethod: "address_text_distance_parse",
        });
      }

      // Try geocoding the address text
      const geocoded = await geocodeAddress(addressStr);
      if (geocoded) {
        deliveryLat = geocoded.lat;
        deliveryLng = geocoded.lng;
      } else {
        return Response.json(
          {
            error: "Could not geocode delivery address to calculate distance. Please specify a valid address.",
            distanceKm: null,
            deliveryCost: 0,
            inDeliveryZone: false,
          },
          { status: 400 }
        );
      }
    } else {
      return Response.json(
        { error: "Address coordinates or address text are required" },
        { status: 400 },
      );
    }

    console.log("[DELIVERY COORDINATES]", {
      deliveryLat,
      deliveryLng,
      addressId,
    });

    // Calculate distance using Google Maps
    let distanceKm;
    try {
      console.log("[CALLING ROUTES API]", {
        from: { lat: branchLat, lng: branchLng },
        to: { lat: deliveryLat, lng: deliveryLng },
      });

      distanceKm = await calculateDistance(
        { lat: branchLat, lng: branchLng },
        { lat: deliveryLat, lng: deliveryLng },
      );

      console.log("[ROUTES API SUCCESS]", { distanceKm });
    } catch (distanceError) {
      console.error("[ROUTES API ERROR]", distanceError.message);

      // If Routes API is not enabled or fails, use fallback cost
      const [fallbackSetting] = await sql`
        SELECT setting_value
        FROM app_settings
        WHERE setting_key = 'delivery_fallback_cost'
      `;

      const fallbackCost = fallbackSetting
        ? parseFloat(fallbackSetting.setting_value)
        : 0;

      console.log("[USING FALLBACK DUE TO API ERROR]", fallbackCost);

      return Response.json({
        distanceKm: null,
        deliveryCost: fallbackCost,
        isFreeDelivery: false,
        inDeliveryZone: true,
        calculationMethod: "api_error_fallback",
        warning:
          "Unable to calculate distance - using fallback cost. Please enable Google Routes API.",
        apiError: distanceError.message,
      });
    }

    console.log("[DELIVERY COST DEBUG]", {
      branchId,
      distanceKm,
      now: new Date().toISOString(),
    });

    // Check for active free delivery period
    const freeDeliveryPeriod = await findActiveFreeDelivery(
      branchId,
      distanceKm,
    );

    console.log("[FREE DELIVERY PERIOD]", freeDeliveryPeriod);

    if (freeDeliveryPeriod) {
      return Response.json({
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        deliveryCost: 0,
        isFreeDelivery: true,
        freeDeliveryPeriodId: freeDeliveryPeriod.id,
        freeDeliveryPeriodName: freeDeliveryPeriod.name,
        calculationMethod: "free_period",
        inDeliveryZone: true,
      });
    }

    // Find applicable delivery rule
    const rule = await findDeliveryRule(branchId, distanceKm);

    console.log("[DELIVERY RULE MATCHED]", rule);

    if (!rule) {
      // No rule found - check if there's a maximum distance defined
      const [maxRule] = await sql`
        SELECT MAX(max_distance_km) as max_distance
        FROM delivery_pricing_rules
        WHERE (branch_id = ${branchId} OR branch_id IS NULL)
          AND is_active = true
      `;

      const maxDistance = maxRule?.max_distance;

      if (maxDistance && distanceKm > maxDistance) {
        return Response.json({
          distanceKm: parseFloat(distanceKm.toFixed(2)),
          deliveryCost: 0,
          isFreeDelivery: false,
          inDeliveryZone: false,
          maxDeliveryDistance: parseFloat(maxDistance),
          calculationMethod: "out_of_zone",
          error: "Address is outside our delivery zone",
        });
      }

      // Use fallback cost if configured
      const [fallbackSetting] = await sql`
        SELECT setting_value
        FROM app_settings
        WHERE setting_key = 'delivery_fallback_cost'
      `;

      const fallbackCost = fallbackSetting
        ? parseFloat(fallbackSetting.setting_value)
        : 0;

      console.log("[USING FALLBACK]", fallbackCost);

      return Response.json({
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        deliveryCost: fallbackCost,
        isFreeDelivery: false,
        inDeliveryZone: true,
        calculationMethod: "fallback",
        warning: "Using fallback delivery cost - no matching rule found",
      });
    }

    return Response.json({
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      deliveryCost: parseFloat(rule.delivery_cost),
      isFreeDelivery: false,
      deliveryRuleId: rule.id,
      ruleDescription: `${rule.min_distance_km}-${rule.max_distance_km} km`,
      calculationMethod: "rule_based",
      inDeliveryZone: true,
    });
  } catch (error) {
    console.error("Error calculating delivery cost:", error);
    return Response.json(
      { error: error.message || "Failed to calculate delivery cost" },
      { status: 500 },
    );
  }
}
