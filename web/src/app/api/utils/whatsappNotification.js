import sql from "./sql";
import {
  toLebanonE164,
  isWhatsAppSessionActive,
  getStatusMessageFreeForm,
  sendWhatsAppFreeForm,
  sendWhatsAppPayload,
  logWhatsAppMessage,
} from "./customerWhatsApp";
import { buildTemplatePayloadFromStatus } from "./whatsappTemplateRegistry";

/**
 * 🔒 CRITICAL CONSTANT - FORCED WHATSAPP SENDER
 *
 * ALWAYS use this sender for ALL WhatsApp sends (no branch overrides)
 *
 * Infobip code 375 = sender not provisioned/blocked for account
 * Different branches were using different senders:
 * - ✅ Success: 96176489078 (provisioned)
 * - ❌ Failure: +96171898641 (not provisioned, causes error 375)
 *
 * Solution: FORCE all sends to use ONLY the provisioned sender
 */
const FORCED_WHATSAPP_SENDER = "96176489078";

/**
 * Validate sender phone number before sending
 * Throws error if sender doesn't match the forced sender
 */
function validateWhatsAppSender(fromPhone) {
  const normalized = String(fromPhone || "")
    .replace(/^\+/, "")
    .trim();

  if (normalized !== FORCED_WHATSAPP_SENDER) {
    throw new Error(
      `❌ INVALID WHATSAPP SENDER BLOCKED: "${fromPhone}"\n` +
        `   Expected: ${FORCED_WHATSAPP_SENDER}\n` +
        `   Got: ${normalized}\n` +
        `   This sender is not provisioned in Infobip (error 375).\n` +
        `   ALL WhatsApp sends MUST use the forced sender: ${FORCED_WHATSAPP_SENDER}`,
    );
  }

  console.log(
    `[sender-validation] ✅ Sender validated: ${FORCED_WHATSAPP_SENDER}`,
  );
  return FORCED_WHATSAPP_SENDER;
}

/**
 * Shared logic for sending WhatsApp notifications
 * Can be called directly from backend code without HTTP
 */
export async function sendWhatsAppNotification(orderId, newStatus) {
  console.log(
    `[whatsapp-notification] ==================== START ====================`,
  );
  console.log(`[whatsapp-notification] Order ${orderId}, Status: ${newStatus}`);

  try {
    // Load order
    const [order] = await sql`
      SELECT 
        o.id,
        o.user_id,
        o.branch_id,
        o.status,
        o.order_type,
        o.created_at,
        o.last_whatsapp_sent_at,
        o.whatsapp_notification_count,
        b.name as branch_name
      FROM orders o
      LEFT JOIN branches b ON b.id = o.branch_id
      WHERE o.id = ${Number(orderId)}
      LIMIT 1
    `;

    if (!order) {
      return {
        ok: false,
        error: "Order not found",
        skipped: true,
      };
    }

    // Load customer
    const [customer] = await sql`
      SELECT 
        id,
        name,
        phone,
        whatsapp_opt_in,
        last_whatsapp_inbound_at,
        push_token
      FROM auth_users
      WHERE id = ${order.user_id}
      LIMIT 1
    `;

    if (!customer) {
      return {
        ok: false,
        error: "Customer not found",
        skipped: true,
      };
    }

    // Guardrails - Check if customer has phone
    if (!customer.phone) {
      return {
        ok: false,
        error: "Customer has no phone number",
        skipped: true,
      };
    }

    // Guardrails - Check WhatsApp opt-in
    if (customer.whatsapp_opt_in === false) {
      return {
        ok: false,
        error: "Customer opted out of WhatsApp",
        skipped: true,
        shouldUsePush: !!customer.push_token,
      };
    }

    // Normalize and validate phone number
    let customerPhone;
    try {
      customerPhone = toLebanonE164(customer.phone);
      console.log(
        `[whatsapp-notification] Phone normalized to: ${customerPhone}`,
      );
    } catch (error) {
      return {
        ok: false,
        error: `Invalid phone number: ${error.message}`,
      };
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 🔒 CRITICAL FIX: FORCE SENDER TO PROVISIONED NUMBER (NO BRANCH OVERRIDE)
    // ════════════════════════════════════════════════════════════════════════════
    //
    // BEFORE: Branch-specific sender could override env var
    //   const fromPhone = order.branch_whatsapp_phone || process.env.INFOBIP_WHATSAPP_SENDER;
    //
    // PROBLEM: Some branches used +96171898641 (not provisioned → error 375)
    //
    // AFTER: ALWAYS use forced sender (96176489078)
    //   const fromPhone = FORCED_WHATSAPP_SENDER;
    //
    // ════════════════════════════════════════════════════════════════════════════

    const fromPhone = FORCED_WHATSAPP_SENDER;

    console.log(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║ 🔒 FORCED WHATSAPP SENDER (NO BRANCH OVERRIDE)                 ║",
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(`║ Sender:                ${fromPhone.padEnd(39)}║`);
    console.log(
      `║ Source:                Forced constant                         ║`,
    );
    console.log(
      `║ Branch override:       DISABLED (prevents error 375)           ║`,
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝",
    );

    // Runtime assertion: validate sender before any send
    validateWhatsAppSender(fromPhone);

    // Determine if we should use template (24h session check)
    const sessionActive = await isWhatsAppSessionActive(customer.id);
    const useTemplate = !sessionActive;

    console.log(
      `[whatsapp-notification] Session active=${sessionActive}, useTemplate=${useTemplate}`,
    );

    // Build message text (for free-form)
    const messageText = getStatusMessageFreeForm(
      newStatus,
      order.order_type,
      order.branch_name,
    );

    let birdMessageId = null;
    let error = null;
    let templateName = null;
    let debugData = null;

    try {
      if (useTemplate) {
        // ═══════════════════════════════════════════════════════════════
        // TEMPLATE PATH - FULLY TEMPLATE-DRIVEN (NO STATUS-SPECIFIC LOGIC)
        // ═══════════════════════════════════════════════════════════════

        console.log(
          `[whatsapp-notification] Building template payload (TEMPLATE-DRIVEN)...`,
        );

        // Prepare all available dynamic data
        // The template system will extract what it needs based on template structure
        const dynamicData = {
          orderId: String(order.id),
          branchName: order.branch_name || "Néo Beirut",
          customerName: customer.name || "",
          orderType: order.order_type,
          // Add more fields as needed for future templates
        };

        // Build payload using template-driven orchestrator
        let buildResult;
        try {
          buildResult = await buildTemplatePayloadFromStatus(
            newStatus,
            order.order_type,
            dynamicData,
            fromPhone, // ← Uses forced sender
            customerPhone,
          );
        } catch (buildError) {
          const errorMsg = `Failed to build template payload: ${buildError.message}`;
          console.error(`[whatsapp-notification] ${errorMsg}`);

          await logWhatsAppMessage({
            userId: customer.id,
            orderId: order.id,
            phone: customerPhone,
            direction: "outbound",
            messageType: "template",
            messageText: `[Build failed for ${newStatus}]`,
            templateName: null,
            birdMessageId: null,
            status: "failed",
            error: errorMsg,
          });

          return {
            ok: false,
            error: errorMsg,
            hint: "Configure WhatsApp templates in Admin Settings",
            shouldUsePush: !!customer.push_token,
            sender: fromPhone, // ← Return sender in response
          };
        }

        const { payload, debug, templateConfig } = buildResult;
        templateName = templateConfig.templateName;
        debugData = debug;

        // ════════════════════════════════════════════════════════════════
        // 🔒 RUNTIME ASSERTION: VALIDATE PAYLOAD SENDER
        // ════════════════════════════════════════════════════════════════
        const payloadSender = payload?.messages?.[0]?.from;

        console.log(
          "╔════════════════════════════════════════════════════════════════╗",
        );
        console.log(
          "║ 🔍 PRE-SEND PAYLOAD SENDER VALIDATION                          ║",
        );
        console.log(
          "╠════════════════════════════════════════════════════════════════╣",
        );
        console.log(
          `║ Payload sender:        ${String(payloadSender).padEnd(39)}║`,
        );
        console.log(
          `║ Expected sender:       ${FORCED_WHATSAPP_SENDER.padEnd(39)}║`,
        );
        console.log(
          `║ Match:                 ${String(payloadSender === FORCED_WHATSAPP_SENDER).padEnd(39)}║`,
        );
        console.log(
          "╚════════════════════════════════════════════════════════════════╝",
        );

        if (payloadSender !== FORCED_WHATSAPP_SENDER) {
          throw new Error(
            `❌ PAYLOAD SENDER MISMATCH:\n` +
              `   Expected: ${FORCED_WHATSAPP_SENDER}\n` +
              `   Got: ${payloadSender}\n` +
              `   Payload rejected - sender validation failed`,
          );
        }

        console.log(
          `[whatsapp-notification] Template payload built successfully`,
        );
        console.log(`[whatsapp-notification] Debug:`, JSON.stringify(debug));

        // Send via Infobip
        const response = await sendWhatsAppPayload(payload);
        birdMessageId = response?.id || null;

        await logWhatsAppMessage({
          userId: customer.id,
          orderId: order.id,
          phone: customerPhone,
          direction: "outbound",
          messageType: "template",
          messageText: `[Template: ${templateName}] ${messageText}`,
          templateName,
          birdMessageId,
          status: "sent",
          error: null,
        });
      } else {
        // ═══════════════════════════════════════════════════════════════
        // FREE-FORM PATH (within 24h session)
        // ═══════════════════════════════════════════════════════════════
        console.log(
          `[whatsapp-notification] Sending free-form message to ${customerPhone}`,
        );

        const response = await sendWhatsAppFreeForm(customerPhone, messageText);
        birdMessageId = response?.id || null;

        await logWhatsAppMessage({
          userId: customer.id,
          orderId: order.id,
          phone: customerPhone,
          direction: "outbound",
          messageType: "freeform",
          messageText,
          templateName: null,
          birdMessageId,
          status: "sent",
          error: null,
        });
      }

      // Update order tracking
      await sql`
        UPDATE orders
        SET 
          last_whatsapp_sent_at = now(),
          whatsapp_notification_count = COALESCE(whatsapp_notification_count, 0) + 1
        WHERE id = ${order.id}
      `;

      console.log(
        `[whatsapp-notification] ==================== SUCCESS ====================`,
      );

      return {
        ok: true,
        sent: true,
        method: useTemplate ? "template" : "freeform",
        templateName,
        messageId: birdMessageId,
        debug: debugData,
        sender: fromPhone, // ← Return sender in response
      };
    } catch (sendError) {
      error = String(sendError?.message || sendError);
      console.error(
        `[whatsapp-notification] Send failed for order ${orderId}`,
        sendError,
      );

      // Log the failure
      await logWhatsAppMessage({
        userId: customer.id,
        orderId: order.id,
        phone: customerPhone,
        direction: "outbound",
        messageType: useTemplate ? "template" : "freeform",
        messageText,
        templateName,
        birdMessageId: null,
        status: "failed",
        error,
      });

      console.log(
        `[whatsapp-notification] ==================== FAILED ====================`,
      );

      return {
        ok: false,
        error: `WhatsApp send failed: ${error}`,
        shouldUsePush: !!customer.push_token,
        sender: fromPhone, // ← Return sender even on failure
      };
    }
  } catch (error) {
    console.error("[whatsapp-notification] Unexpected error:", error);
    return {
      ok: false,
      error: String(error?.message || error),
      sender: FORCED_WHATSAPP_SENDER, // ← Return forced sender even on unexpected error
    };
  }
}
