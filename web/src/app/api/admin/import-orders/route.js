import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    let ordersList = [];
    
    // Check body or fallback to parsed_orders.json on disk
    try {
      const body = await request.json();
      if (body && Array.isArray(body.orders) && body.orders.length > 0) {
        ordersList = body.orders;
      }
    } catch (e) {
      // Body not provided or empty JSON
    }

    if (ordersList.length === 0) {
      const filePath = path.join(process.cwd(), 'parsed_orders.json');
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        ordersList = JSON.parse(fileData);
      }
    }

    if (!ordersList || ordersList.length === 0) {
      return NextResponse.json({ success: false, error: 'No orders found to import' }, { status: 400 });
    }

    let insertedOrdersCount = 0;
    let insertedItemsCount = 0;

    for (const order of ordersList) {
      // Insert order row
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

      // Insert order items
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

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${insertedOrdersCount} orders and ${insertedItemsCount} order items into database.`,
      insertedOrdersCount,
      insertedItemsCount
    });
  } catch (error) {
    console.error('Error importing old orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
