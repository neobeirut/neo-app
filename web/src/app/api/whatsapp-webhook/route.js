import sql from "@/app/api/utils/sql";
import {
  isOverloadClosed,
  hasAutoReplyBeenSent,
  recordAutoReplySent,
  sendClosedAutoReply,
  normalizePhoneForInfobip,
} from "@/app/api/utils/whatsappAfterHours";

/**
 * Infobip WhatsApp Inbound Webhook & After-Hours Auto-Reply Handler
 *
 * Endpoint: POST /api/whatsapp-webhook
 *
 * Opening Hours (Asia/Beirut):
 * - Monday–Saturday: 12:00 PM to 11:00 PM (12:00 - 22:59)
 * - Sunday: CLOSED all day
 *
 * Automatically replies with OVRLOAD closed message during off-hours,
 * with per-closed-period duplicate protection.
 */
export async function POST(request) {
  const receiveTimestamp = new Date();

  // Safely parse incoming JSON request body
  let rawPayload = null;
  try {
    rawPayload = await request.json();
  } catch (parseError) {
    console.warn("[whatsapp-webhook] Failed to parse JSON request body:", parseError?.message);
    return Response.json(
      { ok: true, message: "Invalid or empty JSON payload received" },
      { status: 200 }
    );
  }

  try {
    // Infobip forwards messages in a results[] array or single object
    const results = Array.isArray(rawPayload?.results)
      ? rawPayload.results
      : (rawPayload && (rawPayload.from || rawPayload.message || rawPayload.sender))
        ? [rawPayload]
        : [];

    if (results.length === 0) {
      console.log("[whatsapp-webhook] Webhook received with no message items in payload.");
      return Response.json({ ok: true, message: "No messages to process" }, { status: 200 });
    }

    const { isClosed, isForceClosed, beirutInfo } = isOverloadClosed(receiveTimestamp);

    console.log("==================================================================");
    console.log(`[whatsapp-webhook] Inbound Webhook Received (${results.length} item(s))`);
    console.log(`[whatsapp-webhook] Current Beirut Day & Time: ${beirutInfo.formatted}`);
    console.log(`[whatsapp-webhook] OVRLOAD Status: ${isClosed ? "CLOSED" : "OPEN"} (forced: ${isForceClosed})`);
    console.log("==================================================================");

    for (const item of results) {
      // Safely extract customer sender number
      const fromRaw =
        item.from ||
        item.sender?.contact?.identifierValue ||
        item.sender?.identifierValue ||
        item.sender ||
        null;

      // Safely extract destination number
      const toRaw =
        item.to ||
        item.destination ||
        item.recipient ||
        process.env.INFOBIP_WHATSAPP_SENDER ||
        "96181202607";

      // Safely extract inbound message info
      const messageText =
        item.message?.text ||
        item.message?.caption ||
        (item.message?.type && item.message.type !== "TEXT" ? `[${item.message.type} message]` : "") ||
        item.text ||
        item.body ||
        "";

      const infobipMessageId = item.messageId || item.id || null;

      if (!fromRaw) {
        console.log("[whatsapp-webhook] Inbound message has no valid sender number, safely skipping item.");
        continue;
      }

      const senderNumber = normalizePhoneForInfobip(fromRaw);
      const destinationNumber = normalizePhoneForInfobip(toRaw);

      console.log(`[whatsapp-webhook] Message Details -> Sender: ${senderNumber}, Destination: ${destinationNumber}, Message ID: ${infobipMessageId || "N/A"}`);

      // Log inbound message to customer_whatsapp_messages / conversations if database exists
      if (process.env.DATABASE_URL) {
        try {
          await sql`
            INSERT INTO customer_whatsapp_messages (
              user_id, order_id, phone, direction, message_type,
              message_text, bird_message_id, status, created_at
            )
            VALUES (
              NULL, NULL, ${senderNumber}, 'inbound', 'customer_message',
              ${messageText}, ${infobipMessageId}, 'received', now()
            )
          `.catch((err) => console.warn("[whatsapp-webhook] Non-critical DB log warning:", err.message));
        } catch (dbErr) {
          console.warn("[whatsapp-webhook] DB log skipped:", dbErr?.message);
        }
      }

      // Handle after-hours auto-reply logic
      if (isClosed) {
        const alreadySent = await hasAutoReplyBeenSent(senderNumber, beirutInfo.periodId);

        if (alreadySent) {
          console.log(`[whatsapp-webhook] Closed auto-reply ALREADY sent to ${senderNumber} for period (${beirutInfo.periodId}). Duplicate suppressed.`);
        } else {
          console.log(`[whatsapp-webhook] OVRLOAD is closed. Sending auto-reply to ${senderNumber} for period (${beirutInfo.periodId})...`);
          try {
            const sendResult = await sendClosedAutoReply(senderNumber);
            if (sendResult?.ok) {
              await recordAutoReplySent(senderNumber, beirutInfo.periodId);
              console.log(`[whatsapp-webhook] Successfully sent closed auto-reply to ${senderNumber}. Outbound Message ID: ${sendResult.messageId || "N/A"}`);
            } else if (sendResult?.skipped) {
              console.log(`[whatsapp-webhook] Auto-reply skipped: ${sendResult.reason}`);
            }
          } catch (sendError) {
            console.error(`[whatsapp-webhook] Failed to send outbound WhatsApp reply to ${senderNumber}:`, sendError?.message || sendError);
          }
        }
      } else {
        console.log(`[whatsapp-webhook] OVRLOAD is currently OPEN (${beirutInfo.formatted}). Inbound message received; no closed auto-reply sent.`);
      }
    }

    return Response.json(
      {
        ok: true,
        message: "Webhook processed successfully",
        beirutTime: beirutInfo.formatted,
        status: isClosed ? "closed" : "open",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[whatsapp-webhook] Unhandled webhook processing error:", error?.message || error);
    // Return 200 OK so Infobip acknowledges webhook delivery and does not endlessly retry failed payloads
    return Response.json(
      { ok: true, warning: "Processed with non-fatal handler warning" },
      { status: 200 }
    );
  }
}

/**
 * Verification & Status Endpoint (GET /api/whatsapp-webhook)
 * Handles Infobip verification challenges and health status queries.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("challenge");

  if (challenge) {
    console.log("[whatsapp-webhook] Verification challenge received:", challenge);
    return new Response(challenge, { status: 200 });
  }

  const { isClosed, isForceClosed, beirutInfo } = isOverloadClosed();

  return Response.json({
    ok: true,
    service: "OVRLOAD WhatsApp Webhook",
    endpoint: "/api/whatsapp-webhook",
    beirutTime: beirutInfo.formatted,
    status: isClosed ? "closed" : "open",
    forceClosed: isForceClosed,
    currentClosedPeriod: beirutInfo.periodId,
    businessHours: "Monday–Saturday 12:00 PM – 11:00 PM (Asia/Beirut), Sunday Closed",
  });
}
