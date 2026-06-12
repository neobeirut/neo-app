import { getAdminWithRolesFromRequest } from "../../utils/adminAuth";
import {
  getInfobipConfig,
  testInfobipConfig,
} from "../../utils/infobipWhatsApp";
import sql from "../../utils/sql";

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
    const hasAccess =
      roles.includes("backend") ||
      roles.includes("settings") ||
      roles.includes("orders");

    if (!hasAccess) {
      return Response.json(
        { ok: false, error: "Unauthorized - settings permission required" },
        { status: 403 },
      );
    }

    // Test Infobip configuration
    let configTest;
    try {
      configTest = await testInfobipConfig();
    } catch (error) {
      return Response.json({
        configured: false,
        error: error.message,
        step: "Configuration validation",
      });
    }

    if (!configTest.configured) {
      return Response.json({
        configured: false,
        error: configTest.error,
        hint: "Make sure INFOBIP_API_KEY, INFOBIP_BASE_URL, and INFOBIP_WHATSAPP_SENDER are set in environment variables",
        step: "Environment variables",
      });
    }

    const cfg = getInfobipConfig();

    // Check templates configuration
    const templateRows = await sql`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'whatsapp_template_%'
      ORDER BY setting_key
    `;

    const templates = {
      count: templateRows.length,
      items: [],
      issues: [],
    };

    for (const row of templateRows) {
      const key = row.setting_key.replace("whatsapp_template_", "");
      try {
        const config = JSON.parse(row.setting_value);
        templates.items.push({
          key,
          template: config.template_name || "N/A",
        });

        if (!config.template_name) {
          templates.issues.push(`${key}: Missing template_name`);
        }
      } catch (e) {
        templates.issues.push(`${key}: Invalid JSON configuration`);
      }
    }

    // Check branches
    const branchRows = await sql`
      SELECT id, name, whatsapp_phone, phone
      FROM branches
      WHERE is_active = true
      ORDER BY name
    `;

    const branches = {
      total: branchRows.length,
      withPhone: 0,
      withoutPhone: 0,
      missingPhone: [],
    };

    for (const branch of branchRows) {
      const hasPhone = !!(branch.whatsapp_phone || branch.phone);
      if (hasPhone) {
        branches.withPhone++;
      } else {
        branches.withoutPhone++;
        branches.missingPhone.push(branch.name);
      }
    }

    return Response.json({
      configured: true,
      message: "Infobip WhatsApp is configured and ready",
      baseUrl: cfg.baseUrl,
      sender: cfg.sender,
      templates,
      branches,
    });
  } catch (error) {
    console.error("[test-infobip-config] error", error);
    return Response.json(
      {
        configured: false,
        error: error.message || "Unknown error",
        step: "Unexpected error",
      },
      { status: 500 },
    );
  }
}
