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
    } catch (e) {}

    if (!ordersList || ordersList.length === 0) {
      return corsJson(request, { success: false, error: 'No orders payload provided in request body.' }, { status: 400 });
    }

    let insertedOrdersCount = 0;
    let insertedItemsCount = 0;

    for (const order of ordersList) {
      try {
        const createdAtVal = order.created_at || order.createdAt ? new Date(order.created_at || order.createdAt).toISOString() : new Date().toISOString();

        // 1. Insert order using plain parameter array to prevent LazyQuery connection hangs
        const orderRows = await sql(
          `INSERT INTO orders (
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
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id;`,
          [
            order.branchId || 1,
            order.orderType || 'delivery',
            order.orderSource || 'Toters',
            order.paymentMethod || 'Cash',
            order.customerName || '',
            order.customerPhone || '',
            order.deliveryAddress || '',
            order.specialInstructions || '',
            order.status || 'completed',
            order.subtotal || 0,
            order.deliveryFee || 0,
            order.discountAmount || 0,
            order.total || 0,
            createdAtVal
          ]
        );

        if (orderRows && orderRows[0] && orderRows[0].id) {
          const orderId = orderRows[0].id;
          insertedOrdersCount++;

          if (Array.isArray(order.items) && order.items.length > 0) {
            for (const item of order.items) {
              await sql(
                `INSERT INTO order_items (
                  order_id,
                  product_id,
                  quantity,
                  unit_price,
                  total_price,
                  customizations,
                  comment
                ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
                [
                  orderId,
                  item.product_id,
                  item.quantity || 1,
                  item.unit_price || 0,
                  item.total_price || 0,
                  item.customizations || null,
                  item.comment || null
                ]
              );
              insertedItemsCount++;
            }
          }
        }
      } catch (err) {
        console.error('Error inserting single order:', err);
      }
    }

    return corsJson(request, {
      success: true,
      message: `Successfully processed batch import.`,
      insertedOrdersCount,
      insertedItemsCount
    });
  } catch (error) {
    console.error('Error in batch import-orders:', error);
    return corsJson(request, { success: false, error: error.message }, { status: 500 });
  }
}
