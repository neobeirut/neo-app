import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;

    // Configurable service window
    let windowHours = 24;
    try {
      const [setting] = await sql`SELECT setting_value FROM app_settings WHERE setting_key = 'whatsapp_service_window_hours' LIMIT 1`;
      if (setting?.setting_value) windowHours = parseFloat(setting.setting_value) || 24;
    } catch (e) {}

    const [conv] = await sql`
      SELECT 
        wc.*,
        con.name as contact_name,
        con.phone_e164 as contact_phone,
        con.email as contact_email,
        con.notes as contact_notes,
        con.tags as contact_tags,
        con.whatsapp_opt_in,
        con.whatsapp_opt_in_at,
        con.whatsapp_opt_in_source,
        u.name as customer_name,
        u.email as customer_email,
        u.total_spent as customer_total_spent,
        u.membership_tier as customer_tier,
        u.points as customer_points,
        au.name as assigned_user_name,
        au.email as assigned_user_email,
        (
          wc.last_customer_message_at IS NOT NULL 
          AND wc.last_customer_message_at > now() - (make_interval(hours => ${windowHours}))
        ) as is_window_active
      FROM whatsapp_conversations wc
      LEFT JOIN whatsapp_contacts con ON con.id = wc.contact_id
      LEFT JOIN auth_users u ON u.id = wc.customer_id
      LEFT JOIN admin_users au ON au.id = wc.assigned_user_id
      WHERE wc.id = ${id}
      LIMIT 1
    `;

    if (!conv) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Fetch linked customer recent orders if available
    let recentOrders = [];
    if (conv.customer_id) {
      recentOrders = await sql`
        SELECT id, total_amount, status, order_type, created_at
        FROM orders
        WHERE user_id = ${conv.customer_id}
        ORDER BY created_at DESC
        LIMIT 5
      `;
    }

    return Response.json({
      ok: true,
      conversation: conv,
      recentOrders,
      windowHours,
    });
  } catch (error) {
    console.error("[whatsapp/conversations/[id] GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { status, assigned_user_id } = body;

    const [updated] = await sql`
      UPDATE whatsapp_conversations
      SET 
        status = COALESCE(${status || null}, status),
        assigned_user_id = ${assigned_user_id !== undefined ? assigned_user_id : sql`assigned_user_id`},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updated) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    return Response.json({ ok: true, conversation: updated });
  } catch (error) {
    console.error("[whatsapp/conversations/[id] PATCH] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
