import sql from "../../utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "revert_csv") {
      const deletedItems = await sql`
        DELETE FROM order_items 
        WHERE order_id IN (
          SELECT id FROM orders WHERE special_instructions LIKE 'Toters Import Ref %'
        ) RETURNING id;
      `;

      const deletedOrders = await sql`
        DELETE FROM orders 
        WHERE special_instructions LIKE 'Toters Import Ref %' 
        RETURNING id;
      `;

      return Response.json({
        success: true,
        message: "Successfully deleted all imported CSV orders and their order items.",
        deletedOrdersCount: (deletedOrders || []).length,
        deletedItemsCount: (deletedItems || []).length
      });
    }

    const range = searchParams.get("range") || "today";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const beirutTimeExpr = "(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Beirut')";
    const beirutTimeExprO = "(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Beirut')";
    const beirutNowDate = "(NOW() AT TIME ZONE 'Asia/Beirut')::date";

    let dateWhereClause = "";
    let dateWhereClauseO = "";

    if (range === "today") {
      dateWhereClause = `AND ${beirutTimeExpr}::date = ${beirutNowDate}`;
      dateWhereClauseO = `AND ${beirutTimeExprO}::date = ${beirutNowDate}`;
    } else if (range === "yesterday") {
      dateWhereClause = `AND ${beirutTimeExpr}::date = (${beirutNowDate} - INTERVAL '1 day')::date`;
      dateWhereClauseO = `AND ${beirutTimeExprO}::date = (${beirutNowDate} - INTERVAL '1 day')::date`;
    } else if (range === "7days") {
      dateWhereClause = `AND ${beirutTimeExpr}::date >= (${beirutNowDate} - INTERVAL '7 days')::date`;
      dateWhereClauseO = `AND ${beirutTimeExprO}::date >= (${beirutNowDate} - INTERVAL '7 days')::date`;
    } else if (range === "thismonth") {
      dateWhereClause = `AND ${beirutTimeExpr}::date >= DATE_TRUNC('month', ${beirutNowDate})::date`;
      dateWhereClauseO = `AND ${beirutTimeExprO}::date >= DATE_TRUNC('month', ${beirutNowDate})::date`;
    } else if (range === "all") {
      dateWhereClause = "";
      dateWhereClauseO = "";
    } else if (range === "custom" && startDateParam && endDateParam) {
      const cleanStart = startDateParam.replace(/[^0-9-]/g, "");
      const cleanEnd = endDateParam.replace(/[^0-9-]/g, "");
      dateWhereClause = `AND ${beirutTimeExpr}::date >= '${cleanStart}'::date AND ${beirutTimeExpr}::date <= '${cleanEnd}'::date`;
      dateWhereClauseO = `AND ${beirutTimeExprO}::date >= '${cleanStart}'::date AND ${beirutTimeExprO}::date <= '${cleanEnd}'::date`;
    }

    const salesStatusFilter = "COALESCE(status, 'completed') NOT IN ('cancelled', 'voided', 'pending')";
    const salesStatusFilterO = "COALESCE(o.status, 'completed') NOT IN ('cancelled', 'voided', 'pending')";

    const summaryRows = await sql(
      `SELECT 
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount::float), 0) as total_revenue,
        COALESCE(SUM(subtotal_amount::float), 0) as gross_subtotal,
        COALESCE(SUM(discount_amount::float), 0) as total_discounts,
        COALESCE(SUM(delivery_fee::float), 0) as total_delivery_fees,
        COALESCE(AVG(total_amount::float), 0) as avg_order_value
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}`
    );
    const summary = (summaryRows && summaryRows[0]) ? summaryRows[0] : {};

    const channels = await sql(
      `SELECT 
        COALESCE(order_source, 'Pick-up') as channel,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue,
        COALESCE(SUM(discount_amount::float), 0) as total_discount
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}
      GROUP BY COALESCE(order_source, 'Pick-up')
      ORDER BY total_revenue DESC`
    ) || [];

    const paymentMethods = await sql(
      `SELECT 
        COALESCE(payment_method, 'Cash') as method,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}
      GROUP BY COALESCE(payment_method, 'Cash')
      ORDER BY total_revenue DESC`
    ) || [];

    const topProducts = await sql(
      `SELECT 
        oi.product_id,
        COALESCE(p.name, 'Unknown Item') as product_name,
        COALESCE(c.name, 'Uncategorized') as category_name,
        SUM(oi.quantity)::int as total_qty,
        SUM((oi.quantity * oi.unit_price)::float) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${salesStatusFilterO} ${dateWhereClauseO}
      GROUP BY oi.product_id, p.name, c.name
      ORDER BY total_qty DESC
      LIMIT 15`
    ) || [];

    const categories = await sql(
      `SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        SUM(oi.quantity)::int as total_qty,
        SUM((oi.quantity * oi.unit_price)::float) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${salesStatusFilterO} ${dateWhereClauseO}
      GROUP BY c.name
      ORDER BY total_revenue DESC`
    ) || [];

    const voidedSummaryRows = await sql(
      `SELECT 
        COUNT(*)::int as void_count,
        COALESCE(SUM(total_amount::float), 0) as total_voided_amount
      FROM orders
      WHERE status IN ('voided', 'cancelled') ${dateWhereClause}`
    );

    const voidedOrders = await sql(
      `SELECT 
        id,
        COALESCE(order_source, 'Pick-up') as order_source,
        total_amount::float,
        void_reason,
        created_at
      FROM orders
      WHERE status IN ('voided', 'cancelled') ${dateWhereClause}
      ORDER BY created_at DESC
      LIMIT 20`
    ) || [];

    const hourlySales = await sql(
      `SELECT 
        EXTRACT(HOUR FROM ${beirutTimeExpr})::int as hour,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}
      GROUP BY EXTRACT(HOUR FROM ${beirutTimeExpr})
      ORDER BY hour ASC`
    ) || [];

    const timeOfDayRows = await sql(
      `SELECT 
        CASE 
          WHEN EXTRACT(HOUR FROM ${beirutTimeExpr}) >= 12 AND EXTRACT(HOUR FROM ${beirutTimeExpr}) < 15 THEN 'lunch'
          WHEN EXTRACT(HOUR FROM ${beirutTimeExpr}) >= 15 AND EXTRACT(HOUR FROM ${beirutTimeExpr}) < 19 THEN 'afternoon'
          WHEN EXTRACT(HOUR FROM ${beirutTimeExpr}) >= 19 AND EXTRACT(HOUR FROM ${beirutTimeExpr}) < 23 THEN 'dinner'
          ELSE 'offpeak'
        END as period,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}
      GROUP BY 
        CASE 
          WHEN EXTRACT(HOUR FROM ${beirutTimeExpr}) >= 12 AND EXTRACT(HOUR FROM ${beirutTimeExpr}) < 15 THEN 'lunch'
          WHEN EXTRACT(HOUR FROM ${beirutTimeExpr}) >= 15 AND EXTRACT(HOUR FROM ${beirutTimeExpr}) < 19 THEN 'afternoon'
          WHEN EXTRACT(HOUR FROM ${beirutTimeExpr}) >= 19 AND EXTRACT(HOUR FROM ${beirutTimeExpr}) < 23 THEN 'dinner'
          ELSE 'offpeak'
        END`
    ) || [];

    const timeOfDayMap = {
      lunch: { period: 'Lunch (12 PM – 3 PM)', order_count: 0, total_revenue: 0 },
      afternoon: { period: 'Afternoon (3 PM – 7 PM)', order_count: 0, total_revenue: 0 },
      dinner: { period: 'Dinner (7 PM – 11 PM)', order_count: 0, total_revenue: 0 },
      offpeak: { period: 'Off-Peak / Night (11 PM – 12 PM)', order_count: 0, total_revenue: 0 }
    };

    (timeOfDayRows || []).forEach((r) => {
      const key = (r.period || '').toLowerCase();
      if (timeOfDayMap[key]) {
        timeOfDayMap[key].order_count = parseInt(r.order_count, 10) || 0;
        timeOfDayMap[key].total_revenue = parseFloat(r.total_revenue) || 0;
      }
    });

    return Response.json({
      summary: (summaryRows && summaryRows[0]) ? summaryRows[0] : { total_orders: 0, total_revenue: 0 },
      channels: Array.isArray(channels) ? channels : [],
      paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [],
      topProducts: Array.isArray(topProducts) ? topProducts : [],
      categories: Array.isArray(categories) ? categories : [],
      voidedSummary: (voidedSummaryRows && voidedSummaryRows[0]) ? voidedSummaryRows[0] : { void_count: 0, total_voided_amount: 0 },
      voidedOrders: Array.isArray(voidedOrders) ? voidedOrders : [],
      hourlySales: Array.isArray(hourlySales) ? hourlySales : [],
      timeOfDay: timeOfDayMap
    });
  } catch (error) {
    console.error("Error in GET /api/admin/reports:", error);
    return Response.json({ error: "Failed to generate report: " + error.message }, { status: 500 });
  }
}
