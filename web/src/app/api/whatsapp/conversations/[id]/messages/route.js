import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { sendInfobipTextMessage, sendInfobipMediaMessage } from "@/app/api/utils/infobipService";
import { broadcastWhatsAppEvent } from "@/app/api/utils/realtimeBroadcaster";

export async function GET(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const beforeId = searchParams.get("before"); // Pagination cursor

    let messages = await sql`
      SELECT 
        wm.*,
        au.name as sent_by_user_name
      FROM whatsapp_messages wm
      LEFT JOIN admin_users au ON au.id = wm.sent_by_user_id
      WHERE wm.conversation_id = ${id}
      ${beforeId ? sql`AND wm.id < ${Number(beforeId)}` : sql`true`}
      ORDER BY wm.created_at DESC, wm.id DESC
      LIMIT ${limit}
    `;

    // Return in ascending chronological order for chat UI
    messages.reverse();

    return Response.json({ ok: true, messages });
  } catch (error) {
    console.error("[whatsapp/messages GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { text, messageType = "text", mediaUrl, caption, filename } = body;

    if (!text && !mediaUrl) {
      return Response.json({ error: "Message text or media is required" }, { status: 400 });
    }

    // 1. Fetch conversation and contact
    const [conv] = await sql`
      SELECT 
        wc.id, 
        wc.phone, 
        wc.contact_id, 
        wc.last_customer_message_at,
        con.phone_e164
      FROM whatsapp_conversations wc
      LEFT JOIN whatsapp_contacts con ON con.id = wc.contact_id
      WHERE wc.id = ${id}
      LIMIT 1
    `;

    if (!conv) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const recipientPhone = conv.phone_e164 || conv.phone;

    // 2. CRITICAL: 24-Hour WhatsApp Service Window Validation
    let windowHours = 24;
    try {
      const [setting] = await sql`SELECT setting_value FROM app_settings WHERE setting_key = 'whatsapp_service_window_hours' LIMIT 1`;
      if (setting?.setting_value) windowHours = parseFloat(setting.setting_value) || 24;
    } catch (e) {}

    const lastCustomerTime = conv.last_customer_message_at ? new Date(conv.last_customer_message_at).getTime() : 0;
    const hoursSinceCustomer = (Date.now() - lastCustomerTime) / (1000 * 60 * 60);
    const isWindowActive = lastCustomerTime > 0 && hoursSinceCustomer <= windowHours;

    if (!isWindowActive) {
      return Response.json({
        ok: false,
        error: "WhatsApp customer service window has expired. You must send an approved template to reopen this conversation.",
        code: "SERVICE_WINDOW_EXPIRED",
        hoursSinceCustomer,
        windowHours,
      }, { status: 400 });
    }

    // 3. Send message via Infobip API
    let infobipRes;
    const localMsgId = `out-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      if (mediaUrl) {
        infobipRes = await sendInfobipMediaMessage({
          to: recipientPhone,
          type: messageType,
          mediaUrl,
          caption: caption || text || "",
          filename: filename || "attachment",
          messageId: localMsgId,
        });
      } else {
        infobipRes = await sendInfobipTextMessage({
          to: recipientPhone,
          text,
          messageId: localMsgId,
        });
      }
    } catch (apiErr) {
      console.error("[whatsapp/messages POST] Infobip send error:", apiErr);
      // Record failed message
      const [failedMsg] = await sql`
        INSERT INTO whatsapp_messages (
          conversation_id, contact_id, infobip_message_id, direction,
          message_type, text_content, media_url, status, error_code, error_message,
          sent_by_user_id, created_at, updated_at
        )
        VALUES (
          ${id}, ${conv.contact_id}, ${localMsgId}, 'outgoing',
          ${messageType}, ${text || caption || '[Media]'}, ${mediaUrl || null}, 'failed',
          ${apiErr.errorCode || 'SEND_ERROR'}, ${apiErr.message},
          ${admin.id}, now(), now()
        )
        RETURNING *
      `;

      return Response.json({
        ok: false,
        error: apiErr.message,
        message: failedMsg,
      }, { status: 502 });
    }

    const assignedInfobipId = infobipRes.messageId || localMsgId;
    const preview = text || caption || (mediaUrl ? `[${messageType.toUpperCase()}]` : "");

    // 4. Save outgoing message in DB
    const [savedMsg] = await sql`
      INSERT INTO whatsapp_messages (
        conversation_id, contact_id, infobip_message_id, direction,
        message_type, text_content, media_url, media_filename, status,
        sent_by_user_id, raw_infobip_payload, created_at, updated_at
      )
      VALUES (
        ${id}, ${conv.contact_id}, ${assignedInfobipId}, 'outgoing',
        ${messageType}, ${text || caption || preview}, ${mediaUrl || null}, ${filename || null}, 'sent',
        ${admin.id}, ${JSON.stringify(infobipRes.raw || {})}, now(), now()
      )
      RETURNING *
    `;

    // 5. Update conversation
    await sql`
      UPDATE whatsapp_conversations
      SET 
        last_message = ${preview},
        last_message_preview = ${preview.slice(0, 150)},
        last_message_at = now(),
        status = 'open',
        updated_at = now()
      WHERE id = ${id}
    `;

    // 6. Audit log
    await sql`
      INSERT INTO whatsapp_audit_logs (admin_user_id, action, entity_type, entity_id, details, created_at)
      VALUES (${admin.id}, 'message.sent', 'conversation', ${id}, ${JSON.stringify({ messageId: savedMsg.id, recipientPhone })}, now())
    `;

    // 7. Realtime SSE broadcast
    broadcastWhatsAppEvent("whatsapp.message.sent", {
      message: { ...savedMsg, sent_by_user_name: admin.name },
      conversationId: id,
    });

    return Response.json({ ok: true, message: savedMsg });
  } catch (error) {
    console.error("[whatsapp/messages POST] Fatal error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
