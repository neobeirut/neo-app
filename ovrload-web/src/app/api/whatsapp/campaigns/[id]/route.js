import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function GET(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "all";
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const [campaign] = await sql`
      SELECT 
        c.*,
        au.name as created_by_user_name,
        au.email as created_by_user_email
      FROM whatsapp_campaigns c
      LEFT JOIN admin_users au ON au.id = c.created_by_user_id
      WHERE c.id = ${id}
      LIMIT 1
    `;

    if (!campaign) {
      return Response.json({ error: "Campaign not found" }, { status: 404 });
    }

    const recipients = statusFilter !== 'all'
      ? await sql`
          SELECT 
            r.*,
            con.name as contact_name,
            con.email as contact_email,
            wc.id as conversation_id
          FROM whatsapp_campaign_recipients r
          LEFT JOIN whatsapp_contacts con ON con.id = r.contact_id
          LEFT JOIN whatsapp_conversations wc ON wc.contact_id = con.id
          WHERE r.campaign_id = ${id} AND r.status = ${statusFilter}
          ORDER BY r.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT 
            r.*,
            con.name as contact_name,
            con.email as contact_email,
            wc.id as conversation_id
          FROM whatsapp_campaign_recipients r
          LEFT JOIN whatsapp_contacts con ON con.id = r.contact_id
          LEFT JOIN whatsapp_conversations wc ON wc.contact_id = con.id
          WHERE r.campaign_id = ${id}
          ORDER BY r.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `;

    const [totalRecipientsRow] = await sql`
      SELECT COUNT(*)::int as total FROM whatsapp_campaign_recipients WHERE campaign_id = ${id}
    `;

    return Response.json({
      ok: true,
      campaign,
      recipients,
      totalRecipients: totalRecipientsRow?.total || 0,
    });
  } catch (error) {
    console.error("[whatsapp/campaigns/[id] GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
