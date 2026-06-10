import sql from "@/app/api/utils/sql";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

/**
 * GET /api/admin/whatsapp-inbox/conversations
 * Fetch all WhatsApp conversations with customer details
 */
export async function GET(request) {
  try {
    const adminUser = await getAdminFromRequest(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Branch managers only see their branch conversations
    // HQ admins see all
    let conversations;

    if (adminUser.branch_id) {
      // Branch manager - show conversations where this branch is in the branch_ids array
      // OR the legacy branch_id matches (for backward compatibility)
      conversations = await sql`
        SELECT 
          wc.id,
          wc.phone,
          wc.customer_id,
          wc.last_message,
          wc.last_message_at,
          wc.order_id,
          wc.branch_id,
          wc.branch_ids,
          wc.unread_count,
          wc.session_active,
          wc.created_at,
          u.name as customer_name,
          u.email as customer_email,
          b.name as branch_name
        FROM whatsapp_conversations wc
        LEFT JOIN auth_users u ON u.id = wc.customer_id
        LEFT JOIN branches b ON b.id = wc.branch_id
        WHERE ${adminUser.branch_id} = ANY(wc.branch_ids)
           OR wc.branch_id = ${adminUser.branch_id}
        ORDER BY wc.last_message_at DESC
        LIMIT 100
      `;
    } else {
      // HQ admin - see all conversations
      conversations = await sql`
        SELECT 
          wc.id,
          wc.phone,
          wc.customer_id,
          wc.last_message,
          wc.last_message_at,
          wc.order_id,
          wc.branch_id,
          wc.branch_ids,
          wc.unread_count,
          wc.session_active,
          wc.created_at,
          u.name as customer_name,
          u.email as customer_email,
          b.name as branch_name
        FROM whatsapp_conversations wc
        LEFT JOIN auth_users u ON u.id = wc.customer_id
        LEFT JOIN branches b ON b.id = wc.branch_id
        ORDER BY wc.last_message_at DESC
        LIMIT 100
      `;
    }

    return Response.json({ ok: true, conversations });
  } catch (error) {
    console.error("[whatsapp-inbox/conversations] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}
