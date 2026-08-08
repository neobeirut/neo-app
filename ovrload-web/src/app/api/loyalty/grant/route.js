import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

function computeExpiresAt(days) {
  const d = Number(days);
  if (!Number.isFinite(d) || d <= 0) return null;
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000);
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const userId = Number(body?.userId);
    if (!Number.isFinite(userId)) {
      return Response.json(
        { error: "Valid userId is required" },
        { status: 400 },
      );
    }

    const catalogCode = String(body?.catalogCode || "").trim();
    if (!catalogCode) {
      return Response.json(
        { error: "catalogCode is required" },
        { status: 400 },
      );
    }

    const [catalog] = await sql`
      SELECT id, expires_days, is_active
      FROM rewards_catalog
      WHERE code = ${catalogCode}
      LIMIT 1
    `;

    if (!catalog?.id) {
      return Response.json(
        { error: "Catalog reward not found" },
        { status: 404 },
      );
    }

    if (catalog.is_active === false) {
      return Response.json(
        { error: "Catalog reward is disabled" },
        { status: 400 },
      );
    }

    const expiresAt = computeExpiresAt(
      body?.expiresDays ?? catalog.expires_days ?? 7,
    );

    const periodKey = `admin-${Date.now()}`;

    const [row] = await sql`
      INSERT INTO user_rewards (
        user_id,
        catalog_id,
        status,
        source,
        period_key,
        expires_at,
        metadata
      ) VALUES (
        ${userId},
        ${catalog.id},
        'available',
        'admin_grant',
        ${periodKey},
        ${expiresAt},
        ${JSON.stringify({ admin_id: admin.id, granted_at: new Date().toISOString() })}::jsonb
      )
      RETURNING id
    `;

    return Response.json({ success: true, userRewardId: row?.id || null });
  } catch (error) {
    console.error("Error granting reward:", error);
    return Response.json({ error: "Failed to grant reward" }, { status: 500 });
  }
}
