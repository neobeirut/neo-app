import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

export async function PUT(request, { params }) {
  try {
    // Allow either a regular user session OR the lightweight admin header auth
    const session = await auth();
    const admin = session ? null : await getAdminFromRequest(request);

    if (!session && !admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number.parseInt(String(params.id), 10);
    if (!Number.isFinite(id)) {
      return Response.json({ error: "Invalid reward id" }, { status: 400 });
    }

    const {
      title,
      description,
      points_cost,
      image_url,
      is_active,
      discount_amount,
      free_delivery,
    } = await request.json();

    const discountValueRaw =
      discount_amount === null || discount_amount === undefined
        ? null
        : Number.parseFloat(discount_amount);

    const discountValue =
      discountValueRaw === null
        ? null
        : Number.isFinite(discountValueRaw)
          ? Math.max(discountValueRaw, 0)
          : null;

    const [reward] = await sql`
      UPDATE rewards
      SET
        title = ${title},
        description = ${description || ""},
        points_cost = ${points_cost},
        image_url = ${image_url || ""},
        is_active = ${is_active ?? true},
        discount_amount = ${discountValue},
        free_delivery = ${free_delivery ?? false}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!reward) {
      return Response.json({ error: "Reward not found" }, { status: 404 });
    }

    return Response.json({ reward });
  } catch (error) {
    console.error("Error updating reward:", error);
    return Response.json({ error: "Failed to update reward" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await auth();
    const admin = session ? null : await getAdminFromRequest(request);

    if (!session && !admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number.parseInt(String(params.id), 10);
    if (!Number.isFinite(id)) {
      return Response.json({ error: "Invalid reward id" }, { status: 400 });
    }

    await sql`
      DELETE FROM rewards
      WHERE id = ${id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting reward:", error);
    return Response.json({ error: "Failed to delete reward" }, { status: 500 });
  }
}
