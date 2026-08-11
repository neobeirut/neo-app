import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";
import { sendAutomatedOrderWhatsAppMessages } from "@/app/api/utils/automatedOrderWhatsApp";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      orderType = "delivery",
      deliveryTime = "ASAP",
      items = [],
      subtotal = 0,
      discountAmount = 0,
      deliveryFee = 0,
      total = 0,
      lat = null,
      lng = null,
    } = body;

    if (!customerPhone) {
      return corsJson(request, { error: "Customer phone number is required" }, { status: 400 });
    }

    // 1. Find or create user in auth_users
    let [user] = await sql`
      SELECT id FROM auth_users WHERE phone = ${customerPhone} LIMIT 1
    `;

    if (!user) {
      const [newUser] = await sql`
        INSERT INTO auth_users (name, phone, role)
        VALUES (${customerName || "Customer"}, ${customerPhone}, 'Customer')
        RETURNING id
      `;
      user = newUser;
    } else if (customerName) {
      await sql`
        UPDATE auth_users SET name = ${customerName} WHERE id = ${user.id}
      `;
    }

    // 2. Generate unique order number
    const orderNumber = Math.floor(100000 + Math.random() * 900000);

    // 3. Insert order into DB
    const [order] = await sql`
      INSERT INTO orders (
        user_id,
        branch_id,
        order_number,
        order_type,
        status,
        subtotal_amount,
        discount_amount,
        delivery_fee,
        total_amount,
        delivery_address,
        latitude,
        longitude,
        special_instructions,
        created_at
      ) VALUES (
        ${user.id},
        1,
        ${orderNumber},
        ${orderType},
        'pending',
        ${Number(subtotal)},
        ${Number(discountAmount)},
        ${Number(deliveryFee)},
        ${Number(total)},
        ${deliveryAddress || "Not specified"},
        ${lat ? Number(lat) : null},
        ${lng ? Number(lng) : null},
        ${`Requested Time: ${deliveryTime}`},
        NOW()
      )
      RETURNING id
    `;

    const orderId = order.id;

    // 4. Insert order items
    if (items && items.length > 0) {
      for (const item of items) {
        const itemTotal = Number(item.unit_price_usd || 0) * Number(item.qty || 1);
        await sql`
          INSERT INTO order_items (
            order_id,
            product_name,
            quantity,
            unit_price,
            total_price
          ) VALUES (
            ${orderId},
            ${item.name || "Item"},
            ${Number(item.qty || 1)},
            ${Number(item.unit_price_usd || 0)},
            ${itemTotal}
          )
        `;
      }
    }

    // 5. Trigger automated Infobip WhatsApp messages
    sendAutomatedOrderWhatsAppMessages({
      orderId,
      orderNumber,
      branchId: 1,
    }).catch((err) => {
      console.error("[api/orders/save] WhatsApp dispatch error:", err);
    });

    return corsJson(request, {
      success: true,
      orderId,
      orderNumber,
      message: "Order placed successfully and WhatsApp notification triggered",
    });
  } catch (error) {
    console.error("[api/orders/save] Error creating order:", error);
    return corsJson(request, { error: String(error?.message || error) }, { status: 500 });
  }
}
