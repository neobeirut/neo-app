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

    // Compute live accurate stats directly from whatsapp_campaign_recipients
    const [counts] = await sql`
      SELECT 
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read'))::int as sent,
        COUNT(*) FILTER (WHERE status IN ('delivered', 'read'))::int as delivered,
        COUNT(*) FILTER (WHERE status = 'read')::int as read,
        COUNT(*) FILTER (WHERE status = 'failed')::int as failed
      FROM whatsapp_campaign_recipients
      WHERE campaign_id = ${id}
    `;

    // Keep campaign table in sync if counts updated
    if (counts && (campaign.sent_count !== counts.sent || campaign.delivered_count !== counts.delivered)) {
      await sql`
        UPDATE whatsapp_campaigns
        SET 
          sent_count = ${counts.sent},
          delivered_count = ${counts.delivered},
          read_count = ${counts.read},
          failed_count = ${counts.failed},
          updated_at = now()
        WHERE id = ${id}
      `;
      campaign.sent_count = counts.sent;
      campaign.delivered_count = counts.delivered;
      campaign.read_count = counts.read;
      campaign.failed_count = counts.failed;
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

    return Response.json({
      ok: true,
      campaign,
      recipients,
      totalRecipients: counts?.total || campaign.total_recipients || 0,
      counts: {
        recipients: counts?.total || campaign.total_recipients || 0,
        sent: counts?.sent || campaign.sent_count || 0,
        delivered: counts?.delivered || campaign.delivered_count || 0,
        read: counts?.read || campaign.read_count || 0,
        failed: counts?.failed || campaign.failed_count || 0,
      }
    });
  } catch (error) {
    console.error("[whatsapp/campaigns/[id] GET] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
