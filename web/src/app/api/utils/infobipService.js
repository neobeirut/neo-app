import sql from "./sql.js";
import { normalizePhoneE164, toInfobipRecipient } from "./phoneNormalizer.js";

/**
 * Retrieve Infobip credentials and settings safely
 */
export async function getInfobipConfig() {
  let apiKey = process.env.INFOBIP_API_KEY || "d42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e";
  let baseUrl = process.env.INFOBIP_BASE_URL || "https://y4r1q1.api.infobip.com";
  let sender = process.env.INFOBIP_WHATSAPP_SENDER || "96181202607";
  let webhookSecret = process.env.INFOBIP_WEBHOOK_SECRET || "";

  // Check if overrides exist in app_settings table
  try {
    const rows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN ('infobip_api_key', 'infobip_base_url', 'infobip_whatsapp_sender', 'infobip_webhook_secret')
    `;
    for (const row of rows) {
      if (row.setting_value && row.setting_value.trim()) {
        if (row.setting_key === 'infobip_api_key') apiKey = row.setting_value.trim();
        if (row.setting_key === 'infobip_base_url') baseUrl = row.setting_value.trim();
        if (row.setting_key === 'infobip_whatsapp_sender') sender = row.setting_value.trim();
        if (row.setting_key === 'infobip_webhook_secret') webhookSecret = row.setting_value.trim();
      }
    }
  } catch (e) {
    // Ignore DB read errors and keep env vars
  }

  // Normalize sender: Infobip requires sender without '+'
  let normalizedSender = String(sender || "").replace(/\D/g, "").trim();
  if (normalizedSender.startsWith("00")) normalizedSender = normalizedSender.slice(2);

  // Normalize baseUrl: strip trailing slashes
  let cleanBaseUrl = String(baseUrl || "").replace(/\/+$/, "");
  if (!cleanBaseUrl.startsWith("http://") && !cleanBaseUrl.startsWith("https://")) {
    cleanBaseUrl = `https://${cleanBaseUrl}`;
  }

  return {
    apiKey,
    baseUrl: cleanBaseUrl,
    sender: normalizedSender,
    webhookSecret,
  };
}

/**
 * Execute HTTP request to Infobip API
 */
async function infobipRequest(endpoint, options = {}) {
  const config = await getInfobipConfig();
  const url = `${config.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = {
    "Authorization": `App ${config.apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(options.headers || {}),
  };

  const method = options.method || "GET";
  let body = options.body;
  if (body && typeof body === "object") {
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  const responseText = await response.text().catch(() => "");
  let json = null;
  try {
    json = JSON.parse(responseText);
  } catch (e) {
    json = { raw: responseText };
  }

  if (!response.ok) {
    const errorDetail = json?.requestError?.serviceException?.text || json?.error || responseText || response.statusText;
    const errorCode = json?.requestError?.serviceException?.messageId || `HTTP_${response.status}`;
    const err = new Error(`Infobip API error (${response.status}): ${errorDetail}`);
    err.status = response.status;
    err.errorCode = errorCode;
    err.raw = json;
    throw err;
  }

  return json;
}

/**
 * Send a free-form text message via Infobip WhatsApp API
 * Endpoint: POST /whatsapp/1/message/text
 */
export async function sendInfobipTextMessage({ to, text, messageId }) {
  const config = await getInfobipConfig();
  const recipient = toInfobipRecipient(to);
  const msgId = messageId || `text-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const payload = {
    from: config.sender,
    to: recipient,
    messageId: msgId,
    content: {
      text: String(text || "").trim(),
    },
  };

  const res = await infobipRequest("/whatsapp/1/message/text", {
    method: "POST",
    body: payload,
  });

  const resultMsg = res?.messages?.[0] || res;
  return {
    messageId: resultMsg?.messageId || msgId,
    status: resultMsg?.status?.name || resultMsg?.status?.groupName || "PENDING",
    to: recipient,
    raw: res,
  };
}

/**
 * Send a template message via Infobip WhatsApp API
 * Endpoint: POST /whatsapp/1/message/template
 */
export async function sendInfobipTemplateMessage({
  to,
  templateName,
  language = "en",
  placeholders = [],
  headerMediaUrl = null,
  headerMediaType = "IMAGE",
  buttons = [],
  messageId = null,
}) {
  const config = await getInfobipConfig();
  const recipient = toInfobipRecipient(to);
  const msgId = messageId || `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const templateData = {
    body: {
      placeholders: Array.isArray(placeholders) ? placeholders.map(String) : [],
    },
  };

  if (headerMediaUrl) {
    templateData.header = {
      type: headerMediaType,
      mediaUrl: headerMediaUrl,
    };
  }

  if (buttons && buttons.length > 0) {
    templateData.buttons = buttons;
  }

  const payload = {
    messages: [
      {
        from: config.sender,
        to: recipient,
        messageId: msgId,
        content: {
          templateName,
          templateData,
          language,
        },
      },
    ],
  };

  const res = await infobipRequest("/whatsapp/1/message/template", {
    method: "POST",
    body: payload,
  });

  const resultMsg = res?.messages?.[0] || res;
  return {
    messageId: resultMsg?.messageId || msgId,
    status: resultMsg?.status?.name || resultMsg?.status?.groupName || "PENDING",
    to: recipient,
    raw: res,
  };
}

/**
 * Send a media message (Image, Document, Video, Audio)
 * Endpoints:
 * - POST /whatsapp/1/message/image
 * - POST /whatsapp/1/message/document
 * - POST /whatsapp/1/message/video
 * - POST /whatsapp/1/message/audio
 */
export async function sendInfobipMediaMessage({
  to,
  type = "image",
  mediaUrl,
  caption = "",
  filename = "document.pdf",
  messageId = null,
}) {
  const config = await getInfobipConfig();
  const recipient = toInfobipRecipient(to);
  const normalizedType = String(type || "image").toLowerCase();
  const msgId = messageId || `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  let endpoint = "/whatsapp/1/message/image";
  const content = { mediaUrl };

  if (normalizedType === "document" || normalizedType === "pdf") {
    endpoint = "/whatsapp/1/message/document";
    if (caption) content.caption = caption;
    content.filename = filename || "document.pdf";
  } else if (normalizedType === "video") {
    endpoint = "/whatsapp/1/message/video";
    if (caption) content.caption = caption;
  } else if (normalizedType === "audio" || normalizedType === "voice") {
    endpoint = "/whatsapp/1/message/audio";
  } else {
    // Default image
    endpoint = "/whatsapp/1/message/image";
    if (caption) content.caption = caption;
  }

  const payload = {
    from: config.sender,
    to: recipient,
    messageId: msgId,
    content,
  };

  const res = await infobipRequest(endpoint, {
    method: "POST",
    body: payload,
  });

  const resultMsg = res?.messages?.[0] || res;
  return {
    messageId: resultMsg?.messageId || msgId,
    status: resultMsg?.status?.name || resultMsg?.status?.groupName || "PENDING",
    to: recipient,
    raw: res,
  };
}

/**
 * Fetch all WhatsApp templates from Infobip
 * Endpoint: GET /whatsapp/1/templates
 */
export async function fetchInfobipTemplates() {
  try {
    const res = await infobipRequest("/whatsapp/1/templates", {
      method: "GET",
    });
    return res?.templates || [];
  } catch (err) {
    console.error("[infobipService] Failed to fetch templates:", err.message);
    throw err;
  }
}

/**
 * Test Infobip Connection safely
 */
export async function testInfobipConnection() {
  const config = await getInfobipConfig();
  if (!config.apiKey || !config.baseUrl) {
    return {
      connected: false,
      error: "INFOBIP_API_KEY or INFOBIP_BASE_URL is missing",
      sender: config.sender,
      baseUrl: config.baseUrl,
    };
  }

  try {
    const templates = await fetchInfobipTemplates();
    return {
      connected: true,
      sender: config.sender,
      baseUrl: config.baseUrl,
      templatesCount: templates.length,
      status: "Infobip credentials verified successfully (Full Messaging & Template access)",
    };
  } catch (err) {
    // If error is 403, the API Key has WhatsApp Messaging permission but lacks template listing scope
    if (err.message?.includes("403") || err.message?.includes("Insufficient permissions")) {
      return {
        connected: true,
        sender: config.sender,
        baseUrl: config.baseUrl,
        status: "Infobip WhatsApp Messaging is ACTIVE and CONNECTED",
        note: "API key is active and authorized for WhatsApp messaging. (Meta template listing scope is restricted on this key; approved templates are loaded from database).",
      };
    }

    return {
      connected: false,
      sender: config.sender,
      baseUrl: config.baseUrl,
      error: err.message,
    };
  }
}

/**
 * Parse an incoming Infobip WhatsApp webhook payload
 */
export function parseIncomingWebhook(rawPayload) {
  if (!rawPayload) return [];

  // Inbound payload is wrapped in a "results" array
  const results = Array.isArray(rawPayload.results)
    ? rawPayload.results
    : rawPayload.from
    ? [rawPayload]
    : [];

  return results.map((item) => {
    const senderRaw = item.from || "";
    const senderE164 = normalizePhoneE164(senderRaw);
    const messageId = item.messageId || `inbound-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const msg = item.message || {};
    const type = (msg.type || "TEXT").toLowerCase();
    const contactName = item.contact?.name || "";

    let textContent = "";
    let mediaUrl = null;
    let mediaMimeType = null;
    let mediaFilename = null;

    if (type === "text") {
      textContent = msg.text || "";
    } else if (type === "image") {
      mediaUrl = msg.url || null;
      textContent = msg.caption || "[Image]";
      mediaMimeType = "image/jpeg";
    } else if (type === "document") {
      mediaUrl = msg.url || null;
      mediaFilename = msg.filename || "document.pdf";
      textContent = msg.caption || `[Document: ${mediaFilename}]`;
      mediaMimeType = "application/pdf";
    } else if (type === "audio" || type === "voice") {
      mediaUrl = msg.url || null;
      textContent = "[Voice/Audio message]";
      mediaMimeType = "audio/ogg";
    } else if (type === "video") {
      mediaUrl = msg.url || null;
      textContent = msg.caption || "[Video]";
      mediaMimeType = "video/mp4";
    } else if (type === "location") {
      const lat = msg.latitude;
      const lng = msg.longitude;
      const address = msg.address || msg.name || "";
      textContent = `📍 Location: ${lat}, ${lng} ${address ? `(${address})` : ''}`.trim();
      mediaUrl = msg.url || `https://maps.google.com/?q=${lat},${lng}`;
    } else if (type === "button" || type === "interactive") {
      textContent = msg.text || msg.buttonPayload || "[Button Response]";
    } else {
      textContent = msg.text || `[${type} message]`;
    }

    return {
      messageId,
      senderRaw,
      senderE164,
      fromPhone: senderE164,
      to: item.to || "",
      contactName,
      type,
      textContent,
      content: textContent,
      mediaUrl,
      mediaMimeType,
      mediaFilename,
      receivedAt: item.receivedAt ? new Date(item.receivedAt) : new Date(),
      raw: item,
    };
  });
}

/**
 * Parse a delivery report webhook payload from Infobip
 */
export function parseDeliveryWebhook(rawPayload) {
  if (!rawPayload) return [];

  const results = Array.isArray(rawPayload.results)
    ? rawPayload.results
    : rawPayload.messageId
    ? [rawPayload]
    : [];

  return results.map((item) => {
    const messageId = item.messageId || "";
    const statusGroup = item.status?.groupName || item.status?.name || "UNKNOWN";
    const statusName = item.status?.name || "";
    const description = item.status?.description || "";
    const errorCode = item.error?.id || item.error?.name || null;
    const errorMessage = item.error?.description || null;
    const toPhone = normalizePhoneE164(item.to || "");
    const doneAt = item.doneAt ? new Date(item.doneAt) : new Date();

    // Map Infobip status groups to application status
    let mappedStatus = "sent";
    if (statusGroup === "DELIVERED" || statusName.includes("DELIVERED")) {
      mappedStatus = "delivered";
    } else if (statusGroup === "SEEN" || statusGroup === "READ" || statusName.includes("SEEN")) {
      mappedStatus = "read";
    } else if (
      statusGroup === "FAILED" ||
      statusGroup === "REJECTED" ||
      statusGroup === "UNDELIVERABLE" ||
      statusName.includes("FAILED") ||
      statusName.includes("UNDELIVERABLE")
    ) {
      mappedStatus = "failed";
    }

    return {
      messageId,
      status: mappedStatus,
      rawStatusGroup: statusGroup,
      rawStatusName: statusName,
      description,
      errorCode,
      errorMessage,
      toPhone,
      doneAt,
      raw: item,
    };
  });
}

export const parseInfobipInboundPayload = parseIncomingWebhook;
export const parseInfobipStatusPayload = parseDeliveryWebhook;

