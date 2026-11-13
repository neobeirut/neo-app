import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import {
  normalizeWeekdaySchedule,
  getNextScheduledOpen,
  evaluateBranchStatus,
} from "@/app/api/utils/branchScheduleService";

export async function OPTIONS(request) {
  return corsOptions(request);
}

function resolveId(arg1, arg2) {
  if (arg2?.params?.id) return arg2.params.id;
  if (arg1?.params?.id) return arg1.params.id;
  return null;
}

export async function GET(request, context) {
  try {
    const id = resolveId(request, context);
    if (!id) {
      return corsJson(request, { error: "Branch ID required" }, { status: 400 });
    }

    const [branch] = await sql`SELECT * FROM branches WHERE id = ${id}`;

    if (!branch) {
      return corsJson(request, { error: "Branch not found" }, { status: 404 });
    }

    const evalStatus = evaluateBranchStatus(branch);
    if (evalStatus.needsDbSync) {
      await sql`
        UPDATE branches
        SET operational_status = ${evalStatus.newOperationalStatus},
            closed_until = ${evalStatus.newClosedUntil ? evalStatus.newClosedUntil.toISOString() : null},
            orders_active = ${evalStatus.ordersActive}
        WHERE id = ${branch.id}
      `.catch((err) => console.error("Error auto-syncing branch in GET [id]:", err));
    }

    return corsJson(request, {
      branch: {
        ...branch,
        is_open: evalStatus.isOpen,
        orders_active: evalStatus.ordersActive,
        operational_status: evalStatus.status,
        status_display: evalStatus.displayText,
        status_description: evalStatus.description,
        closed_until: evalStatus.closedUntil,
      },
    });
  } catch (error) {
    console.error("Error fetching branch:", error);
    return corsJson(
      request,
      { error: "Failed to fetch branch: " + error.message },
      { status: 500 },
    );
  }
}

export async function PUT(request, context) {
  try {
    const id = resolveId(request, context);
    if (!id) {
      return corsJson(request, { error: "Branch ID required" }, { status: 400 });
    }

    const body = await request.json();

    const [existing] = await sql`SELECT * FROM branches WHERE id = ${id}`;
    if (!existing) {
      return corsJson(request, { error: "Branch not found" }, { status: 404 });
    }

    // Merge incoming fields with existing fields to support safe partial updates
    const name = body.name !== undefined ? body.name : existing.name;
    if (!name) {
      return corsJson(
        request,
        { error: "Branch name is required" },
        { status: 400 },
      );
    }

    const address = body.address !== undefined ? body.address : existing.address;
    const phone = body.phone !== undefined ? body.phone : existing.phone;
    const whatsapp_phone =
      body.whatsapp_phone !== undefined ? body.whatsapp_phone : existing.whatsapp_phone;
    const location = body.location !== undefined ? body.location : existing.location;
    const discount_percentage =
      body.discount_percentage !== undefined
        ? body.discount_percentage
        : (existing.discount_percentage || 0);
    const image_url = body.image_url !== undefined ? body.image_url : existing.image_url;
    const display_order =
      body.display_order !== undefined ? body.display_order : (existing.display_order || 0);
    const opening_time =
      body.opening_time !== undefined ? body.opening_time : (existing.opening_time || "12:00:00");
    const closing_time =
      body.closing_time !== undefined ? body.closing_time : (existing.closing_time || "23:00:00");
    const delivery_start_time =
      body.delivery_start_time !== undefined
        ? body.delivery_start_time
        : (existing.delivery_start_time || "12:00:00");
    const delivery_end_time =
      body.delivery_end_time !== undefined
        ? body.delivery_end_time
        : (existing.delivery_end_time || "23:00:00");

    const rawRadius =
      body.delivery_radius_km !== undefined
        ? body.delivery_radius_km
        : existing.delivery_radius_km;
    const parsedRadius =
      rawRadius === null || rawRadius === undefined ? null : Number(rawRadius);
    if (
      parsedRadius !== null &&
      (!Number.isFinite(parsedRadius) || parsedRadius < 0)
    ) {
      return corsJson(
        request,
        { error: "Delivery radius must be a non-negative number" },
        { status: 400 },
      );
    }

    // Schedule: preserve existing schedule if body did not supply it
    const rawSchedule =
      body.weekday_schedule !== undefined
        ? body.weekday_schedule
        : existing.weekday_schedule;
    const cleanSchedule = normalizeWeekdaySchedule(
      rawSchedule,
      opening_time,
      closing_time,
    );

    // Determine operational status
    const operational_status =
      body.operational_status !== undefined
        ? body.operational_status
        : (existing.operational_status || "open");
    const closure_reason =
      body.closure_reason !== undefined
        ? body.closure_reason
        : existing.closure_reason;

    // Calculate closed_until, orders_active & is_active
    const now = new Date();
    let closed_until = null;
    let orders_active = true;
    let is_active =
      body.is_active !== undefined ? body.is_active : (existing.is_active ?? true);

    if (operational_status === "closed_hour") {
      closed_until = new Date(now.getTime() + 60 * 60 * 1000);
      orders_active = false;
    } else if (operational_status === "closed_today" || operational_status === "closed") {
      // Calculate next scheduled open time so it automatically reopens next morning!
      const nextOpen = getNextScheduledOpen(cleanSchedule, now);
      closed_until = nextOpen.reopenDate;
      orders_active = false;
      if (body.is_active === false) {
        is_active = false;
      }
    } else if (operational_status === "open") {
      closed_until = null;
      orders_active = true;
      is_active = true;
    }

    const jsonSchedule = JSON.stringify(cleanSchedule);

    const [branch] = await sql`
      UPDATE branches 
      SET name = ${name}, 
          address = ${address || null}, 
          phone = ${phone || null}, 
          whatsapp_phone = ${whatsapp_phone || null},
          location = ${location || null},
          is_active = ${is_active},
          discount_percentage = ${discount_percentage},
          image_url = ${image_url || null},
          delivery_radius_km = ${parsedRadius},
          display_order = ${display_order},
          opening_time = ${opening_time},
          closing_time = ${closing_time},
          delivery_start_time = ${delivery_start_time},
          delivery_end_time = ${delivery_end_time},
          orders_active = ${orders_active},
          operational_status = ${operational_status},
          closure_reason = ${orders_active ? null : (closure_reason || null)},
          closed_until = ${closed_until ? closed_until.toISOString() : null},
          weekday_schedule = ${jsonSchedule}::jsonb
      WHERE id = ${id}
      RETURNING *
    `;

    const evalStatus = evaluateBranchStatus(branch);

    return corsJson(request, {
      branch: {
        ...branch,
        is_open: evalStatus.isOpen,
        orders_active: evalStatus.ordersActive,
        operational_status: evalStatus.status,
        status_display: evalStatus.displayText,
        status_description: evalStatus.description,
        closed_until: evalStatus.closedUntil,
      },
    });
  } catch (error) {
    console.error("Error updating branch:", error);
    return corsJson(
      request,
      { error: `Failed to update branch: ${error.message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(request, context) {
  try {
    const id = resolveId(request, context);
    if (!id) {
      return corsJson(request, { error: "Branch ID required" }, { status: 400 });
    }

    const [branch] = await sql`
      DELETE FROM branches 
      WHERE id = ${id}
      RETURNING *
    `;

    if (!branch) {
      return corsJson(request, { error: "Branch not found" }, { status: 404 });
    }

    return corsJson(request, { message: "Branch deleted successfully", branch });
  } catch (error) {
    console.error("Error deleting branch:", error);
    return corsJson(
      request,
      { error: `Failed to delete branch: ${error.message}` },
      { status: 500 },
    );
  }
}
