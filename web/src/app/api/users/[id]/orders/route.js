import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request, { params }) {
  try {
    const userId = parseInt(params.id);

    // Get all orders for the user with order items and product details
    const orders = await sql`
      SELECT 
        o.id,
        o.total_amount,
        o.status,
        o.order_type,
        o.scheduled_date,
        o.scheduled_time,
        o.delivery_address,
        o.special_instructions,
        o.created_at,
        ua.building,
        ua.company_name,
        ua.address_line2,
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', p.name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price
          )
        ) as items
      FROM orders o
      LEFT JOIN user_addresses ua ON o.address_id = ua.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.user_id = ${userId}
      GROUP BY o.id, ua.building, ua.company_name, ua.address_line2
      ORDER BY o.created_at DESC
    `;

    return Response.json({ orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return Response.json(
      { error: "Failed to fetch user orders" },
      { status: 500 },
    );
  }
}
