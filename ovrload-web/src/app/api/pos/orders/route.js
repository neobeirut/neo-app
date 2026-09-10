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
        COALESCE(o.version, 1) as version,
        o.client_order_token,
        o.claimed_by,
        o.claimed_terminal,
        o.claimed_at,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price::float,
            'total_price', oi.total_price::float,
            'customizations', oi.customizations,
            'comment', oi.comment,
            'product_name', p.name
          ))
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = o.id
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
  let client_order_token = null;
  try {
    const body = await request.json();
    client_order_token = body.client_order_token || null;
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

    // 1. Idempotency Check: if client_order_token is provided, verify whether order already exists
    if (client_order_token) {
      const existingOrders = await sql`
        SELECT id, order_source, payment_method, total_amount, status, created_at, client_order_token, COALESCE(version, 1) as version
        FROM orders 
        WHERE client_order_token = ${client_order_token}
        LIMIT 1;
      `;
      if (existingOrders && existingOrders.length > 0) {
        const existing = existingOrders[0];
        return Response.json({
          success: true,
          orderId: existing.id,
          order: existing,
          isDuplicate: true,
          message: "Idempotent response: order already created with this client_order_token"
        });
      }
    }

    // Insert order with client_order_token and initial version = 1
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
        client_order_token,
        version,
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
        ${client_order_token},
        1,
        NOW()
      )
      RETURNING id, created_at, version, client_order_token;
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

    return Response.json({
      success: true,
      orderId,
      order: {
        id: orderId,
        order_source: orderSource,
        payment_method: paymentMethod,
        total_amount: total,
        status,
        version: newOrder.version || 1,
        client_order_token: newOrder.client_order_token,
        created_at: newOrder.created_at
      }
    });
  } catch (error) {
    // 2. Race condition catch: handle concurrent duplicate submission catching unique constraint
    if (client_order_token && (error.code === '23505' || String(error.message).includes('client_order_token'))) {
      try {
        const [existing] = await sql`
          SELECT id, order_source, payment_method, total_amount, status, created_at, client_order_token, COALESCE(version, 1) as version
          FROM orders 
          WHERE client_order_token = ${client_order_token}
          LIMIT 1;
        `;
        if (existing) {
          return Response.json({
            success: true,
            orderId: existing.id,
            order: existing,
            isDuplicate: true,
            message: "Concurrent idempotent response: order already created"
          });
        }
      } catch (innerErr) {
        console.error("Error retrieving existing order during duplicate catch:", innerErr);
      }
    }
    console.error("Error in POST /api/pos/orders:", error);
    return Response.json(
      { error: "Failed to create order: " + error.message },
      { status: 500 }
    );
  }
}
