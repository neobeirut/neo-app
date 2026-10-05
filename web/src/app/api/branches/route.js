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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const isActiveFilter = searchParams.get("is_active");

    const allBranches = await sql`
      SELECT id, name, address, phone, whatsapp_phone, location, is_active, created_at, discount_percentage, image_url, delivery_radius_km, display_order,
             opening_time, closing_time, delivery_start_time, delivery_end_time, orders_active,
             COALESCE(operational_status, 'open') as operational_status, closure_reason, closed_until, weekday_schedule
      FROM branches 
      ORDER BY display_order, name
    `;

    const now = new Date();
    const evaluatedBranches = [];

    for (const b of allBranches) {
      const evalStatus = evaluateBranchStatus(b, now);

      if (evalStatus.needsDbSync) {
        // Asynchronously sync DB so other services/queries stay fresh
        sql`
          UPDATE branches 
          SET operational_status = ${evalStatus.newOperationalStatus},
              closed_until = ${evalStatus.newClosedUntil ? evalStatus.newClosedUntil.toISOString() : null},
              orders_active = ${evalStatus.ordersActive}
          WHERE id = ${b.id}
        `.catch((err) => console.error("Error auto-syncing branch in GET:", err));
      }

      const branchWithEval = {
        ...b,
        is_open: evalStatus.isOpen,
        orders_active: evalStatus.ordersActive,
        operational_status: evalStatus.status,
        closed_until: evalStatus.closedUntil,
        status_display: evalStatus.displayText,
        status_description: evalStatus.description,
      };

      evaluatedBranches.push(branchWithEval);
    }

    let branches = evaluatedBranches;

    if (isActiveFilter !== null) {
      const isActiveBoolean = isActiveFilter === "true";
      if (isActiveBoolean) {
        // Customer view: only branches that are active and currently open
        branches = evaluatedBranches.filter(
          (b) => b.is_active === true && b.is_open === true,
        );
      } else {
        branches = evaluatedBranches.filter(
          (b) => b.is_active === false || b.is_open === false,
        );
      }
    }

    return corsJson(request, { branches });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return corsJson(
      request,
      { error: "Failed to fetch branches: " + error.message },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const {
      name,
      address,
      phone,
      whatsapp_phone,
      location,
      is_active = true,
      discount_percentage = 0,
      image_url,
      delivery_radius_km,
      display_order,
      opening_time = "12:00:00",
      closing_time = "23:00:00",
      delivery_start_time = "12:00:00",
      delivery_end_time = "23:00:00",
      operational_status = "open",
      closure_reason = null,
      weekday_schedule = null,
    } = await request.json();

    if (!name) {
      return corsJson(
        request,
        { error: "Branch name is required" },
        { status: 400 },
      );
    }

    const parsedRadius =
      delivery_radius_km === null || delivery_radius_km === undefined
        ? null
        : Number(delivery_radius_km);

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

    // Clean schedule
    const cleanSchedule = normalizeWeekdaySchedule(
      weekday_schedule,
      opening_time,
      closing_time,
    );
    const jsonSchedule = JSON.stringify(cleanSchedule);

    // Calculate closed_until & orders_active
    const now = new Date();
    let closed_until = null;
    let orders_active = true;
    let finalIsActive = is_active;

    if (operational_status === "closed_hour") {
      closed_until = new Date(now.getTime() + 60 * 60 * 1000);
      orders_active = false;
    } else if (operational_status === "closed_today" || operational_status === "closed") {
      const nextOpen = getNextScheduledOpen(cleanSchedule, now);
      closed_until = nextOpen.reopenDate;
      orders_active = false;
      if (is_active === false) {
        finalIsActive = false;
      }
    } else if (operational_status === "open") {
      closed_until = null;
      orders_active = true;
      finalIsActive = true;
    }

    // Get max display_order if not provided
    let finalDisplayOrder = display_order;
    if (finalDisplayOrder === null || finalDisplayOrder === undefined) {
      const [maxOrder] =
        await sql`SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM branches`;
      finalDisplayOrder = maxOrder?.next_order || 1;
    }

    const [branch] = await sql`
      INSERT INTO branches (
        name, address, phone, whatsapp_phone, location, is_active, 
        discount_percentage, image_url, delivery_radius_km, display_order,
        opening_time, closing_time, delivery_start_time, delivery_end_time, orders_active,
        operational_status, closure_reason, closed_until, weekday_schedule
      ) VALUES (
        ${name}, ${address || null}, ${phone || null}, ${whatsapp_phone || null}, ${location || null}, ${finalIsActive},
        ${discount_percentage || 0}, ${image_url || null}, ${parsedRadius}, ${finalDisplayOrder},
        ${opening_time}, ${closing_time}, ${delivery_start_time}, ${delivery_end_time}, ${orders_active},
        ${operational_status}, ${orders_active ? null : (closure_reason || null)}, ${closed_until ? closed_until.toISOString() : null}, ${jsonSchedule}::jsonb
      )
      RETURNING *
    `;

    const evalStatus = evaluateBranchStatus(branch);

    return corsJson(
      request,
      {
        branch: {
          ...branch,
          is_open: evalStatus.isOpen,
          orders_active: evalStatus.ordersActive,
          operational_status: evalStatus.status,
          status_display: evalStatus.displayText,
          status_description: evalStatus.description,
          closed_until: evalStatus.closedUntil,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating branch:", error);
    return corsJson(
      request,
      { error: "Failed to create branch: " + error.message },
      { status: 500 },
    );
  }
}
