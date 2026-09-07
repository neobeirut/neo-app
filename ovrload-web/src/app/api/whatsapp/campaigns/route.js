import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const campaigns = await sql`
      SELECT 
        c.*,
        au.name as created_by_user_name,
        au.email as created_by_user_email
      FROM whatsapp_campaigns c
      LEFT JOIN admin_users au ON au.id = c.created_by_user_id
      ORDER BY c.created_at DESC
    `;

    return Response.json({ ok: true, campaigns });
  } catch (error) {
    console.error("[whatsapp/campaigns GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const {
      name,
      template_name,
      template_language = "en",
      template_variables = [],
      template_id = null,
      scheduled_at = null,
      filter_criteria = {},
      recipients = [], // Array of contact IDs or phone numbers
    } = body;

    if (!name || !template_name) {
      return Response.json({ error: "Campaign name and template are required" }, { status: 400 });
    }

    const [campaign] = await sql`
      INSERT INTO whatsapp_campaigns (
        name, template_id, template_name, template_language, template_variables,
        status, created_by_user_id, scheduled_at, filter_criteria, total_recipients, created_at, updated_at
      )
      VALUES (
        ${name.trim()}, ${template_id}, ${template_name}, ${template_language}, ${JSON.stringify(template_variables)},
        ${scheduled_at ? 'scheduled' : 'draft'}, ${admin.id}, ${scheduled_at ? new Date(scheduled_at) : null},
        ${JSON.stringify(filter_criteria)}, ${recipients.length}, now(), now()
      )
      RETURNING *
    `;

    await sql`
      INSERT INTO whatsapp_audit_logs (admin_user_id, action, entity_type, entity_id, details, created_at)
      VALUES (${admin.id}, 'campaign.created', 'campaign', ${campaign.id}, ${JSON.stringify({ name, template_name })}, now())
    `;

    return Response.json({ ok: true, campaign }, { status: 201 });
  } catch (error) {
    console.error("[whatsapp/campaigns POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
