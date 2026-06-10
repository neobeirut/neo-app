import { getAdminWithRolesFromRequest } from "../../utils/adminAuth";
import sql from "../../utils/sql";

/**
 * Configure Infobip Templates
 * Converts Bird template format to Infobip format
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
    const { templates, language = "en" } = body;

    if (!templates || typeof templates !== "object") {
      return Response.json(
        { ok: false, error: "Templates object required" },
        { status: 400 },
      );
    }

    const results = [];

    // Default Infobip template configuration
    const defaultTemplates = {
      pending: "order_received",
      preparing: "preparing",
      ready_pickup: "ready_pickup",
      ready_delivery: "ready_delivery",
      out_for_delivery: "out_for_delivery",
      completed: "completed",
      cancelled: "cancelled",
      new_order_to_branch: "new_order_to_branch",
    };

    // Update each template
    for (const [key, templateName] of Object.entries(templates)) {
      const settingKey = `whatsapp_template_${key}`;

      // Infobip template format (simple!)
      const config = {
        template_name: templateName,
        language: language,
        // No project_id or version_id for Infobip
      };

      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES (${settingKey}, ${JSON.stringify(config)}, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key)
        DO UPDATE SET 
          setting_value = ${JSON.stringify(config)},
          updated_at = CURRENT_TIMESTAMP
      `;

      results.push({
        key,
        templateName,
        status: "configured",
      });
    }

    return Response.json({
      ok: true,
      message: `Configured ${results.length} Infobip templates`,
      results,
      language,
      note: "Make sure these templates are approved in your Infobip portal",
    });
  } catch (error) {
    console.error("[configure-infobip-templates] error", error);
    return Response.json(
      { ok: false, error: error.message || "Failed to configure templates" },
      { status: 500 },
    );
  }
}

// GET - Show current template configuration
export async function GET(request) {
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

    const templateRows = await sql`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'whatsapp_template_%'
      ORDER BY setting_key
    `;

    const templates = {};
    const issues = [];

    for (const row of templateRows) {
      const key = row.setting_key.replace("whatsapp_template_", "");
      try {
        const config = JSON.parse(row.setting_value);
        templates[key] = config;

        // Check format
        if (config.project_id || config.version_id) {
          issues.push({
            key,
            issue:
              "Has Bird format (project_id/version_id). Switch to Infobip format (template_name + language only)",
            config,
          });
        }

        if (!config.template_name) {
          issues.push({
            key,
            issue: "Missing template_name",
            config,
          });
        }
      } catch (e) {
        issues.push({
          key,
          issue: "Invalid JSON",
          raw: row.setting_value,
        });
      }
    }

    return Response.json({
      ok: true,
      templates,
      issues,
      totalTemplates: Object.keys(templates).length,
      totalIssues: issues.length,
    });
  } catch (error) {
    console.error("[configure-infobip-templates GET] error", error);
    return Response.json(
      { ok: false, error: error.message || "Failed to get templates" },
      { status: 500 },
    );
  }
}
