/**
 * Diagnostic endpoint to check if INFOBIP_WHATSAPP_SENDER is set correctly
 * Access: /api/_debug/check-infobip-sender
 */

export async function GET() {
  const sender = process.env.INFOBIP_WHATSAPP_SENDER;
  const baseUrl = process.env.INFOBIP_BASE_URL;
  const apiKey = process.env.INFOBIP_API_KEY;

  const result = {
    timestamp: new Date().toISOString(),
    environment: {
      INFOBIP_WHATSAPP_SENDER: {
        isSet: !!sender,
        value: sender || "NOT SET",
        type: typeof sender,
        length: sender ? sender.length : 0,
      },
      INFOBIP_BASE_URL: {
        isSet: !!baseUrl,
        value: baseUrl || "NOT SET",
        type: typeof baseUrl,
      },
      INFOBIP_API_KEY: {
        isSet: !!apiKey,
        value: apiKey ? `${apiKey.substring(0, 10)}...` : "NOT SET",
        type: typeof apiKey,
      },
    },
    diagnostics: {
      sender_is_valid: sender === "96176489078",
      sender_normalized: sender ? sender.trim() : null,
      all_env_keys: Object.keys(process.env).filter((k) =>
        k.includes("INFOBIP"),
      ),
    },
  };

  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║ 🔍 INFOBIP ENVIRONMENT VARIABLE CHECK                          ║",
  );
  console.log(
    "╠════════════════════════════════════════════════════════════════╣",
  );
  console.log(
    `║ INFOBIP_WHATSAPP_SENDER:                                       ║`,
  );
  console.log(
    `║   Is set:              ${String(result.environment.INFOBIP_WHATSAPP_SENDER.isSet).padEnd(43)}║`,
  );
  console.log(
    `║   Value:               ${String(result.environment.INFOBIP_WHATSAPP_SENDER.value).padEnd(43)}║`,
  );
  console.log(
    `║   Type:                ${String(result.environment.INFOBIP_WHATSAPP_SENDER.type).padEnd(43)}║`,
  );
  console.log(
    `║                                                                ║`,
  );
  console.log(
    `║ INFOBIP_BASE_URL:                                              ║`,
  );
  console.log(
    `║   Is set:              ${String(result.environment.INFOBIP_BASE_URL.isSet).padEnd(43)}║`,
  );
  console.log(
    `║                                                                ║`,
  );
  console.log(
    `║ INFOBIP_API_KEY:                                               ║`,
  );
  console.log(
    `║   Is set:              ${String(result.environment.INFOBIP_API_KEY.isSet).padEnd(43)}║`,
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );

  return Response.json(result, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
