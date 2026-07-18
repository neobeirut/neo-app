import sql from "@/app/api/utils/sql";
import { getInfobipConfig, toE164 } from "@/app/api/utils/infobipWhatsApp";
import { getTemplateConfig } from "@/app/api/utils/customerWhatsApp";

/**
 * TEST ROUTE - Direct WhatsApp Status Update Test WITH FORENSIC DEBUG
 *
 * Returns ALL debug data in JSON response (not console logs)
 */

export async function POST(request) {
  const debugData = {
    step1_buildTemplatePayload: null,
    step2_beforeSend: null,
    step3_finalRequestBodyString: null,
    step4_hasBodyProperty: null,
    step5_templateDataKeys: null,
    step6_rawInfobipResponse: null,
    step7_infobipError: null,
  };

  try {
    const body = await request.json();
    const { phone, status, orderType } = body;

    // Validate inputs
    if (!phone) {
      return Response.json(
        { error: "phone is required", debugData },
        { status: 400 },
      );
    }

    if (!status) {
      return Response.json(
        { error: "status is required", debugData },
        { status: 400 },
      );
    }

    if (!orderType) {
      return Response.json(
        { error: "orderType is required (delivery or pickup)", debugData },
        { status: 400 },
      );
    }

    // Normalize phone
    const normalizedPhone = toE164(phone);

    // Get Infobip config
    const cfg = getInfobipConfig();

    // Get template config from database
    const templateConfig = await getTemplateConfig(status, orderType);

    if (!templateConfig) {
      return Response.json(
        {
          error: `No template configured for status "${status}" and order type "${orderType}"`,
          hint: "Configure templates in Admin → Settings → WhatsApp Templates",
          debugData,
        },
        { status: 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🔍 STEP 1: Manually build template payload (inline logic)
    // ═══════════════════════════════════════════════════════════════════════

    const parameters = []; // Empty for utility templates
    const placeholders = parameters
      .filter(
        (param) => param && param.value !== undefined && param.value !== null,
      )
      .map((param) => String(param.value));

    // Build content object step-by-step
    // 🔥 CRITICAL FIX: Infobip REQUIRES templateData.body.placeholders to ALWAYS be an array (never null/undefined)
    // Latest error: "messages.null.content.templateData.body.placeholders must not be null"
    // Solution: ALWAYS send placeholders as array (empty [] for utility templates with no variables)
    const content = {
      templateName: templateConfig.templateName,
      language: templateConfig.language || "en",
      templateData: {
        body: {
          placeholders: [], // ALWAYS start with empty array
        },
      },
    };

    // If placeholders exist, replace empty array with actual values
    if (placeholders && placeholders.length > 0) {
      content.templateData.body.placeholders = placeholders.map(String);
    }
    // Otherwise placeholders remains as empty array: []

    const step1Payload = {
      messages: [
        {
          from: cfg.sender,
          to: normalizedPhone,
          messageId: `test-${Date.now()}`,
          content,
        },
      ],
    };

    debugData.step1_buildTemplatePayload = JSON.parse(
      JSON.stringify(step1Payload),
    );
    debugData.step4_hasBodyProperty = Object.prototype.hasOwnProperty.call(
      step1Payload.messages[0].content.templateData || {},
      "body",
    );
    debugData.step5_templateDataKeys = Object.keys(
      step1Payload.messages[0].content.templateData || {},
    );

    // ═══════════════════════════════════════════════════════════════════════
    // 🔍 STEP 2: Payload before sending to infobipFetch
    // ═══════════════════════════════════════════════════════════════════════

    debugData.step2_beforeSend = JSON.parse(JSON.stringify(step1Payload));

    // ═══════════════════════════════════════════════════════════════════════
    // 🔍 STEP 3: Final request body string (what goes to fetch())
    // ═══════════════════════════════════════════════════════════════════════

    const requestBodyString = JSON.stringify(step1Payload);
    debugData.step3_finalRequestBodyString = requestBodyString;

    // Parse back to verify
    const parsedBack = JSON.parse(requestBodyString);
    debugData.parsedBack_hasBodyProperty = Object.prototype.hasOwnProperty.call(
      parsedBack.messages?.[0]?.content?.templateData || {},
      "body",
    );
    debugData.parsedBack_templateData =
      parsedBack.messages?.[0]?.content?.templateData;

    // ═══════════════════════════════════════════════════════════════════════
    // 🔍 STEP 4-6: Actually send to Infobip and capture response
    // ═══════════════════════════════════════════════════════════════════════

    const url = `${cfg.baseUrl}/whatsapp/1/message/template`;

    let response;
    let responseText = "";
    let responseJson = null;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `App ${cfg.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: requestBodyString,
      });

      responseText = await response.text().catch(() => "");

      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = null;
      }

      debugData.step6_rawInfobipResponse = {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        bodyText: responseText,
        bodyJson: responseJson,
      };

      if (!response.ok) {
        debugData.step7_infobipError = {
          status: response.status,
          statusText: response.statusText,
          responseJson: responseJson,
          responseText: responseText,
        };

        return Response.json(
          {
            success: false,
            error: `Infobip API returned ${response.status}: ${response.statusText}`,
            phone: normalizedPhone,
            status,
            orderType,
            templateName: templateConfig.templateName,
            language: templateConfig.language,
            resolvedTemplateKey:
              templateConfig.resolvedTemplateKey || templateConfig.templateName,
            resolvedTemplateName:
              templateConfig.resolvedTemplateName ||
              templateConfig.templateName,
            resolvedLanguage:
              templateConfig.resolvedLanguage || templateConfig.language,
            isHardCoded: templateConfig.isHardCoded || false,
            finalRequestBodyString: requestBodyString,
            debugData,
          },
          { status: 500 },
        );
      }

      // Success!
      return Response.json({
        success: true,
        message: "WhatsApp sent successfully",
        phone: normalizedPhone,
        status,
        orderType,
        templateName: templateConfig.templateName,
        language: templateConfig.language,
        messageId: responseJson?.messages?.[0]?.messageId,
        infobipStatus: responseJson?.messages?.[0]?.status,
        debugData,
      });
    } catch (fetchError) {
      debugData.step7_infobipError = {
        message: fetchError.message,
        stack: fetchError.stack,
        type: "network_error",
      };

      return Response.json(
        {
          success: false,
          error: `Network error: ${fetchError.message}`,
          phone: normalizedPhone,
          status,
          orderType,
          templateName: templateConfig.templateName,
          language: templateConfig.language,
          debugData,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    debugData.step7_infobipError = {
      message: error.message,
      stack: error.stack,
      type: "route_error",
    };

    return Response.json(
      {
        success: false,
        error: String(error?.message || error),
        stack: error?.stack,
        debugData,
      },
      { status: 500 },
    );
  }
}
