import sql from "@/app/api/utils/sql";
import { buildTemplatePayloadFromStatus } from "@/app/api/utils/whatsappTemplateRegistry";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHATSAPP FORENSIC COMPARISON ENDPOINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tests BOTH success and failure scenarios side-by-side
 * Returns complete forensic data for comparison
 *
 * Usage:
 * POST /api/admin/whatsapp-forensic-comparison
 * {
 *   "phone": "+1234567890",
 *   "successStatus": "completed",
 *   "failureStatus": "ready_pickup",
 *   "orderId": 123
 * }
 */

export async function POST(req) {
  try {
    const body = await req.json();
    const { phone, successStatus, failureStatus, orderId } = body;

    if (!phone || !successStatus || !failureStatus) {
      return Response.json(
        {
          error: "Missing required fields: phone, successStatus, failureStatus",
        },
        { status: 400 },
      );
    }

    console.log(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║ 🔬 WHATSAPP FORENSIC COMPARISON TEST                          ║",
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(`║ Phone:             ${phone.padEnd(43)}║`);
    console.log(`║ Success Status:    ${successStatus.padEnd(43)}║`);
    console.log(`║ Failure Status:    ${failureStatus.padEnd(43)}║`);
    console.log(`║ Order ID:          ${String(orderId || "N/A").padEnd(43)}║`);
    console.log(
      "╚════════════════════════════════════════════════════════════════╝",
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Get DB Template Settings
    // ═══════════════════════════════════════════════════════════════════════
    const dbTemplateSettings = await sql`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'whatsapp_template_%'
      ORDER BY setting_key
    `;

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Test Success Scenario
    // ═══════════════════════════════════════════════════════════════════════
    console.log(
      "\n┌─────────────────────────────────────────────────────────────┐",
    );
    console.log(
      "│ 🟢 TESTING SUCCESS SCENARIO                                 │",
    );
    console.log(
      "└─────────────────────────────────────────────────────────────┘",
    );

    const successTest = await testStatusSend({
      phone,
      status: successStatus,
      orderId,
      label: "SUCCESS",
    });

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Test Failure Scenario
    // ═══════════════════════════════════════════════════════════════════════
    console.log(
      "\n┌─────────────────────────────────────────────────────────────┐",
    );
    console.log(
      "│ 🔴 TESTING FAILURE SCENARIO                                 │",
    );
    console.log(
      "└─────────────────────────────────────────────────────────────┘",
    );

    const failureTest = await testStatusSend({
      phone,
      status: failureStatus,
      orderId,
      label: "FAILURE",
    });

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Return Side-by-Side Comparison
    // ═══════════════════════════════════════════════════════════════════════
    const comparison = {
      metadata: {
        timestamp: new Date().toISOString(),
        phone,
        orderId: orderId || null,
      },
      dbTemplateSettings: dbTemplateSettings.map((row) => ({
        key: row.setting_key,
        value: row.setting_value,
      })),
      success: successTest,
      failure: failureTest,
      differences: {
        status: {
          success: successTest.status,
          failure: failureTest.status,
          different: successTest.status !== failureTest.status,
        },
        sender: {
          success: successTest.sender,
          failure: failureTest.sender,
          different: successTest.sender !== failureTest.sender,
        },
        actualSenderSent: {
          success: successTest.actualSenderSent,
          failure: failureTest.actualSenderSent,
          different:
            successTest.actualSenderSent !== failureTest.actualSenderSent,
        },
        templateName: {
          success: successTest.templateName,
          failure: failureTest.templateName,
          different: successTest.templateName !== failureTest.templateName,
        },
        language: {
          success: successTest.language,
          failure: failureTest.language,
          different: successTest.language !== failureTest.language,
        },
        bodyPlaceholders: {
          success: successTest.bodyPlaceholders,
          failure: failureTest.bodyPlaceholders,
          different:
            JSON.stringify(successTest.bodyPlaceholders) !==
            JSON.stringify(failureTest.bodyPlaceholders),
        },
        hasHeader: {
          success: successTest.hasHeader,
          failure: failureTest.hasHeader,
          different: successTest.hasHeader !== failureTest.hasHeader,
        },
        hasMedia: {
          success: successTest.hasMedia,
          failure: failureTest.hasMedia,
          different: successTest.hasMedia !== failureTest.hasMedia,
        },
        httpStatus: {
          success: successTest.httpStatus,
          failure: failureTest.httpStatus,
          different: successTest.httpStatus !== failureTest.httpStatus,
        },
      },
    };

    return Response.json(comparison, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("❌ Forensic comparison failed:", error);
    return Response.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}

/**
 * Test sending WhatsApp for a specific status
 * Returns complete forensic data
 */
async function testStatusSend({ phone, status, orderId, label }) {
  console.log(`\n[${label}] Building template payload for status: ${status}`);

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Build Template Payload (with full debug data)
    // ═══════════════════════════════════════════════════════════════════════
    const payloadResult = await buildTemplatePayloadFromStatus(
      status,
      "pickup", // default to pickup for ready_pickup template
      { orderId: String(orderId || 999), branchName: "Test Branch" }, // dynamicData
      process.env.INFOBIP_WHATSAPP_SENDER || "96176489078", // from
      phone, // to
    );

    console.log(`[${label}] ✅ Payload built successfully`);
    console.log(
      `[${label}] Debug data:`,
      JSON.stringify(payloadResult.debug, null, 2),
    );

    // Extract ALL detailed info from payload and debug
    const { payload, debug, templateConfig, structure } = payloadResult;
    const message = payload?.messages?.[0] || {};
    const content = message.content || {};
    const templateData = content.templateData || {};

    // ════════════════════════════════════════════════════════════════════
    // COMPREHENSIVE DEBUG DATA EXTRACTION
    // ════════════════════════════════════════════════════════════════════

    // Sender information
    const sender = message.from || null;
    const recipient = message.to || null;

    // Template identification
    const templateName = content.templateName || null;
    const language = content.language || null;

    // Body information
    const bodyData = templateData.body || null;
    const bodyPlaceholders = bodyData?.placeholders || null;
    const bodyPlaceholderCount = Array.isArray(bodyPlaceholders)
      ? bodyPlaceholders.length
      : 0;

    // Header information
    const headerData = templateData.header || null;
    const hasHeader = !!headerData;
    const headerType = headerData?.type || null; // IMAGE, VIDEO, DOCUMENT, TEXT
    const headerMediaUrl = headerData?.mediaUrl || null;
    const headerPlaceholders = headerData?.placeholders || null;

    // Media information (legacy field, might be same as header)
    const mediaData = templateData.media || null;
    const hasMedia = !!mediaData;
    const mediaType = mediaData?.type || null;
    const mediaUrl = mediaData?.mediaUrl || mediaData?.url || null;

    // Button information
    const buttonsData = templateData.buttons || null;
    const hasButtons = !!buttonsData;
    const buttonCount = Array.isArray(buttonsData) ? buttonsData.length : 0;

    // Footer information
    const footerData = templateData.footer || null;
    const hasFooter = !!footerData;

    console.log(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      `║ 🔍 [${label}] COMPLETE DEBUG DATA EXTRACTION                  ║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(`║ Sender:                ${String(sender).padEnd(39)}║`);
    console.log(`║ Recipient:             ${String(recipient).padEnd(39)}║`);
    console.log(`║ Template Name:         ${String(templateName).padEnd(39)}║`);
    console.log(`║ Language:              ${String(language).padEnd(39)}║`);
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ BODY:                                                          ║`,
    );
    console.log(
      `║   Placeholders:        ${JSON.stringify(bodyPlaceholders)
        .substring(0, 39)
        .padEnd(39)}║`,
    );
    console.log(
      `║   Count:               ${String(bodyPlaceholderCount).padEnd(39)}║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ HEADER:                                                        ║`,
    );
    console.log(`║   Has Header:          ${String(hasHeader).padEnd(39)}║`);
    console.log(
      `║   Type:                ${String(headerType || "N/A").padEnd(39)}║`,
    );
    console.log(
      `║   Media URL:           ${String(headerMediaUrl || "N/A")
        .substring(0, 39)
        .padEnd(39)}║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ MEDIA (legacy):                                                ║`,
    );
    console.log(`║   Has Media:           ${String(hasMedia).padEnd(39)}║`);
    console.log(
      `║   Type:                ${String(mediaType || "N/A").padEnd(39)}║`,
    );
    console.log(
      `║   URL:                 ${String(mediaUrl || "N/A")
        .substring(0, 39)
        .padEnd(39)}║`,
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ BUTTONS:                                                       ║`,
    );
    console.log(`║   Has Buttons:         ${String(hasButtons).padEnd(39)}║`);
    console.log(`║   Count:               ${String(buttonCount).padEnd(39)}║`);
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ FOOTER:                                                        ║`,
    );
    console.log(`║   Has Footer:          ${String(hasFooter).padEnd(39)}║`);
    console.log(
      "╚════════════════════════════════════════════════════════════════╝",
    );

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Send to Infobip (Capture Request & Response)
    // ═══════════════════════════════════════════════════════════════════════
    console.log(`[${label}] Sending to Infobip...`);

    let finalRequestBodyString = null;
    let rawInfobipResponse = null;
    let httpStatus = null;
    let xRequestId = null;
    let sendError = null;
    let infobipErrorCode = null;
    let infobipErrorMessage = null;
    let actualSenderSent = null; // ← Extract sender from actual HTTP request

    try {
      // Use the actual payload we built (don't rebuild)
      const requestBody = payload;
      finalRequestBodyString = JSON.stringify(requestBody, null, 2);

      console.log("📤 FORENSIC CAPTURE - Final Request Body:");
      console.log(finalRequestBodyString);

      // ════════════════════════════════════════════════════════════════════
      // 🔍 EXTRACT ACTUAL SENDER FROM HTTP REQUEST BODY STRING
      // ════════════════════════════════════════════════════════════════════
      try {
        const parsedRequest = JSON.parse(finalRequestBodyString);
        actualSenderSent = parsedRequest?.messages?.[0]?.from || null;
        console.log(
          `[${label}] 🔍 Actual sender in HTTP request: ${actualSenderSent}`,
        );
      } catch (e) {
        console.error(
          `[${label}] Failed to parse request body for sender extraction`,
        );
      }

      // Send to Infobip
      const response = await fetch(
        `${process.env.INFOBIP_BASE_URL}/whatsapp/1/message/template`,
        {
          method: "POST",
          headers: {
            Authorization: `App ${process.env.INFOBIP_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: finalRequestBodyString,
        },
      );

      httpStatus = response.status;
      xRequestId = response.headers.get("x-request-id");

      const text = await response.text();

      try {
        rawInfobipResponse = JSON.parse(text);
      } catch (e) {
        rawInfobipResponse = { rawText: text };
      }

      console.log("📥 FORENSIC CAPTURE - Response:");
      console.log(`HTTP Status: ${httpStatus}`);
      console.log(`X-Request-ID: ${xRequestId}`);
      console.log(JSON.stringify(rawInfobipResponse, null, 2));

      // Extract error details if present
      if (rawInfobipResponse?.requestError) {
        const serviceError = rawInfobipResponse.requestError.serviceException;
        infobipErrorCode = serviceError?.messageId || null;
        infobipErrorMessage = serviceError?.text || null;
      }

      console.log(`[${label}] ✅ Send completed - HTTP ${httpStatus}`);

      if (!response.ok) {
        throw new Error(
          `Infobip returned ${httpStatus}: ${JSON.stringify(rawInfobipResponse)}`,
        );
      }
    } catch (error) {
      sendError = {
        message: error.message,
        stack: error.stack,
      };
      console.error(`[${label}] ❌ Send failed:`, error.message);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Return COMPLETE Forensic Data
    // ═══════════════════════════════════════════════════════════════════════
    return {
      // Status & Template Info
      status,
      templateKey: debug?.templateKey || null,
      templateName,
      language,

      // Sender Info
      sender,
      actualSenderSent,
      recipient,

      // Body Data
      bodyPlaceholders,
      bodyPlaceholderCount,
      bodyData,

      // Header Data
      hasHeader,
      headerType,
      headerMediaUrl,
      headerPlaceholders,
      headerData,

      // Media Data (legacy)
      hasMedia,
      mediaType,
      mediaUrl,
      mediaData,

      // Button Data
      hasButtons,
      buttonCount,
      buttonsData,

      // Footer Data
      hasFooter,
      footerData,

      // Complete Template Data
      templateData,

      // Network Data
      finalRequestBodyString,
      rawInfobipResponse,
      httpStatus,
      xRequestId,

      // Error Data
      sendError,
      infobipErrorCode,
      infobipErrorMessage,

      // Full Debug Data
      fullPayload: payload,
      fullDebug: debug,
      templateStructure: structure,
      templateConfig,
    };
  } catch (error) {
    console.error(`[${label}] ❌ Test failed:`, error);
    return {
      status,
      sender: null,
      actualSenderSent: null,
      error: {
        message: error.message,
        stack: error.stack,
      },
    };
  }
}
