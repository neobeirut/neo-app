import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { fetchInfobipTemplates } from "@/app/api/utils/infobipService";

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let infobipTemplates = [];
    try {
      infobipTemplates = await fetchInfobipTemplates();
    } catch (err) {
      if (err.message?.includes("403") || err.message?.includes("Insufficient permissions") || err.message?.includes("Unauthorized access")) {
        const existing = await sql`SELECT count(*) FROM whatsapp_templates`;
        return Response.json({
          ok: false,
          error: "Infobip API Key does not have the 'WhatsApp Templates' read scope enabled. You can register your new Infobip template name directly by clicking '+ Add Template' above.",
          permissionNeeded: true,
          totalTemplates: parseInt(existing[0]?.count, 10) || 0,
        }, { status: 403 });
      }
      return Response.json({ ok: false, error: "Failed to connect to Infobip templates API: " + err.message }, { status: 502 });
    }

    let syncedCount = 0;

    for (const tpl of infobipTemplates) {
      const name = tpl.name || tpl.templateName;
      const language = tpl.language || "en";
      const category = tpl.category || "UTILITY";
      const status = tpl.status || "APPROVED";
      const components = tpl.components || [];

      const bodyComponent = components.find(c => c.type === "BODY") || {};
      const headerComponent = components.find(c => c.type === "HEADER") || {};
      const footerComponent = components.find(c => c.type === "FOOTER") || {};
      const buttonsComponent = components.find(c => c.type === "BUTTONS") || {};

      const bodyText = bodyComponent.text || "";
      const headerText = headerComponent.text || (headerComponent.format ? `[${headerComponent.format}]` : "");
      const footerText = footerComponent.text || "";
      const buttons = buttonsComponent.buttons || [];

      // Extract placeholders e.g. {{1}}, {{2}}
      const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      const variables = Array.from(new Set(matches));

      await sql`
        INSERT INTO whatsapp_templates (
          name, language, category, status, body, header, footer,
          buttons, variables, infobip_template_id, last_synced_at, updated_at
        )
        VALUES (
          ${name}, ${language}, ${category}, ${status}, ${bodyText},
          ${headerText || null}, ${footerText || null}, ${JSON.stringify(buttons)}, ${JSON.stringify(variables)},
          ${tpl.id || null}, now(), now()
        )
        ON CONFLICT (name, language)
        DO UPDATE SET
          category = EXCLUDED.category,
          status = EXCLUDED.status,
          body = EXCLUDED.body,
          header = EXCLUDED.header,
          footer = EXCLUDED.footer,
          buttons = EXCLUDED.buttons,
          variables = EXCLUDED.variables,
          infobip_template_id = EXCLUDED.infobip_template_id,
          last_synced_at = now(),
          updated_at = now()
      `;
      syncedCount++;
    }

    // Also sync with older templates table if exists
    try {
      const oldTemplates = await sql`SELECT template_name, language, category, status, body, header, footer, buttons FROM templates`;
      for (const ot of oldTemplates) {
        if (!ot.template_name) continue;
        let bText = ot.body || "";
        try {
          const parsed = JSON.parse(ot.body);
          if (parsed.text) bText = parsed.text;
        } catch (e) {}

        await sql`
          INSERT INTO whatsapp_templates (
            name, language, category, status, body, header, footer, buttons, variables, updated_at
          )
          VALUES (
            ${ot.template_name}, ${ot.language || 'en'}, ${ot.category || 'UTILITY'}, ${ot.status || 'APPROVED'},
            ${bText}, ${ot.header !== 'null' ? ot.header : null}, ${ot.footer !== 'null' ? ot.footer : null},
            '[]'::jsonb, '[]'::jsonb, now()
          )
          ON CONFLICT (name, language) DO NOTHING
        `;
      }
    } catch (e) {}

    const allTemplates = await sql`SELECT * FROM whatsapp_templates ORDER BY name ASC`;

    return Response.json({
      ok: true,
      syncedCount,
      totalTemplates: allTemplates.length,
      templates: allTemplates,
    });
  } catch (error) {
    console.error("[whatsapp/templates/sync POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
