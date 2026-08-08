import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import {
  getTemplateConfig,
  buildWhatsAppTemplatePayload,
  validateTemplatePayload,
  getTemplateStructure,
} from "@/app/api/utils/whatsappTemplateRegistry";
import { getInfobipConfig } from "@/app/api/utils/infobipWhatsApp";

/**
 * Test WhatsApp Template Payload Generation
 *
 * This endpoint allows testing template payload generation without
 * actually sending to Infobip. Useful for validating template structure
 * and payload before real sends.
 */
export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { ok: false, error: "Admin authentication required" },
        { status: 401 },
      );
    }

    const roles = Array.isArray(admin?.roles) ? admin.roles : [];
    const hasAccess = roles.includes("backend") || roles.includes("settings");

    if (!hasAccess) {
      return Response.json(
        { ok: false, error: "Unauthorized - settings permission required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { templateKey, testData } = body;

    if (!templateKey) {
      return Response.json(
        { ok: false, error: "templateKey is required" },
        { status: 400 },
      );
    }

    // Get template config from database
    const config = await getTemplateConfig(templateKey);
    if (!config) {
      return Response.json(
        {
          ok: false,
          error: `Template not configured: ${templateKey}`,
          hint: `Configure this template in Admin → Settings → WhatsApp Templates with key 'whatsapp_template_${templateKey}'`,
        },
        { status: 404 },
      );
    }

    // Get template structure from registry
    const structure = getTemplateStructure(templateKey);
    if (!structure) {
      return Response.json(
        {
          ok: false,
          error: `Template structure not defined: ${templateKey}`,
          hint: `Add template structure to TEMPLATE_STRUCTURES in whatsappTemplateRegistry.js`,
        },
        { status: 404 },
      );
    }

    // Prepare test data
    const data = testData || {};
    if (!data.placeholders && structure.bodyPlaceholderCount > 0) {
      data.placeholders = Array(structure.bodyPlaceholderCount)
        .fill(null)
        .map((_, i) => `TEST_VALUE_${i + 1}`);
    }
    if (
      !data.buttonParams &&
      structure.hasButtons &&
      structure.buttonStructure
    ) {
      data.buttonParams = Array(structure.buttonStructure.count)
        .fill(null)
        .map((_, i) => `TEST_BUTTON_${i + 1}`);
    }

    // Validate
    const validation = validateTemplatePayload(templateKey, config, data);

    // Build payload
    const cfg = getInfobipConfig();
    const testPhone = "+96176489078"; // Test phone
    const payload = buildWhatsAppTemplatePayload(
      templateKey,
      config,
      data,
      cfg.sender,
      testPhone,
    );

    return Response.json({
      ok: true,
      templateKey,
      config: {
        templateName: config.templateName,
        language: config.language,
      },
      structure: {
        category: structure.category,
        bodyPlaceholders: structure.bodyPlaceholderCount,
        hasButtons: structure.hasButtons,
        buttonStructure: structure.buttonStructure,
      },
      validation: {
        valid: validation.valid,
        errors: validation.errors,
      },
      testData: data,
      generatedPayload: payload,
      explanation: {
        bodyIncluded: !!payload.messages[0].content.templateData.body,
        buttonsIncluded: !!payload.messages[0].content.templateData.buttons,
        placeholderCount:
          payload.messages[0].content.templateData.body?.placeholders?.length ||
          0,
        buttonCount:
          payload.messages[0].content.templateData.buttons?.length || 0,
      },
    });
  } catch (error) {
    console.error("[whatsapp-template-test POST] error", error);
    return Response.json(
      { ok: false, error: error.message || "Failed to test template" },
      { status: 500 },
    );
  }
}
