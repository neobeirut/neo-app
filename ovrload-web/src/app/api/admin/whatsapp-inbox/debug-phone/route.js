import sql from "@/app/api/utils/sql";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";
import { normalizePhone } from "@/app/api/utils/customerWhatsApp";

/**
 * GET /api/admin/whatsapp-inbox/debug-phone?phone=+9613361515
 * Debug endpoint to check what's in the database for a specific phone
 */
export async function GET(request) {
  try {
    const adminUser = await getAdminFromRequest(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");

    if (!phone) {
      return Response.json(
        { ok: false, error: "Phone number required" },
        { status: 400 },
      );
    }

    // Normalize the phone (removes all spaces)
    const normalizedPhone = normalizePhone(phone);

    // 1. Check if customer exists (using normalized matching)
    const customers = await sql`
      SELECT id, name, phone, email, branch_id
      FROM auth_users
      WHERE REPLACE(phone, ' ', '') = ${normalizedPhone}
         OR phone = ${phone}
    `;

    // 2. Check if conversation exists
    const conversations = await sql`
      SELECT 
        id, phone, customer_id, last_message, last_message_at,
        order_id, branch_id, unread_count, session_active, created_at
      FROM whatsapp_conversations
      WHERE REPLACE(phone, ' ', '') = ${normalizedPhone}
         OR phone = ${phone}
    `;

    // 3. Check messages
    const messages = await sql`
      SELECT 
        id, user_id, order_id, phone, direction, message_type,
        message_text, status, created_at
      FROM customer_whatsapp_messages
      WHERE REPLACE(phone, ' ', '') = ${normalizedPhone}
         OR phone = ${phone}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // 4. Check admin user permissions
    const adminInfo = {
      id: adminUser.id,
      name: adminUser.name,
      branch_id: adminUser.branch_id,
      roles: adminUser.roles,
    };

    return Response.json({
      ok: true,
      debug: {
        searchPhone: phone,
        normalizedPhone,
        customers,
        conversations,
        messages,
        adminInfo,
      },
    });
  } catch (error) {
    console.error("[whatsapp-inbox/debug-phone] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}
