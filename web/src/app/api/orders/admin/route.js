import sql from "@/app/api/utils/sql";
import { getAdminWithRolesFromRequest } from "@/app/api/utils/adminAuth";

// Get all orders for admin
export async function GET(request) {
  try {
    const admin = await getAdminWithRolesFromRequest(request);
    if (!admin) {
      return Response.json(
        { error: "Admin authentication required" },
        { status: 401 },
      );
    }

    // Check if admin has orders role
    if (!admin.roles || !admin.roles.includes("orders")) {
      return Response.json(
        { error: "Unauthorized - orders permission required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const orderType = searchParams.get("order_type");

    // First, get orders without items (much faster)
    let ordersQuery = `
      SELECT 
        o.*,
        b.name as branch_name,
        b.address as branch_address,
        au.name as customer_name,
        au.email as customer_email,
        au.phone as customer_phone,
        ua.address_line1,
        ua.building,
        ua.company_name,
        ua.address_line2,
        ua.city,
        ua.state,
        ua.zip_code,
        ua.latitude,
        ua.longitude,
        rc.title as reward_title,
        rc.description as reward_description,
        rc.code as reward_code
      FROM orders o
      LEFT JOIN branches b ON o.branch_id = b.id
      LEFT JOIN auth_users au ON o.user_id = au.id
      LEFT JOIN user_addresses ua ON o.address_id = ua.id
      LEFT JOIN user_rewards ur ON o.applied_user_reward_id = ur.id
      LEFT JOIN rewards_catalog rc ON ur.catalog_id = rc.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filter by admin's branch if they have one assigned
    if (admin.branch_id) {
      ordersQuery += ` AND o.branch_id = $${paramIndex}`;
      params.push(admin.branch_id);
      paramIndex++;
    }

    if (status) {
      ordersQuery += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (orderType) {
      ordersQuery += ` AND o.order_type = $${paramIndex}`;
      params.push(orderType);
      paramIndex++;
    }

    ordersQuery += ` ORDER BY o.created_at DESC`;

    const orders = await sql(ordersQuery, params);

    // Get order IDs
    const orderIds = orders.map((o) => o.id);

    // If we have orders, get their items in a separate query
    let itemsMap = {};
    if (orderIds.length > 0) {
      const items = await sql`
        SELECT 
          oi.order_id,
          oi.id,
          oi.product_id,
          p.name as product_name,
          p.image_url as product_image,
          oi.quantity,
          oi.unit_price,
          oi.total_price,
          oi.customizations,
          oi.comment
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ANY(${orderIds})
        ORDER BY oi.id
      `;

      // Get addons for all items
      const itemIds = items.map((i) => i.id);
      let addonsMap = {};

      if (itemIds.length > 0) {
        const addons = await sql`
          SELECT 
            oia.order_item_id,
            pa.id,
            pa.name,
            oia.price,
            oia.quantity
          FROM order_item_addons oia
          JOIN product_addons pa ON oia.product_addon_id = pa.id
          WHERE oia.order_item_id = ANY(${itemIds})
        `;

        // Group addons by item
        addons.forEach((addon) => {
          if (!addonsMap[addon.order_item_id]) {
            addonsMap[addon.order_item_id] = [];
          }
          addonsMap[addon.order_item_id].push({
            id: addon.id,
            name: addon.name,
            price: addon.price,
            quantity: addon.quantity,
          });
        });
      }

      // Group items by order and attach addons
      items.forEach((item) => {
        if (!itemsMap[item.order_id]) {
          itemsMap[item.order_id] = [];
        }
        itemsMap[item.order_id].push({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_image: item.product_image,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          customizations: item.customizations,
          comment: item.comment,
          addons: addonsMap[item.id] || null,
        });
      });
    }

    // Attach items to orders
    const ordersWithItems = orders.map((order) => ({
      ...order,
      items: itemsMap[order.id] || [],
    }));

    return Response.json({ orders: ordersWithItems });
  } catch (error) {
    console.error("Error fetching admin orders:", error);
    return Response.json(
      { error: "Failed to fetch orders", details: error.message },
      { status: 500 },
    );
  }
}
