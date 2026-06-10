import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const userId = parseInt(id);

    if (!userId || isNaN(userId)) {
      return Response.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Fetch user details
    const userResult = await sql`
      SELECT 
        id,
        first_name,
        last_name,
        name,
        email,
        phone,
        points,
        membership_tier,
        total_spent,
        branch_id,
        birthday
      FROM auth_users
      WHERE id = ${userId}
    `;

    if (userResult.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult[0];

    // Fetch order stats
    const orderStatsResult = await sql`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_spent,
        COALESCE(AVG(total_amount), 0) as avg_order_value,
        MIN(created_at) as first_order_date,
        MAX(created_at) as last_order_date
      FROM orders
      WHERE user_id = ${userId}
    `;

    const orderStats = orderStatsResult[0] || {
      total_orders: 0,
      total_spent: 0,
      avg_order_value: 0,
      first_order_date: null,
      last_order_date: null,
    };

    // Fetch preferred branch (most ordered from)
    const preferredBranchResult = await sql`
      SELECT 
        b.id,
        b.name,
        COUNT(*) as order_count
      FROM orders o
      JOIN branches b ON o.branch_id = b.id
      WHERE o.user_id = ${userId}
      GROUP BY b.id, b.name
      ORDER BY order_count DESC
      LIMIT 1
    `;

    const preferredBranch = preferredBranchResult[0] || null;

    // Fetch order history with items
    const ordersResult = await sql`
      SELECT 
        o.id,
        o.total_amount,
        o.status,
        o.order_type,
        o.scheduled_date,
        o.scheduled_time,
        o.delivery_address,
        o.created_at,
        o.branch_id,
        b.name as branch_name,
        o.points_awarded,
        o.points_redeemed
      FROM orders o
      LEFT JOIN branches b ON o.branch_id = b.id
      WHERE o.user_id = ${userId}
      ORDER BY o.created_at DESC
      LIMIT 50
    `;

    // Fetch order items for each order
    const orderIds = ordersResult.map((o) => o.id);
    let orderItemsMap = {};

    if (orderIds.length > 0) {
      const itemsResult = await sql`
        SELECT 
          oi.order_id,
          oi.quantity,
          p.name as product_name,
          oi.total_price,
          p.category_id,
          c.name as category_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE oi.order_id = ANY(${orderIds})
      `;

      itemsResult.forEach((item) => {
        if (!orderItemsMap[item.order_id]) {
          orderItemsMap[item.order_id] = [];
        }
        orderItemsMap[item.order_id].push(item);
      });
    }

    const ordersWithItems = ordersResult.map((order) => ({
      ...order,
      items: orderItemsMap[order.id] || [],
    }));

    // Fetch saved addresses
    const addressesResult = await sql`
      SELECT 
        id,
        label,
        address_line1,
        address_line2,
        building,
        company_name,
        city,
        state,
        zip_code,
        latitude,
        longitude,
        is_default,
        is_deliverable,
        delivery_distance_km,
        created_at
      FROM user_addresses
      WHERE user_id = ${userId}
      ORDER BY is_default DESC, created_at DESC
    `;

    // Calculate behavioral insights
    const insights = calculateInsights(ordersWithItems);

    return Response.json({
      user: {
        ...user,
        member_since: orderStats.first_order_date,
      },
      stats: {
        total_orders: parseInt(orderStats.total_orders),
        total_spent: parseFloat(orderStats.total_spent),
        avg_order_value: parseFloat(orderStats.avg_order_value),
        last_order_date: orderStats.last_order_date,
      },
      preferred_branch: preferredBranch,
      orders: ordersWithItems,
      addresses: addressesResult,
      insights,
    });
  } catch (error) {
    console.error("Error fetching user dashboard:", error);
    return Response.json(
      { error: "Failed to fetch user dashboard" },
      { status: 500 },
    );
  }
}

function calculateInsights(orders) {
  if (orders.length === 0) {
    return {
      most_ordered_category: null,
      most_frequent_time: null,
      order_type_preference: null,
    };
  }

  // Category frequency
  const categoryCount = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (item.category_name) {
        categoryCount[item.category_name] =
          (categoryCount[item.category_name] || 0) + item.quantity;
      }
    });
  });

  const mostOrderedCategory = Object.keys(categoryCount).reduce(
    (a, b) => (categoryCount[a] > categoryCount[b] ? a : b),
    null,
  );

  // Time of day frequency
  const timeSlots = { morning: 0, lunch: 0, evening: 0, night: 0 };
  orders.forEach((order) => {
    const time = order.scheduled_time;
    if (!time) return;

    const hour = parseInt(time.split(":")[0]);

    if (hour >= 6 && hour < 11) timeSlots.morning++;
    else if (hour >= 11 && hour < 15) timeSlots.lunch++;
    else if (hour >= 15 && hour < 20) timeSlots.evening++;
    else timeSlots.night++;
  });

  const mostFrequentTime = Object.keys(timeSlots).reduce((a, b) =>
    timeSlots[a] > timeSlots[b] ? a : b,
  );

  // Order type preference
  const deliveryCount = orders.filter(
    (o) => o.order_type === "delivery",
  ).length;
  const pickupCount = orders.filter((o) => o.order_type === "pickup").length;
  const orderTypePreference =
    deliveryCount > pickupCount ? "delivery" : "pickup";

  return {
    most_ordered_category: mostOrderedCategory,
    most_frequent_time: mostFrequentTime,
    order_type_preference: orderTypePreference,
    category_breakdown: categoryCount,
    time_breakdown: timeSlots,
  };
}
