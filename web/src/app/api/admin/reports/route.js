import sql from "../../utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "today";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let dateWhereClause = "";
    let dateWhereClauseO = "";

    if (range === "today") {
      dateWhereClause = "AND created_at >= CURRENT_DATE";
      dateWhereClauseO = "AND o.created_at >= CURRENT_DATE";
    } else if (range === "yesterday") {
      dateWhereClause = "AND created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE";
      dateWhereClauseO = "AND o.created_at >= CURRENT_DATE - INTERVAL '1 day' AND o.created_at < CURRENT_DATE";
    } else if (range === "7days") {
      dateWhereClause = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
      dateWhereClauseO = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (range === "thismonth") {
      dateWhereClause = "AND created_at >= DATE_TRUNC('month', CURRENT_DATE)";
      dateWhereClauseO = "AND o.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
    } else if (range === "all") {
      dateWhereClause = "";
      dateWhereClauseO = "";
    } else if (range === "custom" && startDateParam && endDateParam) {
      const cleanStart = startDateParam.replace(/[^0-9-]/g, "");
      const cleanEnd = endDateParam.replace(/[^0-9-]/g, "");
      dateWhereClause = `AND created_at >= '${cleanStart} 00:00:00' AND created_at <= '${cleanEnd} 23:59:59'`;
      dateWhereClauseO = `AND o.created_at >= '${cleanStart} 00:00:00' AND o.created_at <= '${cleanEnd} 23:59:59'`;
    }

    // Valid completed sales status (includes completed, approved, paid, etc. - excludes cancelled/voided)
    const salesStatusFilter = "COALESCE(status, 'completed') NOT IN ('cancelled', 'voided', 'pending')";
    const salesStatusFilterO = "COALESCE(o.status, 'completed') NOT IN ('cancelled', 'voided', 'pending')";

    // 1. KPI Summary
    const summaryRows = await sql.unsafe(`
      SELECT 
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount::float), 0) as total_revenue,
        COALESCE(SUM(subtotal_amount::float), 0) as gross_subtotal,
        COALESCE(SUM(discount_amount::float), 0) as total_discounts,
        COALESCE(SUM(delivery_fee::float), 0) as total_delivery_fees,
        COALESCE(AVG(total_amount::float), 0) as avg_order_value
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}
    `);
    const summary = summaryRows[0] || {};

    // 2. Sales Channel Breakdown
    const channels = await sql.unsafe(`
      SELECT 
        COALESCE(order_source, 'In-Store') as channel,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue,
        COALESCE(SUM(discount_amount::float), 0) as total_discount
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}
      GROUP BY COALESCE(order_source, 'In-Store')
      ORDER BY total_revenue DESC
    `);

    // 3. Payment Method Breakdown
    const paymentMethods = await sql.unsafe(`
      SELECT 
        COALESCE(payment_method, 'Cash') as method,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}
      GROUP BY COALESCE(payment_method, 'Cash')
      ORDER BY total_revenue DESC
    `);

    // 4. Top Selling Products
    const topProducts = await sql.unsafe(`
      SELECT 
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
      LIMIT 15
    `);

    // 5. Category Breakdown
    const categories = await sql.unsafe(`
      SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        SUM(oi.quantity)::int as total_qty,
        SUM((oi.quantity * oi.unit_price)::float) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${salesStatusFilterO} ${dateWhereClauseO}
      GROUP BY c.name
      ORDER BY total_revenue DESC
    `);

    // 6. Voided & Cancelled Orders Log
    const voidedSummaryRows = await sql.unsafe(`
      SELECT 
        COUNT(*)::int as void_count,
        COALESCE(SUM(total_amount::float), 0) as total_voided_amount
      FROM orders
      WHERE status IN ('voided', 'cancelled') ${dateWhereClause}
    `);

    const voidedOrders = await sql.unsafe(`
      SELECT 
        id,
        COALESCE(order_source, 'In-Store') as order_source,
        total_amount::float,
        void_reason,
        created_at
      FROM orders
      WHERE status IN ('voided', 'cancelled') ${dateWhereClause}
      ORDER BY created_at DESC
      LIMIT 20
    `);

    // 7. Hourly Peak Sales Distribution
    const hourlySales = await sql.unsafe(`
      SELECT 
        EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour ASC
    `);

    return Response.json({
      summary,
      channels,
      paymentMethods,
      topProducts,
      categories,
      voidedSummary: voidedSummaryRows[0] || { void_count: 0, total_voided_amount: 0 },
      voidedOrders,
      hourlySales
    });
  } catch (error) {
    console.error("Error in GET /api/admin/reports:", error);
    return Response.json({ error: "Failed to generate report: " + error.message }, { status: 500 });
  }
}
