import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function POST(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const [campaign] = await sql`
      UPDATE whatsapp_campaigns
      SET status = 'cancelled', updated_at = now()
      WHERE id = ${id} AND status IN ('draft', 'scheduled', 'running')
      RETURNING *
    `;

    if (!campaign) {
      return Response.json({ error: "Campaign not found or cannot be cancelled" }, { status: 400 });
    }

    return Response.json({ ok: true, campaign });
  } catch (error) {
    console.error("[whatsapp/campaigns/[id]/cancel POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
