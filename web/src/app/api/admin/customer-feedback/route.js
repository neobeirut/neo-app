import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { ok: false, error: "Admin authentication required" },
        { status: 401 },
      );
    }

    const roles = Array.isArray(admin?.roles) ? admin.roles : [];
    const hasAccess = roles.includes("backend") || roles.includes("orders");

    if (!hasAccess) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 403 },
      );
    }

    // Fetch feedback (last 30 days)
    const feedback = await sql`
      SELECT 
        f.id,
        f.order_id,
        f.user_id,
        f.rating,
        f.feedback_text,
        f.source,
        f.admin_notified,
        f.created_at,
        u.name as user_name
      FROM order_feedback f
      LEFT JOIN auth_users u ON u.id = f.user_id
      WHERE f.created_at > now() - interval '30 days'
      ORDER BY f.created_at DESC
      LIMIT 200
    `;

    return Response.json({
      ok: true,
      feedback: Array.isArray(feedback) ? feedback : [],
    });
  } catch (error) {
    console.error("[admin/customer-feedback] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}
