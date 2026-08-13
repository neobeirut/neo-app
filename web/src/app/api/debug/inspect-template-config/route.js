import sql from "@/app/api/utils/sql";

/**
 * 🔍 TEMPLATE CONFIGURATION INSPECTOR
 *
 * PURPOSE: See EXACTLY what's stored in the database for WhatsApp templates
 *
 * Test URLs:
 * - /api/_debug/inspect-template-config?templateKey=preparing
 * - /api/_debug/inspect-template-config (shows all templates)
 */

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const templateKey = searchParams.get("templateKey");

  try {
    let templates;

    if (templateKey) {
      // Fetch specific template
      const settingKey = `whatsapp_template_${templateKey}`;
      templates = await sql`
        SELECT setting_key, setting_value, created_at, updated_at
        FROM app_settings
        WHERE setting_key = ${settingKey}
      `;
    } else {
      // Fetch all WhatsApp templates
      templates = await sql`
        SELECT setting_key, setting_value, created_at, updated_at
        FROM app_settings
        WHERE setting_key LIKE 'whatsapp_template_%'
        ORDER BY setting_key
      `;
    }

    if (!templates || templates.length === 0) {
      return Response.json(
        {
          error: "No templates found",
          templateKey,
          settingKey: templateKey ? `whatsapp_template_${templateKey}` : null,
        },
        { status: 404 },
      );
    }

    // Parse and enrich each template
    const enriched = templates.map((t) => {
      const key = t.setting_key;
      const rawValue = t.setting_value;

      let parsed = null;
      let parseError = null;

      try {
        parsed = JSON.parse(rawValue);
      } catch (e) {
        parseError = e.message;
      }

      return {
        setting_key: key,
        template_key: key.replace("whatsapp_template_", ""),
        raw_value: rawValue,
        parsed_value: parsed,
        parse_error: parseError,
        created_at: t.created_at,
        updated_at: t.updated_at,

        // Extract specific fields if parsed successfully
        template_name: parsed?.template_name || null,
        language: parsed?.language || null,
        project_id: parsed?.project_id || null,
        version_id: parsed?.version_id || null,

        // Validation checks
        validation: {
          has_template_name: !!parsed?.template_name,
          has_language: !!parsed?.language,
          has_bird_fields: !!(parsed?.project_id || parsed?.version_id),
          template_name_matches_key:
            parsed?.template_name === key.replace("whatsapp_template_", ""),
        },
      };
    });

    return Response.json(
      {
        success: true,
        count: enriched.length,
        templates: enriched,

        usage: {
          allTemplates: "/api/_debug/inspect-template-config",
          specificTemplate:
            "/api/_debug/inspect-template-config?templateKey=preparing",
        },

        instructions: [
          "1. Check 'template_name' - this MUST match exactly what's in Infobip dashboard",
          "2. Check 'language' - this MUST match the approved language (e.g., 'en', 'en_US', 'ar')",
          "3. Ignore 'project_id' and 'version_id' - these are Bird.com fields (not used by Infobip)",
          "4. For 'preparing': verify template_name='preparing' and language matches Infobip",
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
