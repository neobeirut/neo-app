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
    let branchId = searchParams.get('branch_id');
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time') || new Date().toISOString();
    const terminalId = searchParams.get('terminal_id');

    if (!branchId && locationKey) {
      branchId = LOCATION_TO_BRANCH_ID[locationKey];
    }

    if (!branchId) {
      return Response.json({ error: "Missing required parameter: branch_id or location_key" }, { status: 400 });
    }

    if (!startTime) {
      return Response.json({ error: "Missing required parameter: start_time" }, { status: 400 });
    }

    const numericBranchId = parseInt(branchId, 10);

    // 1. Fetch commerce orders in the shift time window
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
      WHERE branch_id = ${numericBranchId}
        AND created_at >= ${startTime}
        AND created_at <= ${endTime}
      ORDER BY created_at ASC;
    `;

    // 2. Fetch granular order_payments rows
    const payments = await sql`
      SELECT 
        p.*,
        o.branch_id
      FROM order_payments p
      JOIN orders o ON o.id = p.order_id
      WHERE o.branch_id = ${numericBranchId}
        AND p.created_at >= ${startTime}
        AND p.created_at <= ${endTime}
        ${terminalId ? sql`AND p.terminal_id = ${terminalId}` : sql``};
    `;

    // 3. Compute aggregations
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

      // Check if order has granular payments in order_payments
      const orderPays = payments.filter(p => p.order_id === o.id);
      if (orderPays.length > 0) {
        for (const p of orderPays) {
          if (p.status === 'REFUNDED') continue;
          const pMethod = (p.payment_method || '').toLowerCase();
          const amtUsd = parseFloat(p.amount_usd || 0);
          const amtCurr = parseFloat(p.amount_in_currency || amtUsd);
          if (pMethod.includes('usd') && pMethod.includes('cash')) {
            tenders.cash_usd += amtUsd;
          } else if (pMethod.includes('lbp') && pMethod.includes('cash')) {
            tenders.cash_lbp += amtCurr;
            tenders.cash_lbp_usd_equiv += amtUsd;
          } else if (pMethod.includes('whish')) {
            tenders.whish_usd += amtUsd;
          } else if (pMethod.includes('card')) {
            tenders.card_usd += amtUsd;
          } else {
            tenders.other_usd += amtUsd;
          }
        }
      } else {
        // Legacy / order-level attribution
        const pMethod = (o.payment_method || o.order_source || '').toLowerCase();
        if (src.includes('toter') || pMethod.includes('toter')) {
          tenders.toters_usd += total;
          tenders.toters_orders++;
        } else if (src.includes('nok') || pMethod.includes('nok')) {
          tenders.noknok_usd += total;
          tenders.noknok_orders++;
        } else if (pMethod.includes('whish')) {
          tenders.whish_usd += total;
        } else if (pMethod.includes('card')) {
          tenders.card_usd += total;
        } else if (pMethod.includes('lbp')) {
          tenders.cash_lbp += total * 89500;
          tenders.cash_lbp_usd_equiv += total;
        } else {
          tenders.cash_usd += total;
        }
      }
    }

    const netSales = grossSales - totalDiscounts - totalRefunds;
    const avgTicket = ordersCount > 0 ? (netSales / ordersCount) : 0;

    return Response.json({
      success: true,
      branchId: numericBranchId,
      locationKey: locationKey || Object.keys(LOCATION_TO_BRANCH_ID).find(k => LOCATION_TO_BRANCH_ID[k] === numericBranchId),
      startTime,
      endTime,
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
      channels
    });
  } catch (error) {
    console.error("Reconciliation endpoint error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
