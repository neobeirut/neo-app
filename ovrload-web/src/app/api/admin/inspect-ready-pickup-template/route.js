import sql from "@/app/api/utils/sql";
import { getTemplateStructure } from "@/app/api/utils/whatsappTemplateRegistry";

/**
 * Inspect ready_pickup template configuration
 * Shows:
 * 1. Database configuration (template name, language)
 * 2. Code structure definition (what our code thinks the template looks like)
 * 3. Guidance on how to check Infobip's actual approved template
 */
export async function GET() {
  try {
    console.log("🔍 Inspecting ready_pickup template configuration...");

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Get Database Configuration
    // ═══════════════════════════════════════════════════════════════════════
    const [dbSetting] = await sql`
      SELECT setting_key, setting_value, updated_at
      FROM app_settings
      WHERE setting_key = 'whatsapp_template_ready_pickup'
      LIMIT 1
    `;

    let dbConfig = null;
    let dbConfigError = null;

    if (dbSetting) {
      try {
        dbConfig = JSON.parse(dbSetting.setting_value);
      } catch (e) {
        dbConfigError = e.message;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Get Code Structure Definition
    // ═══════════════════════════════════════════════════════════════════════
    const codeStructure = getTemplateStructure("ready_pickup");

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Build Diagnostic Report
    // ═══════════════════════════════════════════════════════════════════════
    const report = {
      timestamp: new Date().toISOString(),

      // Database Configuration
      database: {
        exists: !!dbSetting,
        rawValue: dbSetting?.setting_value || null,
        parsed: dbConfig,
        parseError: dbConfigError,
        updatedAt: dbSetting?.updated_at || null,

        // Extracted fields
        templateName:
          dbConfig?.template_name ||
          dbConfig?.templateName ||
          dbConfig?.name ||
          null,
        language: dbConfig?.language || dbConfig?.locale || null,
      },

      // Code Structure (what our code expects)
      codeStructure: codeStructure || null,

      // Infobip Inspection Instructions
      infobipInspectionInstructions: {
        step1: "Go to Infobip dashboard: https://portal.infobip.com",
        step2:
          "Navigate to: Solutions → Channels → WhatsApp → Message Templates",
        step3: `Search for template name: "${dbConfig?.template_name || dbConfig?.templateName || "ready_pickup"}"`,
        step4: "Click on the template to view its structure",
        step5: "Check the following:",
        checkList: [
          "✓ Does it have a HEADER? (image/video/document)",
          "✓ What is the BODY text? How many {{placeholders}} does it have?",
          "✓ Does it have BUTTONS?",
          "✓ Does it have a FOOTER?",
          "✓ What is the LANGUAGE code?",
          "✓ What is the STATUS? (Approved/Pending/Rejected)",
        ],
        step6: "Compare Infobip structure to our code structure above",
      },

      // Mismatch Detection
      potentialIssues: [],
    };

    // Detect potential issues
    if (!dbSetting) {
      report.potentialIssues.push({
        severity: "ERROR",
        issue: "Template not configured in database",
        fix: "Configure ready_pickup template in Admin → Settings → WhatsApp Templates",
      });
    }

    if (dbConfigError) {
      report.potentialIssues.push({
        severity: "ERROR",
        issue: `Failed to parse database config: ${dbConfigError}`,
        fix: "Fix JSON syntax in app_settings.setting_value",
      });
    }

    if (!codeStructure) {
      report.potentialIssues.push({
        severity: "ERROR",
        issue: "Template structure not defined in code",
        fix: "Add ready_pickup to TEMPLATE_STRUCTURES in whatsappTemplateRegistry.js",
      });
    }

    if (!report.database.templateName) {
      report.potentialIssues.push({
        severity: "ERROR",
        issue: "Template name missing in database config",
        fix: "Add template_name field to database config",
      });
    }

    // Error code 7008 specific guidance
    report.error7008Guidance = {
      errorCode: 7008,
      errorName: "Failed to match template parameters",
      commonCauses: [
        "Payload structure doesn't match approved template in Infobip",
        "Placeholder count mismatch (payload has different number than template)",
        "Header/media included in payload but template doesn't have it (or vice versa)",
        "Button structure mismatch",
        "Language code mismatch",
      ],
      debugSteps: [
        "1. Run forensic comparison: POST /api/admin/whatsapp-forensic-comparison",
        "2. Check finalRequestBodyString - this is the EXACT payload sent to Infobip",
        "3. Compare payload structure to approved template structure in Infobip dashboard",
        "4. Look for fields in payload that template doesn't have (or missing fields template expects)",
        "5. Update TEMPLATE_STRUCTURES in whatsappTemplateRegistry.js to match approved template EXACTLY",
      ],
    };

    // Return comprehensive report
    return Response.json(report, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("❌ Template inspection failed:", error);
    return Response.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
