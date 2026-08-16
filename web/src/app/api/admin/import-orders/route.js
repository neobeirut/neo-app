import { corsJson, corsOptions } from "@/app/api/utils/cors";
import sql from "@/app/api/utils/sql";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  return handleBatchImport(request);
}

export async function POST(request) {
  return handleBatchImport(request);
}

async function handleBatchImport(request) {
  try {
    let ordersList = [];
    
    try {
      const body = await request.json();
      if (body && Array.isArray(body.orders) && body.orders.length > 0) {
        ordersList = body.orders;
      }
    } catch (e) {
      // Body not provided or empty JSON
    }

    if (!ordersList || ordersList.length === 0) {
      return corsJson(request, { success: false, error: 'No orders payload provided in request body. Send JSON object: { orders: [...] }' }, { status: 400 });
    }

    // Check existing special_instructions to avoid duplicates
    const existingRows = await sql`SELECT special_instructions FROM orders WHERE special_instructions LIKE 'Toters Import Ref %'`;
    const existingSet = new Set((existingRows || []).map(r => r.special_instructions));

    const remainingOrders = ordersList.filter(o => !existingSet.has(o.specialInstructions));

    if (remainingOrders.length === 0) {
      return corsJson(request, {
        success: true,
        message: 'All orders provided in payload have already been imported into the database.',
        totalPayloadOrders: ordersList.length,
        insertedOrdersCount: 0,
        insertedItemsCount: 0
      });
    }

    let insertedOrdersCount = 0;
    let insertedItemsCount = 0;

    for (const order of remainingOrders) {
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
          ${order.branchId || 1},
          ${order.orderType || 'delivery'},
          ${order.orderSource || 'Toters'},
          ${order.paymentMethod || 'Cash'},
          ${order.customerName || ''},
          ${order.customerPhone || ''},
          ${order.deliveryAddress || ''},
          ${order.specialInstructions || ''},
          ${order.status || 'completed'},
          ${order.subtotal || 0},
          ${order.deliveryFee || 0},
          ${order.discountAmount || 0},
          ${order.total || 0},
          ${order.created_at}
        )
        RETURNING id;
      `;

      const orderId = orderResult[0].id;
      insertedOrdersCount++;

      if (Array.isArray(order.items) && order.items.length > 0) {
        for (const item of order.items) {
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
              ${item.product_id},
              ${item.quantity},
              ${item.unit_price},
              ${item.total_price},
              ${item.customizations || null},
              ${item.comment || null}
            );
          `;
          insertedItemsCount++;
        }
      }
    }

    return corsJson(request, {
      success: true,
      message: `Successfully imported ${insertedOrdersCount} historical orders (${insertedItemsCount} items) into database.`,
      totalPayloadOrders: ordersList.length,
      insertedOrdersCount,
      insertedItemsCount
    });
  } catch (error) {
    console.error('Error in batch import-orders:', error);
    return corsJson(request, { success: false, error: error.message }, { status: 500 });
  }
}
