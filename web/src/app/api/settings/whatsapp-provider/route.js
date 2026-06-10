import { getAdminWithRolesFromRequest } from "../../utils/adminAuth";
import sql from "../../utils/sql";

// GET - Get current WhatsApp provider
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

    const [setting] = await sql`
      SELECT setting_value
      FROM app_settings
      WHERE setting_key = 'whatsapp_provider'
      LIMIT 1
    `;

    const provider = setting?.setting_value || "bird"; // Default to Bird

    return Response.json({
      ok: true,
      provider,
    });
  } catch (error) {
    console.error("[whatsapp-provider GET] error", error);
    return Response.json(
      { ok: false, error: error.message || "Failed to get provider" },
      { status: 500 },
    );
  }
}

// PUT - Set WhatsApp provider
export async function PUT(request) {
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
    const provider = String(body?.provider || "").toLowerCase();

    if (!["bird", "infobip"].includes(provider)) {
      return Response.json(
        { ok: false, error: "Invalid provider. Must be 'bird' or 'infobip'" },
        { status: 400 },
      );
    }

    // Upsert the setting
    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES ('whatsapp_provider', ${provider}, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key)
      DO UPDATE SET 
        setting_value = ${provider},
        updated_at = CURRENT_TIMESTAMP
    `;

    console.log(
      `[whatsapp-provider] Provider set to: ${provider} by admin ${admin.id}`,
    );

    return Response.json({
      ok: true,
      provider,
      message: `WhatsApp provider successfully set to ${provider.toUpperCase()}`,
    });
  } catch (error) {
    console.error("[whatsapp-provider PUT] error", error);
    return Response.json(
      { ok: false, error: error.message || "Failed to set provider" },
      { status: 500 },
    );
  }
}
