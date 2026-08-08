import sql from "@/app/api/utils/sql";

/**
 * Ultra-simple webhook test endpoint
 * This logs EVERYTHING and always returns 200
 * Use this URL in Infobip portal to verify connectivity before switching to /inbound
 */
export async function POST(request) {
  const timestamp = new Date().toISOString();

  console.log("=".repeat(60));
  console.log(`[WEBHOOK TEST] ${timestamp} - POST request received`);
  console.log("=".repeat(60));

  let payload = null;
  let payloadString = "FAILED TO PARSE";

  try {
    payload = await request.json();
    payloadString = JSON.stringify(payload, null, 2);
    console.log("[WEBHOOK TEST] Payload:", payloadString);
  } catch (e) {
    console.log("[WEBHOOK TEST] Failed to parse JSON:", e);
    const text = await request.text().catch(() => "");
    console.log("[WEBHOOK TEST] Raw body:", text);
    payloadString = text;
  }

  // Log headers
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  console.log("[WEBHOOK TEST] Headers:", JSON.stringify(headers, null, 2));

  // Store in database
  try {
    await sql`
      INSERT INTO customer_whatsapp_messages (
        user_id, order_id, phone, direction, message_type,
        message_text, status, created_at
      )
      VALUES (
        NULL, NULL, 'WEBHOOK_TEST', 'inbound', 'test_payload',
        ${payloadString}, 'received', now()
      )
    `;
    console.log("[WEBHOOK TEST] ✅ Stored in database");
  } catch (dbError) {
    console.error("[WEBHOOK TEST] ❌ Failed to store in database:", dbError);
  }

  console.log("[WEBHOOK TEST] ✅ Returning 200 OK");
  console.log("=".repeat(60));

  return Response.json({
    ok: true,
    message: "Webhook test received",
    timestamp,
    receivedPayload: payload !== null,
  });
}

export async function GET(request) {
  console.log("[WEBHOOK TEST] GET request received");

  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("challenge");

  if (challenge) {
    console.log("[WEBHOOK TEST] Verification challenge:", challenge);
    return new Response(challenge, { status: 200 });
  }

  return Response.json({
    ok: true,
    message: "WhatsApp webhook test endpoint (Infobip)",
    info: "Configure this URL in Infobip portal to test connectivity. Use /api/webhooks/whatsapp/inbound for production.",
    productionUrl: "/api/webhooks/whatsapp/inbound",
    manualTestUrl:
      "/api/webhooks/whatsapp/manual-test?phone=+9611234567&message=Hello",
  });
}
