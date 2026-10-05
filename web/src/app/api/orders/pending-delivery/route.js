import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

// GET /api/orders/pending-delivery
export async function GET(request) {
  try {
    const orders = await sql`
      SELECT
        o.id,
        o.status,
        o.order_type,
        o.order_source,
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
        AND COALESCE(o.order_source, '') NOT ILIKE '%toter%'
        AND COALESCE(o.order_source, '') NOT ILIKE '%noknok%'
        AND COALESCE(o.order_source, '') NOT ILIKE '%nok_nok%'
        AND COALESCE(o.customer_name, '') NOT ILIKE '%toters%'
        AND COALESCE(o.customer_name, '') NOT ILIKE '%noknok%'
      GROUP BY o.id, au.name, au.phone
      ORDER BY o.created_at DESC
    `;
    return corsJson(request, orders);
  } catch (err) {
    console.error("[pending-delivery] Error:", err);
    return corsJson(request, { error: "Internal Server Error" }, { status: 500 });
  }
}

export async function OPTIONS(request) {
  return corsOptions(request);
}
