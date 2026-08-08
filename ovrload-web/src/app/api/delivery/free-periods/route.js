import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

/**
 * GET /api/delivery/free-periods
 * Get all free delivery periods
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    let periods;

    if (activeOnly) {
      const now = new Date().toISOString();
      periods = await sql`
        SELECT *
        FROM free_delivery_periods
        WHERE is_active = true
          AND start_at <= ${now}
          AND end_at >= ${now}
        ORDER BY start_at DESC
      `;
    } else {
      periods = await sql`
        SELECT *
        FROM free_delivery_periods
        ORDER BY start_at DESC
      `;
    }

    return Response.json({ periods });
  } catch (error) {
    console.error("Error fetching free delivery periods:", error);
    return Response.json(
      { error: "Failed to fetch free delivery periods" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/delivery/free-periods
 * Create a new free delivery period
 */
export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      startAt,
      endAt,
      maxDistanceKm,
      branchIds,
      isActive = true,
    } = body;

    // Validation
    if (!name || !startAt || !endAt) {
      return Response.json(
        { error: "Name, start date, and end date are required" },
        { status: 400 },
      );
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (end <= start) {
      return Response.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }

    if (maxDistanceKm != null && parseFloat(maxDistanceKm) <= 0) {
      return Response.json(
        { error: "Maximum distance must be positive" },
        { status: 400 },
      );
    }

    const [period] = await sql`
      INSERT INTO free_delivery_periods (
        name,
        start_at,
        end_at,
        max_distance_km,
        branch_ids,
        is_active
      ) VALUES (
        ${name},
        ${startAt},
        ${endAt},
        ${maxDistanceKm || null},
        ${branchIds || null},
        ${isActive}
      )
      RETURNING *
    `;

    return Response.json({ period }, { status: 201 });
  } catch (error) {
    console.error("Error creating free delivery period:", error);
    return Response.json(
      { error: "Failed to create free delivery period" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/delivery/free-periods
 * Update a free delivery period
 */
export async function PUT(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, startAt, endAt, maxDistanceKm, branchIds, isActive } =
      body;

    if (!id) {
      return Response.json({ error: "Period ID is required" }, { status: 400 });
    }

    // Validation
    if (startAt && endAt) {
      const start = new Date(startAt);
      const end = new Date(endAt);

      if (end <= start) {
        return Response.json(
          { error: "End date must be after start date" },
          { status: 400 },
        );
      }
    }

    if (maxDistanceKm != null && parseFloat(maxDistanceKm) <= 0) {
      return Response.json(
        { error: "Maximum distance must be positive" },
        { status: 400 },
      );
    }

    // Build update query
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push(`name = $${updates.length + 1}`);
      values.push(name);
    }
    if (startAt !== undefined) {
      updates.push(`start_at = $${updates.length + 1}`);
      values.push(startAt);
    }
    if (endAt !== undefined) {
      updates.push(`end_at = $${updates.length + 1}`);
      values.push(endAt);
    }
    if (maxDistanceKm !== undefined) {
      updates.push(`max_distance_km = $${updates.length + 1}`);
      values.push(maxDistanceKm || null);
    }
    if (branchIds !== undefined) {
      updates.push(`branch_ids = $${updates.length + 1}`);
      values.push(branchIds || null);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${updates.length + 1}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const [period] = await sql(
      `UPDATE free_delivery_periods SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values,
    );

    if (!period) {
      return Response.json({ error: "Period not found" }, { status: 404 });
    }

    return Response.json({ period });
  } catch (error) {
    console.error("Error updating free delivery period:", error);
    return Response.json(
      { error: "Failed to update free delivery period" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/delivery/free-periods
 * Delete a free delivery period
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
      return Response.json({ error: "Period ID is required" }, { status: 400 });
    }

    const [deleted] = await sql`
      DELETE FROM free_delivery_periods
      WHERE id = ${id}
      RETURNING id
    `;

    if (!deleted) {
      return Response.json({ error: "Period not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting free delivery period:", error);
    return Response.json(
      { error: "Failed to delete free delivery period" },
      { status: 500 },
    );
  }
}
