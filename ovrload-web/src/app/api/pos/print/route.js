import sql from "../../utils/sql";

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Fetch print server IP & Port from app_settings
    const settingsRows = await sql`
      SELECT setting_key, setting_value 
      FROM app_settings 
      WHERE setting_key IN ('print_server_ip', 'print_server_port')
    `;

    let ip = "192.168.18.195";
    let port = "9191";

    settingsRows.forEach(r => {
      if (r.setting_key === "print_server_ip" && r.setting_value) ip = r.setting_value;
      if (r.setting_key === "print_server_port" && r.setting_value) port = r.setting_value;
    });

    const printUrl = `http://${ip}:${port}/print`;
    console.log(`[PROXY PRINT] Forwarding order #${body.id} to print server at ${printUrl}`);

    const res = await fetch(printUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000)
    });

    const data = await res.json();
    return Response.json(data);
  } catch (error) {
    console.error("Error in POST /api/pos/print proxy:", error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
