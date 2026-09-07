import sql from "@/app/api/utils/sql";
import { parseIncomingWebhook, getInfobipConfig } from "@/app/api/utils/infobipService";
import { normalizePhoneE164 } from "@/app/api/utils/phoneNormalizer";
import { broadcastWhatsAppEvent } from "@/app/api/utils/realtimeBroadcaster";

export async function GET(request) {
  return Response.json({
    ok: true,
    service: "Infobip WhatsApp Inbound Webhook",
    status: "active",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request) {
  try {
    const rawPayload = await request.json().catch(() => ({}));
    console.log("[infobip-inbound-webhook] Received payload:", JSON.stringify(rawPayload));

    // Optional webhook secret verification if configured
    const config = await getInfobipConfig();
    if (config.webhookSecret) {
      const authHeader = request.headers.get("x-infobip-signature") || 
                         request.headers.get("authorization") || 
                         request.headers.get("x-webhook-secret");
      if (authHeader && !authHeader.includes(config.webhookSecret)) {
        console.warn("[infobip-inbound-webhook] Invalid webhook secret");
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const messages = parseIncomingWebhook(rawPayload);
    if (messages.length === 0) {
      return Response.json({ ok: true, message: "No messages in payload" });
    }

    const processedResults = [];

    for (const item of messages) {
      const {
        messageId,
        senderE164,
        contactName,
        type,
        textContent,
        mediaUrl,
        mediaMimeType,
        mediaFilename,
        receivedAt,
        raw,
      } = item;

      if (!senderE164) {
        console.warn("[infobip-inbound-webhook] Skipped message with invalid sender phone:", item);
        continue;
      }

      // 1. Idempotency check: prevent duplicate message insertion
      const [existingMsg] = await sql`
        SELECT id FROM whatsapp_messages WHERE infobip_message_id = ${messageId} LIMIT 1
      `;
      if (existingMsg) {
        console.log(`[infobip-inbound-webhook] Message ${messageId} already processed. Skipping.`);
        processedResults.push({ messageId, status: "duplicate" });
        continue;
      }

      // 2. Find or create Contact
      let [contact] = await sql`
        SELECT id, name, phone_e164, customer_id, whatsapp_opt_in
        FROM whatsapp_contacts
        WHERE phone_e164 = ${senderE164}
        LIMIT 1
      `;

      if (!contact) {
        // Try linking to existing customer in auth_users
        const digitsOnly = senderE164.replace(/\D/g, "");
        const [linkedCustomer] = await sql`
          SELECT id, name, email 
          FROM auth_users 
          WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE '%' || ${digitsOnly.slice(-8)}
             OR phone = ${senderE164}
          LIMIT 1
        `;

        const nameToUse = contactName || linkedCustomer?.name || `WhatsApp ${senderE164.slice(-4)}`;
        const emailToUse = linkedCustomer?.email || null;
        const customerId = linkedCustomer?.id || null;

        [contact] = await sql`
          INSERT INTO whatsapp_contacts (
            name, phone_e164, email, customer_id, whatsapp_opt_in, whatsapp_opt_in_source, created_at, updated_at
          )
          VALUES (
            ${nameToUse}, ${senderE164}, ${emailToUse}, ${customerId}, false, 'inbound_message', now(), now()
          )
          RETURNING id, name, phone_e164, customer_id, whatsapp_opt_in
        `;
      } else if (contactName && (!contact.name || contact.name.startsWith("WhatsApp "))) {
        // Update contact name if provided by WhatsApp profile
        await sql`
          UPDATE whatsapp_contacts 
          SET name = ${contactName}, updated_at = now() 
          WHERE id = ${contact.id}
        `;
        contact.name = contactName;
      }

      // 3. Find or create Conversation
      // Match by contact_id or normalized phone
      let [conversation] = await sql`
        SELECT id, contact_id, status, assigned_user_id, unread_count
        FROM whatsapp_conversations
        WHERE contact_id = ${contact.id} 
           OR REPLACE(REPLACE(phone, ' ', ''), '+', '') = ${senderE164.replace('+', '')}
           OR phone = ${senderE164}
        LIMIT 1
      `;

      const now = new Date();
      let convId;

      if (!conversation) {
        convId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        [conversation] = await sql`
          INSERT INTO whatsapp_conversations (
            id, phone, customer_id, contact_id, last_message, last_message_at,
            last_customer_message_at, last_message_preview, unread_count,
            session_active, service_window_active, status, created_at, updated_at
          )
          VALUES (
            ${convId}, ${senderE164}, ${contact.customer_id}, ${contact.id},
            ${textContent}, ${now}, ${now}, ${textContent.slice(0, 150)}, 1,
            true, true, 'open', ${now}, ${now}
          )
          RETURNING *
        `;
      } else {
        convId = conversation.id;
        [conversation] = await sql`
          UPDATE whatsapp_conversations
          SET 
            contact_id = ${contact.id},
            phone = ${senderE164},
            last_message = ${textContent},
            last_message_preview = ${textContent.slice(0, 150)},
            last_message_at = ${now},
            last_customer_message_at = ${now},
            unread_count = COALESCE(unread_count, 0) + 1,
            session_active = true,
            service_window_active = true,
            status = 'open',
            updated_at = ${now}
          WHERE id = ${convId}
          RETURNING *
        `;
      }

      // 4. Save message in whatsapp_messages
      const [savedMessage] = await sql`
        INSERT INTO whatsapp_messages (
          conversation_id, contact_id, infobip_message_id, direction,
          message_type, text_content, media_url, media_mime_type, media_filename,
          status, raw_infobip_payload, created_at, updated_at
        )
        VALUES (
          ${convId}, ${contact.id}, ${messageId}, 'incoming',
          ${type}, ${textContent}, ${mediaUrl}, ${mediaMimeType}, ${mediaFilename},
          'delivered', ${JSON.stringify(raw)}, ${receivedAt}, now()
        )
        RETURNING *
      `;

      // 5. Broadcast Realtime SSE Events to staff
      broadcastWhatsAppEvent("whatsapp.message.received", {
        message: savedMessage,
        conversation,
        contact,
      });

      broadcastWhatsAppEvent("whatsapp.conversation.updated", conversation);

      processedResults.push({ messageId, status: "saved", conversationId: convId });
    }

    return Response.json({ ok: true, processed: processedResults });
  } catch (error) {
    console.error("[infobip-inbound-webhook] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
