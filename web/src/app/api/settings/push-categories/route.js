import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const rows = await sql`
      SELECT setting_value, updated_at
      FROM app_settings
      WHERE setting_key = 'push_categories'
    `;

    const raw = rows[0]?.setting_value || "[]";
    let category_ids = [];
    try {
      const parsed = JSON.parse(raw);
      category_ids = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      category_ids = [];
    }

    return corsJson(request, {
      category_ids,
      updated_at: rows[0]?.updated_at || null,
    });
  } catch (error) {
    console.error("Error fetching push categories:", error);
    return corsJson(request, { category_ids: [] });
  }
}

export async function PUT(request) {
  try {
    // Allow either a regular user session OR the lightweight admin header auth
    const session = await auth();
    const admin = session ? null : await getAdminFromRequest(request);

    if (!session && !admin) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const category_ids = Array.isArray(body?.category_ids)
      ? body.category_ids
      : [];

    const cleaned = category_ids
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v));

    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ('push_categories', ${JSON.stringify(cleaned)}, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = ${JSON.stringify(cleaned)},
        updated_at = CURRENT_TIMESTAMP
    `;

    return corsJson(request, { success: true, category_ids: cleaned });
  } catch (error) {
    console.error("Error updating push categories:", error);
    return corsJson(
      request,
      { error: "Failed to update push categories" },
      { status: 500 },
    );
  }
}
