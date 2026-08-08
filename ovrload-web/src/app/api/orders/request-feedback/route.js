import sql from "@/app/api/utils/sql";
import {
  toLebanonE164,
  isWhatsAppSessionActive,
  getFeedbackRequestMessage,
  sendWhatsAppFreeForm,
  logWhatsAppMessage,
} from "@/app/api/utils/customerWhatsApp";

/**
 * Workflow 4: Feedback After Completion
 *
 * This endpoint sends a feedback request to customers after their order is completed.
 * It should be called ~45 minutes after order completion.
 *
 * POST /api/orders/request-feedback
 * Body: { orderId: number }
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId) {
      return Response.json(
        { ok: false, error: "orderId is required" },
        { status: 400 },
      );
    }

    // Node 3: Load order + customer
    const [order] = await sql`
      SELECT 
        o.id,
        o.user_id,
        o.branch_id,
        o.status,
        o.order_type,
        o.created_at,
        b.name as branch_name
      FROM orders o
      LEFT JOIN branches b ON b.id = o.branch_id
      WHERE o.id = ${Number(orderId)}
      LIMIT 1
    `;

    if (!order) {
      return Response.json(
        { ok: false, error: "Order not found" },
        { status: 404 },
      );
    }

    // Only send feedback request for completed orders
    if (order.status !== "completed" && order.status !== "delivered") {
      return Response.json(
        { ok: false, error: "Order is not completed", skipped: true },
        { status: 400 },
      );
    }

    const [customer] = await sql`
      SELECT 
        id,
        name,
        phone,
        whatsapp_opt_in,
        last_whatsapp_inbound_at,
        push_token
      FROM auth_users
      WHERE id = ${order.user_id}
      LIMIT 1
    `;

    if (!customer) {
      return Response.json(
        { ok: false, error: "Customer not found" },
        { status: 404 },
      );
    }

    // Check if feedback already exists for this order
    const [existingFeedback] = await sql`
      SELECT id
      FROM order_feedback
      WHERE order_id = ${order.id}
      LIMIT 1
    `;

    if (existingFeedback) {
      console.log(
        `[request-feedback] Order ${orderId}: Feedback already exists`,
      );
      return Response.json(
        { ok: false, error: "Feedback already exists", skipped: true },
        { status: 400 },
      );
    }

    // Node 4: Decide channel
    // Priority:
    // 1. WhatsApp (if session active and opted in)
    // 2. Push notification (if available)
    // 3. In-app prompt (future implementation)

    const sessionActive =
      customer.whatsapp_opt_in && customer.phone
        ? await isWhatsAppSessionActive(customer.id)
        : false;

    if (sessionActive && customer.phone) {
      // Send via WhatsApp (free-form - within 24h session)
      console.log(
        `[request-feedback] Order ${orderId}: Sending WhatsApp feedback request`,
      );

      let customerPhone;
      try {
        customerPhone = toLebanonE164(customer.phone);
      } catch (error) {
        console.error(`[request-feedback] Invalid phone number:`, error);
        return Response.json(
          { ok: false, error: `Invalid phone number: ${error.message}` },
          { status: 400 },
        );
      }

      const messageText = getFeedbackRequestMessage(order.branch_name);

      try {
        const response = await sendWhatsAppFreeForm(customerPhone, messageText);

        const birdMessageId = response?.id || null;

        // Log the feedback request
        await logWhatsAppMessage({
          userId: customer.id,
          orderId: order.id,
          phone: customerPhone,
          direction: "outbound",
          messageType: "freeform",
          messageText,
          templateName: null,
          birdMessageId,
          status: "sent",
          error: null,
        });

        return Response.json({
          ok: true,
          channel: "whatsapp",
          messageId: birdMessageId,
        });
      } catch (error) {
        console.error(`[request-feedback] WhatsApp send failed:`, error);

        // Log the failure
        await logWhatsAppMessage({
          userId: customer.id,
          orderId: order.id,
          phone: customerPhone,
          direction: "outbound",
          messageType: "freeform",
          messageText,
          templateName: null,
          birdMessageId: null,
          status: "failed",
          error: String(error?.message || error),
        });

        // Fallback to push if WhatsApp fails
        if (customer.push_token) {
          console.log(`[request-feedback] Falling back to push notification`);
          // TODO: Implement push notification
          return Response.json({
            ok: true,
            channel: "push_fallback",
            whatsappError: String(error?.message || error),
          });
        }

        return Response.json(
          {
            ok: false,
            error: `WhatsApp send failed: ${error.message}`,
          },
          { status: 500 },
        );
      }
    } else if (customer.push_token) {
      // Send via Push Notification
      console.log(
        `[request-feedback] Order ${orderId}: Sending push notification feedback request`,
      );

      // TODO: Implement push notification
      // Message: "How was your order? Tap to rate your experience"

      return Response.json({
        ok: true,
        channel: "push",
        message: "Push notification feedback request would be sent here",
      });
    } else {
      // In-app only
      console.log(
        `[request-feedback] Order ${orderId}: No immediate channel, will show in-app`,
      );

      return Response.json({
        ok: true,
        channel: "in_app",
        message: "Feedback will be requested in-app on next visit",
      });
    }
  } catch (error) {
    console.error("[request-feedback] Error:", error);
    return Response.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 },
    );
  }
}
