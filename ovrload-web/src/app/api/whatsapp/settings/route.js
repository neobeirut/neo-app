import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { getInfobipConfig, testInfobipConnection } from "@/app/api/utils/infobipService";

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const config = await getInfobipConfig();

    // App settings
    let serviceWindowHours = 24;
    let defaultCountry = "961";
    let campaignBatchSize = 25;
    let campaignDelayMs = 500;

    try {
      const rows = await sql`SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'whatsapp_%'`;
      for (const r of rows) {
        if (r.setting_key === 'whatsapp_service_window_hours') serviceWindowHours = parseFloat(r.setting_value) || 24;
        if (r.setting_key === 'whatsapp_default_country_code') defaultCountry = r.setting_value;
        if (r.setting_key === 'whatsapp_campaign_batch_size') campaignBatchSize = parseInt(r.setting_value, 10) || 25;
        if (r.setting_key === 'whatsapp_campaign_delay_ms') campaignDelayMs = parseInt(r.setting_value, 10) || 500;
      }
    } catch (e) {}

    // Construct origin URL for webhook endpoints
    const origin = request.headers.get("origin") || request.headers.get("host") || "https://ovrload-backend-production.up.railway.app";
    const hostWithProtocol = origin.startsWith("http") ? origin : `https://${origin}`;

    return Response.json({
      ok: true,
      config: {
        sender: config.sender,
        baseUrl: config.baseUrl,
        hasApiKey: Boolean(config.apiKey),
        hasWebhookSecret: Boolean(config.webhookSecret),
        maskedApiKey: config.apiKey ? `...${config.apiKey.slice(-6)}` : "Not set",
      },
      settings: {
        serviceWindowHours,
        defaultCountry,
        campaignBatchSize,
        campaignDelayMs,
      },
      webhooks: {
        inboundUrl: `${hostWithProtocol}/api/webhooks/infobip/whatsapp/inbound`,
        statusUrl: `${hostWithProtocol}/api/webhooks/infobip/whatsapp/status`,
      },
    });
  } catch (error) {
    console.error("[whatsapp/settings GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const testResult = await testInfobipConnection();
    return Response.json({ ok: true, test: testResult });
  } catch (error) {
    console.error("[whatsapp/settings POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { serviceWindowHours, defaultCountry, campaignBatchSize, campaignDelayMs } = body;

    if (serviceWindowHours !== undefined) {
      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES ('whatsapp_service_window_hours', ${String(serviceWindowHours)}, now())
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = ${String(serviceWindowHours)}, updated_at = now()
      `;
    }

    if (defaultCountry !== undefined) {
      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES ('whatsapp_default_country_code', ${String(defaultCountry)}, now())
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = ${String(defaultCountry)}, updated_at = now()
      `;
    }

    if (campaignBatchSize !== undefined) {
      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES ('whatsapp_campaign_batch_size', ${String(campaignBatchSize)}, now())
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = ${String(campaignBatchSize)}, updated_at = now()
      `;
    }

    if (campaignDelayMs !== undefined) {
      await sql`
        INSERT INTO app_settings (setting_key, setting_value, updated_at)
        VALUES ('whatsapp_campaign_delay_ms', ${String(campaignDelayMs)}, now())
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = ${String(campaignDelayMs)}, updated_at = now()
      `;
    }

    return Response.json({ ok: true, message: "Settings saved successfully" });
  } catch (error) {
    console.error("[whatsapp/settings PATCH] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
