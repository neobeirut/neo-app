import sql from "@/app/api/utils/sql";
import {
  markWhatsAppSessionActive,
  logWhatsAppMessage,
  parseRatingFromMessage,
  saveFeedback,
  sendWhatsAppFreeForm,
  normalizePhone,
} from "@/app/api/utils/customerWhatsApp";
import { broadcastWhatsAppEvent } from "@/app/api/utils/realtimeBroadcaster";
import { normalizePhoneE164 } from "@/app/api/utils/phoneNormalizer";

/**
 * Workflow 2: Receive WhatsApp Replies (Webhook)
 *
 * This webhook receives inbound WhatsApp messages from Infobip and:
 * 1. Marks the customer's WhatsApp session as active (24h window)
 * 2. Links the message to their latest active order
 * 3. Creates/updates conversation thread
 * 4. Parses ratings if it's a feedback response
 * 5. Saves conversation history
 * 6. Notifies admins for low ratings or important messages
 *
 * POST /api/webhooks/whatsapp/inbound
 *
 * ─── Infobip inbound webhook payload shape ─────────────────────────────────
 * {
 *   "results": [
 *     {
 *       "from": "+9611234567",          ← sender phone (E.164)
 *       "to": "96176489078",            ← your WA number
 *       "integrationType": "WHATSAPP",
 *       "receivedAt": "2024-01-01T00:00:00.000+0000",
 *       "messageId": "ABEGe4iX5oWGAgo-sJwNhpcc95Q",
 *       "message": {
 *         "type": "TEXT",
 *         "text": "Hello"               ← message body
 *       },
 *       "contact": { "name": "Customer Name" }
 *     }
 *   ],
 *   "messageCount": 1,
 *   "pendingMessageCount": 0
 * }
 * ───────────────────────────────────────────────────────────────────────────
 */
export async function POST(request) {
  try {
    // ── 1. Parse raw body ────────────────────────────────────────────────────
    const rawPayload = await request.json().catch(() => ({}));

    console.log("============================================");
    console.log("[whatsapp-webhook] 📥 RAW INFOBIP PAYLOAD:");
    console.log(JSON.stringify(rawPayload, null, 2));
    console.log("============================================");

    // Store raw payload for debugging
    await sql`
      INSERT INTO customer_whatsapp_messages (
        user_id, order_id, phone, direction, message_type,
        message_text, status, created_at
      )
      VALUES (
        NULL, NULL, 'DEBUG', 'inbound', 'debug_raw_payload',
        ${JSON.stringify(rawPayload, null, 2)}, 'received', now()
      )
    `.catch((e) => console.error("Failed to log debug payload:", e));

    // ── 2. Extract the first result from Infobip's results[] array ───────────
    // Infobip always wraps messages in a "results" array.
    // Fall back to treating the root object as a single message for compatibility.
    const results = Array.isArray(rawPayload.results)
      ? rawPayload.results
      : [rawPayload];

    if (results.length === 0) {
      console.log("[whatsapp-webhook] ⚠ Empty results array — nothing to do");
      return Response.json({ ok: true, message: "No results in payload" });
    }

    // Process all results (usually just one)
    const processingResults = [];
    for (const result of results) {
      const processed = await processInboundMessage(result);
      processingResults.push(processed);
    }

    return Response.json({ ok: true, processed: processingResults.length });
  } catch (error) {
    console.error("[whatsapp-webhook] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}

/**
 * Process a single inbound message result from Infobip.
 * @param {object} result - One item from results[]
 */
async function processInboundMessage(result) {
  // ── Extract fields using Infobip format ───────────────────────────────────
  let fromPhone = null;
  let messageText = null;
  let timestamp = null;
  let infobipMessageId = null;

  // ── Phone: Infobip puts it directly at result.from ────────────────────────
  if (result.from) {
    fromPhone = String(result.from).trim();
    console.log("[whatsapp-webhook] ✓ Phone from result.from:", fromPhone);
  } else {
    // Fallback: old Bird paths (kept for migration safety)
    fromPhone =
      result.sender?.contact?.identifierValue ||
      result.sender?.identifierValue ||
      null;
    if (fromPhone) {
      console.log("[whatsapp-webhook] ✓ Phone from Bird fallback:", fromPhone);
    } else {
      console.log(
        "[whatsapp-webhook] ✗ Could not find phone. Keys:",
        Object.keys(result),
      );
    }
  }

  // ── Message text: Infobip puts it at result.message.text ─────────────────
  if (result.message?.text) {
    messageText = result.message.text;
    console.log(
      "[whatsapp-webhook] ✓ Message from result.message.text:",
      messageText,
    );
  } else if (result.message?.caption) {
    // Image/video captions
    messageText = result.message.caption;
    console.log(
      "[whatsapp-webhook] ✓ Message from result.message.caption:",
      messageText,
    );
  } else if (result.message?.type && result.message.type !== "TEXT") {
    // Non-text message types: audio, image, video, etc.
    messageText = `[${result.message.type} message]`;
    console.log(
      "[whatsapp-webhook] ✓ Non-text message type:",
      result.message.type,
    );
  } else {
    // Bird fallbacks (kept for migration safety)
    messageText =
      result.body?.text?.text ||
      result.message?.text?.text ||
      result.body?.text ||
      result.text ||
      null;
    if (messageText) {
      console.log(
        "[whatsapp-webhook] ✓ Message from Bird fallback:",
        messageText,
      );
    } else {
      console.log(
        "[whatsapp-webhook] ✗ Could not find message text. message obj:",
        JSON.stringify(result.message || {}, null, 2),
      );
    }
  }

  // ── Timestamp: Infobip uses result.receivedAt ─────────────────────────────
  if (result.receivedAt) {
    timestamp = new Date(result.receivedAt);
    console.log(
      "[whatsapp-webhook] ✓ Timestamp from result.receivedAt:",
      timestamp,
    );
  } else if (result.createdAt) {
    timestamp = new Date(result.createdAt);
  } else if (result.timestamp) {
    timestamp = new Date(result.timestamp);
  } else {
    timestamp = new Date();
    console.log("[whatsapp-webhook] ⚠ Using current time as timestamp");
  }

  // ── Message ID: Infobip uses result.messageId ─────────────────────────────
  infobipMessageId = result.messageId || result.id || null;

  console.log("[whatsapp-webhook] 📋 PARSED VALUES:");
  console.log("  Phone:", fromPhone);
  console.log("  Message:", messageText);
  console.log("  Timestamp:", timestamp);
  console.log("  Infobip Message ID:", infobipMessageId);

  if (!fromPhone || !messageText) {
    console.error("[whatsapp-webhook] ❌ Missing required fields:", {
      fromPhone,
      messageText,
    });
    return {
      ok: false,
      error: "Missing phone or message text",
      fromPhone,
      messageText,
    };
  }

  console.log(
    `[whatsapp-webhook] ✅ Parsed — From: ${fromPhone}, Message: "${messageText}"`,
  );

  // ── Location Detection (Native Infobip location object or Google Maps URL in text) ──
  let detectedLat = null;
  let detectedLng = null;
  let detectedAddress = null;
  let detectedUrl = null;

  if (result.message?.type === "LOCATION" || result.message?.location) {
    const locObj = result.message?.location || result.message || {};
    detectedLat = locObj.latitude !== undefined ? parseFloat(locObj.latitude) : null;
    detectedLng = locObj.longitude !== undefined ? parseFloat(locObj.longitude) : null;
    detectedAddress = locObj.address || locObj.name || null;
    detectedUrl = locObj.url || (detectedLat && detectedLng ? `https://maps.google.com/?q=${detectedLat},${detectedLng}` : null);
    if (!messageText || messageText === "[LOCATION message]") {
      messageText = `📍 Shared Location: ${detectedAddress || (detectedLat && detectedLng ? `${detectedLat}, ${detectedLng}` : "Pinned Location")}`;
    }
  } else if (messageText && typeof messageText === "string") {
    // Check for Google Maps URLs or coordinates in text
    const coordsMatch = messageText.match(/(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/) ||
                        messageText.match(/[?&]q=(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/) ||
                        messageText.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
    if (coordsMatch) {
      detectedLat = parseFloat(coordsMatch[1]);
      detectedLng = parseFloat(coordsMatch[2]);
      detectedUrl = `https://maps.google.com/?q=${detectedLat},${detectedLng}`;
    } else if (messageText.includes("maps.app.goo.gl") || messageText.includes("goo.gl/maps")) {
      const urlMatch = messageText.match(/https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\/[^\s]+/);
      if (urlMatch) {
        detectedUrl = urlMatch[0];
        try {
          const headRes = await fetch(detectedUrl, { method: "HEAD", redirect: "follow" });
          const finalUrl = headRes.url;
          const finalMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || finalUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (finalMatch) {
            detectedLat = parseFloat(finalMatch[1]);
            detectedLng = parseFloat(finalMatch[2]);
          }
        } catch (e) {
          console.warn("[whatsapp-webhook] Failed to resolve shortened map link:", e.message);
        }
      }
    }
  }

  if (detectedLat || detectedUrl) {
    console.log(`[whatsapp-webhook] 📍 Location detected from ${fromPhone}: Lat=${detectedLat}, Lng=${detectedLng}, URL=${detectedUrl}`);
  }

  // Normalize the phone number for consistent matching
  const normalizedPhone = normalizePhone(fromPhone);

  // ── Unified WhatsApp Module Message Pipeline ─────────────────────────────
  let unifiedContact = null;
  let unifiedConversation = null;

  try {
    const senderE164 = normalizePhoneE164(fromPhone);
    const contactProfileName = result.contact?.name || result.sender?.name || null;

    // 1. Find or create Contact in whatsapp_contacts
    let [existingContact] = await sql`
      SELECT id, name, phone_e164, customer_id, whatsapp_opt_in
      FROM whatsapp_contacts
      WHERE phone_e164 = ${senderE164}
      LIMIT 1
    `;

    if (!existingContact) {
      const digitsOnly = senderE164.replace(/\D/g, "");
      const [linkedCustomer] = await sql`
        SELECT id, name, email 
        FROM auth_users 
        WHERE REPLACE(REPLACE(phone, ' ', ''), '+', '') LIKE '%' || ${digitsOnly.slice(-8)}
           OR phone = ${senderE164}
        LIMIT 1
      `;

      const nameToUse = contactProfileName || linkedCustomer?.name || `WhatsApp ${senderE164.slice(-4)}`;
      const emailToUse = linkedCustomer?.email || null;
      const customerId = linkedCustomer?.id || null;

      [existingContact] = await sql`
        INSERT INTO whatsapp_contacts (
          name, phone_e164, email, customer_id, whatsapp_opt_in, whatsapp_opt_in_source, created_at, updated_at
        )
        VALUES (
          ${nameToUse}, ${senderE164}, ${emailToUse}, ${customerId}, false, 'inbound_message', now(), now()
        )
        RETURNING id, name, phone_e164, customer_id, whatsapp_opt_in
      `;
    } else if (contactProfileName && (!existingContact.name || existingContact.name.startsWith("WhatsApp "))) {
      await sql`
        UPDATE whatsapp_contacts 
        SET name = ${contactProfileName}, updated_at = now() 
        WHERE id = ${existingContact.id}
      `;
      existingContact.name = contactProfileName;
    }
    unifiedContact = existingContact;

    // 2. Find or create Unified Conversation
    let [convRow] = await sql`
      SELECT id, contact_id, status, assigned_user_id, unread_count
      FROM whatsapp_conversations
      WHERE contact_id = ${unifiedContact.id} 
         OR phone = ${fromPhone}
         OR phone = ${senderE164}
         OR REPLACE(REPLACE(phone, ' ', ''), '+', '') = ${senderE164.replace('+', '')}
      LIMIT 1
    `;

    const now = new Date();
    let convId;

    if (!convRow) {
      convId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      [convRow] = await sql`
        INSERT INTO whatsapp_conversations (
          id, phone, customer_id, contact_id, last_message, last_message_at,
          last_customer_message_at, last_message_preview, unread_count,
          session_active, service_window_active, status, created_at, updated_at
        )
        VALUES (
          ${convId}, ${senderE164}, ${unifiedContact.customer_id}, ${unifiedContact.id},
          ${messageText}, ${now}, ${now}, ${messageText.slice(0, 150)}, 1,
          true, true, 'open', ${now}, ${now}
        )
        RETURNING *
      `;
    } else {
      convId = convRow.id;
      [convRow] = await sql`
        UPDATE whatsapp_conversations
        SET 
          contact_id = COALESCE(${unifiedContact.id}, contact_id),
          last_message = ${messageText},
          last_message_preview = ${messageText.slice(0, 150)},
          last_message_at = ${now},
          last_customer_message_at = ${now},
          unread_count = COALESCE(unread_count, 0) + 1,
          session_active = true,
          service_window_active = true,
          status = 'open',
          latest_location_lat = COALESCE(${detectedLat}, latest_location_lat),
          latest_location_lng = COALESCE(${detectedLng}, latest_location_lng),
          latest_location_address = COALESCE(${detectedAddress}, latest_location_address),
          latest_location_url = COALESCE(${detectedUrl}, latest_location_url),
          latest_location_at = CASE WHEN ${detectedLat}::numeric IS NOT NULL OR ${detectedUrl}::text IS NOT NULL THEN ${timestamp} ELSE latest_location_at END,
          updated_at = ${now}
        WHERE id = ${convId}
        RETURNING *
      `;
    }
    unifiedConversation = convRow;

    // 3. Save message in whatsapp_messages
    const [savedMessage] = await sql`
      INSERT INTO whatsapp_messages (
        conversation_id, contact_id, infobip_message_id, direction,
        message_type, text_content, media_url,
        status, raw_infobip_payload, created_at, updated_at
      )
      VALUES (
        ${convId}, ${unifiedContact.id}, ${infobipMessageId}, 'incoming',
        'text', ${messageText}, ${detectedUrl || null},
        'delivered', ${JSON.stringify(result)}, ${timestamp}, now()
      )
      ON CONFLICT (infobip_message_id) DO NOTHING
      RETURNING *
    `;

    // 4. Broadcast Realtime SSE Events to staff UI
    if (savedMessage) {
      broadcastWhatsAppEvent("whatsapp.message.received", {
        message: savedMessage,
        conversation: unifiedConversation,
        contact: unifiedContact,
      });
      broadcastWhatsAppEvent("whatsapp.conversation.updated", unifiedConversation);
    }
  } catch (unifiedErr) {
    console.error("[whatsapp-webhook] Unified pipeline error:", unifiedErr);
  }

  // ── Find customer by phone ────────────────────────────────────────────────
  const [customer] = await sql`
    SELECT id, name, phone
    FROM auth_users
    WHERE REPLACE(phone, ' ', '') = ${normalizedPhone}
       OR phone = ${fromPhone}
    LIMIT 1
  `;

  if (!customer) {
    console.log(
      `[whatsapp-webhook] Customer not found for phone: ${fromPhone}`,
    );

    // Log anyway for debugging
    await sql`
      INSERT INTO customer_whatsapp_messages (
        user_id, order_id, phone, direction, message_type,
        message_text, bird_message_id, status, created_at
      )
      VALUES (
        NULL, NULL, ${fromPhone}, 'inbound', 'customer_reply',
        ${messageText}, ${infobipMessageId}, 'received', now()
      )
    `;

    // Still upsert a conversation entry so it shows in the inbox
    await sql`
      INSERT INTO whatsapp_conversations (
        phone, customer_id, last_message, last_message_at,
        order_id, branch_id, branch_ids, unread_count, session_active,
        latest_location_lat, latest_location_lng, latest_location_address,
        latest_location_url, latest_location_at
      )
      VALUES (
        ${fromPhone}, NULL, ${messageText}, ${timestamp},
        NULL, NULL, '{}', 1, true,
        ${detectedLat}, ${detectedLng}, ${detectedAddress},
        ${detectedUrl}, ${detectedLat || detectedUrl ? timestamp : null}
      )
      ON CONFLICT (phone)
      DO UPDATE SET
        last_message = ${messageText},
        last_message_at = ${timestamp},
        unread_count = whatsapp_conversations.unread_count + 1,
        session_active = true,
        latest_location_lat = COALESCE(${detectedLat}, whatsapp_conversations.latest_location_lat),
        latest_location_lng = COALESCE(${detectedLng}, whatsapp_conversations.latest_location_lng),
        latest_location_address = COALESCE(${detectedAddress}, whatsapp_conversations.latest_location_address),
        latest_location_url = COALESCE(${detectedUrl}, whatsapp_conversations.latest_location_url),
        latest_location_at = CASE WHEN ${detectedLat}::numeric IS NOT NULL OR ${detectedUrl}::text IS NOT NULL THEN ${timestamp} ELSE whatsapp_conversations.latest_location_at END,
        updated_at = now()
    `;

    return { ok: true, message: "Customer not found, message logged" };
  }

  console.log(
    `[whatsapp-webhook] Customer found: ${customer.name} (ID: ${customer.id})`,
  );

  // Mark session active
  await markWhatsAppSessionActive(customer.id);

  // Link to latest active order
  const [order] = await sql`
    SELECT id, status, branch_id, created_at, order_type
    FROM orders
    WHERE user_id = ${customer.id}
      AND status IN ('pending', 'preparing', 'ready', 'out_for_delivery')
      AND created_at > now() - interval '24 hours'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const orderId = order?.id || null;
  const branchId = order?.branch_id || null;

  console.log(
    `[whatsapp-webhook] Linked to order: ${orderId || "none"} (status: ${order?.status || "n/a"})`,
  );

  // Get all branches where this customer has recent orders (last 30 days)
  const branchRows = await sql`
    SELECT DISTINCT branch_id
    FROM orders
    WHERE user_id = ${customer.id}
      AND branch_id IS NOT NULL
      AND created_at > now() - interval '30 days'
    ORDER BY branch_id
  `;

  const branchIds = branchRows.map((row) => row.branch_id);

  const [userBranch] = await sql`
    SELECT branch_id
    FROM auth_users
    WHERE id = ${customer.id}
      AND branch_id IS NOT NULL
    LIMIT 1
  `;

  if (userBranch?.branch_id && !branchIds.includes(userBranch.branch_id)) {
    branchIds.push(userBranch.branch_id);
  }

  if (branchIds.length === 0 && branchId) {
    branchIds.push(branchId);
  }

  console.log(
    `[whatsapp-webhook] Conversation visible to branches: ${branchIds.length > 0 ? branchIds.join(", ") : "HQ only"}`,
  );

  // Upsert conversation
  await sql`
    INSERT INTO whatsapp_conversations (
      phone, customer_id, last_message, last_message_at,
      order_id, branch_id, branch_ids, unread_count, session_active,
      latest_location_lat, latest_location_lng, latest_location_address,
      latest_location_url, latest_location_at
    )
    VALUES (
      ${fromPhone}, ${customer.id}, ${messageText}, ${timestamp},
      ${orderId}, ${branchId}, ${branchIds}, 1, true,
      ${detectedLat}, ${detectedLng}, ${detectedAddress},
      ${detectedUrl}, ${detectedLat || detectedUrl ? timestamp : null}
    )
    ON CONFLICT (phone)
    DO UPDATE SET
      last_message = ${messageText},
      last_message_at = ${timestamp},
      order_id = COALESCE(${orderId}, whatsapp_conversations.order_id),
      branch_id = COALESCE(${branchId}, whatsapp_conversations.branch_id),
      branch_ids = ${branchIds},
      unread_count = whatsapp_conversations.unread_count + 1,
      session_active = true,
      latest_location_lat = COALESCE(${detectedLat}, whatsapp_conversations.latest_location_lat),
      latest_location_lng = COALESCE(${detectedLng}, whatsapp_conversations.latest_location_lng),
      latest_location_address = COALESCE(${detectedAddress}, whatsapp_conversations.latest_location_address),
      latest_location_url = COALESCE(${detectedUrl}, whatsapp_conversations.latest_location_url),
      latest_location_at = CASE WHEN ${detectedLat}::numeric IS NOT NULL OR ${detectedUrl}::text IS NOT NULL THEN ${timestamp} ELSE whatsapp_conversations.latest_location_at END,
      updated_at = now()
  `;

  console.log(`[whatsapp-webhook] Conversation updated for ${fromPhone}`);

  // Check if this is a rating response (1-5)
  const rating = parseRatingFromMessage(messageText);

  if (rating && orderId) {
    console.log(
      `[whatsapp-webhook] Parsed rating: ${rating} for order ${orderId}`,
    );

    await saveFeedback({
      orderId,
      userId: customer.id,
      rating,
      feedbackText: messageText,
      source: "whatsapp",
    });

    if (rating <= 3) {
      console.log(
        `[whatsapp-webhook] LOW RATING ALERT: ${rating}/5 for order ${orderId}`,
      );

      await sql`
        INSERT INTO customer_whatsapp_messages (
          user_id, order_id, phone, direction, message_type,
          message_text, bird_message_id, status, created_at
        )
        VALUES (
          ${customer.id}, ${orderId}, ${fromPhone}, 'inbound', 'customer_reply',
          ${`⚠️ LOW RATING (${rating}/5): ${messageText}`}, ${infobipMessageId}, 'received', now()
        )
      `;

      try {
        await sendWhatsAppFreeForm(
          fromPhone,
          `Thank you for your feedback. We're sorry to hear your experience wasn't perfect. A manager will review this and reach out if needed.`,
        );
      } catch (e) {
        console.error("[whatsapp-webhook] Failed to send acknowledgment:", e);
      }
    } else {
      try {
        await sendWhatsAppFreeForm(
          fromPhone,
          `Thank you so much for the ${rating}-star rating! 🙏 We're glad you enjoyed your order.`,
        );
      } catch (e) {
        console.error("[whatsapp-webhook] Failed to send acknowledgment:", e);
      }
    }
  }

  // Log the inbound message
  await logWhatsAppMessage({
    userId: customer.id,
    orderId,
    phone: fromPhone,
    direction: "inbound",
    messageType: "customer_reply",
    messageText,
    templateName: null,
    birdMessageId: infobipMessageId, // column kept for backwards compat
    status: "received",
    error: null,
  });

  // Auto-reply for status inquiries
  const lowerText = messageText.toLowerCase();
  if (
    order &&
    (lowerText.includes("where") ||
      lowerText.includes("status") ||
      lowerText.includes("when") ||
      lowerText.includes("location"))
  ) {
    const [branch] = await sql`
      SELECT name, address, phone
      FROM branches
      WHERE id = ${order.branch_id}
      LIMIT 1
    `;

    const statusMessages = {
      pending: "Your order has been received and will be prepared soon.",
      preparing: "Your order is currently being prepared.",
      ready:
        order.order_type === "pickup"
          ? `Your order is ready for pickup at ${branch?.name || "our branch"}.`
          : "Your order is ready and will be delivered soon.",
      out_for_delivery: "Your order is currently out for delivery.",
    };

    const autoReply =
      statusMessages[order.status] || "Your order is being processed.";

    try {
      await sendWhatsAppFreeForm(fromPhone, autoReply);
      console.log(`[whatsapp-webhook] Sent auto-reply for status inquiry`);
    } catch (e) {
      console.error("[whatsapp-webhook] Failed to send auto-reply:", e);
    }
  }

  return { ok: true, customerId: customer.id, orderId };
}

/**
 * GET — Webhook verification endpoint
 * Infobip verifies by sending a GET with a challenge in the query string
 * or simply checking that the URL returns HTTP 200.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("challenge");

  if (challenge) {
    console.log(
      "[whatsapp-webhook] Verification challenge received:",
      challenge,
    );
    return new Response(challenge, { status: 200 });
  }

  return Response.json({
    ok: true,
    message: "Infobip WhatsApp webhook endpoint is active",
    provider: "Infobip",
  });
}
