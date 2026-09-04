import sql from "@/app/api/utils/sql";
import { corsJson, corsOptions } from "@/app/api/utils/cors";

export async function OPTIONS(request) {
  return corsOptions(request);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const supplierId = searchParams.get("supplierId");

    const values = [];
    let whereConditions = ["1=1"];

    if (startDate) {
      values.push(startDate);
      whereConditions.push(`p.payment_date >= $${values.length}::date`);
    }
    if (endDate) {
      values.push(endDate);
      whereConditions.push(`p.payment_date <= $${values.length}::date`);
    }
    if (supplierId && supplierId !== 'all') {
      values.push(parseInt(supplierId, 10));
      whereConditions.push(`p.supplier_id = $${values.length}`);
    }

    const whereClause = whereConditions.join(" AND ");

    // 1. Overall Summary Metrics
    const summaryQuery = `
      SELECT 
        COALESCE(SUM(p.total_amount), 0)::numeric AS total_spend,
        COALESCE(SUM(COALESCE(p.vat_amount, 0)), 0)::numeric AS total_vat,
        COALESCE(SUM(COALESCE(p.subtotal_amount, p.total_amount)), 0)::numeric AS net_spend,
        COUNT(p.id)::integer AS total_payments,
        COUNT(DISTINCT p.supplier_id)::integer AS total_suppliers,
        COUNT(DISTINCT p.item_id)::integer AS total_items,
        ROUND(COALESCE(AVG(p.total_amount), 0)::numeric, 2) AS avg_payment
      FROM supplier_payments p
      WHERE ${whereClause};
    `;
    const summaryRes = await sql(summaryQuery, values);
    const summary = summaryRes[0] || {};

    // 2. Spend breakdown by Supplier (Top 10)
    const bySupplierQuery = `
      SELECT 
        s.id,
        s.name,
        COALESCE(SUM(p.total_amount), 0)::numeric AS total_spend,
        COUNT(p.id)::integer AS payment_count
      FROM supplier_payments p
      JOIN suppliers s ON s.id = p.supplier_id
      WHERE ${whereClause}
      GROUP BY s.id, s.name
      ORDER BY total_spend DESC
      LIMIT 10;
    `;
    const bySupplier = await sql(bySupplierQuery, values);

    // 3. Spend breakdown by Item (Top 10 Cost Drivers)
    const byItemQuery = `
      SELECT 
        si.id,
        si.name,
        si.unit,
        si.has_vat,
        si.vat_rate,
        COALESCE(SUM(p.qty), 0)::numeric AS total_qty,
        COALESCE(SUM(p.total_amount), 0)::numeric AS total_spend,
        COALESCE(SUM(COALESCE(p.vat_amount, 0)), 0)::numeric AS total_vat,
        COALESCE(SUM(COALESCE(p.subtotal_amount, p.total_amount)), 0)::numeric AS net_spend,
        ROUND(COALESCE(AVG(p.price), 0)::numeric, 2) AS avg_unit_price,
        COUNT(p.id)::integer AS purchase_count
      FROM supplier_payments p
      JOIN supplier_items si ON si.id = p.item_id
      WHERE ${whereClause}
      GROUP BY si.id, si.name, si.unit, si.has_vat, si.vat_rate
      ORDER BY total_spend DESC
      LIMIT 10;
    `;
    const byItem = await sql(byItemQuery, values);

    // 4. Monthly Spend Timeline (last 12 months)
    const timelineQuery = `
      SELECT 
        TO_CHAR(p.payment_date, 'YYYY-MM') AS period,
        TO_CHAR(p.payment_date, 'Mon YY') AS period_label,
        COALESCE(SUM(p.total_amount), 0)::numeric AS spend,
        COUNT(p.id)::integer AS count
      FROM supplier_payments p
      WHERE ${whereClause}
      GROUP BY TO_CHAR(p.payment_date, 'YYYY-MM'), TO_CHAR(p.payment_date, 'Mon YY')
      ORDER BY period ASC;
    `;
    const timeline = await sql(timelineQuery, values);

    // 5. Compare against Total Sales Revenue from orders in the same period (sales - discount)
    let orderRevenue = 0;
    let grossSales = 0;
    let orderDiscounts = 0;
    let orderCount = 0;
    try {
      const orderValues = [];
      let orderWhere = ["COALESCE(status, 'completed') NOT IN ('cancelled', 'voided', 'pending')"];
      if (startDate) {
        orderValues.push(startDate);
        orderWhere.push(`created_at >= $${orderValues.length}::date`);
      }
      if (endDate) {
        orderValues.push(endDate);
        orderWhere.push(`created_at <= $${orderValues.length}::date + INTERVAL '1 day'`);
      }
      const orderRes = await sql(
        `SELECT 
           COALESCE(SUM(COALESCE(subtotal_amount, total_amount) - COALESCE(discount_amount, 0)), 0)::numeric AS total_rev,
           COALESCE(SUM(COALESCE(subtotal_amount, total_amount)), 0)::numeric AS gross_sales,
           COALESCE(SUM(COALESCE(discount_amount, 0)), 0)::numeric AS total_discount,
           COUNT(id)::integer AS order_count 
         FROM orders 
         WHERE ${orderWhere.join(' AND ')};`,
        orderValues
      );
      if (orderRes.length > 0) {
        orderRevenue = Number(orderRes[0].total_rev || 0);
        grossSales = Number(orderRes[0].gross_sales || 0);
        orderDiscounts = Number(orderRes[0].total_discount || 0);
        orderCount = parseInt(orderRes[0].order_count || 0, 10);
      }
    } catch (orderErr) {
      console.warn("Could not query orders table for revenue comparison:", orderErr.message);
    }

    const totalSpend = Number(summary.total_spend || 0);
    const grossMargin = orderRevenue > 0 ? (orderRevenue - totalSpend) : 0;
    const grossMarginPercent = orderRevenue > 0 ? Math.round(((orderRevenue - totalSpend) / orderRevenue) * 1000) / 10 : 0;

    return corsJson(request, {
      ok: true,
      summary: {
        totalSpend,
        totalVat: Number(summary.total_vat || 0),
        netSpend: Number(summary.net_spend || (totalSpend - Number(summary.total_vat || 0))),
        totalPayments: parseInt(summary.total_payments || 0, 10),
        totalSuppliers: parseInt(summary.total_suppliers || 0, 10),
        totalItems: parseInt(summary.total_items || 0, 10),
        avgPayment: Number(summary.avg_payment || 0),
        orderRevenue,
        grossSales,
        orderDiscounts,
        orderCount,
        grossMargin,
        grossMarginPercent
      },
      bySupplier: bySupplier.map(s => ({
        ...s,
        total_spend: Number(s.total_spend),
        percentage: totalSpend > 0 ? Math.round((Number(s.total_spend) / totalSpend) * 1000) / 10 : 0
      })),
      byItem: byItem.map(i => ({
        ...i,
        total_qty: Number(i.total_qty),
        total_spend: Number(i.total_spend),
        total_vat: Number(i.total_vat || 0),
        net_spend: Number(i.net_spend || 0),
        avg_unit_price: Number(i.avg_unit_price),
        percentage: totalSpend > 0 ? Math.round((Number(i.total_spend) / totalSpend) * 1000) / 10 : 0
      })),
      timeline: timeline.map(t => ({
        period: t.period,
        label: t.period_label,
        spend: Number(t.spend),
        count: parseInt(t.count, 10)
      }))
    });
  } catch (error) {
    console.error("Error generating payments stats:", error);
    return corsJson(request, { ok: false, error: error.message }, { status: 500 });
  }
}
