import sql from "@/app/api/utils/sql";

/**
 * Manual test endpoint — simulates an Infobip inbound webhook.
 *
 * Usage (from browser):
 *   GET /api/webhooks/whatsapp/manual-test?phone=+9611234567&message=Hello
 *
 * This builds a proper Infobip "results[]" payload and forwards it to the real
 * webhook handler so you can verify the full flow without touching the Infobip portal.
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const testMessage = searchParams.get("message") || "Manual test message";
  const testPhone = searchParams.get("phone") || "+9611234567";
  const timestamp = new Date().toISOString();

  console.log("=".repeat(60));
  console.log(`[MANUAL TEST] ${timestamp}`);
  console.log(
    `[MANUAL TEST] Simulating Infobip inbound from ${testPhone}: "${testMessage}"`,
  );
  console.log("=".repeat(60));

  // Build a proper Infobip inbound payload
  const infobipPayload = {
    results: [
      {
        from: testPhone,
        to: process.env.INFOBIP_WHATSAPP_SENDER || "96176489078",
        integrationType: "WHATSAPP",
        receivedAt: timestamp,
        messageId: `manual-test-${Date.now()}`,
        message: {
          type: "TEXT",
          text: testMessage,
        },
        contact: {
          name: "Manual Test",
        },
      },
    ],
    messageCount: 1,
    pendingMessageCount: 0,
  };

  let webhookResult = null;
  let webhookError = null;

  try {
    // Forward to the real webhook handler
    const webhookUrl = `${origin}/api/webhooks/whatsapp/inbound`;
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(infobipPayload),
    });
    webhookResult = await res.json().catch(() => ({ status: res.status }));
    console.log(
      "[MANUAL TEST] Webhook response:",
      JSON.stringify(webhookResult),
    );
  } catch (err) {
    webhookError = err.message;
    console.error("[MANUAL TEST] Webhook call failed:", err);
  }

  const success = !webhookError && webhookResult?.ok !== false;

  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <title>Infobip Webhook Test</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; }
    .card { padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .success { background:#d4edda; border:1px solid #c3e6cb; }
    .error   { background:#f8d7da; border:1px solid #f5c6cb; }
    .info    { background:#d1ecf1; border:1px solid #bee5eb; }
    h1 { margin:0 0 10px 0; }
    pre { background:#f8f9fa; padding:12px; border-radius:6px; overflow-x:auto; font-size:12px; }
    code { background:#f8f9fa; padding:2px 6px; border-radius:3px; }
  </style>
</head>
<body>
  <div class="card ${success ? "success" : "error"}">
    <h1>${success ? "✅ Webhook test succeeded!" : "❌ Webhook test failed"}</h1>
    <p><strong>Phone:</strong> ${testPhone}</p>
    <p><strong>Message:</strong> ${testMessage}</p>
    <p><strong>Time:</strong> ${timestamp}</p>
    ${webhookError ? `<p><strong>Error:</strong> ${webhookError}</p>` : ""}
    ${webhookResult ? `<p><strong>Webhook response:</strong> <code>${JSON.stringify(webhookResult)}</code></p>` : ""}
  </div>

  <div class="card info">
    <h3>📋 Infobip payload that was sent to the webhook:</h3>
    <pre>${JSON.stringify(infobipPayload, null, 2)}</pre>
  </div>

  <div class="card info">
    <h3>🔗 Configure this URL in Infobip portal:</h3>
    <p>Go to: <strong>Channels → WhatsApp → Your sender → Inbound messages → Webhook URL</strong></p>
    <code>${origin}/api/webhooks/whatsapp/inbound</code>
    <br/><br/>
    <p>To test again: <a href="/api/webhooks/whatsapp/manual-test?phone=${testPhone}&message=${encodeURIComponent(testMessage)}">Re-run this test</a></p>
    <p>Then check the <strong>Admin → WhatsApp Inbox</strong> for new conversations.</p>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    },
  );
}
