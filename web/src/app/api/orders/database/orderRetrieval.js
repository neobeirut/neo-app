import sql from "@/app/api/utils/sql";

export async function getUserOrders(userId) {
  const orders = await sql`
    SELECT 
      o.*,
      b.name as branch_name,
      b.address as branch_address,
      ua.building,
      ua.company_name,
      ua.address_line2,
      json_agg(
        json_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', p.name,
          'product_image', p.image_url,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'total_price', oi.total_price,
          'customizations', oi.customizations,
          'comment', oi.comment,
          'addons', (
            SELECT json_agg(
              json_build_object(
                'id', pa.id,
                'name', pa.name,
                'price', oia.price
              )
            )
            FROM order_item_addons oia
            JOIN product_addons pa ON oia.product_addon_id = pa.id
            WHERE oia.order_item_id = oi.id
          )
        )
      ) as items
    FROM orders o
    LEFT JOIN branches b ON o.branch_id = b.id
    LEFT JOIN user_addresses ua ON o.address_id = ua.id
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = ${userId}
    GROUP BY o.id, b.name, b.address, ua.building, ua.company_name, ua.address_line2
    ORDER BY o.created_at DESC
  `;

  return orders;
}
