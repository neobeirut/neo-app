import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const is_active = searchParams.get("is_active");

    let branches;

    // Only filter by is_active if explicitly provided
    if (is_active !== null) {
      const isActiveBoolean = is_active === "true";
      branches = await sql`
        SELECT id, name, address, phone, whatsapp_phone, location, is_active, created_at, discount_percentage, image_url, delivery_radius_km, display_order,
               opening_time, closing_time, delivery_start_time, delivery_end_time, orders_active
        FROM branches 
        WHERE is_active = ${isActiveBoolean}
        ORDER BY display_order, name
      `;
    } else {
      // No filter, get all branches
      branches = await sql`
        SELECT id, name, address, phone, whatsapp_phone, location, is_active, created_at, discount_percentage, image_url, delivery_radius_km, display_order,
               opening_time, closing_time, delivery_start_time, delivery_end_time, orders_active
        FROM branches 
        ORDER BY display_order, name
      `;
    }

    return corsJson(request, { branches });
  } catch (error) {
    console.error("Error fetching branches:", error);
    return corsJson(
      request,
      { error: "Failed to fetch branches" },
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
      is_active,
      discount_percentage,
      image_url,
      delivery_radius_km,
      display_order,
      opening_time,
      closing_time,
      delivery_start_time,
      delivery_end_time,
      orders_active,
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

    // Get max display_order if not provided
    let finalDisplayOrder = display_order;
    if (finalDisplayOrder === null || finalDisplayOrder === undefined) {
      const [maxOrder] =
        await sql`SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM branches`;
      finalDisplayOrder = maxOrder.next_order;
    }

    const [branch] = await sql`
      INSERT INTO branches (
        name, address, phone, whatsapp_phone, location, is_active, 
        discount_percentage, image_url, delivery_radius_km, display_order,
        opening_time, closing_time, delivery_start_time, delivery_end_time, orders_active
      )
      VALUES (
        ${name}, ${address || null}, ${phone || null}, ${whatsapp_phone || null}, 
        ${location || null}, ${is_active ?? true}, ${discount_percentage || 0}, 
        ${image_url || null}, ${parsedRadius}, ${finalDisplayOrder},
        ${opening_time || "09:00:00"}, ${closing_time || "21:00:00"}, 
        ${delivery_start_time || "11:00:00"}, ${delivery_end_time || "20:00:00"}, 
        ${orders_active ?? true}
      )
      RETURNING *
    `;

    return corsJson(request, { branch });
  } catch (error) {
    console.error("Error creating branch:", error);
    return corsJson(
      request,
      { error: `Failed to create branch: ${error.message}` },
      { status: 500 },
    );
  }
}
