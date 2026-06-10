import sql from "@/app/api/utils/sql";
import { fetchInfobipTemplateSchema } from "@/app/api/utils/infobipWhatsApp";
import { getTemplateKeyForStatus } from "@/app/api/utils/whatsappTemplateRegistry";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHATSAPP TEMPLATE SCHEMA AUDIT ENDPOINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * PURPOSE:
 * Compare DB-stored template schemas with ACTUAL approved Infobip templates
 * Show mismatches and generate migration SQL to fix
 *
 * CRITICAL REQUIREMENT:
 * DB schemas MUST exactly match Infobip approved structure
 * No fallback defaults allowed for production templates
 *
 * RETURNS:
 * - For each template:
 *   - DB schema (what we think it is)
 *   - Infobip schema (what it actually is)
 *   - Mismatch fields
 *   - Fix SQL
 */

export async function GET(request) {
  try {
    console.log(
      "╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║ 🔍 WHATSAPP TEMPLATE SCHEMA AUDIT                              ║",
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      "║ Comparing DB schemas vs. actual Infobip approved templates    ║",
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝",
    );

    // Step 1: Get all templates from DB
    const rows = await sql`
      SELECT setting_key, setting_value, updated_at
      FROM app_settings
      WHERE setting_key LIKE 'whatsapp_template_%'
      ORDER BY setting_key
    `;

    const auditResults = [];
    const sqlFixes = [];

    // Step 2: For each template, fetch actual Infobip structure and compare
    for (const row of rows) {
      const templateKey = row.setting_key.replace("whatsapp_template_", "");

      console.log(`\n🔍 Auditing template: ${templateKey}...`);

      let dbConfig = null;
      let parseError = null;

      try {
        dbConfig = JSON.parse(row.setting_value);
      } catch (error) {
        parseError = error.message;
      }

      if (!dbConfig) {
        auditResults.push({
          templateKey,
          dbKey: row.setting_key,
          status: "❌ CRITICAL",
          error: `Failed to parse DB config: ${parseError}`,
          dbSchema: null,
          infobipSchema: null,
          mismatches: ["Cannot parse DB config"],
          fixSql: null,
        });
        continue;
      }

      // Extract DB schema
      const templateName =
        dbConfig.template_name || dbConfig.templateName || dbConfig.name;
      const language = dbConfig.language || dbConfig.locale || "en";
      const dbSchema = dbConfig.schema || null;

      if (!templateName) {
        auditResults.push({
          templateKey,
          dbKey: row.setting_key,
          status: "❌ CRITICAL",
          error: "Missing template_name in DB config",
          dbSchema,
          infobipSchema: null,
          mismatches: ["Missing template_name"],
          fixSql: null,
        });
        continue;
      }

      // Fetch actual Infobip schema
      const infobipResult = await fetchInfobipTemplateSchema(
        templateName,
        language,
      );

      if (infobipResult.error || !infobipResult.schema) {
        auditResults.push({
          templateKey,
          dbKey: row.setting_key,
          templateName,
          language,
          status: "❌ NOT FOUND IN INFOBIP",
          error: infobipResult.error,
          dbSchema,
          infobipSchema: null,
          mismatches: ["Template not found in Infobip or not approved"],
          fixSql: null,
        });
        continue;
      }

      const infobipSchema = infobipResult.schema;

      // Compare schemas
      const mismatches = [];

      if (!dbSchema) {
        mismatches.push(
          "❗ CRITICAL: DB has no schema field (using fallback defaults)",
        );
      } else {
        // Compare each field
        const fieldsToCheck = [
          "category",
          "bodyPlaceholderCount",
          "hasHeader",
          "headerType",
          "hasButtons",
          "buttonCount",
          "buttonType",
          "hasFooter",
        ];

        for (const field of fieldsToCheck) {
          const dbValue = dbSchema[field];
          const infobipValue = infobipSchema[field];

          // Normalize for comparison
          const dbNorm =
            dbValue === null || dbValue === undefined ? null : dbValue;
          const infobipNorm =
            infobipValue === null || infobipValue === undefined
              ? null
              : infobipValue;

          if (JSON.stringify(dbNorm) !== JSON.stringify(infobipNorm)) {
            mismatches.push(
              `${field}: DB=${JSON.stringify(dbNorm)} vs Infobip=${JSON.stringify(infobipNorm)}`,
            );
          }
        }
      }

      // Generate fix SQL
      let fixSql = null;
      if (mismatches.length > 0) {
        const updatedConfig = {
          ...dbConfig,
          schema: infobipSchema,
        };

        fixSql = `
-- Fix template: ${templateKey}
UPDATE app_settings
SET setting_value = '${JSON.stringify(updatedConfig).replace(/'/g, "''")}'
WHERE setting_key = '${row.setting_key}';
`.trim();

        sqlFixes.push(fixSql);
      }

      // Determine status
      let status = "✅ MATCH";
      if (mismatches.length > 0) {
        status = "⚠️ MISMATCH";
      }

      auditResults.push({
        templateKey,
        dbKey: row.setting_key,
        templateName,
        language,
        status,
        dbSchema,
        infobipSchema,
        mismatches,
        fixSql,
        updatedAt: row.updated_at,
      });

      console.log(`  Status: ${status}`);
      if (mismatches.length > 0) {
        console.log(`  Mismatches: ${mismatches.length}`);
        mismatches.forEach((m) => console.log(`    - ${m}`));
      }
    }

    // Generate summary
    const totalTemplates = auditResults.length;
    const matchingTemplates = auditResults.filter(
      (r) => r.status === "✅ MATCH",
    ).length;
    const mismatchTemplates = auditResults.filter(
      (r) => r.status === "⚠️ MISMATCH",
    ).length;
    const criticalTemplates = auditResults.filter(
      (r) => r.status.includes("CRITICAL") || r.status.includes("NOT FOUND"),
    ).length;

    const summary = {
      totalTemplates,
      matchingTemplates,
      mismatchTemplates,
      criticalTemplates,
      healthPercentage:
        totalTemplates > 0
          ? Math.round((matchingTemplates / totalTemplates) * 100)
          : 0,
    };

    console.log(
      "\n╔════════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║ 📊 AUDIT SUMMARY                                               ║",
    );
    console.log(
      "╠════════════════════════════════════════════════════════════════╣",
    );
    console.log(
      `║ Total Templates:       ${String(totalTemplates).padEnd(39)}║`,
    );
    console.log(
      `║ ✅ Matching:           ${String(matchingTemplates).padEnd(39)}║`,
    );
    console.log(
      `║ ⚠️  Mismatches:         ${String(mismatchTemplates).padEnd(39)}║`,
    );
    console.log(
      `║ ❌ Critical Issues:    ${String(criticalTemplates).padEnd(39)}║`,
    );
    console.log(
      `║ Health Score:          ${String(summary.healthPercentage)}%${" ".repeat(37 - String(summary.healthPercentage).length)}║`,
    );
    console.log(
      "╚════════════════════════════════════════════════════════════════╝",
    );

    // Generate migration guide
    const migrationGuide =
      sqlFixes.length > 0
        ? `
-- ═══════════════════════════════════════════════════════════════════════════
-- WHATSAPP TEMPLATE SCHEMA MIGRATION
-- Generated: ${new Date().toISOString()}
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CRITICAL: These schemas are from actual approved Infobip templates
-- DB schemas MUST match Infobip reality for correct payload generation
--
-- HOW TO APPLY:
-- 1. Review each UPDATE statement below
-- 2. Verify template names and schemas match your Infobip dashboard
-- 3. Run all UPDATE statements in your database
-- 4. Re-run audit endpoint to verify all templates show "✅ MATCH"
--
-- ═══════════════════════════════════════════════════════════════════════════

${sqlFixes.join("\n\n")}

-- ═══════════════════════════════════════════════════════════════════════════
-- END MIGRATION
-- ═══════════════════════════════════════════════════════════════════════════
`.trim()
        : "-- No migration needed - all templates match Infobip schemas! 🎉";

    return Response.json({
      success: true,
      summary,
      auditResults,
      migrationSql: migrationGuide,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Audit failed:", error);
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
