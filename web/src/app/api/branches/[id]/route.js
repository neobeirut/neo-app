import sql from "@/app/api/utils/sql";

export async function GET(request, { params: { id } }) {
  try {
    const [branch] = await sql`SELECT * FROM branches WHERE id = ${id}`;

    if (!branch) {
      return Response.json({ error: "Branch not found" }, { status: 404 });
    }

    return Response.json({ branch });
  } catch (error) {
    console.error("Error fetching branch:", error);
    return Response.json({ error: "Failed to fetch branch" }, { status: 500 });
  }
}

export async function PUT(request, { params: { id } }) {
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
      return Response.json(
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
      return Response.json(
        { error: "Delivery radius must be a non-negative number" },
        { status: 400 },
      );
    }

    const [branch] = await sql`
      UPDATE branches 
      SET name = ${name}, 
          address = ${address || null}, 
          phone = ${phone || null}, 
          whatsapp_phone = ${whatsapp_phone || null},
          location = ${location || null},
          is_active = ${is_active ?? true},
          discount_percentage = ${discount_percentage !== undefined ? discount_percentage : 0},
          image_url = ${image_url || null},
          delivery_radius_km = ${parsedRadius},
          display_order = ${display_order ?? 0},
          opening_time = ${opening_time || "09:00:00"},
          closing_time = ${closing_time || "21:00:00"},
          delivery_start_time = ${delivery_start_time || "11:00:00"},
          delivery_end_time = ${delivery_end_time || "20:00:00"},
          orders_active = ${orders_active ?? true}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!branch) {
      return Response.json({ error: "Branch not found" }, { status: 404 });
    }

    return Response.json({ branch });
  } catch (error) {
    console.error("Error updating branch:", error);
    return Response.json(
      { error: `Failed to update branch: ${error.message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params: { id } }) {
  try {
    const [branch] = await sql`
      DELETE FROM branches 
      WHERE id = ${id}
      RETURNING *
    `;

    if (!branch) {
      return Response.json({ error: "Branch not found" }, { status: 404 });
    }

    return Response.json({ message: "Branch deleted successfully" });
  } catch (error) {
    console.error("Error deleting branch:", error);
    return Response.json(
      { error: `Failed to delete branch: ${error.message}` },
      { status: 500 },
    );
  }
}
