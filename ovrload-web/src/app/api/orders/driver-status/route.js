import sql from "@/app/api/utils/sql";
import { sendInfobipTemplateMessage } from "@/app/api/utils/infobipService";

// PATCH /api/orders/driver-status
// No user session required — used by the Driver PWA to mark orders as picked up
export async function PATCH(request) {
  try {
    const { orderId, status } = await request.json();

    if (!orderId) {
      return Response.json({ error: "orderId is required" }, { status: 400 });
    }

    const allowed = ["pending", "accepted", "preparing", "ready", "out_for_delivery", "completed", "cancelled"];
    const newStatus = status || "completed";

    if (!allowed.includes(newStatus)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    const [existingOrder] = await sql`
      SELECT id, status, customer_phone FROM orders WHERE id = ${Number(orderId)} LIMIT 1
    `;
    if (!existingOrder) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }
    const prevStatus = existingOrder.status;
    const phoneToNotify = existingOrder.customer_phone;

    const result = await sql`
      UPDATE orders
      SET status = ${newStatus}
      WHERE id = ${Number(orderId)}
      RETURNING id, status
    `;

    if (result.length === 0) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    // Send "Your order {{1}} is out for delivery." when marked as completed/delivered/out_for_delivery
    const isPickupOrDelivery = newStatus === "completed" || newStatus === "delivered" || newStatus === "out_for_delivery";
    const wasPickupOrDelivery = prevStatus === "completed" || prevStatus === "delivered" || prevStatus === "out_for_delivery";
    if (isPickupOrDelivery && !wasPickupOrDelivery && phoneToNotify) {
      try {
        const orderTag = `#${orderId}`;
        console.log(`[driver-status] Sending out_for_delivery template to ${phoneToNotify} for order ${orderTag}`);
        await sendInfobipTemplateMessage({
          to: phoneToNotify,
          templateName: "out_for_delivery",
          placeholders: [orderTag],
        });
      } catch (e) {
        console.error("[driver-status] Failed sending out_for_delivery template:", e);
      }
    }

    return Response.json({ success: true, order: result[0] });
  } catch (err) {
    console.error("[driver-status] Error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
