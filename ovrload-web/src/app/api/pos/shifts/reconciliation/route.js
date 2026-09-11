import sql from '../../../utils/sql';

const LOCATION_TO_BRANCH_ID = {
  'cloud-kitchen': 1,
  'badaro': 2,
  'badaro-bistro': 3,
  'naccache-bistro': 4
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const locationKey = searchParams.get('location_key');
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time') || new Date().toISOString();
    const rawTerminalIds = searchParams.get('terminal_ids') || searchParams.get('terminal_id');

    if (!locationKey) {
      return Response.json({ error: "Missing required parameter: location_key" }, { status: 400 });
    }

    if (!startTime) {
      return Response.json({ error: "Missing required parameter: start_time" }, { status: 400 });
    }

    const numericBranchId = LOCATION_TO_BRANCH_ID[locationKey] || null;

    // Parse terminal IDs for drawer-specific physical cash filtering
    let terminalList = [];
    if (rawTerminalIds) {
      terminalList = rawTerminalIds.split(',').map(t => t.trim()).filter(Boolean);
    }

    // 1. Fetch commerce orders in the shift time window for this location
    const orders = await sql`
      SELECT 
        id,
        branch_id,
        total_amount,
        subtotal_amount,
        discount_amount,
        promo_discount,
        status,
        order_source,
        order_type,
        payment_method,
        amount_paid,
        amount_refunded,
        void_reason,
        guest_count,
        created_at
      FROM orders
      WHERE (
        ${numericBranchId ? sql`branch_id = ${numericBranchId}` : sql`false`}
      )
        AND created_at >= ${startTime}
        AND created_at <= ${endTime}
      ORDER BY created_at ASC;
    `;

    // 2. Fetch granular completed order_payments rows
    const payments = await sql`
      SELECT 
        p.*
      FROM order_payments p
      WHERE LOWER(p.status) = 'completed'
        AND (
          p.location_key = ${locationKey}
          OR (${numericBranchId ? sql`p.order_id IN (SELECT id FROM orders WHERE branch_id = ${numericBranchId})` : sql`false`})
        )
        AND p.created_at >= ${startTime}
        AND p.created_at <= ${endTime}
        ${terminalList.length > 0 ? sql`AND p.terminal_id IN ${sql(terminalList)}` : sql``};
    `;

    // 3. Fetch granular completed order_refunds rows (using refund's completed_at!)
    const refundsList = await sql`
      SELECT 
        r.*
      FROM order_refunds r
      WHERE LOWER(r.status) = 'completed'
        AND (
          r.location_key = ${locationKey}
          OR (${numericBranchId ? sql`r.order_id IN (SELECT id FROM orders WHERE branch_id = ${numericBranchId})` : sql`false`})
        )
        AND r.completed_at >= ${startTime}
        AND r.completed_at <= ${endTime}
        ${terminalList.length > 0 ? sql`AND r.terminal_id IN ${sql(terminalList)}` : sql``};
    `;

    // 4. Compute aggregations
    let grossSales = 0;
    let totalDiscounts = 0;
    let totalRefunds = 0;
    let ordersCount = 0;
    let discountedOrdersCount = 0;
    let totalCovers = 0;
    let voidCount = 0;
    let voidTotal = 0;

    const tenders = {
      cash_usd: 0,
      cash_lbp: 0,
      cash_lbp_usd_equiv: 0,
      whish_usd: 0,
      card_usd: 0,
      toters_usd: 0,
      toters_orders: 0,
      noknok_usd: 0,
      noknok_orders: 0,
      other_usd: 0
    };

    const refunds = {
      cash_usd: 0,
      cash_lbp: 0,
      cash_lbp_usd_equiv: 0,
      whish_usd: 0,
      card_usd: 0,
      total_usd: 0
    };

    const channels = {
      pos: 0,
      whatsapp: 0,
      toters: 0,
      noknok: 0,
      app: 0,
      dine_in: 0,
      takeaway: 0,
      delivery: 0
    };

    for (const o of orders) {
      if (o.status === 'cancelled') {
        voidCount++;
        voidTotal += parseFloat(o.total_amount || 0);
        continue;
      }

      ordersCount++;
      const total = parseFloat(o.total_amount || 0);
      const subtotal = parseFloat(o.subtotal_amount || total);
      const discount = parseFloat(o.discount_amount || 0) + parseFloat(o.promo_discount || 0);
      const refunded = parseFloat(o.amount_refunded || 0);
      const guests = parseInt(o.guest_count || 0, 10);

      grossSales += (subtotal > 0 ? subtotal : total + discount);
      totalDiscounts += discount;
      if (discount > 0) discountedOrdersCount++;
      totalRefunds += refunded;
      totalCovers += guests;

      // Channel breakdown
      const src = (o.order_source || '').toLowerCase();
      if (src.includes('toter')) channels.toters++;
      else if (src.includes('nok')) channels.noknok++;
      else if (src.includes('whats')) channels.whatsapp++;
      else if (src.includes('pos')) channels.pos++;
      else channels.app++;

      const oType = (o.order_type || '').toLowerCase();
      if (oType.includes('dine')) channels.dine_in++;
      else if (oType.includes('take') || oType.includes('pick')) channels.takeaway++;
      else channels.delivery++;

      // Tally legacy external/aggregator totals if not in payments
      if (src.includes('toter')) {
        tenders.toters_usd += total;
        tenders.toters_orders++;
      } else if (src.includes('nok')) {
        tenders.noknok_usd += total;
        tenders.noknok_orders++;
      }
    }

    // Process granular payments
    for (const p of payments) {
      const pMethod = p.payment_method || '';
      const curr = (p.currency || 'USD').toUpperCase();
      const amtUsd = parseFloat(p.amount_usd || 0);
      const amtCurr = parseFloat(p.amount_in_currency || amtUsd);

      if (pMethod === 'Cash USD' || (pMethod === 'Cash' && curr === 'USD')) {
        tenders.cash_usd += amtUsd;
      } else if (pMethod === 'Cash LBP' || (pMethod === 'Cash' && curr === 'LBP')) {
        tenders.cash_lbp += amtCurr;
        tenders.cash_lbp_usd_equiv += amtUsd;
      } else if (pMethod.toLowerCase().includes('whish')) {
        tenders.whish_usd += amtUsd;
      } else if (pMethod.toLowerCase().includes('card')) {
        tenders.card_usd += amtUsd;
      } else {
        tenders.other_usd += amtUsd;
      }
    }

    // Process granular refunds from order_refunds table
    for (const r of refundsList) {
      const pMethod = r.payment_method || '';
      const curr = (r.currency || 'USD').toUpperCase();
      const amtUsd = parseFloat(r.amount_usd || r.amount || 0);
      const amtCurr = parseFloat(r.amount_in_currency || r.amount || amtUsd);

      refunds.total_usd += amtUsd;

      if (pMethod === 'Cash USD' || (pMethod.toLowerCase().includes('cash') && curr === 'USD')) {
        refunds.cash_usd += amtUsd;
      } else if (pMethod === 'Cash LBP' || (pMethod.toLowerCase().includes('cash') && curr === 'LBP')) {
        refunds.cash_lbp += amtCurr;
        refunds.cash_lbp_usd_equiv += amtUsd;
      } else if (pMethod.toLowerCase().includes('whish')) {
        refunds.whish_usd += amtUsd;
      } else if (pMethod.toLowerCase().includes('card')) {
        refunds.card_usd += amtUsd;
      }
    }

    const netSales = grossSales - totalDiscounts - totalRefunds;
    const avgTicket = ordersCount > 0 ? (netSales / ordersCount) : 0;

    return Response.json({
      success: true,
      locationKey,
      startTime,
      endTime,
      terminalIds: terminalList,
      ordersCount,
      grossSales: parseFloat(grossSales.toFixed(2)),
      totalDiscounts: parseFloat(totalDiscounts.toFixed(2)),
      discountedOrdersCount,
      totalRefunds: parseFloat(totalRefunds.toFixed(2)),
      netSales: parseFloat(netSales.toFixed(2)),
      avgTicket: parseFloat(avgTicket.toFixed(2)),
      totalCovers,
      voidCount,
      voidTotal: parseFloat(voidTotal.toFixed(2)),
      tenders: {
        cash_usd: parseFloat(tenders.cash_usd.toFixed(2)),
        cash_lbp: Math.round(tenders.cash_lbp),
        cash_lbp_usd_equiv: parseFloat(tenders.cash_lbp_usd_equiv.toFixed(2)),
        whish_usd: parseFloat(tenders.whish_usd.toFixed(2)),
        card_usd: parseFloat(tenders.card_usd.toFixed(2)),
        toters_usd: parseFloat(tenders.toters_usd.toFixed(2)),
        toters_orders: tenders.toters_orders,
        noknok_usd: parseFloat(tenders.noknok_usd.toFixed(2)),
        noknok_orders: tenders.noknok_orders,
        other_usd: parseFloat(tenders.other_usd.toFixed(2))
      },
      refunds: {
        cash_usd: parseFloat(refunds.cash_usd.toFixed(2)),
        cash_lbp: Math.round(refunds.cash_lbp),
        cash_lbp_usd_equiv: parseFloat(refunds.cash_lbp_usd_equiv.toFixed(2)),
        whish_usd: parseFloat(refunds.whish_usd.toFixed(2)),
        card_usd: parseFloat(refunds.card_usd.toFixed(2)),
        total_usd: parseFloat(refunds.total_usd.toFixed(2))
      },
      channels
    });
  } catch (error) {
    console.error("Reconciliation endpoint error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
