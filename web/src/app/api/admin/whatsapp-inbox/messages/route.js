import sql from "@/app/api/utils/sql";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";
import { normalizePhone } from "@/app/api/utils/customerWhatsApp";

/**
 * GET /api/admin/whatsapp-inbox/messages?phone=+9613...
 * Fetch all messages for a specific conversation
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

    // Normalize phone by removing spaces and plus signs for robust matching
    const cleanPhone = phone.replace("+", "").replace(/\s+/g, "");

    // Verify branch access if admin is branch-specific
    if (adminUser.branch_id) {
      const [conversation] = await sql`
        SELECT branch_id, branch_ids
        FROM whatsapp_conversations
        WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') = ${cleanPhone}
           OR phone = ${phone}
        LIMIT 1
      `;

      if (conversation) {
        // If a specific branch_id matches OR the admin's branch is in branch_ids list,
        // OR the conversation is unattributed (both branch_id and branch_ids empty), they have access.
        const isAllowed = 
          conversation.branch_id === adminUser.branch_id ||
          (conversation.branch_ids && conversation.branch_ids.includes(adminUser.branch_id)) ||
          !conversation.branch_ids ||
          conversation.branch_ids.length === 0;

        if (!isAllowed) {
          return Response.json(
            {
              ok: false,
              error:
                "Access denied: This conversation belongs to a different branch",
            },
            { status: 403 },
          );
        }
      }
    }

    // Fetch all messages for this phone (match with or without spaces or plus signs)
    const messages = await sql`
      SELECT 
        id,
        user_id,
        order_id,
        phone,
        direction,
        message_type,
        message_text,
        template_name,
        bird_message_id,
        status,
        error,
        created_at
      FROM customer_whatsapp_messages
      WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') = ${cleanPhone}
         OR phone = ${phone}
      ORDER BY created_at ASC, id ASC
    `;

    // Mark conversation as read (also needs normalization)
    await sql`
      UPDATE whatsapp_conversations
      SET unread_count = 0
      WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') = ${cleanPhone}
         OR phone = ${phone}
    `;

    return Response.json({ ok: true, messages });
  } catch (error) {
    console.error("[whatsapp-inbox/messages] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}
