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

    // Fetch recent customer WhatsApp messages (last 7 days)
    const messages = await sql`
      SELECT 
        m.id,
        m.user_id,
        m.order_id,
        m.phone,
        m.direction,
        m.message_type,
        m.message_text,
        m.template_name,
        m.bird_message_id,
        m.status,
        m.error,
        m.created_at,
        u.name as user_name
      FROM customer_whatsapp_messages m
      LEFT JOIN auth_users u ON u.id = m.user_id
      WHERE m.created_at > now() - interval '7 days'
      ORDER BY m.created_at DESC
      LIMIT 200
    `;

    return Response.json({
      ok: true,
      messages: Array.isArray(messages) ? messages : [],
    });
  } catch (error) {
    console.error("[admin/customer-messages] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}
