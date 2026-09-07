import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { sendInfobipTemplateMessage } from "@/app/api/utils/infobipService";
import { broadcastWhatsAppEvent } from "@/app/api/utils/realtimeBroadcaster";

export async function POST(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { templateName, language = "en", placeholders = [], buttons = [], headerMediaUrl = null } = body;

    if (!templateName) {
      return Response.json({ error: "Template name is required" }, { status: 400 });
    }

    const [conv] = await sql`
      SELECT wc.id, wc.phone, wc.contact_id, con.phone_e164
      FROM whatsapp_conversations wc
      LEFT JOIN whatsapp_contacts con ON con.id = wc.contact_id
      WHERE wc.id = ${id}
      LIMIT 1
    `;

    if (!conv) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const recipientPhone = conv.phone_e164 || conv.phone;
    const localMsgId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let infobipRes;
    try {
      infobipRes = await sendInfobipTemplateMessage({
        to: recipientPhone,
        templateName,
        language,
        placeholders,
        buttons,
        headerMediaUrl,
        messageId: localMsgId,
      });
    } catch (err) {
      console.error("[whatsapp/templates POST] Infobip error:", err);
      return Response.json({ ok: false, error: err.message }, { status: 502 });
    }

    const assignedId = infobipRes.messageId || localMsgId;
    const textPreview = `[Template: ${templateName}]` + (placeholders.length > 0 ? ` (${placeholders.join(', ')})` : '');

    const [savedMsg] = await sql`
      INSERT INTO whatsapp_messages (
        conversation_id, contact_id, infobip_message_id, direction,
        message_type, text_content, template_name, template_parameters,
        status, sent_by_user_id, raw_infobip_payload, created_at, updated_at
      )
      VALUES (
        ${id}, ${conv.contact_id}, ${assignedId}, 'outgoing',
        'template', ${textPreview}, ${templateName}, ${JSON.stringify({ placeholders, buttons, language })},
        'sent', ${admin.id}, ${JSON.stringify(infobipRes.raw || {})}, now(), now()
      )
      RETURNING *
    `;

    await sql`
      UPDATE whatsapp_conversations
      SET 
        last_message = ${textPreview},
        last_message_preview = ${textPreview.slice(0, 150)},
        last_message_at = now(),
        status = 'open',
        updated_at = now()
      WHERE id = ${id}
    `;

    await sql`
      INSERT INTO whatsapp_audit_logs (admin_user_id, action, entity_type, entity_id, details, created_at)
      VALUES (${admin.id}, 'template.sent', 'conversation', ${id}, ${JSON.stringify({ templateName, language, recipientPhone })}, now())
    `;

    broadcastWhatsAppEvent("whatsapp.message.sent", {
      message: { ...savedMsg, sent_by_user_name: admin.name },
      conversationId: id,
    });

    return Response.json({ ok: true, message: savedMsg });
  } catch (error) {
    console.error("[whatsapp/templates POST] Fatal error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
