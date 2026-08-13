import sql from "@/app/api/utils/sql";
import {
  getTemplateConfig,
  toLebanonE164,
} from "@/app/api/utils/customerWhatsApp";
import {
  getInfobipConfig,
  infobipFetch,
} from "@/app/api/utils/infobipWhatsApp";

/**
 * 🔥 DIAGNOSTIC ENDPOINT - "preparing" Template Testing
 *
 * PURPOSE: Capture the EXACT payload being sent for "preparing" template
 * to diagnose error 7008 (Failed to match template parameters)
 *
 * This endpoint will:
 * 1. Build the "preparing" template config (same as production)
 * 2. Build the exact payload (same as production)
 * 3. Return the full request body WITHOUT sending to Infobip
 * 4. Optionally send if sendToInfobip=true query param
 *
 * Test URL: /api/_debug/test-preparing-template?phone=96176489078&sendToInfobip=true
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawPhone = searchParams.get("phone");
  const sendToInfobip = searchParams.get("sendToInfobip") === "true";

  if (!rawPhone) {
    return Response.json(
      {
        error: "Missing phone parameter",
        usage:
          "/api/_debug/test-preparing-template?phone=96176489078&sendToInfobip=true",
      },
      { status: 400 },
    );
  }

  try {
    // Step 1: Normalize phone
    const phone = toLebanonE164(rawPhone);

    // Step 2: Get template config (EXACT same as production)
    const templateConfig = await getTemplateConfig("preparing", "delivery");

    if (!templateConfig) {
      return Response.json(
        {
          error: "Template config not found for 'preparing'",
          hint: "Check app_settings table for whatsapp_template_preparing",
        },
        { status: 404 },
      );
    }

    // Step 3: Get Infobip config
    const cfg = getInfobipConfig();

    // Step 4: Build payload (EXACT same logic as buildTemplatePayload in infobipWhatsApp.js)
    const parameters = []; // preparing has no placeholders
    const placeholders = parameters
      .filter((p) => p && p.value !== undefined && p.value !== null)
      .map((p) => String(p.value));

    // Build content object (matching infobipWhatsApp.js logic)
    const content = {
      templateName: templateConfig.templateName,
      language: templateConfig.language || "en",
      templateData: {
        body: {
          placeholders: placeholders.length > 0 ? placeholders.map(String) : [],
        },
      },
    };

    const payload = {
      messages: [
        {
          from: cfg.sender,
          to: phone,
          messageId: `test-preparing-${Date.now()}`,
          content,
        },
      ],
    };

    // Step 5: Serialize to JSON string (EXACT as sent to fetch)
    const requestBodyString = JSON.stringify(payload);

    // Step 6: Build response with full diagnostic data
    const diagnosticData = {
      step1_inputPhone: rawPhone,
      step2_normalizedPhone: phone,
      step3_templateConfig: templateConfig,
      step4_infobipConfig: {
        sender: cfg.sender,
        baseUrl: cfg.baseUrl,
        apiKeyLength: cfg.apiKey?.length,
        apiKeyLast4: cfg.apiKey?.slice(-4),
      },
      step5_placeholdersArray: placeholders,
      step6_contentObject: content,
      step7_fullPayload: payload,
      step8_requestBodyString: requestBodyString,
      step9_requestBodyLength: requestBodyString.length,
      step10_parsedBack: JSON.parse(requestBodyString),

      verification: {
        templateNameMatches:
          payload.messages[0].content.templateName ===
          templateConfig.templateName,
        languageMatches:
          payload.messages[0].content.language ===
          (templateConfig.language || "en"),
        hasTemplateData: !!payload.messages[0].content.templateData,
        hasBody: !!payload.messages[0].content.templateData?.body,
        hasPlaceholders:
          !!payload.messages[0].content.templateData?.body?.placeholders,
        placeholdersIsArray: Array.isArray(
          payload.messages[0].content.templateData?.body?.placeholders,
        ),
        placeholdersLength:
          payload.messages[0].content.templateData?.body?.placeholders?.length,
        bodyKeys: Object.keys(
          payload.messages[0].content.templateData?.body || {},
        ),
        templateDataKeys: Object.keys(
          payload.messages[0].content.templateData || {},
        ),
      },

      infobipEndpoint: `${cfg.baseUrl}/whatsapp/1/message/template`,
      sendToInfobip: sendToInfobip,
    };

    // Step 7: Optionally send to Infobip
    let infobipResponse = null;
    let infobipError = null;

    if (sendToInfobip) {
      try {
        console.log("🔥 SENDING TO INFOBIP (test-preparing-template)");
        console.log("Endpoint:", `${cfg.baseUrl}/whatsapp/1/message/template`);
        console.log("Payload:", JSON.stringify(payload, null, 2));

        const result = await infobipFetch("/whatsapp/1/message/template", {
          method: "POST",
          body: payload,
        });

        infobipResponse = result;
      } catch (error) {
        infobipError = {
          message: error.message,
          stack: error.stack,
        };
      }
    }

    return Response.json(
      {
        success: true,
        diagnostic: diagnosticData,
        infobipResponse,
        infobipError,

        instructions: {
          step1:
            "Review 'step3_templateConfig' - this is what comes from the database",
          step2:
            "Review 'step7_fullPayload' - this is the exact payload being built",
          step3:
            "Review 'step8_requestBodyString' - this is the EXACT JSON string sent to Infobip",
          step4:
            "Review 'verification' - confirms all fields are correctly populated",
          step5:
            "Compare 'step3_templateConfig.templateName' to what you see in Infobip dashboard",
          step6:
            "Compare 'step3_templateConfig.language' to what you see in Infobip dashboard",
          step7:
            "If sendToInfobip=true, check 'infobipResponse' or 'infobipError'",
        },

        nextSteps: [
          "1. Go to Infobip Portal → Channels → WhatsApp → Templates",
          "2. Search for template name from 'step3_templateConfig.templateName'",
          "3. Verify: Category (MARKETING/UTILITY/AUTH), Language, Body Placeholders count",
          "4. If template has 0 placeholders, payload should have placeholders: []",
          '5. If template has N placeholders, payload should have placeholders: ["val1", "val2", ...]',
          "6. If error 7008 persists, template structure in Infobip doesn't match our payload",
          "7. Check if template is TEXT-only or MEDIA (image/video/document header)",
          "8. If MEDIA template, we may need to add header parameters",
        ],
      },
      { status: 200 },
    );
  } catch (error) {
    return Response.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
