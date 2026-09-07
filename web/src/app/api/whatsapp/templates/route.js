import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const templates = await sql`
      SELECT * FROM whatsapp_templates
      ORDER BY name ASC, language ASC
    `;

    return Response.json({ ok: true, templates });
  } catch (error) {
    console.error("[whatsapp/templates GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { name, language = "en", category = "UTILITY", status = "APPROVED", body: bodyText, header, footer, buttons = [], variables = [] } = body;

    if (!name || !bodyText) {
      return Response.json({ error: "Template name and body are required" }, { status: 400 });
    }

    const [tpl] = await sql`
      INSERT INTO whatsapp_templates (
        name, language, category, status, body, header, footer, buttons, variables, updated_at
      )
      VALUES (
        ${name.trim()}, ${language.trim()}, ${category}, ${status}, ${bodyText},
        ${header || null}, ${footer || null}, ${JSON.stringify(buttons)}, ${JSON.stringify(variables)}, now()
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
        updated_at = now()
      RETURNING *
    `;

    return Response.json({ ok: true, template: tpl });
  } catch (error) {
    console.error("[whatsapp/templates POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
