import sql from "../../utils/sql";

export async function GET() {
  try {
    const settings = await sql`
      SELECT setting_key, setting_value FROM app_settings
    `;
    const settingsObj = {};
    (settings || []).forEach((row) => {
      settingsObj[row.setting_key] = row.setting_value;
    });

    return Response.json({
      toters_discount_percent: parseFloat(settingsObj.toters_discount_percent || "15"),
      noknok_discount_percent: parseFloat(settingsObj.noknok_discount_percent || "15")
    });
  } catch (err) {
    console.error("Error in GET /api/admin/settings:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { toters_discount_percent, noknok_discount_percent } = body;

    if (toters_discount_percent !== undefined) {
      await sql`
        INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at)
        VALUES ('toters_discount_percent', ${String(toters_discount_percent)}, NOW(), NOW())
        ON CONFLICT (setting_key) 
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
      `;
    }

    if (noknok_discount_percent !== undefined) {
      await sql`
        INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at)
        VALUES ('noknok_discount_percent', ${String(noknok_discount_percent)}, NOW(), NOW())
        ON CONFLICT (setting_key) 
        DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
      `;
    }

    return Response.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    console.error("Error in POST /api/admin/settings:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
