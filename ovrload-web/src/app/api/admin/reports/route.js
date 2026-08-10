import sql from "../../utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "today";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let dateFilterSql = "";

    if (range === "today") {
      dateFilterSql = "AND created_at >= CURRENT_DATE";
    } else if (range === "yesterday") {
      dateFilterSql = "AND created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE";
    } else if (range === "7days") {
      dateFilterSql = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (range === "thismonth") {
      dateFilterSql = "AND created_at >= DATE_TRUNC('month', CURRENT_DATE)";
    } else if (range === "custom" && startDateParam && endDateParam) {
      dateFilterSql = `AND created_at >= '${startDateParam} 00:00:00' AND created_at <= '${endDateParam} 23:59:59'`;
    }

    // 1. KPI Summary
    const summaryRows = await sql`
      SELECT 
        COUNT(*)::int as total_orders,
        COALESCE(SUM(total_amount::float), 0) as total_revenue,
        COALESCE(SUM(subtotal_amount::float), 0) as gross_subtotal,
        COALESCE(SUM(discount_amount::float), 0) as total_discounts,
        COALESCE(SUM(delivery_fee::float), 0) as total_delivery_fees,
        COALESCE(AVG(total_amount::float), 0) as avg_order_value
      FROM orders
      WHERE status = 'completed' ${dateFilterSql ? sql.raw(dateFilterSql) : sql.raw("")}
    `;
    const summary = summaryRows[0] || {};

    // 2. Sales Channel Breakdown
    const channels = await sql`
      SELECT 
        COALESCE(order_source, 'In-Store') as channel,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue,
        COALESCE(SUM(discount_amount::float), 0) as total_discount
      FROM orders
      WHERE status = 'completed' ${dateFilterSql ? sql.raw(dateFilterSql) : sql.raw("")}
      GROUP BY COALESCE(order_source, 'In-Store')
      ORDER BY total_revenue DESC
    `;

    // 3. Payment Method Breakdown
    const paymentMethods = await sql`
      SELECT 
        COALESCE(payment_method, 'Cash') as method,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue
      FROM orders
      WHERE status = 'completed' ${dateFilterSql ? sql.raw(dateFilterSql) : sql.raw("")}
      GROUP BY COALESCE(payment_method, 'Cash')
      ORDER BY total_revenue DESC
    `;

    // 4. Top Selling Products
    const topProducts = await sql`
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
      WHERE o.status = 'completed' ${dateFilterSql ? sql.raw(dateFilterSql) : sql.raw("")}
      GROUP BY oi.product_id, p.name, c.name
      ORDER BY total_qty DESC
      LIMIT 15
    `;

    // 5. Category Breakdown
    const categories = await sql`
      SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        SUM(oi.quantity)::int as total_qty,
        SUM((oi.quantity * oi.unit_price)::float) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.status = 'completed' ${dateFilterSql ? sql.raw(dateFilterSql) : sql.raw("")}
      GROUP BY c.name
      ORDER BY total_revenue DESC
    `;

    // 6. Voided Orders Log
    const voidedSummaryRows = await sql`
      SELECT 
        COUNT(*)::int as void_count,
        COALESCE(SUM(total_amount::float), 0) as total_voided_amount
      FROM orders
      WHERE status = 'voided' ${dateFilterSql ? sql.raw(dateFilterSql) : sql.raw("")}
    `;

    const voidedOrders = await sql`
      SELECT 
        id,
        COALESCE(order_source, 'In-Store') as order_source,
        total_amount::float,
        void_reason,
        created_at
      FROM orders
      WHERE status = 'voided' ${dateFilterSql ? sql.raw(dateFilterSql) : sql.raw("")}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    // 7. Hourly Peak Sales Distribution
    const hourlySales = await sql`
      SELECT 
        EXTRACT(HOUR FROM created_at)::int as hour,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue
      FROM orders
      WHERE status = 'completed' ${dateFilterSql ? sql.raw(dateFilterSql) : sql.raw("")}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour ASC
    `;

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
