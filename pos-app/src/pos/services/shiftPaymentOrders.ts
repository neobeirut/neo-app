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

export async function loadShiftPaymentOrders(params: { restaurantId: string; branchIds: string[]; terminalIds?: string[]; startTime: string; endTime: string; endExclusive?: boolean }) {
  if (!params.restaurantId || !params.branchIds.length) throw new Error('Cannot resolve payment reporting scope.');
  const orders: any[] = [], tenders: any[] = [];
  // 1. Load pos_orders
  for (let offset = 0; ; offset += 500) {
    let q = supabase.from('pos_orders').select('*')
      .eq('restaurant_id', params.restaurantId).in('branch_id', params.branchIds).order('id').range(offset, offset + 499);
    q = q.not('status', 'in', '(cancelled,canceled,voided,refunded)');
    if (params.terminalIds?.length) q = q.in('terminal_id', params.terminalIds);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    orders.push(...(data || []));
    if (!data || data.length < 500) break;
  }

  // 2. Try loading order_tender_receivables for precise tender timing if table permissions allow
  try {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('order_tender_receivables').select('pos_order_id,completed_at')
        .eq('restaurant_id', params.restaurantId).in('branch_id', params.branchIds).order('id').range(offset, offset + 499);
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
  const start = Date.parse(params.startTime), end = Date.parse(params.endTime);
  return orders.filter(order => {
    const time = paymentTime(order, tenders);
    if (!time) return false;
    const paid = Date.parse(time);
    return paid >= start && (params.endExclusive === false ? paid <= end : paid < end);
  });
}
