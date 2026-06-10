import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await sql`
      SELECT membership_tier, COUNT(*)::int AS count
      FROM auth_users
      WHERE is_active = true
      GROUP BY membership_tier
    `;

    const counts = {
      Bronze: 0,
      Silver: 0,
      Gold: 0,
      Platinum: 0,
    };

    for (const r of rows) {
      const tier = r.membership_tier || "Bronze";
      if (counts[tier] === undefined) continue;
      counts[tier] = Number(r.count || 0);
    }

    return Response.json({ counts });
  } catch (error) {
    console.error("Error loading tier stats:", error);
    return Response.json(
      { error: "Failed to load tier stats" },
      { status: 500 },
    );
  }
}
