import sql from "@/app/api/utils/sql";
import {
  sendInfobipOTPTemplate,
  getInfobipConfig,
  toE164,
} from "@/app/api/utils/infobipWhatsApp";

// Apple Review Test Account - bypasses WhatsApp and uses fixed code
const APPLE_REVIEW_TEST_PHONE = "+9611234567";
const APPLE_REVIEW_TEST_CODE = "123456";

// TEMP: Pause outbound OTP delivery (WhatsApp) during testing.
// Set to false (or remove) when you're ready to send real messages again.
const PAUSE_OUTBOUND_OTP_DELIVERY = false; // Set to false to enable real WhatsApp delivery

const normalizePhone = (phone) => {
  if (!phone) return "";
  // collapse whitespace and trim (handles "+961   03..." and odd web spaces)
  return String(phone).replace(/\s+/g, " ").trim();
};

// Canonicalize to Lebanese E.164 (+961...) so we store + look up consistently
const toLebanonE164 = (phone) => {
  const trimmed = normalizePhone(phone);
  if (!trimmed) return "";

  // Remove ALL spaces/formatting first for test account check
  const digitsOnly = trimmed.replace(/\s+/g, "");

  // Allow Apple review test phone to bypass Lebanese validation
  if (digitsOnly === APPLE_REVIEW_TEST_PHONE) {
    return APPLE_REVIEW_TEST_PHONE;
  }

  // Keep only digits
  let digits = trimmed.replace(/\D/g, "");

  // Handle 00-prefixed international format (00961...)
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Lebanon rule of thumb: when country code is present, drop the leading 0 from the national number.
  // Example: +961 03 123456 -> digits 96103123456 -> 9613123456
  if (digits.startsWith("9610")) {
    digits = `961${digits.slice(4)}`;
  }

  // If user entered local format with leading 0 (03xxxxxx), convert to 9613xxxxxx
  if (
    !digits.startsWith("961") &&
    digits.startsWith("0") &&
    digits.length === 8
  ) {
    digits = `961${digits.slice(1)}`;
  }

  // If user entered local format without leading 0 (3xxxxxx), convert to 9613xxxxxx
  if (!digits.startsWith("961") && digits.length >= 7 && digits.length <= 8) {
    digits = `961${digits}`;
  }

  const e164 = `+${digits}`;

  if (!e164.startsWith("+961")) {
    throw new Error("Only Lebanese phone numbers (+961) are supported.");
  }

  // Basic sanity check: after +961, expect 7–8 digits.
  const rest = e164.replace("+961", "");
  const restLen = rest.length;
  if (restLen < 7 || restLen > 8 || rest.startsWith("0")) {
    throw new Error(
      "Invalid Lebanese phone number. Please enter your number without the leading 0 after +961 (example: +961 3 123456).",
    );
  }

  return e164;
};

// Generate random 6-digit verification code
const generateVerificationCode = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

// Quick diagnostics without sending an OTP
export async function GET(request) {
  const envLabel = process.env.ENV || process.env.NODE_ENV || "unknown";

  let infobipStatus = { configured: false };
  try {
    const cfg = getInfobipConfig();
    infobipStatus = { configured: true, sender: cfg.sender, baseUrl: cfg.baseUrl };
  } catch (e) {
    infobipStatus = { configured: false, error: e.message };
  }

  return Response.json({
    ok: true,
    env: envLabel,
    infobip: infobipStatus,
  });
}

export async function POST(request) {
  try {
    const body = (await request.json()) || {};
    const phoneRaw = normalizePhone(body?.phone);

    if (!phoneRaw) {
      return Response.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    const phone = toLebanonE164(phoneRaw);

    // Apple Review Test Account - bypass WhatsApp, use fixed code
    if (phone === APPLE_REVIEW_TEST_PHONE) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours for Apple review

      await sql`
        DELETE FROM phone_verification_codes
        WHERE phone = ${phone}
      `;

      await sql`
        INSERT INTO phone_verification_codes (phone, code, expires_at)
        VALUES (${phone}, ${APPLE_REVIEW_TEST_CODE}, ${expiresAt})
      `;

      console.log(
        "[phone-send-code] 🧪 Apple Review test account - code set to 123456",
      );

      return Response.json({
        success: true,
        message: "Verification code created (Apple Review test account)",
        provider: "test-account",
      });
    }

    // Legacy local-code behavior (useful during testing)
    if (PAUSE_OUTBOUND_OTP_DELIVERY) {
      const verificationCode = "000000";
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await sql`
        DELETE FROM phone_verification_codes
        WHERE phone = ${phone}
      `;

      await sql`
        INSERT INTO phone_verification_codes (phone, code, expires_at)
        VALUES (${phone}, ${verificationCode}, ${expiresAt})
      `;

      console.log("[phone-send-code] ⏸️ Delivery paused - code set to 000000");

      return Response.json({
        success: true,
        message: "Verification code created (delivery paused for testing)",
        provider: "paused",
      });
    }

    // Check Infobip WhatsApp configuration
    let config;
    try {
      config = getInfobipConfig();
    } catch (e) {
      console.error("[phone-send-code] ❌ Infobip not configured:", e.message);
      return Response.json(
        {
          error:
            "WhatsApp is not configured. Please set INFOBIP_API_KEY, INFOBIP_BASE_URL, and INFOBIP_WHATSAPP_SENDER in Project Settings → Secrets.",
        },
        { status: 500 },
      );
    }

    // Fetch WhatsApp OTP template configuration from app_settings
    let templateConfig = null;
    try {
      const templateRows = await sql`
        SELECT setting_value
        FROM app_settings
        WHERE setting_key = 'whatsapp_template_otp'
        LIMIT 1
      `;

      if (templateRows?.[0]?.setting_value) {
        const parsed = JSON.parse(templateRows[0].setting_value);
        templateConfig = {
          templateName: parsed.template_name,
          language: parsed.language || "en",
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔍 RUNTIME TEMPLATE NAME AUDIT - PROOF OF WHAT IS ACTUALLY SENT
      // ═══════════════════════════════════════════════════════════════
      console.log(
        "╔════════════════════════════════════════════════════════════════╗",
      );
      console.log(
        "║ 🔍 RUNTIME TEMPLATE CONFIG AUDIT - DATABASE READ PROOF         ║",
      );
      console.log(
        "╠════════════════════════════════════════════════════════════════╣",
      );
      console.log(
        `║ DB Query Result Rows:  ${String(templateRows?.length || 0).padEnd(39)}║`,
      );
      console.log(
        `║ Raw setting_value:                                             ║`,
      );
      console.log(
        `║   ${String(templateRows?.[0]?.setting_value || "NULL")
          .substring(0, 59)
          .padEnd(59)}║`,
      );
      console.log(
        `║ Parsed template_name:                                          ║`,
      );
      console.log(
        `║   ${String(templateConfig?.templateName || "NULL").padEnd(59)}║`,
      );
      console.log(
        `║ Parsed language:                                               ║`,
      );
      console.log(
        `║   ${String(templateConfig?.language || "NULL").padEnd(59)}║`,
      );
      console.log(
        "╠════════════════════════════════════════════════════════════════╣",
      );
      console.log(
        "║ ⚠️  IF YOU SEE 'otp_code_v1' ABOVE, THE DATABASE IS WRONG     ║",
      );
      console.log(
        "║ ✅ IF YOU SEE 'otp_verification_code', THE CODE IS CORRECT    ║",
      );
      console.log(
        "╠════════════════════════════════════════════════════════════════╣",
      );
      console.log(
        "║ THIS VALUE WILL BE SENT TO INFOBIP IN THE NEXT API CALL       ║",
      );
      console.log(
        "╚════════════════════════════════════════════════════════════════╝",
      );
    } catch (err) {
      console.error(
        "[phone-send-code] ⚠️ Failed to fetch WhatsApp OTP template config:",
        err,
      );
    }

    if (!templateConfig?.templateName) {
      console.error(
        "[phone-send-code] ❌ WhatsApp OTP template not configured in app_settings",
      );
      return Response.json(
        {
          error:
            'WhatsApp OTP template not configured. Please add \'whatsapp_template_otp\' to app_settings with format: {"template_name": "your_otp_template_name", "language": "en"}',
        },
        { status: 500 },
      );
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in database
    await sql`
      DELETE FROM phone_verification_codes
      WHERE phone = ${phone}
    `;

    await sql`
      INSERT INTO phone_verification_codes (phone, code, expires_at)
      VALUES (${phone}, ${verificationCode}, ${expiresAt})
    `;

    // Check for sender mismatch
    const expectedSender = "96176489078";
    const actualSender = config.sender;
    const senderMismatch = actualSender !== expectedSender;

    // DEBUG LOGGING - Show exact configuration being used
    console.log(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║ 📱 OTP VERIFICATION FLOW - CONFIGURATION AUDIT                 ║",
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ ENVIRONMENT VARIABLES:                                         ║`,
    );
    console.log(
      `║   INFOBIP_API_KEY:         ${process.env.INFOBIP_API_KEY ? "SET (len=" + process.env.INFOBIP_API_KEY.length + ")" : "NOT SET".padEnd(36)}║`,
    );
    console.log(
      `║   INFOBIP_BASE_URL:        ${String(process.env.INFOBIP_BASE_URL || "NOT SET").padEnd(36)}║`,
    );
    console.log(
      `║   INFOBIP_WHATSAPP_SENDER: ${String(process.env.INFOBIP_WHATSAPP_SENDER || "NOT SET").padEnd(36)}║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ RUNTIME CONFIG (from getInfobipConfig):                        ║`,
    );
    console.log(`║   config.sender:           ${actualSender.padEnd(36)}║`);
    console.log(`║   config.baseUrl:          ${config.baseUrl.padEnd(36)}║`);
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ TEMPLATE CONFIG (from app_settings whatsapp_template_otp):     ║`,
    );
    console.log(
      `║   templateName:            ${templateConfig.templateName.padEnd(36)}║`,
    );
    console.log(
      `║   language:                ${templateConfig.language.padEnd(36)}║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ SENDER VALIDATION:                                             ║`,
    );
    console.log(`║   Expected:                ${expectedSender.padEnd(36)}║`);
    console.log(`║   Actual:                  ${actualSender.padEnd(36)}║`);

    if (senderMismatch) {
      console.log(
        `║   Status:                  ⚠️  MISMATCH                         ║`,
      );
    } else {
      console.log(
        `║   Status:                  ✅ CORRECT                           ║`,
      );
    }

    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ ENDPOINT DETAILS:                                              ║`,
    );
    console.log(
      `║   Channel:                 WhatsApp Template (OTP)             ║`,
    );
    console.log(
      `║   Endpoint:                /whatsapp/1/message/template        ║`,
    );
    console.log(
      `║   Full URL:                ${(config.baseUrl + "/whatsapp/1/message/template").substring(0, 36).padEnd(36)}║`,
    );
    console.log(
      `║   Transport:               WhatsApp (NOT SMS)                  ║`,
    );
    console.log(
      `║   Method:                  POST                                ║`,
    );
    console.log(
      `║   Compliant:               YES - Works outside 24h window      ║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ RECIPIENT & OTP:                                               ║`,
    );
    console.log(`║   To:                      ${phone.padEnd(36)}║`);
    console.log(`║   OTP Code:                ${verificationCode.padEnd(36)}║`);
    console.log(
      "╚════════════════════════════════════════════════════════════════╝",
    );

    if (senderMismatch) {
      console.warn(
        "╔════════════════════════════════════════════════════════════════╗",
      );
      console.warn(
        "║ ⚠️  CRITICAL: SENDER MISMATCH                                  ║",
      );
      console.warn(
        "╠════════════════════════════════════════════════════════════════╣",
      );
      console.warn(
        "║ The INFOBIP_WHATSAPP_SENDER environment variable is set to:   ║",
      );
      console.warn(`║   ${actualSender.padEnd(59)}║`);
      console.warn(
        "║                                                                ║",
      );
      console.warn(
        "║ But the expected sender for this project is:                  ║",
      );
      console.warn(`║   ${expectedSender.padEnd(59)}║`);
      console.warn(
        "║                                                                ║",
      );
      console.warn(
        "║ ACTION REQUIRED:                                               ║",
      );
      console.warn(
        "║ Update INFOBIP_WHATSAPP_SENDER in Project Settings → Secrets  ║",
      );
      console.warn(
        "║ to match the expected sender number above.                    ║",
      );
      console.warn(
        "╚════════════════════════════════════════════════════════════════╝",
      );
    }

    // Send via Infobip WhatsApp Template (business-initiated OTP)
    // ═══════════════════════════════════════════════════════════════
    // 🎯 FINAL CHECK - EXACT VALUES BEING SENT TO INFOBIP API
    // ═════════════════════════════════════════════════════════════════
    console.log(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║ 🎯 ABOUT TO CALL sendInfobipOTPTemplate - FINAL CHECK         ║",
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ Function:              sendInfobipOTPTemplate                  ║`,
    );
    console.log(`║ Argument 1 (phone):    ${String(phone).padEnd(39)}║`);
    console.log(
      `║ Argument 2 (code):     ${String(verificationCode).padEnd(39)}║`,
    );
    console.log(
      `║ Argument 3 (template): ${String(templateConfig.templateName).padEnd(39)}║`,
    );
    console.log(
      `║ Argument 4 (language): ${String(templateConfig.language).padEnd(39)}║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      "║ 🚨 THIS IS THE TEMPLATE NAME THAT WILL BE IN INFOBIP LOGS:    ║",
    );
    console.log(
      `║    >>> ${String(templateConfig.templateName).padEnd(56)}<<<║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      "║ ❌ If Infobip shows 'otp_code_v1', you are looking at old logs║",
    );
    console.log(
      "║ ✅ If Infobip shows 'otp_verification_code', it matches!      ║",
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝",
    );

    const result = await sendInfobipOTPTemplate(
      phone,
      verificationCode,
      templateConfig.templateName,
      templateConfig.language,
    );

    console.log(
      `[phone-send-code] ✅ Infobip WhatsApp Template result:`,
      result,
    );

    if (
      result.status !== "PENDING" &&
      result.status !== "ACCEPTED" &&
      result.status !== "PENDING_ACCEPTED"
    ) {
      console.error(
        `[phone-send-code] ⚠️ Unexpected status from Infobip WhatsApp Template:`,
        result.status,
      );
    }

    return Response.json({
      success: true,
      message: "Verification code sent via WhatsApp (Template)",
      provider: "infobip-whatsapp-template",
      channel: "whatsapp",
      template: templateConfig.templateName,
      sender: actualSender,
      expectedSender,
      senderCorrect: !senderMismatch,
      endpoint: "/whatsapp/1/message/template",
      transport: "whatsapp",
      compliant: true,
    });
  } catch (error) {
    console.error(
      "[phone-send-code] ❌ Error sending verification code:",
      error,
    );

    // Check if error is template-related
    const errorMsg = String(error?.message || "");
    if (errorMsg.includes("template")) {
      return Response.json(
        {
          error:
            "WhatsApp template error. Please ensure the OTP template is approved in Infobip and configured in app_settings (whatsapp_template_otp).",
          details: error?.message,
        },
        { status: 500 },
      );
    }

    return Response.json(
      { error: error?.message || "Failed to send verification code" },
      { status: 500 },
    );
  }
}
