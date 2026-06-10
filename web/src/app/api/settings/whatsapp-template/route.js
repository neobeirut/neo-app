import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

const SETTING_KEY = "bird_whatsapp_template_name";
const PROJECT_ID_KEY = "bird_whatsapp_template_project_id";
const VERSION_KEY = "bird_whatsapp_template_version";

function cleanString(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const rows = await sql`
      SELECT setting_key, setting_value, updated_at
      FROM app_settings
      WHERE setting_key IN (${SETTING_KEY}, ${PROJECT_ID_KEY}, ${VERSION_KEY})
    `;

    const byKey = new Map(
      (Array.isArray(rows) ? rows : []).map((r) => [
        String(r.setting_key),
        {
          value: r?.setting_value ? String(r.setting_value) : "",
          updated_at: r?.updated_at || null,
        },
      ]),
    );

    const templateName = byKey.get(SETTING_KEY)?.value || "";
    const projectId = byKey.get(PROJECT_ID_KEY)?.value || "";
    const version = byKey.get(VERSION_KEY)?.value || "";

    // Use the most recent updated_at among the settings (best-effort)
    const updatedAtCandidates = [
      byKey.get(SETTING_KEY)?.updated_at,
      byKey.get(PROJECT_ID_KEY)?.updated_at,
      byKey.get(VERSION_KEY)?.updated_at,
    ].filter(Boolean);

    const updatedAt = updatedAtCandidates.length
      ? updatedAtCandidates.sort().slice(-1)[0]
      : null;

    return corsJson(request, {
      template_name: templateName,
      template_project_id: projectId,
      template_version: version,
      updated_at: updatedAt,
    });
  } catch (error) {
    console.error("[api/settings/whatsapp-template] GET error", error);
    return corsJson(request, {
      template_name: "",
      template_project_id: "",
      template_version: "",
      updated_at: null,
    });
  }
}

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

    const body = (await request.json().catch(() => ({}))) || {};

    const templateName = cleanString(body?.template_name);
    const projectId = cleanString(body?.template_project_id);
    const version = cleanString(body?.template_version);

    if (!templateName) {
      return corsJson(
        request,
        {
          error:
            "template_name is required (this must match your approved Bird WhatsApp template name)",
        },
        { status: 400 },
      );
    }

    // Name always saved
    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES (${SETTING_KEY}, ${templateName}, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = ${templateName},
        updated_at = CURRENT_TIMESTAMP
    `;

    // Project/version are optional (but recommended for reliability)
    if (projectId) {
      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES (${PROJECT_ID_KEY}, ${projectId}, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = ${projectId},
          updated_at = CURRENT_TIMESTAMP
      `;
    }

    if (version) {
      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES (${VERSION_KEY}, ${version}, CURRENT_TIMESTAMP)
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = ${version},
          updated_at = CURRENT_TIMESTAMP
      `;
    }

    return corsJson(request, {
      ok: true,
      template_name: templateName,
      template_project_id: projectId,
      template_version: version,
    });
  } catch (error) {
    console.error("[api/settings/whatsapp-template] PUT error", error);
    return corsJson(
      request,
      { error: error?.message || "Failed to update WhatsApp template" },
      { status: 500 },
    );
  }
}
