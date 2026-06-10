import sql from "./sql";

// Global variable to store the last request body string for debugging/forensics
let lastRequestBodyString = "";

/**
 * Retrieve the last request body string sent via infobipFetch
 */
export function getLastRequestBodyString() {
  return lastRequestBodyString;
}

/**
 * Format a phone number to standard E.164 format with '+' prefix
 */
export function toE164(phone) {
  if (!phone) return "";
  let trimmed = String(phone).replace(/\s+/g, "").trim();
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("961")) {
    return "+" + digits;
  }
  if (digits.startsWith("0") && digits.length === 8) {
    return "+961" + digits.slice(1);
  }
  if (digits.length === 7 || digits.length === 8) {
    return "+961" + digits;
  }
  return "+" + digits;
}

/**
 * Format recipient phone number for Infobip
 */
export function toInfobipRecipient(phone) {
  return toE164(phone);
}

/**
 * Retrieve and normalize Infobip settings from environment variables
 */
export function getInfobipConfig() {
  const apiKey = process.env.INFOBIP_API_KEY;
  const baseUrl = process.env.INFOBIP_BASE_URL;
  const sender = process.env.INFOBIP_WHATSAPP_SENDER;

  if (!apiKey || !baseUrl || !sender) {
    throw new Error(
      "Infobip configuration is missing. Please set INFOBIP_API_KEY, INFOBIP_BASE_URL, and INFOBIP_WHATSAPP_SENDER in environment variables."
    );
  }

  let normalizedSender = sender.trim();
  // Strip '+' prefix if present because Infobip requires sender without '+'
  if (normalizedSender.startsWith("+")) {
    normalizedSender = normalizedSender.slice(1);
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ""),
    sender: normalizedSender,
  };
}

/**
 * Verify if Infobip variables are configured
 */
export async function testInfobipConfig() {
  try {
    const cfg = getInfobipConfig();
    return { configured: true, sender: cfg.sender, baseUrl: cfg.baseUrl };
  } catch (error) {
    return { configured: false, error: error.message };
  }
}

/**
 * Perform an HTTP request to the Infobip API
 */
export async function infobipFetch(endpoint, options = {}) {
  const cfg = getInfobipConfig();
  const url = `${cfg.baseUrl}${endpoint}`;

  const headers = {
    "Authorization": `App ${cfg.apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...options.headers,
  };

  const method = options.method || "GET";
  let body = options.body;

  if (body && typeof body === "object") {
    // CRITICAL: Intercept and ensure the 'from' field of any message starts with '+'
    if (body.messages && Array.isArray(body.messages)) {
      body.messages.forEach(msg => {
        if (msg.from) {
          let from = String(msg.from).trim();
          if (!from.startsWith("+")) {
            msg.from = "+" + from;
          }
        }
      });
    }
    body = JSON.stringify(body);
  }

  if (body) {
    lastRequestBodyString = body;
    console.log(`[infobipFetch] Request Body: ${body}`);
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[infobipFetch] Error ${response.status}: ${response.statusText}. Body: ${errorText}`);
    throw new Error(`Infobip API error ${response.status}: ${response.statusText}. Body: ${errorText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

/**
 * Fetch a template schema structure from Infobip and map it to database schema format
 */
export async function fetchInfobipTemplateSchema(templateName, language = "en") {
  try {
    const result = await infobipFetch(`/whatsapp/1/templates`, {
      method: "GET",
    });

    const templates = result.templates || [];
    const template = templates.find(
      t => t.name === templateName && t.language === language
    );

    if (!template) {
      return { error: `Template '${templateName}' in language '${language}' not found in Infobip` };
    }

    const components = template.components || [];
    const bodyComponent = components.find(c => c.type === "BODY");
    const headerComponent = components.find(c => c.type === "HEADER");
    const footerComponent = components.find(c => c.type === "FOOTER");
    const buttonsComponent = components.find(c => c.type === "BUTTONS");

    let bodyPlaceholderCount = 0;
    if (bodyComponent && bodyComponent.text) {
      const matches = bodyComponent.text.match(/\\{\\{\\d+\\}\\}/g);
      bodyPlaceholderCount = matches ? new Set(matches).size : 0;
    }

    const hasHeader = !!headerComponent;
    const headerType = headerComponent ? headerComponent.format : null;
    const hasFooter = !!footerComponent;
    const hasButtons = !!buttonsComponent;
    const buttonCount = buttonsComponent && buttonsComponent.buttons ? buttonsComponent.buttons.length : 0;
    const buttonType = buttonsComponent && buttonsComponent.buttons && buttonsComponent.buttons[0] ? buttonsComponent.buttons[0].type : null;

    return {
      schema: {
        category: template.category || "UTILITY",
        bodyPlaceholderCount,
        hasHeader,
        headerType,
        hasButtons,
        buttonCount,
        buttonType,
        hasFooter,
      }
    };
  } catch (e) {
    return { error: `Failed to fetch template schema: ${e.message}` };
  }
}

/**
 * Send an OTP verification code template message
 */
export async function sendInfobipOTPTemplate(to, code, templateName, language = "en") {
  const cfg = getInfobipConfig();
  const normalizedTo = toInfobipRecipient(to);

  // Build OTP template payload
  const payload = {
    messages: [
      {
        from: cfg.sender,
        to: normalizedTo,
        messageId: `otp-template-${Date.now()}`,
        content: {
          templateName,
          templateData: {
            body: {
              placeholders: [String(code)],
            },
            buttons: [
              {
                type: "URL",
                parameter: String(code),
              },
            ],
          },
          language,
        },
      },
    ],
  };

  const result = await infobipFetch("/whatsapp/1/message/template", {
    method: "POST",
    body: payload,
  });

  const msgResult = result?.messages?.[0];
  return {
    id: msgResult?.messageId || null,
    status: msgResult?.status?.name || "PENDING",
    raw: result,
  };
}

/**
 * Send an OTP (helper function called by customerWhatsApp.js)
 */
export async function sendInfobipOTP(to, code) {
  let templateName = "neo_login_code_2026";
  let language = "en_US";

  try {
    const [row] = await sql`
      SELECT setting_value FROM app_settings WHERE setting_key = 'whatsapp_template_otp' LIMIT 1
    `;
    if (row && row.setting_value) {
      const config = JSON.parse(row.setting_value);
      templateName = config.template_name || config.templateName || templateName;
      language = config.language || config.locale || language;
    }
  } catch (e) {
    console.error("[sendInfobipOTP] Failed to load OTP template config from DB, using fallback defaults", e);
  }

  return await sendInfobipOTPTemplate(to, code, templateName, language);
}

/**
 * Send order status updates using template registry payload structures
 */
export async function sendInfobipWhatsAppTemplate(toPhone, templateConfig, parameters = []) {
  const cfg = getInfobipConfig();
  const to = toInfobipRecipient(toPhone);

  const registry = await import("./whatsappTemplateRegistry");
  let schema = null;

  try {
    const allKeys = await registry.getAllTemplateKeys();
    for (const key of allKeys) {
      const cfgObj = await registry.getTemplateConfig(key);
      if (cfgObj && cfgObj.templateName === templateConfig.templateName) {
        schema = cfgObj.schema;
        break;
      }
    }
  } catch (e) {
    console.error("[sendInfobipWhatsAppTemplate] Failed to resolve schema by templateName", e);
  }

  if (!schema) {
    console.warn(`[sendInfobipWhatsAppTemplate] Schema not found in DB configs for templateName '${templateConfig.templateName}', using fallback`);
    schema = {
      category: "UTILITY",
      bodyPlaceholderCount: parameters.length,
      hasHeader: false,
      hasButtons: false,
    };
  }

  const payload = registry.buildPayloadFromSchema(
    schema,
    templateConfig,
    { placeholders: parameters },
    cfg.sender,
    to
  );

  const result = await infobipFetch("/whatsapp/1/message/template", {
    method: "POST",
    body: payload,
  });

  const msgResult = result?.messages?.[0];
  return {
    id: msgResult?.messageId || null,
    status: msgResult?.status?.name || "PENDING",
    raw: result,
  };
}

/**
 * Send free-form WhatsApp reply message
 */
export async function sendInfobipWhatsAppFreeForm(toPhone, messageText) {
  const cfg = getInfobipConfig();
  const to = toInfobipRecipient(toPhone);

  const payload = {
    messages: [
      {
        from: cfg.sender,
        to,
        messageId: `freeform-${Date.now()}`,
        content: {
          text: messageText,
        },
      },
    ],
  };

  const result = await infobipFetch("/whatsapp/1/message/text", {
    method: "POST",
    body: payload,
  });

  const msgResult = result?.messages?.[0];
  return {
    id: msgResult?.messageId || null,
    status: msgResult?.status?.name || "PENDING",
    raw: result,
  };
}
