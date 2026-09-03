import sql from "../../../../utils/sql";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      voidReason,
      subtotal,
      deliveryFee,
      discountAmount,
      total,
      customerName,
      customerPhone,
      deliveryAddress,
      orderType,
      orderSource,
      items
    } = body;

    if (!status) {
      return Response.json({ error: "Missing status field" }, { status: 400 });
    }

    if (voidReason) {
      await sql`
        UPDATE orders 
        SET status = ${status}, void_reason = ${voidReason}
        WHERE id = ${id}
      `;
    } else {
      if (customerName !== undefined && (!customerName || !String(customerName).trim())) {
        return Response.json({ error: "Customer name is required to save the order" }, { status: 400 });
      }
      await sql`
        UPDATE orders 
        SET 
          status = ${status},
          subtotal_amount = COALESCE(${subtotal !== undefined && subtotal !== null ? subtotal : null}, subtotal_amount),
          delivery_fee = COALESCE(${deliveryFee !== undefined && deliveryFee !== null ? deliveryFee : null}, delivery_fee),
          discount_amount = COALESCE(${discountAmount !== undefined && discountAmount !== null ? discountAmount : null}, discount_amount),
          total_amount = COALESCE(${total !== undefined && total !== null ? total : null}, total_amount),
          customer_name = COALESCE(${customerName || null}, customer_name),
          customer_phone = COALESCE(${customerPhone || null}, customer_phone),
          delivery_address = COALESCE(${deliveryAddress || null}, delivery_address),
          order_type = COALESCE(${orderType || null}, order_type),
          order_source = COALESCE(${orderSource || null}, order_source)
        WHERE id = ${id}
      `;

      // Update order items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        await sql`DELETE FROM order_items WHERE order_id = ${id}`;
        for (const item of items) {
          const unitPrice = parseFloat(item.unit_price || item.unit_price_usd || 0);
          const qty = parseInt(item.quantity || item.qty || 1, 10);
          const totalPrice = unitPrice * qty;
          const custText = Array.isArray(item.customizations)
            ? item.customizations.map(c => typeof c === "string" ? c : (c.ingredient || c.name)).join(", ")
            : (item.customizations || null);
          const commentText = item.comment || item.note || null;

          await sql`
            INSERT INTO order_items (
              order_id,
              product_id,
              quantity,
              unit_price,
              total_price,
              customizations,
              comment
            ) VALUES (
              ${id},
              ${item.product_id || item.id},
              ${qty},
              ${unitPrice},
              ${totalPrice},
              ${custText},
              ${commentText}
            )
          `;
        }
      }

      // Send "We are preparing your items now!" when confirmed from POS (only once on transition)
      if (status === "preparing" || status === "confirmed") {
        try {
          const [orderRow] = await sql`SELECT status, customer_phone FROM orders WHERE id = ${id} LIMIT 1`;
          const phoneToNotify = customerPhone || orderRow?.customer_phone;
          // Only send if not previously preparing or confirmed
          if (phoneToNotify && orderRow?.status !== "preparing" && orderRow?.status !== "confirmed") {
            const normPhone = String(phoneToNotify).replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "961");
            const target = normPhone.length === 8 ? "961" + normPhone : normPhone;
            const apiKey = process.env.INFOBIP_API_KEY || "d42824b2b707759420c14250c320ec7b-449822b8-55e1-4d67-906f-8a19af1d302e";
            const baseUrl = (process.env.INFOBIP_BASE_URL || "https://y4r1q1.api.infobip.com").replace(/\/$/, "");
            const sender = "96181202607";

            // Direct Meta Template dispatch (sends exactly one message)
            await fetch(`${baseUrl}/whatsapp/1/message/template`, {
              method: "POST",
              headers: {
                "Authorization": `App ${apiKey}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
              },
              body: JSON.stringify({
                messages: [{
                  from: sender,
                  to: target,
                  content: {
                    templateName: "order_preparing",
                    templateData: { body: { placeholders: [] } },
                    language: "en"
                  }
                }]
              })
            });
          }
        } catch (e) {
          console.error("Failed to send order_preparing notification from POS:", e);
        }
      }
    }

    return Response.json({ success: true, orderId: id, status });
  } catch (error) {
    console.error("Error in PATCH /api/pos/orders/[id]/status:", error);
    return Response.json(
      { error: "Failed to update order status: " + error.message },
      { status: 500 }
    );
  }
}

