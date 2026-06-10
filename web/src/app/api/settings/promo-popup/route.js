import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

const SETTING_KEY = "promo_popup";

function cleanString(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function parseBool(v) {
  return !!v;
}

function isValidIsoDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function cleanDestinationType(v) {
  const s = String(v || "").toLowerCase();
  if (s === "event" || s === "product" || s === "page") return s;
  return null;
}

function cleanFrequency(v) {
  const s = String(v || "").toLowerCase();
  if (s === "every_visit" || s === "once_per_session" || s === "once_per_day") {
    return s;
  }
  // Backward-compatible aliases
  if (s === "every visit") return "every_visit";
  if (s === "once per session") return "once_per_session";
  if (s === "once per day") return "once_per_day";
  return "once_per_session";
}

function defaultSettings() {
  return {
    enabled: false,
    image_url: null,
    destination_type: "page",
    destination_value: "/(tabs)/home",
    start_at: null,
    end_at: null,
    show_frequency: "once_per_session",
  };
}

function normalizeSettings(input) {
  const base = defaultSettings();
  const type =
    cleanDestinationType(input?.destination_type) || base.destination_type;

  const out = {
    enabled: parseBool(input?.enabled),
    image_url: cleanString(input?.image_url),
    destination_type: type,
    destination_value: cleanString(input?.destination_value),
    start_at: isValidIsoDateOrNull(input?.start_at),
    end_at: isValidIsoDateOrNull(input?.end_at),
    show_frequency: cleanFrequency(input?.show_frequency),
  };

  // If destination is page and missing, default to home.
  if (!out.destination_value) {
    out.destination_value = type === "page" ? "/(tabs)/home" : null;
  }

  return { ...base, ...out };
}

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const rows = await sql`
      SELECT setting_value, updated_at
      FROM app_settings
      WHERE setting_key = ${SETTING_KEY}
    `;

    const raw = rows[0]?.setting_value || null;
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (e) {
      parsed = null;
    }

    const promo_popup = normalizeSettings(parsed);

    return corsJson(request, {
      promo_popup,
      updated_at: rows[0]?.updated_at || null,
    });
  } catch (error) {
    console.error("[api/settings/promo-popup] GET error", error);
    return corsJson(request, {
      promo_popup: defaultSettings(),
      updated_at: null,
    });
  }
}

export async function PUT(request) {
  try {
    // Allow either a regular user session OR the lightweight admin header auth
    const session = await auth();
    const admin = session ? null : await getAdminFromRequest(request);

    if (!session && !admin) {
      return corsJson(request, { error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const promo_popup = normalizeSettings(body?.promo_popup || body);

    await sql`
      INSERT INTO app_settings (setting_key, setting_value, updated_at)
      VALUES (${SETTING_KEY}, ${JSON.stringify(promo_popup)}, CURRENT_TIMESTAMP)
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = ${JSON.stringify(promo_popup)},
        updated_at = CURRENT_TIMESTAMP
    `;

    return corsJson(request, { success: true, promo_popup });
  } catch (error) {
    console.error("[api/settings/promo-popup] PUT error", error);
    return corsJson(
      request,
      { error: "Failed to update promo popup" },
      { status: 500 },
    );
  }
}
