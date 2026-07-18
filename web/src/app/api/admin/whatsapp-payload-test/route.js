import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { getTemplateConfig } from "@/app/api/utils/customerWhatsApp";
import {
  getInfobipConfig,
  toInfobipRecipient,
} from "@/app/api/utils/infobipWhatsApp";
import sql from "@/app/api/utils/sql";

/**
 * WhatsApp Payload Test Endpoint
 *
 * Compare exact payloads that will be sent for different template types.
 * Helps diagnose payload structure issues without actually sending to Infobip.
 *
 * Tests:
 * 1. OTP template (AUTHENTICATION with buttons)
 * 2. Order status templates (UTILITY without buttons)
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

    const body = await request.json().catch(() => ({}));
    const { testPhone = "+96176489078", testOTP = "123456" } = body;

    const cfg = getInfobipConfig();
    const to = toInfobipRecipient(testPhone);

    // Build comparison
    const comparison = {
      testPhone,
      sender: cfg.sender,
      endpoint: "/whatsapp/1/message/template",
      baseUrl: cfg.baseUrl,
      tests: [],
    };

    // Test 1: OTP Template
    try {
      const [otpSetting] = await sql`
        SELECT setting_value
        FROM app_settings
        WHERE setting_key = 'whatsapp_template_otp'
        LIMIT 1
      `;

      if (otpSetting) {
        const otpConfig = JSON.parse(otpSetting.setting_value);

        const otpPayload = {
          messages: [
            {
              from: cfg.sender,
              to,
              messageId: `otp-template-test-${Date.now()}`,
              content: {
                templateName: otpConfig.template_name || otpConfig.templateName,
                templateData: {
                  body: {
                    placeholders: [testOTP],
                  },
                  buttons: [
                    {
                      type: "URL",
                      parameter: testOTP,
                    },
                  ],
                },
                language: otpConfig.language || "en",
              },
            },
          ],
        };

        comparison.tests.push({
          templateType: "OTP (AUTHENTICATION)",
          templateName: otpConfig.template_name || otpConfig.templateName,
          language: otpConfig.language || "en",
          category: "AUTHENTICATION",
          expectedStructure: {
            hasBody: true,
            bodyPlaceholders: 1,
            hasButtons: true,
            buttonType: "URL",
          },
          payload: otpPayload,
          analysis: {
            bodyIncluded: true,
            bodyPlaceholdersCount: 1,
            buttonsIncluded: true,
            buttonsCount: 1,
            templateDataEmpty: false,
          },
          status: "✅ Correct (includes buttons for AUTHENTICATION)",
        });
      }
    } catch (e) {
      comparison.tests.push({
        templateType: "OTP (AUTHENTICATION)",
        error: `Failed to build OTP payload: ${e.message}`,
        status: "❌ Error",
      });
    }

    // Test 2: Utility Templates (Order Status)
    const utilityTemplates = [
      { key: "pending", status: "pending" },
      { key: "preparing", status: "preparing" },
      { key: "ready_pickup", status: "ready", orderType: "pickup" },
      { key: "ready_delivery", status: "ready", orderType: "delivery" },
      { key: "out_for_delivery", status: "out_for_delivery" },
      { key: "completed", status: "completed" },
      { key: "cancelled", status: "cancelled" },
    ];

    for (const template of utilityTemplates) {
      try {
        const config = await getTemplateConfig(
          template.status,
          template.orderType || "delivery",
        );

        if (config) {
          // Simulate what buildTemplatePayload does
          const parameters = [];
          const placeholders =
            parameters.length > 0
              ? parameters
                  .filter((p) => p && p.value !== undefined && p.value !== null)
                  .map((p) => String(p.value))
              : [];

          const templateData = {};
          if (placeholders.length > 0) {
            templateData.body = { placeholders };
          }

          const utilityPayload = {
            messages: [
              {
                from: cfg.sender,
                to,
                messageId: `template-test-${Date.now()}`,
                content: {
                  templateName: config.templateName,
                  templateData,
                  language: config.language || "en",
                },
              },
            ],
          };

          comparison.tests.push({
            templateType: `${template.key.toUpperCase()} (UTILITY)`,
            templateName: config.templateName,
            language: config.language || "en",
            category: "UTILITY",
            expectedStructure: {
              hasBody: false,
              bodyPlaceholders: 0,
              hasButtons: false,
              buttonType: null,
            },
            payload: utilityPayload,
            analysis: {
              bodyIncluded: placeholders.length > 0,
              bodyPlaceholdersCount: placeholders.length,
              buttonsIncluded: false,
              buttonsCount: 0,
              templateDataEmpty: Object.keys(templateData).length === 0,
            },
            status:
              Object.keys(templateData).length === 0
                ? "✅ Correct (empty templateData for static template)"
                : "⚠️  Warning (templateData not empty)",
          });
        } else {
          comparison.tests.push({
            templateType: `${template.key.toUpperCase()} (UTILITY)`,
            error: `Template not configured in database`,
            status: "⚠️  Not configured",
          });
        }
      } catch (e) {
        comparison.tests.push({
          templateType: `${template.key.toUpperCase()} (UTILITY)`,
          error: `Failed to build payload: ${e.message}`,
          status: "❌ Error",
        });
      }
    }

    // Summary
    const correctCount = comparison.tests.filter((t) =>
      t.status?.startsWith("✅"),
    ).length;
    const warningCount = comparison.tests.filter((t) =>
      t.status?.startsWith("⚠️"),
    ).length;
    const errorCount = comparison.tests.filter((t) =>
      t.status?.startsWith("❌"),
    ).length;

    return Response.json({
      ok: true,
      summary: {
        total: comparison.tests.length,
        correct: correctCount,
        warnings: warningCount,
        errors: errorCount,
      },
      comparison,
      note: "This endpoint shows the exact payload structure that will be sent to Infobip for each template type. Use this to verify the fix is working correctly.",
      interpretation: {
        authentication_templates:
          "Should include both body.placeholders and buttons fields",
        utility_templates:
          "Should have empty templateData {} if no placeholders needed",
        common_issue:
          "Error 7009 occurs when payload includes fields template doesn't have",
      },
    });
  } catch (error) {
    console.error("[whatsapp-payload-test POST] error", error);
    return Response.json(
      { ok: false, error: error.message || "Failed to test payloads" },
      { status: 500 },
    );
  }
}
