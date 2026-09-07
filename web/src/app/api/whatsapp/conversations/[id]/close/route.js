import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";
import { broadcastWhatsAppEvent } from "@/app/api/utils/realtimeBroadcaster";

export async function POST(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const newStatus = body.status || 'closed';

    const [conv] = await sql`
      UPDATE whatsapp_conversations
      SET status = ${newStatus}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!conv) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    await sql`
      INSERT INTO whatsapp_audit_logs (admin_user_id, action, entity_type, entity_id, details, created_at)
      VALUES (${admin.id}, ${'conversation.' + newStatus}, 'conversation', ${id}, ${JSON.stringify({ status: newStatus })}, now())
    `;

    broadcastWhatsAppEvent("whatsapp.conversation.updated", conv);

    return Response.json({ ok: true, conversation: conv });
  } catch (error) {
    console.error("[whatsapp/close POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
