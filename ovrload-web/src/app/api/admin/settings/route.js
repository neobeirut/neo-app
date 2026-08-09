import sql from "../../utils/sql";

export async function GET() {
  try {
    const settings = await sql`
      SELECT setting_key, setting_value FROM app_settings
    `;
    const s = {};
    (settings || []).forEach((row) => { s[row.setting_key] = row.setting_value; });

    return Response.json({
      toters_discount_percent: parseFloat(s.toters_discount_percent || "15"),
      noknok_discount_percent: parseFloat(s.noknok_discount_percent || "15"),
      print_server_ip:         s.print_server_ip   || "",
      print_server_port:       s.print_server_port || "9191",
    });
  } catch (err) {
    console.error("Error in GET /api/admin/settings:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Upsert each provided key generically
    const allowed = [
      "toters_discount_percent",
      "noknok_discount_percent",
      "print_server_ip",
      "print_server_port",
    ];

    for (const key of allowed) {
      if (body[key] !== undefined) {
        const val = String(body[key]);
        await sql`
          INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at)
          VALUES (${key}, ${val}, NOW(), NOW())
          ON CONFLICT (setting_key)
          DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
        `;
      }
    }

    return Response.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    console.error("Error in POST /api/admin/settings:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

