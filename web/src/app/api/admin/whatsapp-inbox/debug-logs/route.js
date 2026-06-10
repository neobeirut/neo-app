import sql from "@/app/api/utils/sql";
import { getAdminFromRequest } from "@/app/api/utils/adminAuth";

/**
 * GET /api/admin/whatsapp-inbox/debug-logs
 * Fetch raw webhook payloads for debugging
 */
export async function GET(request) {
  try {
    const adminUser = await getAdminFromRequest(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get last 50 debug payloads (both test and production webhooks)
    const logs = await sql`
      SELECT 
        id,
        phone,
        message_text,
        message_type,
        created_at
      FROM customer_whatsapp_messages
      WHERE (message_type = 'debug_raw_payload' AND phone = 'DEBUG')
         OR (message_type = 'test_payload' AND phone = 'WEBHOOK_TEST')
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return Response.json({ ok: true, logs });
  } catch (error) {
    console.error("[whatsapp-debug-logs] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/whatsapp-inbox/debug-logs
 * Clear debug logs
 */
export async function DELETE(request) {
  try {
    const adminUser = await getAdminFromRequest(request);
    if (!adminUser) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Clear both debug and test logs
    await sql`
      DELETE FROM customer_whatsapp_messages
      WHERE (message_type = 'debug_raw_payload' AND phone = 'DEBUG')
         OR (message_type = 'test_payload' AND phone = 'WEBHOOK_TEST')
    `;

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[whatsapp-debug-logs] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}
