import sql from "../../utils/sql";

export async function DELETE(request) {
  try {
    const deletedItems = await sql(
      `DELETE FROM order_items 
       WHERE order_id IN (
         SELECT id FROM orders WHERE special_instructions LIKE 'Toters Import Ref %'
       ) RETURNING id;`
    );

    const deletedOrders = await sql(
      `DELETE FROM orders 
       WHERE special_instructions LIKE 'Toters Import Ref %' 
       RETURNING id;`
    );

    return Response.json({
      success: true,
      message: "Reverted all CSV imported orders.",
      deletedOrdersCount: (deletedOrders || []).length,
      deletedItemsCount: (deletedItems || []).length
    });
  } catch (error) {
    console.error("Error in DELETE /api/pos/orders:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";

    let ordersQuery = `
      SELECT 
        o.id,
        o.branch_id,
        o.order_type,
        o.order_source,
        o.payment_method,
        o.delivery_address,
        o.customer_name,
        o.customer_phone,
        o.subtotal_amount::float,
        o.delivery_fee::float,
        o.discount_amount::float,
        o.total_amount::float,
        o.status,
        o.special_instructions,
        o.void_reason,
        o.created_at,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price::float,
            'total_price', oi.total_price::float,
            'customizations', oi.customizations,
            'comment', oi.comment,
            'product_name', COALESCE(oi.product_name, p.name, 'Item')
          ))
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id::text = p.id::text
           WHERE oi.order_id::text = o.id::text
          ), '[]'::json
        ) as items
      FROM orders o
    `;

    if (type === "pending") {
      ordersQuery += ` WHERE o.status = 'pending' ORDER BY o.created_at DESC`;
    } else if (type === "held") {
      ordersQuery += ` WHERE o.status = 'held' ORDER BY o.created_at DESC`;
    } else {
      ordersQuery += ` ORDER BY o.created_at DESC LIMIT 50`;
    }

    const orders = await sql(ordersQuery);

    return Response.json({ orders: orders || [] });
  } catch (error) {
    console.error("Error in GET /api/pos/orders:", error);
    return Response.json(
      { error: "Failed to fetch POS orders: " + error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      branchId = 1,
      orderType = "pickup",
      orderSource = "POS",
      paymentMethod = "Cash",
      customerName = "",
      customerPhone = "",
      deliveryAddress = "",
      specialInstructions = "",
      status = "preparing",
      items = [],
      subtotal = 0,
      deliveryFee = 0,
      discountAmount = 0,
      total = 0
    } = body;

    if (!items || items.length === 0) {
      return Response.json({ error: "Cannot create an empty order" }, { status: 400 });
    }

    if (!customerName || !String(customerName).trim()) {
      return Response.json({ error: "Customer name is required to save the order" }, { status: 400 });
    }

    // Insert order
    const orderResult = await sql`
      INSERT INTO orders (
        branch_id,
        order_type,
        order_source,
        payment_method,
        customer_name,
        customer_phone,
        delivery_address,
        special_instructions,
        status,
        subtotal_amount,
        delivery_fee,
        discount_amount,
        total_amount,
        created_at
      ) VALUES (
        ${branchId},
        ${orderType},
        ${orderSource},
        ${paymentMethod},
        ${customerName},
        ${customerPhone},
        ${deliveryAddress},
        ${specialInstructions},
        ${status},
        ${subtotal},
        ${deliveryFee},
        ${discountAmount},
        ${total},
        NOW()
      )
      RETURNING id, created_at;
    `;

    const newOrder = orderResult[0];
    const orderId = newOrder.id;

    // Insert order items
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
          ${orderId},
          ${item.product_id || item.id},
          ${qty},
          ${unitPrice},
          ${totalPrice},
          ${custText},
          ${commentText}
        )
      `;
    }

    // Send "order_preparing" WhatsApp notification if customerPhone is present and status is preparing/confirmed/accepted
    const isPreparingOrAccepted = status === "preparing" || status === "confirmed" || status === "accepted";
    if (isPreparingOrAccepted && customerPhone && String(customerPhone).trim()) {
      try {
        const normPhone = String(customerPhone).replace(/\D/g, "").replace(/^00/, "").replace(/^0/, "961");
        const target = (normPhone.length === 7 || normPhone.length === 8) ? "961" + normPhone : normPhone;
        const apiKey = process.env.INFOBIP_API_KEY || "4ba437cf19cbff80fd5b41af77ef6dd3-70acb77e-2cf7-4028-9bdb-3382c4b8865a";
        const baseUrl = (process.env.INFOBIP_BASE_URL || "https://y4r1q1.api.infobip.com").replace(/\/$/, "");
        const sender = (process.env.INFOBIP_WHATSAPP_SENDER || "96181202607").replace(/\D/g, "");

        const numTotal = Number(total || 0);
        const formattedTotal = `$${numTotal % 1 === 0 ? numTotal.toFixed(0) : numTotal.toFixed(2)}`;

        console.log(`[pos-order-create] Sending order_preparing template to ${target} for order #${orderId} (Total: ${formattedTotal})`);
        let prepRes = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
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
                templateData: { body: { placeholders: [formattedTotal] } },
                language: "en"
              }
            }]
          })
        });
        let prepData = await prepRes.json().catch(() => ({}));
        if (!prepRes.ok && prepRes.status === 400) {
          console.warn(`[pos-order-create] order_preparing failed with 'en' (status: ${prepRes.status}), trying 'en_US' fallback:`, prepData);
          const retryRes = await fetch(`${baseUrl}/whatsapp/1/message/template`, {
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
                  templateData: { body: { placeholders: [formattedTotal] } },
                  language: "en_US"
                }
              }]
            })
          });
          if (retryRes.ok) {
            prepRes = retryRes;
            prepData = await retryRes.json().catch(() => ({}));
          }
        }
        console.log(`[pos-order-create] order_preparing response status: ${prepRes.status}`, JSON.stringify(prepData));
      } catch (e) {
        console.error("Failed to send order_preparing notification from POS order creation:", e);
      }
    }

    return Response.json({
      success: true,
      orderId,
      order: {
        id: orderId,
        order_source: orderSource,
        payment_method: paymentMethod,
        total_amount: total,
        status,
        created_at: newOrder.created_at
      }
    });
  } catch (error) {
    console.error("Error in POST /api/pos/orders:", error);
    return Response.json(
      { error: "Failed to create order: " + error.message },
      { status: 500 }
    );
  }
}
