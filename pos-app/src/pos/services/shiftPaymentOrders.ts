import { supabase } from '../../api/supabase';

// Tender time is immutable in the existing receivable RPC, even when an advance
// order is fulfilled later. Old orders without tenders retain a legacy fallback.
export function paymentTime(order: any, tenders: any[]) {
  const times = tenders.filter(t => String(t.pos_order_id) === String(order.id) && t.completed_at)
    .map(t => t.completed_at).sort();
  if (times.length) return times[0];
  if (!['completed', 'paid', 'closed', 'delivered'].includes(order.status)) return null;
  return order.completed_at || order.created_at;
}

export async function loadShiftPaymentOrders(params: {
  restaurantId: string;
  branchIds: string[];
  terminalIds?: string[];
  startTime: string;
  endTime: string;
  endExclusive?: boolean;
}) {
  if (!params.restaurantId || !params.branchIds.length) {
    throw new Error('Cannot resolve payment reporting scope.');
  }

  const tenders: any[] = [];
  const startMs = Date.parse(params.startTime);
  const endMs = Date.parse(params.endTime);

  // 1. Try loading order_tender_receivables for precise tender timing in this shift window
  try {
    for (let offset = 0; ; offset += 500) {
      let tQ = supabase
        .from('order_tender_receivables')
        .select('pos_order_id,completed_at')
        .eq('restaurant_id', params.restaurantId)
        .in('branch_id', params.branchIds)
        .order('id');

      if (typeof tQ.gte === 'function' && Number.isFinite(startMs)) {
        tQ = tQ.gte('completed_at', params.startTime);
      }
      if (Number.isFinite(endMs)) {
        if (params.endExclusive === false) {
          if (typeof tQ.lte === 'function') tQ = tQ.lte('completed_at', params.endTime);
        } else {
          if (typeof tQ.lt === 'function') tQ = tQ.lt('completed_at', params.endTime);
        }
      }
      tQ = tQ.range(offset, offset + 499);

      const { data, error } = await tQ;
      if (error) {
        // Permission denied (RLS / table grant) or missing table - log and use pos_orders timing fallback
        console.warn('[shiftPaymentOrders] order_tender_receivables lookup skipped:', error.message);
        break;
      }
      tenders.push(...(data || []));
      if (!data || data.length < 500) break;
    }
  } catch (tErr: any) {
    console.warn('[shiftPaymentOrders] order_tender_receivables not accessible, using order completed_at fallback:', tErr?.message);
  }

  const tenderOrderIds = Array.from(new Set(tenders.map(t => t.pos_order_id).filter(Boolean)));

  // 2. Load pos_orders bounded by the shift window (with 24h lookback to cover tables/orders opened prior to shift)
  const orders: any[] = [];
  const lookbackMs = Number.isFinite(startMs) ? startMs - 24 * 3600 * 1000 : NaN;
  const lookbackIso = Number.isFinite(lookbackMs) ? new Date(lookbackMs).toISOString() : '';
  const maxMs = Number.isFinite(endMs) ? endMs + 4 * 3600 * 1000 : NaN;
  const maxIso = Number.isFinite(maxMs) ? new Date(maxMs).toISOString() : '';

  const columns = 'id,status,restaurant_id,branch_id,terminal_id,total_amount,subtotal_amount,discount_amount,exchange_rate,payment_method,order_source,order_type,guest_count,created_at,completed_at,tendered_amount,special_instructions,customer_name,table_label,is_scheduled,scheduled_for,concept_id';

  for (let offset = 0; ; offset += 500) {
    let q = supabase
      .from('pos_orders')
      .select(columns)
      .eq('restaurant_id', params.restaurantId)
      .in('branch_id', params.branchIds)
      .order('id');

    q = q.not('status', 'in', '(cancelled,canceled,voided,refunded)');
    if (params.terminalIds?.length) q = q.in('terminal_id', params.terminalIds);

    // Apply time bounds to avoid scanning historical orders
    if (lookbackIso && typeof q.gte === 'function') {
      q = q.gte('created_at', lookbackIso);
    }
    if (maxIso && typeof q.lte === 'function') {
      q = q.lte('created_at', maxIso);
    }

    q = q.range(offset, offset + 499);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    orders.push(...(data || []));
    if (!data || data.length < 500) break;
  }

  // 3. If any advance/scheduled orders paid via tender were created earlier than the lookback, fetch them directly
  if (tenderOrderIds.length > 0) {
    const fetchedIds = new Set(orders.map(o => o.id));
    const missingIds = tenderOrderIds.filter(id => !fetchedIds.has(id));
    if (missingIds.length > 0) {
      for (let i = 0; i < missingIds.length; i += 100) {
        const chunk = missingIds.slice(i, i + 100);
        let qMissing = supabase
          .from('pos_orders')
          .select(columns)
          .eq('restaurant_id', params.restaurantId)
          .in('id', chunk);
        const { data: missingData } = await qMissing;
        if (missingData) {
          orders.push(...missingData);
        }
      }
    }
  }

  // 4. Exact payment window filtering
  const start = startMs, end = endMs;
  return orders.filter(order => {
    const time = paymentTime(order, tenders);
    if (!time) return false;
    const paid = Date.parse(time);
    return paid >= start && (params.endExclusive === false ? paid <= end : paid < end);
  });
}
