import { sendWhatsAppNotification } from "@/app/api/utils/whatsappNotification";

/**
 * Workflow 1: Send WhatsApp Status Update to Customer
 *
 * This endpoint handles sending order status updates to customers via WhatsApp.
 * It automatically chooses between template messages (for cold contacts) and
 * free-form messages (for active 24h sessions).
 *
 * POST /api/orders/notify-customer
 * Body: { orderId: number, newStatus: string }
 */
export async function POST(request) {
  try {
    console.log(
      "[notify-customer] ==================== START ====================",
    );
    const body = await request.json().catch(() => ({}));
    const { orderId, newStatus } = body;
    console.log(`[notify-customer] Request received:`, { orderId, newStatus });

    if (!orderId || !newStatus) {
      console.log("[notify-customer] Missing orderId or newStatus");
      return Response.json(
        { ok: false, error: "orderId and newStatus are required" },
        { status: 400 },
      );
    }

    // Use shared WhatsApp notification logic
    const result = await sendWhatsAppNotification(orderId, newStatus);

    console.log(
      "[notify-customer] ==================== COMPLETE ====================",
    );

    if (result.ok) {
      return Response.json(result);
    } else {
      // Return appropriate status code based on error type
      const statusCode = result.skipped ? 400 : 500;
      return Response.json(result, { status: statusCode });
    }
  } catch (error) {
    console.error("[notify-customer] ❌ Unexpected error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}
