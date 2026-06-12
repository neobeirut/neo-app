import sql from "./sql";
import {
  getInfobipConfig,
  sendInfobipWhatsAppTemplate,
  sendInfobipWhatsAppFreeForm,
  sendInfobipOTP,
  toE164 as infobipToE164,
} from "./infobipWhatsApp";

// Phone number normalization (Lebanese E.164)
export const normalizePhone = (phone) => {
  if (!phone) return "";
  // Remove ALL whitespace, not just trim
  return String(phone).replace(/\s+/g, "");
};

export const toLebanonE164 = (phone) => {
  const trimmed = normalizePhone(phone);
  if (!trimmed) return "";

  // Already E.164
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/[^0-9+]/g, "");
    if (!/^\+\d{8,15}$/.test(digits)) {
      throw new Error("Invalid phone format");
    }
    if (!digits.startsWith("+961")) {
      throw new Error("Only Lebanese phone numbers (+961) are supported");
    }
    return digits;
  }

  let digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("9610")) {
    digits = `961${digits.slice(4)}`;
  }

  if (
    !digits.startsWith("961") &&
    digits.startsWith("0") &&
    digits.length === 8
  ) {
    digits = `961${digits.slice(1)}`;
  }

  if (!digits.startsWith("961") && digits.length >= 7 && digits.length <= 8) {
    digits = `961${digits}`;
  }

  const e164 = `+${digits}`;

  if (!e164.startsWith("+961")) {
    throw new Error("Only Lebanese phone numbers (+961) are supported");
  }

  const rest = e164.replace("+961", "");
  if (rest.length < 7 || rest.length > 8 || rest.startsWith("0")) {
    throw new Error("Invalid Lebanese phone number");
  }

  return e164;
};

// Check if WhatsApp session is active (24-hour window)
export const isWhatsAppSessionActive = async (userId) => {
  const [user] = await sql`
    SELECT last_whatsapp_inbound_at
    FROM auth_users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (!user?.last_whatsapp_inbound_at) {
    return false;
  }

  const lastInbound = new Date(user.last_whatsapp_inbound_at);
  const hoursSinceLastInbound =
    (Date.now() - lastInbound.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastInbound < 24;
};

// Status message templates (free-form - for active sessions)
export const getStatusMessageFreeForm = (status, orderType, branchName) => {
  const messages = {
    pending: `Your order has been received at Néo Beirut.\nWe're getting things started.\nIf you have any questions or special requests, just reply to this message.`,

    preparing: `Your order is now being prepared.\nWe'll update you once it's ready.`,

    ready:
      orderType === "pickup"
        ? `Your order is ready for pickup.\nYou can come by anytime.\nIf you're running late or need help, just reply here.`
        : `Your order is ready and will be out for delivery soon.`,

    out_for_delivery: `Your order is out for delivery.\nIf you need to update delivery details, reply to this message.`,

    delivered: `Your order has been completed.\nThank you for choosing Néo Beirut.\nWe hope you enjoyed it.`,

    completed: `Your order has been completed.\nThank you for choosing Néo Beirut.\nWe hope you enjoyed it.`,

    cancelled: `Your order has been cancelled.\nIf you have any questions or need assistance, please reply to this message.`,
  };

  return (
    messages[status] ||
    `Your order status has been updated. Reply here if you have any questions.`
  );
};

// Get template configuration from database
export const getTemplateConfig = async (templateKey) => {
  const [setting] = await sql`
    SELECT setting_value
    FROM app_settings
    WHERE setting_key = ${"whatsapp_template_" + templateKey}
    LIMIT 1
  `;

  if (!setting?.setting_value) {
    return null;
  }

  try {
    const config = JSON.parse(setting.setting_value);

    console.log(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║ 🔍 TEMPLATE CONFIGURATION - getTemplateConfig()                ║",
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(`║ Template Key:          ${String(templateKey).padEnd(39)}║`);
    console.log(
      `║ Database Key:          whatsapp_template_${templateKey.padEnd(23)}║`,
    );
    console.log(
      `║ Template Name:         ${String(config.template_name || "MISSING").padEnd(39)}║`,
    );
    console.log(
      `║ Language:              ${String(config.language || "en (default)").padEnd(39)}║`,
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝",
    );

    // Infobip template format
    return {
      templateName: config.template_name,
      language: config.language || "en",
    };
  } catch (e) {
    console.error("Failed to parse template config:", e);
    return null;
  }
};

// Send WhatsApp template message (Infobip only)
export const sendWhatsAppTemplate = async (
  toPhone,
  templateConfig,
  parameters = [],
) => {
  console.log(`[sendWhatsAppTemplate] Using Infobip`);
  return await sendInfobipWhatsAppTemplate(toPhone, templateConfig, parameters);
};

// Send pre-built WhatsApp payload (for template-driven system)
export const sendWhatsAppPayload = async (payload) => {
  console.log(`[sendWhatsAppPayload] Sending pre-built payload to Infobip`);

  const cfg = getInfobipConfig();
  const url = `${cfg.baseUrl}/whatsapp/1/message/template`;

  console.log(`[sendWhatsAppPayload] POST ${url}`);
  console.log(
    `[sendWhatsAppPayload] Payload:`,
    JSON.stringify(payload, null, 2),
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `App ${cfg.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Infobip API error ${response.status}: ${response.statusText}. Body: ${errorText}`,
    );
  }

  const result = await response.json();

  console.log(
    `[sendWhatsAppPayload] Response:`,
    JSON.stringify(result).substring(0, 200),
  );

  return {
    id: result?.messages?.[0]?.messageId || null,
    status: result?.messages?.[0]?.status?.name || result?.status,
    raw: result,
  };
};

// Send WhatsApp free-form message (within 24h session) - Infobip only
export const sendWhatsAppFreeForm = async (toPhone, messageText) => {
  console.log(`[sendWhatsAppFreeForm] Using Infobip`);
  return await sendInfobipWhatsAppFreeForm(toPhone, messageText);
};

// Send OTP via WhatsApp (Infobip only)
export const sendWhatsAppOTP = async (toPhone, otpCode) => {
  console.log(`[sendWhatsAppOTP] Using Infobip`);
  return await sendInfobipOTP(toPhone, otpCode);
};

// Log WhatsApp message to database
export const logWhatsAppMessage = async ({
  userId,
  orderId,
  phone,
  direction,
  messageType,
  messageText,
  templateName = null,
  birdMessageId = null, // Keep for backward compatibility with database column
  status,
  error = null,
}) => {
  await sql`
    INSERT INTO customer_whatsapp_messages (
      user_id, order_id, phone, direction, message_type, 
      message_text, template_name, bird_message_id, status, error, created_at
    )
    VALUES (
      ${userId}, ${orderId}, ${phone}, ${direction}, ${messageType},
      ${messageText}, ${templateName}, ${birdMessageId}, ${status}, ${error}, now()
    )
  `;
};

// Mark WhatsApp session as active (when customer replies)
export const markWhatsAppSessionActive = async (userId) => {
  await sql`
    UPDATE auth_users
    SET 
      last_whatsapp_inbound_at = now(),
      whatsapp_session_active = true
    WHERE id = ${userId}
  `;
};

// Get feedback request message
export const getFeedbackRequestMessage = (branchName) => {
  return `Hope you enjoyed your order from ${branchName || "Néo Beirut"}.\r\nWould you mind rating it from 1 to 5?\r\nReply with a number 🙏`;
};

// Parse rating from customer reply
export const parseRatingFromMessage = (messageText) => {
  const text = String(messageText || "").trim();
  const match = text.match(/[1-5]/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return null;
};

// Save feedback to database
export const saveFeedback = async ({
  orderId,
  userId,
  rating,
  feedbackText,
  source,
}) => {
  const [feedback] = await sql`
    INSERT INTO order_feedback (order_id, user_id, rating, feedback_text, source)
    VALUES (${orderId}, ${userId}, ${rating}, ${feedbackText}, ${source})
    RETURNING id
  `;

  // If rating is low, mark for admin notification
  if (rating && rating <= 3) {
    await sql`
      UPDATE order_feedback
      SET admin_notified = true
      WHERE id = ${feedback.id}
    `;
  }

  return feedback;
};
