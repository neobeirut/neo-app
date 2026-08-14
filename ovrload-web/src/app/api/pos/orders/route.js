import sql from "../../utils/sql";

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
  try {
    const body = await request.json();
    const {
      branchId = 1,
      orderType = "pickup",
      orderSource = "In-Store",
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
