import sql from "@/app/api/utils/sql";

/**
 * Calculate driving distance between two points using Google Maps Distance Matrix API
 */
async function calculateDistance(origin, destination) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error("Google Maps API key not configured");
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&mode=driving&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "OK") {
    throw new Error(`Google Maps API error: ${data.status}`);
  }

  const element = data.rows[0]?.elements[0];

  if (!element || element.status !== "OK") {
    throw new Error("Unable to calculate distance");
  }

  // Return distance in kilometers
  return element.distance.value / 1000;
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
 * Get delivery fee based on order type and distance
 * @param {string} order_type - The order type (delivery or pickup)
 * @param {object} options - Additional options
 * @param {number} options.addressId - The delivery address ID
 * @param {number} options.branchId - The branch ID
 * @returns {Promise<object>} Delivery fee and metadata
 */
export async function getDeliveryFee(order_type, options = {}) {
  if (order_type !== "delivery") {
    return {
      fee: 0,
      distanceKm: null,
      deliveryRuleId: null,
      freeDeliveryPeriodId: null,
      calculationMethod: "pickup",
      inDeliveryZone: true,
    };
  }

  const { addressId, branchId } = options;

  // If no address or branch, fall back to old behavior
  if (!addressId || !branchId) {
    try {
      const [row] = await sql`
        SELECT setting_value
        FROM app_settings
        WHERE setting_key = 'delivery_cost'
      `;
      const parsed = Number.parseFloat(row?.setting_value ?? "0");
      return {
        fee: Number.isFinite(parsed) ? parsed : 0,
        distanceKm: null,
        deliveryRuleId: null,
        freeDeliveryPeriodId: null,
        calculationMethod: "legacy_fallback",
        inDeliveryZone: true,
      };
    } catch (e) {
      return {
        fee: 0,
        distanceKm: null,
        deliveryRuleId: null,
        freeDeliveryPeriodId: null,
        calculationMethod: "error",
        inDeliveryZone: true,
      };
    }
  }

  try {
    // Get branch location
    const [branch] = await sql`
      SELECT id, name, location
      FROM branches
      WHERE id = ${branchId}
    `;

    if (!branch) {
      throw new Error("Branch not found");
    }

    // Parse branch coordinates from location field
    let branchLat, branchLng;

    if (branch.location) {
      const coords = branch.location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
      if (coords) {
        branchLat = parseFloat(coords[1]);
        branchLng = parseFloat(coords[2]);
      }
    }

    if (!branchLat || !branchLng) {
      throw new Error("Branch location not configured");
    }

    // Get delivery address coordinates
    const [address] = await sql`
      SELECT latitude, longitude
      FROM user_addresses
      WHERE id = ${addressId}
    `;

    if (!address || !address.latitude || !address.longitude) {
      throw new Error("Address coordinates not found");
    }

    const deliveryLat = parseFloat(address.latitude);
    const deliveryLng = parseFloat(address.longitude);

    // Calculate distance using Google Maps
    const distanceKm = await calculateDistance(
      { lat: branchLat, lng: branchLng },
      { lat: deliveryLat, lng: deliveryLng },
    );

    // Check for active free delivery period
    const freeDeliveryPeriod = await findActiveFreeDelivery(
      branchId,
      distanceKm,
    );

    if (freeDeliveryPeriod) {
      return {
        fee: 0,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        deliveryRuleId: null,
        freeDeliveryPeriodId: freeDeliveryPeriod.id,
        calculationMethod: "free_period",
        inDeliveryZone: true,
      };
    }

    // Find applicable delivery rule
    const rule = await findDeliveryRule(branchId, distanceKm);

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
        return {
          fee: 0,
          distanceKm: parseFloat(distanceKm.toFixed(2)),
          deliveryRuleId: null,
          freeDeliveryPeriodId: null,
          calculationMethod: "out_of_zone",
          inDeliveryZone: false,
          maxDeliveryDistance: parseFloat(maxDistance),
          error: "Address is outside our delivery zone",
        };
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

      return {
        fee: fallbackCost,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        deliveryRuleId: null,
        freeDeliveryPeriodId: null,
        calculationMethod: "fallback",
        inDeliveryZone: true,
      };
    }

    return {
      fee: parseFloat(rule.delivery_cost),
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      deliveryRuleId: rule.id,
      freeDeliveryPeriodId: null,
      calculationMethod: "rule_based",
      inDeliveryZone: true,
    };
  } catch (error) {
    console.error("Error calculating delivery fee:", error);

    // Fallback to legacy behavior on error
    try {
      const [row] = await sql`
        SELECT setting_value
        FROM app_settings
        WHERE setting_key = 'delivery_cost'
      `;
      const parsed = Number.parseFloat(row?.setting_value ?? "0");
      return {
        fee: Number.isFinite(parsed) ? parsed : 0,
        distanceKm: null,
        deliveryRuleId: null,
        freeDeliveryPeriodId: null,
        calculationMethod: "error_fallback",
        inDeliveryZone: true,
        error: error.message,
      };
    } catch (e) {
      return {
        fee: 0,
        distanceKm: null,
        deliveryRuleId: null,
        freeDeliveryPeriodId: null,
        calculationMethod: "error",
        inDeliveryZone: true,
        error: error.message,
      };
    }
  }
}
