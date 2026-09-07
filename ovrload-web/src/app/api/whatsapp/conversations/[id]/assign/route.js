import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { broadcastWhatsAppEvent } from "@/app/api/utils/realtimeBroadcaster";

export async function POST(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { assigned_user_id } = body; // number or null

    const [conv] = await sql`
      UPDATE whatsapp_conversations
      SET assigned_user_id = ${assigned_user_id !== undefined ? assigned_user_id : null}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!conv) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    await sql`
      INSERT INTO whatsapp_audit_logs (admin_user_id, action, entity_type, entity_id, details, created_at)
      VALUES (${admin.id}, 'conversation.assigned', 'conversation', ${id}, ${JSON.stringify({ assigned_user_id })}, now())
    `;

    broadcastWhatsAppEvent("whatsapp.conversation.updated", conv);

    return Response.json({ ok: true, conversation: conv });
  } catch (error) {
    console.error("[whatsapp/assign POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
