import sql from "@/app/api/utils/sql";

/**
 * ONE-TIME SETUP: Insert preparing template configuration
 *
 * This inserts the TEXT-ONLY template config for "preparing" status
 * to fix MEDIA_TEMPLATE rejection (error 7009)
 *
 * Visit: /api/_debug/insert-preparing-text-template
 */

export async function GET(request) {
  try {
    const settingKey = "whatsapp_template_preparing";
    const config = {
      template_name: "preparing",
      language: "en_US",
    };

    await sql`
      INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at)
      VALUES (
        ${settingKey},
        ${JSON.stringify(config)},
        now(),
        now()
      )
      ON CONFLICT (setting_key) 
      DO UPDATE SET 
        setting_value = ${JSON.stringify(config)},
        updated_at = now()
    `;

    // Verify it was inserted
    const [result] = await sql`
      SELECT setting_key, setting_value, updated_at
      FROM app_settings
      WHERE setting_key = ${settingKey}
      LIMIT 1
    `;

    return Response.json({
      success: true,
      message: "preparing template configuration inserted/updated successfully",
      settingKey,
      config,
      dbRecord: result,
      note: "Template 'preparing' is already created at Infobip/WhatsApp - TEXT ONLY (no header, no media, no buttons)",
      nextSteps: [
        "1. Verify template exists in Infobip WhatsApp Manager:",
        "   - Template Name: preparing",
        "   - Category: UTILITY",
        "   - Type: TEXT ONLY (no header, no media, no buttons)",
        "   - Body: 'Your order is now being prepared. We'll update you once it's ready.'",
        "2. Test with: /admin/whatsapp-status-test",
        "   - Status: preparing",
        "   - Phone: your test number",
      ],
    });
  } catch (error) {
    console.error("[insert-preparing-text-template] Error:", error);
    return Response.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
