import sql from "@/app/api/utils/sql";

// GET /api/orders/pending-delivery
export async function GET() {
  try {
    const orders = await sql`
      SELECT
        o.id,
        o.status,
        o.order_type,
        o.delivery_address,
        o.total_amount,
        o.created_at,
        COALESCE(au.name, o.customer_name) AS customer_name,
        COALESCE(au.phone, o.customer_phone) AS customer_phone,
        json_agg(
          json_build_object(
            'quantity', oi.quantity,
            'product_name', p.name,
            'total_price', oi.total_price
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL) AS items
      FROM orders o
      LEFT JOIN auth_users au ON au.id = o.user_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE (
          o.order_type ILIKE 'delivery'
          OR (o.delivery_address IS NOT NULL AND o.delivery_address != '')
        )
        AND o.status NOT IN ('cancelled', 'completed')
        AND o.created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY o.id, au.name, au.phone
      ORDER BY o.created_at DESC
    `;
    return Response.json(orders);
  } catch (err) {
    console.error("[pending-delivery] Error:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
