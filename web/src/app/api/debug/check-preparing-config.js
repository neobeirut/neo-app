import sql from "@/app/api/utils/sql";

// Quick diagnostic script to check what's configured for "preparing" template

export async function checkPreparingConfig() {
  const [setting] = await sql`
    SELECT setting_key, setting_value
    FROM app_settings
    WHERE setting_key = 'whatsapp_template_preparing'
    LIMIT 1
  `;

  if (!setting) {
    return {
      error: "No template configured for 'preparing'",
      hint: "Configure in Admin Settings → WhatsApp Templates",
    };
  }

  const config = JSON.parse(setting.setting_value);

  console.log(
    "╔════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║ 'PREPARING' TEMPLATE CONFIGURATION                            ║",
  );
  console.log(
    "╠════════════════════════════════════════════════════════════════╣",
  );
  console.log(
    `║ Database Key:          whatsapp_template_preparing               ║`,
  );
  console.log(
    `║ Template Name:         ${String(config.template_name || "MISSING").padEnd(39)}║`,
  );
  console.log(
    `║ Language:              ${String(config.language || "MISSING").padEnd(39)}║`,
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝",
  );
  console.log("Full config:", JSON.stringify(config, null, 2));

  return {
    dbKey: setting.setting_key,
    config,
    templateName: config.template_name,
    language: config.language,
  };
}
