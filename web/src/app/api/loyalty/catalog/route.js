import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const catalog = await sql`
      SELECT id, code, title, description, tier_required, frequency, expires_days, is_active
      FROM rewards_catalog
      ORDER BY tier_required, frequency, title
    `;

    return Response.json({ catalog });
  } catch (error) {
    console.error("Error loading rewards catalog:", error);
    return Response.json(
      { error: "Failed to load rewards catalog" },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const id = Number.parseInt(String(body?.id), 10);
    if (!Number.isFinite(id)) {
      return Response.json({ error: "Invalid id" }, { status: 400 });
    }

    const isActive = body?.is_active;
    if (typeof isActive !== "boolean") {
      return Response.json(
        { error: "is_active must be boolean" },
        { status: 400 },
      );
    }

    const [row] = await sql`
      UPDATE rewards_catalog
      SET is_active = ${isActive}, updated_at = now()
      WHERE id = ${id}
      RETURNING id, code, is_active
    `;

    if (!row) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ success: true, catalog: row });
  } catch (error) {
    console.error("Error updating catalog item:", error);
    return Response.json(
      { error: "Failed to update catalog item" },
      { status: 500 },
    );
  }
}
