import sql from "@/app/api/utils/sql";

/**
 * Calculate driving distance between two points using Google Routes API (New)
 * Replaces deprecated Distance Matrix API
 */
async function calculateDistance(origin, destination) {
  // IMPORTANT: Use only the server key, NOT the public/client keys
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error(
      "[GOOGLE MAPS] GOOGLE_MAPS_API_KEY not found. Available env vars:",
      Object.keys(process.env).filter(
        (k) => k.includes("GOOGLE") || k.includes("MAPS"),
      ),
    );
    throw new Error(
      "Google Maps API key not configured - GOOGLE_MAPS_API_KEY must be set for server-side API calls",
    );
  }

  // Routes API endpoint
  const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;

  // Routes API request body
  const requestBody = {
    origin: {
      location: {
        latLng: {
          latitude: origin.lat,
          longitude: origin.lng,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.lat,
          longitude: destination.lng,
        },
      },
    },
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
      // Request only the fields we need to reduce costs
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  console.log("[ROUTES API] Full response:", JSON.stringify(data, null, 2));

  // Check for API errors
  if (!response.ok || data.error) {
    console.error("[ROUTES API] Error details:", {
      status: response.status,
      error: data.error,
      full_response: data,
    });
    throw new Error(
      `Google Routes API error: ${data.error?.message || response.statusText}`,
    );
  }

  // Extract distance from first route
  const route = data.routes?.[0];

  if (!route || !route.distanceMeters) {
    throw new Error("Unable to calculate distance - no route found");
  }

  // Return distance in kilometers
  return route.distanceMeters / 1000;
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
      AND min_distance_km <= ${distanceKm}
      AND max_distance_km >= ${distanceKm}
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
      AND min_distance_km <= ${distanceKm}
      AND max_distance_km >= ${distanceKm}
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
    } else {
      return Response.json(
        { error: "Address coordinates are required" },
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
        : 5.0;

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
        : 5.0;

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
