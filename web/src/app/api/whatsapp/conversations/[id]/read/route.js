import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

export async function POST(request, { params }) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    await sql`
      UPDATE whatsapp_conversations
      SET unread_count = 0, updated_at = now()
      WHERE id = ${id}
    `;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[whatsapp/read POST] Error:", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
