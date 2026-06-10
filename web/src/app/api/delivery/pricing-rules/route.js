import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

/**
 * GET /api/delivery/pricing-rules
 * Get all delivery pricing rules (optionally filtered by branch)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get("branchId");

    let rules;

    if (branchId) {
      rules = await sql`
        SELECT r.*, b.name as branch_name
        FROM delivery_pricing_rules r
        LEFT JOIN branches b ON r.branch_id = b.id
        WHERE r.branch_id = ${branchId} OR r.branch_id IS NULL
        ORDER BY r.branch_id NULLS FIRST, r.display_order, r.min_distance_km
      `;
    } else {
      rules = await sql`
        SELECT r.*, b.name as branch_name
        FROM delivery_pricing_rules r
        LEFT JOIN branches b ON r.branch_id = b.id
        ORDER BY r.branch_id NULLS FIRST, r.display_order, r.min_distance_km
      `;
    }

    return Response.json({ rules });
  } catch (error) {
    console.error("Error fetching delivery pricing rules:", error);
    return Response.json(
      { error: "Failed to fetch delivery pricing rules" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/delivery/pricing-rules
 * Create a new delivery pricing rule
 */
export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      branchId,
      minDistanceKm,
      maxDistanceKm,
      deliveryCost,
      isActive = true,
      displayOrder = 0,
    } = body;

    // Validation
    if (
      minDistanceKm == null ||
      maxDistanceKm == null ||
      deliveryCost == null
    ) {
      return Response.json(
        { error: "Distance range and cost are required" },
        { status: 400 },
      );
    }

    if (parseFloat(minDistanceKm) < 0) {
      return Response.json(
        { error: "Minimum distance cannot be negative" },
        { status: 400 },
      );
    }

    if (parseFloat(maxDistanceKm) <= parseFloat(minDistanceKm)) {
      return Response.json(
        { error: "Maximum distance must be greater than minimum distance" },
        { status: 400 },
      );
    }

    if (parseFloat(deliveryCost) < 0) {
      return Response.json(
        { error: "Delivery cost cannot be negative" },
        { status: 400 },
      );
    }

    // Check for overlapping ranges
    let overlapping;
    if (branchId) {
      overlapping = await sql`
        SELECT id
        FROM delivery_pricing_rules
        WHERE branch_id = ${branchId}
          AND is_active = true
          AND (
            (min_distance_km <= ${minDistanceKm} AND max_distance_km > ${minDistanceKm})
            OR (min_distance_km < ${maxDistanceKm} AND max_distance_km >= ${maxDistanceKm})
            OR (min_distance_km >= ${minDistanceKm} AND max_distance_km <= ${maxDistanceKm})
          )
        LIMIT 1
      `;
    } else {
      overlapping = await sql`
        SELECT id
        FROM delivery_pricing_rules
        WHERE branch_id IS NULL
          AND is_active = true
          AND (
            (min_distance_km <= ${minDistanceKm} AND max_distance_km > ${minDistanceKm})
            OR (min_distance_km < ${maxDistanceKm} AND max_distance_km >= ${maxDistanceKm})
            OR (min_distance_km >= ${minDistanceKm} AND max_distance_km <= ${maxDistanceKm})
          )
        LIMIT 1
      `;
    }

    if (overlapping.length > 0) {
      return Response.json(
        { error: "Distance range overlaps with existing rule" },
        { status: 400 },
      );
    }

    const [rule] = await sql`
      INSERT INTO delivery_pricing_rules (
        branch_id,
        min_distance_km,
        max_distance_km,
        delivery_cost,
        is_active,
        display_order
      ) VALUES (
        ${branchId || null},
        ${minDistanceKm},
        ${maxDistanceKm},
        ${deliveryCost},
        ${isActive},
        ${displayOrder}
      )
      RETURNING *
    `;

    return Response.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Error creating delivery pricing rule:", error);
    return Response.json(
      { error: "Failed to create delivery pricing rule" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/delivery/pricing-rules
 * Update a delivery pricing rule
 */
export async function PUT(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      branchId,
      minDistanceKm,
      maxDistanceKm,
      deliveryCost,
      isActive,
      displayOrder,
    } = body;

    if (!id) {
      return Response.json({ error: "Rule ID is required" }, { status: 400 });
    }

    // Validation
    if (minDistanceKm != null && parseFloat(minDistanceKm) < 0) {
      return Response.json(
        { error: "Minimum distance cannot be negative" },
        { status: 400 },
      );
    }

    if (
      minDistanceKm != null &&
      maxDistanceKm != null &&
      parseFloat(maxDistanceKm) <= parseFloat(minDistanceKm)
    ) {
      return Response.json(
        { error: "Maximum distance must be greater than minimum distance" },
        { status: 400 },
      );
    }

    if (deliveryCost != null && parseFloat(deliveryCost) < 0) {
      return Response.json(
        { error: "Delivery cost cannot be negative" },
        { status: 400 },
      );
    }

    // Check for overlapping ranges (excluding this rule)
    if (minDistanceKm != null || maxDistanceKm != null) {
      const [currentRule] = await sql`
        SELECT * FROM delivery_pricing_rules WHERE id = ${id}
      `;

      if (!currentRule) {
        return Response.json({ error: "Rule not found" }, { status: 404 });
      }

      const checkMinKm = minDistanceKm ?? currentRule.min_distance_km;
      const checkMaxKm = maxDistanceKm ?? currentRule.max_distance_km;
      const checkBranchId =
        branchId !== undefined ? branchId : currentRule.branch_id;

      let overlapping;
      if (checkBranchId) {
        overlapping = await sql`
          SELECT id
          FROM delivery_pricing_rules
          WHERE id != ${id}
            AND branch_id = ${checkBranchId}
            AND is_active = true
            AND (
              (min_distance_km <= ${checkMinKm} AND max_distance_km > ${checkMinKm})
              OR (min_distance_km < ${checkMaxKm} AND max_distance_km >= ${checkMaxKm})
              OR (min_distance_km >= ${checkMinKm} AND max_distance_km <= ${checkMaxKm})
            )
          LIMIT 1
        `;
      } else {
        overlapping = await sql`
          SELECT id
          FROM delivery_pricing_rules
          WHERE id != ${id}
            AND branch_id IS NULL
            AND is_active = true
            AND (
              (min_distance_km <= ${checkMinKm} AND max_distance_km > ${checkMinKm})
              OR (min_distance_km < ${checkMaxKm} AND max_distance_km >= ${checkMaxKm})
              OR (min_distance_km >= ${checkMinKm} AND max_distance_km <= ${checkMaxKm})
            )
          LIMIT 1
        `;
      }

      if (overlapping.length > 0) {
        return Response.json(
          { error: "Distance range overlaps with existing rule" },
          { status: 400 },
        );
      }
    }

    // Build update query
    const updates = [];
    const values = [];

    if (branchId !== undefined) {
      updates.push(`branch_id = $${updates.length + 1}`);
      values.push(branchId || null);
    }
    if (minDistanceKm !== undefined) {
      updates.push(`min_distance_km = $${updates.length + 1}`);
      values.push(minDistanceKm);
    }
    if (maxDistanceKm !== undefined) {
      updates.push(`max_distance_km = $${updates.length + 1}`);
      values.push(maxDistanceKm);
    }
    if (deliveryCost !== undefined) {
      updates.push(`delivery_cost = $${updates.length + 1}`);
      values.push(deliveryCost);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${updates.length + 1}`);
      values.push(isActive);
    }
    if (displayOrder !== undefined) {
      updates.push(`display_order = $${updates.length + 1}`);
      values.push(displayOrder);
    }

    if (updates.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const [rule] = await sql(
      `UPDATE delivery_pricing_rules SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!rule) {
      return Response.json({ error: "Rule not found" }, { status: 404 });
    }

    return Response.json({ rule });
  } catch (error) {
    console.error("Error updating delivery pricing rule:", error);
    return Response.json(
      { error: "Failed to update delivery pricing rule" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/delivery/pricing-rules
 * Delete a delivery pricing rule
 */
export async function DELETE(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const [deleted] = await sql`
      DELETE FROM delivery_pricing_rules
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deleted) {
      return Response.json({ error: "Rule not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting delivery pricing rule:", error);
    return Response.json(
      { error: "Failed to delete delivery pricing rule" },
      { status: 500 },
    );
  }
}
