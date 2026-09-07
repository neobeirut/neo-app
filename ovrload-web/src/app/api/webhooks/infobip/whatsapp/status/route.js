import sql from "@/app/api/utils/sql";
import { parseDeliveryWebhook } from "@/app/api/utils/infobipService";
import { broadcastWhatsAppEvent } from "@/app/api/utils/realtimeBroadcaster";

export async function GET(request) {
  return Response.json({
    ok: true,
    service: "Infobip WhatsApp Delivery Status Webhook",
    status: "active",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request) {
  try {
    const rawPayload = await request.json().catch(() => ({}));
    console.log("[infobip-status-webhook] Received payload:", JSON.stringify(rawPayload));

    const reports = parseDeliveryWebhook(rawPayload);
    if (reports.length === 0) {
      return Response.json({ ok: true, message: "No status reports in payload" });
    }

    const updated = [];

    for (const report of reports) {
      const {
        messageId,
        status,
        description,
        errorCode,
        errorMessage,
        doneAt,
      } = report;

      if (!messageId) continue;

      // 1. Update whatsapp_messages
      const [msg] = await sql`
        SELECT id, conversation_id, status FROM whatsapp_messages
        WHERE infobip_message_id = ${messageId}
        LIMIT 1
      `;

      if (msg) {
        const deliveredAt = status === "delivered" || status === "read" ? doneAt : null;
        const readAt = status === "read" ? doneAt : null;

        const [updatedMsg] = await sql`
          UPDATE whatsapp_messages
          SET 
            status = ${status},
            error_code = COALESCE(${errorCode ? String(errorCode) : null}, error_code),
            error_message = COALESCE(${errorMessage || (status === 'failed' ? description : null)}, error_message),
            delivered_at = COALESCE(${deliveredAt}, delivered_at),
            read_at = COALESCE(${readAt}, read_at),
            updated_at = now()
          WHERE id = ${msg.id}
          RETURNING *
        `;

        broadcastWhatsAppEvent("whatsapp.message.updated", {
          messageId,
          status,
          conversationId: msg.conversation_id,
          deliveredAt: updatedMsg.delivered_at,
          readAt: updatedMsg.read_at,
          error: updatedMsg.error_message,
        });

        updated.push({ messageId, status });
      }

      // 2. Also check if this message is a campaign recipient
      const [recipient] = await sql`
        SELECT id, campaign_id, status FROM whatsapp_campaign_recipients
        WHERE infobip_message_id = ${messageId}
        LIMIT 1
      `;

      if (recipient) {
        const deliveredAt = status === "delivered" || status === "read" ? doneAt : null;
        const readAt = status === "read" ? doneAt : null;

        await sql`
          UPDATE whatsapp_campaign_recipients
          SET 
            status = ${status},
            error_code = ${errorCode ? String(errorCode) : null},
            error_message = ${errorMessage || (status === 'failed' ? description : null)},
            delivered_at = COALESCE(${deliveredAt}, delivered_at),
            read_at = COALESCE(${readAt}, read_at)
          WHERE id = ${recipient.id}
        `;

        // Update campaign counters
        await sql`
          UPDATE whatsapp_campaigns
          SET 
            delivered_count = (SELECT COUNT(*) FROM whatsapp_campaign_recipients WHERE campaign_id = ${recipient.campaign_id} AND status IN ('delivered', 'read')),
            read_count = (SELECT COUNT(*) FROM whatsapp_campaign_recipients WHERE campaign_id = ${recipient.campaign_id} AND status = 'read'),
            failed_count = (SELECT COUNT(*) FROM whatsapp_campaign_recipients WHERE campaign_id = ${recipient.campaign_id} AND status = 'failed'),
            updated_at = now()
          WHERE id = ${recipient.campaign_id}
        `;
      }
    }

    return Response.json({ ok: true, updatedCount: updated.length });
  } catch (error) {
    console.error("[infobip-status-webhook] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
