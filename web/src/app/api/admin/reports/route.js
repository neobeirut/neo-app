import sql from "../../utils/sql";

export async function GET(request) {
  try {
    const url = new URL(request.url, "http://localhost");
    const searchParams = url.searchParams;
    const action = searchParams.get("action");

    if (action === "audit_discounts") {
      const orders = await sql`
        SELECT 
          id, 
          order_source, 
          payment_method, 
          subtotal_amount::float as subtotal, 
          discount_amount::float as discount, 
          total_amount::float as total, 
          delivery_fee::float as delivery_fee,
          special_instructions,
          created_at
        FROM orders 
        WHERE COALESCE(status, 'completed') NOT IN ('cancelled', 'voided');
      `;

      let totersCount = 0;
      let nonTotersCount = 0;
      let exact15PctCount = 0;
      let non15PctOrders = [];
      let pctBreakdown = {};

      (orders || []).forEach(o => {
        const source = (o.order_source || '').trim();
        const isToters = source.toLowerCase() === 'toters';

        if (isToters) {
          totersCount++;
        } else {
          nonTotersCount++;
          const subtotal = parseFloat(o.subtotal) || 0;
          const discount = parseFloat(o.discount) || 0;

          const expected15 = Math.round(subtotal * 0.15 * 100) / 100;
          const actualPct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
          const roundedPct = Math.round(actualPct);

          pctBreakdown[`${roundedPct}%`] = (pctBreakdown[`${roundedPct}%`] || 0) + 1;

          if (Math.abs(discount - expected15) <= 0.05) {
            exact15PctCount++;
          } else {
            non15PctOrders.push({
              id: o.id,
              source: source || 'Pick-up',
              subtotal,
              discount,
              total: o.total,
              actualPct: Math.round(actualPct * 10) / 10,
              specialInstructions: o.special_instructions,
              createdAt: o.created_at
            });
          }
        }
      });

      return Response.json({
        totalOrders: (orders || []).length,
        totersCount,
        nonTotersCount,
        exact15PctCount,
        non15PctCount: non15PctOrders.length,
        pctBreakdown,
        non15PctOrders
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

    try {
      await sql`
        UPDATE orders 
        SET payment_method = 'Toters' 
        WHERE LOWER(COALESCE(order_source, '')) = 'toters' 
          AND (payment_method IS NULL OR LOWER(payment_method) != 'toters');
      `;
      await sql`
        UPDATE orders 
        SET payment_method = 'Cash' 
        WHERE LOWER(COALESCE(payment_method, '')) = 'cash' 
          AND payment_method != 'Cash';
      `;
    } catch (e) {
      console.error('Error auto-updating Toters payment methods:', e);
    }

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
        CASE 
          WHEN LOWER(COALESCE(order_source, '')) = 'toters' THEN 'Toters'
          WHEN LOWER(COALESCE(payment_method, '')) LIKE '%whish%' THEN 'Whish'
          WHEN LOWER(COALESCE(payment_method, '')) LIKE '%toters%' THEN 'Toters'
          ELSE 'Cash'
        END as method,
        COUNT(*)::int as order_count,
        COALESCE(SUM(total_amount::float), 0) as total_revenue
      FROM orders
      WHERE ${salesStatusFilter} ${dateWhereClause}
      GROUP BY 
        CASE 
          WHEN LOWER(COALESCE(order_source, '')) = 'toters' THEN 'Toters'
          WHEN LOWER(COALESCE(payment_method, '')) LIKE '%whish%' THEN 'Whish'
          WHEN LOWER(COALESCE(payment_method, '')) LIKE '%toters%' THEN 'Toters'
          ELSE 'Cash'
        END
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
