import { getLastRequestBodyString } from "@/app/api/utils/infobipWhatsApp";
import sql from "@/app/api/utils/sql";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";
import {
  logWhatsAppMessage,
  normalizePhone,
  sendWhatsAppFreeForm,
} from "@/app/api/utils/customerWhatsApp";

/**
 * POST /api/admin/whatsapp-inbox/send-reply
 */
export async function POST(request) {
  try {
    console.log("🔥🔥🔥 SEND-REPLY ROUTE HIT 🔥🔥🔥");

    const adminUser = await getAdminFromRequest(request);

    if (!adminUser) {
      console.log("❌ Unauthorized request");
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const phone = String(body.phone || "").trim();
    const message = String(body.message || "").trim();

    console.log("📥 Incoming payload:", { phone, message });

    if (!phone || !message) {
      console.log("❌ Missing phone or message");
      return Response.json(
        { ok: false, error: "Phone and message are required" },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);
    console.log("📞 Normalized phone:", normalizedPhone);

    const [conversation] = await sql`
      SELECT 
        customer_id,
        order_id,
        branch_id,
        session_active
      FROM whatsapp_conversations
      WHERE REPLACE(phone, ' ', '') = ${normalizedPhone}
         OR phone = ${phone}
      LIMIT 1
    `;

    console.log("📊 Conversation found:", conversation);

    if (!conversation) {
      return Response.json(
        { ok: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (adminUser.branch_id && conversation.branch_id !== adminUser.branch_id) {
      console.log("❌ Branch access denied");
      return Response.json(
        {
          ok: false,
          error:
            "Access denied: This conversation belongs to a different branch",
        },
        { status: 403 }
      );
    }

    if (!conversation.session_active) {
      console.log("❌ WhatsApp session expired");
      return Response.json(
        {
          ok: false,
          error:
            "WhatsApp session expired (24h window). Customer must message first to reactivate.",
        },
        { status: 400 }
      );
    }

    const messageWithFooter = `${message}\n\n— Néo Beirut\nReply to this message if you need help.`;

    console.log("📤 Final message:", messageWithFooter);

    let infobipResponse;

    try {
      console.log("🚀 ABOUT TO CALL WHATSAPP SEND FUNCTION");

      infobipResponse = await sendWhatsAppFreeForm(phone, messageWithFooter);
      console.log("✅ WHATSAPP SEND FUNCTION FINISHED");
      console.log("🔥 LAST REQUEST BODY STRING:");
      console.log(getLastRequestBodyString());
    } catch (error) {
      console.error("❌ WhatsApp send failed:", error);

      console.log("🔥 LAST REQUEST BODY STRING AFTER ERROR:");
      console.log(getLastRequestBodyString());
      await logWhatsAppMessage({
        userId: conversation.customer_id,
        orderId: conversation.order_id,
        phone,
        direction: "outbound",
        messageType: "admin_reply",
        messageText: messageWithFooter,
        templateName: null,
        birdMessageId: null,
        status: "failed",
        error: String(error?.message || error),
      });

      return Response.json(
        { ok: false, error: String(error?.message || error) },
        { status: 500 }
      );
    }

    console.log("📝 Logging success to DB");

    await logWhatsAppMessage({
      userId: conversation.customer_id,
      orderId: conversation.order_id,
      phone,
      direction: "outbound",
      messageType: "admin_reply",
      messageText: messageWithFooter,
      templateName: null,
      birdMessageId: infobipResponse?.id || null,
      status: "sent",
      error: null,
    });

    await sql`
      UPDATE whatsapp_conversations
      SET 
        last_message = ${messageWithFooter},
        last_message_at = now(),
        unread_count = 0,
        updated_at = now()
      WHERE REPLACE(phone, ' ', '') = ${normalizedPhone}
         OR phone = ${phone}
    `;

    console.log("✅ Reply sent successfully");

    return Response.json({
      ok: true,
      messageId: infobipResponse?.id || null,
      message: "Reply sent successfully",
      debugPayload: getLastRequestBodyString(), // 🔥 ADD THIS
    });
  } catch (error) {
    console.error("[send-reply] Fatal error:", error);

    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}