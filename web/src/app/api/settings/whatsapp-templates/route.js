import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function OPTIONS(request) {
  return corsOptions(request);
}

// Get all WhatsApp template configurations
export async function GET(request) {
  try {
    // Get all templates from app_settings
    const rows = await sql`
      SELECT setting_key, setting_value, updated_at
      FROM app_settings
      WHERE setting_key LIKE 'whatsapp_template_%'
      ORDER BY setting_key
    `;

    const templates = {};
    let lastUpdated = null;

    for (const row of rows) {
      try {
        const value = JSON.parse(row.setting_value);
        const key = row.setting_key.replace("whatsapp_template_", "");
        templates[key] = value;

        if (!lastUpdated || new Date(row.updated_at) > new Date(lastUpdated)) {
          lastUpdated = row.updated_at;
        }
      } catch (e) {
        console.error(`Failed to parse ${row.setting_key}:`, e);
      }
    }

    return corsJson(request, {
      templates,
      updated_at: lastUpdated,
    });
  } catch (error) {
    console.error("Error fetching WhatsApp templates:", error);
    return corsJson(
      request,
      { error: "Failed to fetch WhatsApp templates" },
      { status: 500 },
    );
  }
}

// Update WhatsApp template configurations
export async function PUT(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    const roles = Array.isArray(admin?.roles) ? admin.roles : [];
    if (!roles.includes("backend")) {
      return corsJson(
        request,
        { error: "Unauthorized - backend role required" },
        { status: 403 },
      );
    }

    const { templates } = await request.json();

    if (!templates || typeof templates !== "object") {
      return corsJson(
        request,
        { error: "Invalid templates data" },
        { status: 400 },
      );
    }

    // Update each template
    for (const [key, config] of Object.entries(templates)) {
      const settingKey = `whatsapp_template_${key}`;
      const settingValue = JSON.stringify(config);

      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES (${settingKey}, ${settingValue}, now())
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = ${settingValue}, updated_at = now()
      `;
    }

    return corsJson(request, {
      message: "WhatsApp templates updated successfully",
    });
  } catch (error) {
    console.error("Error updating WhatsApp templates:", error);
    return corsJson(
      request,
      { error: "Failed to update WhatsApp templates" },
      { status: 500 },
    );
  }
}
