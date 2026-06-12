import {
  getInfobipConfig,
  infobipFetch,
  toE164,
  sendInfobipWhatsAppFreeForm,
} from "@/app/api/utils/infobipWhatsApp";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

/**
 * Comprehensive Infobip WhatsApp Test Endpoint
 *
 * This endpoint:
 * 1. Tests Infobip authentication
 * 2. Shows configuration (base URL, sender, API key info)
 * 3. Optionally sends a test WhatsApp message
 * 4. Returns detailed diagnostics
 */
export async function POST(request) {
  try {
    // Require admin authentication
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return Response.json(
        { ok: false, error: "Admin authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const sendTestMessage = body?.sendTestMessage === true;
    const testPhoneNumber = body?.testPhoneNumber || null;

    console.log(
      "[test-whatsapp] ==================== START ====================",
    );
    console.log(`[test-whatsapp] Send test message: ${sendTestMessage}`);
    console.log(`[test-whatsapp] Test phone: ${testPhoneNumber || "none"}`);

    // Step 1: Load and validate Infobip configuration
    let config;
    try {
      config = getInfobipConfig();
    } catch (error) {
      return Response.json({
        ok: false,
        step: "config_load",
        error: error.message,
        diagnostics: {
          hasApiKey: Boolean(process.env.INFOBIP_API_KEY),
          hasBaseUrl: Boolean(process.env.INFOBIP_BASE_URL),
          hasSender: Boolean(process.env.INFOBIP_WHATSAPP_SENDER),
        },
      });
    }

    // Step 2: Show configuration details (safe to display)
    const configInfo = {
      baseUrl: config.baseUrl,
      sender: config.sender,
      apiKeyLength: config.apiKey.length,
      apiKeyLast4: config.apiKey.slice(-4),
      apiKeyPresent: Boolean(config.apiKey),
    };

    console.log("[test-whatsapp] Configuration loaded:");
    console.log(`  Base URL: ${configInfo.baseUrl}`);
    console.log(`  Sender: ${configInfo.sender}`);
    console.log(`  API Key length: ${configInfo.apiKeyLength}`);
    console.log(`  API Key last 4: ...${configInfo.apiKeyLast4}`);

    // Step 3: Test authentication with Infobip API
    let authTestResult;
    try {
      // Make a simple GET request to account endpoint to verify credentials
      const accountInfo = await infobipFetch("/account/1/balance", {
        method: "GET",
      });

      authTestResult = {
        success: true,
        message: "Authentication successful",
        accountBalance: accountInfo?.balance || "N/A",
        currency: accountInfo?.currency || "N/A",
      };

      console.log("[test-whatsapp] ✅ Authentication successful");
      console.log(
        `  Account balance: ${authTestResult.accountBalance} ${authTestResult.currency}`,
      );
    } catch (error) {
      console.error("[test-whatsapp] ❌ Authentication failed:", error);

      return Response.json({
        ok: false,
        step: "authentication",
        error: error.message,
        config: configInfo,
        hint: "Check: (1) INFOBIP_API_KEY is correct, (2) INFOBIP_BASE_URL matches your account region, (3) API key has permissions",
      });
    }

    // Step 4: If requested, send a test WhatsApp message
    let testMessageResult = null;
    if (sendTestMessage && testPhoneNumber) {
      try {
        const normalizedPhone = toE164(testPhoneNumber);
        console.log(
          `[test-whatsapp] Sending test message to ${normalizedPhone}`,
        );

        const result = await sendInfobipWhatsAppFreeForm(
          normalizedPhone,
          `✅ WhatsApp Test Message\n\nThis is a test message from NAco Beirut admin panel.\n\nTimestamp: ${new Date().toISOString()}\n\nIf you received this, Infobip integration is working correctly!`
        );

        testMessageResult = {
          success: true,
          messageId: result.id || null,
          status: result.status || "unknown",
          to: normalizedPhone,
          from: config.sender,
          sentAt: new Date().toISOString(),
        };

        console.log("[test-whatsapp] ✅ Test message sent successfully");
        console.log(`  Message ID: ${testMessageResult.messageId}`);
        console.log(`  Status: ${testMessageResult.status}`);
      } catch (error) {
        console.error("[test-whatsapp] ❌ Failed to send test message:", error);

        testMessageResult = {
          success: false,
          error: error.message,
        };
      }
    }

    // Step 5: Return comprehensive diagnostics
    console.log(
      "[test-whatsapp] ==================== SUCCESS ====================",
    );

    return Response.json({
      ok: true,
      provider: "Infobip",
      config: configInfo,
      authentication: authTestResult,
      testMessage: testMessageResult,
      timestamp: new Date().toISOString(),
      message:
        "Infobip WhatsApp integration is configured and working correctly",
    });
  } catch (error) {
    console.error("[test-whatsapp] Unexpected error:", error);

    return Response.json(
      {
        ok: false,
        step: "unexpected_error",
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
