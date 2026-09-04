import sql from "@/app/api/utils/sql";
import { toLebanonE164, sendWhatsAppFreeForm } from "@/app/api/utils/customerWhatsApp";

// Automated Infobip WhatsApp sender for new orders
// Sends full summary to OVRLOAD / Branch and short summary (NO personal info/location) to Client
export async function sendAutomatedOrderWhatsAppMessages({ orderId, orderNumber, branchId }) {
  console.log(`[automated_order_whatsapp] START for order #${orderNumber}`);
  try {
    const [order] = await sql`
      SELECT 
        o.id, o.total_amount, o.subtotal_amount, o.delivery_fee, o.order_type,
        o.scheduled_date, o.scheduled_time, o.delivery_address, o.special_instructions,
        o.latitude, o.longitude,
        u.name as customer_name, u.phone as customer_phone,
        b.name as branch_name, b.whatsapp_phone as branch_whatsapp, b.phone as branch_phone
      FROM orders o
      LEFT JOIN auth_users u ON o.user_id = u.id
      LEFT JOIN branches b ON o.branch_id = b.id
      WHERE o.id = ${Number(orderId)}
      LIMIT 1
    `;

    if (!order) {
      console.error(`[automated_order_whatsapp] Order ${orderId} not found`);
      return;
    }

    const items = await sql`
      SELECT product_name, quantity, total_price, unit_price
      FROM order_items
      WHERE order_id = ${Number(orderId)}
    `;

    const itemsText = (items || [])
      .map((i) => `• ${i.quantity}x ${i.product_name} ($${Number(i.total_price || 0).toFixed(2)})`)
      .join("\n");

    const locLink =
      order.latitude && order.longitude
        ? `\n📍 GPS Location: https://maps.google.com/?q=${order.latitude},${order.longitude}`
        : "";

    // 1. FULL ORDER NOTIFICATION FOR OVRLOAD (Sent to 81202607)
    const ovrloadMsgText = `🛒 *New Order #${orderNumber}*\n\n*Order Type:* ${String(
      order.order_type || "delivery"
    ).toUpperCase()}\n\n*Items:*\n${itemsText}\n\n*Subtotal:* $${Number(
      order.subtotal_amount || 0
    ).toFixed(2)}\n*Delivery Fee:* $${Number(order.delivery_fee || 0).toFixed(
      2
    )}\n*Total:* $${Number(order.total_amount || 0).toFixed(
      2
    )}\n\n*Customer Name:* ${order.customer_name || "N/A"}\n*Customer Phone:* ${
      order.customer_phone || "N/A"
    }\n*Delivery Address:* ${order.delivery_address || "Not specified"}${locLink}\n*Schedule:* ${
      order.scheduled_date || ""
    } ${order.scheduled_time || ""}`;

    const rawBranchPhone = order.branch_whatsapp || order.branch_phone || "96181202607";
    try {
      const branchPhoneE164 = toLebanonE164(rawBranchPhone);
      await sendWhatsAppFreeForm(branchPhoneE164, ovrloadMsgText);
      console.log(`[automated_order_whatsapp] Sent full order notification to OVRLOAD (${branchPhoneE164})`);
    } catch (e) {
      console.error("[automated_order_whatsapp] Failed sending to OVRLOAD phone:", e);
    }

    // 2. SHORTENED ORDER CONFIRMATION FOR CLIENT (NO personal info, NO location)
    if (order.customer_phone) {
      try {
        const clientPhoneE164 = toLebanonE164(order.customer_phone);
        const clientMsgText = `🛒 *Order #${orderNumber} Confirmed - OVRLOAD*\n\n*Order Type:* ${String(
          order.order_type || "delivery"
        ).toUpperCase()}\n\n*Items:*\n${itemsText}\n\n*Subtotal:* $${Number(order.subtotal_amount || 0).toFixed(
          2
        )}\n*Delivery Fee:* $${Number(order.delivery_fee || 0).toFixed(
          2
        )}\n*Total:* $${Number(order.total_amount || 0).toFixed(
          2
        )}\n*Schedule:* ${order.scheduled_date || ""} ${order.scheduled_time || ""}\n\nThank you for ordering with OVRLOAD! 🙏`;

        await sendWhatsAppFreeForm(clientPhoneE164, clientMsgText);
        console.log(`[automated_order_whatsapp] Sent short order confirmation to Client (${clientPhoneE164})`);
      } catch (e) {
        console.error("[automated_order_whatsapp] Failed sending to Client phone:", e);
      }
    }
  } catch (err) {
    console.error("[automated_order_whatsapp] Unexpected error in automated dispatch:", err);
  }
}
