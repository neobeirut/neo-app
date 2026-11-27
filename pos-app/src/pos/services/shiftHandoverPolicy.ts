import { supabase, getGlobalRestaurantId } from '../../api/supabase';
import { businessDay, loadPreparingOrders, pendingPreparation } from './preparingOrders';

export function canHoldPreviousPm(shift: any, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hour: '2-digit', hourCycle: 'h23' }).format(now));
  return shift?.status === 'open' && shift.shift === 'PM' && String(shift.date).slice(0, 10) < businessDay(now) && hour < 16;
}

export async function loadShiftHandover(
  branchId: string,
  restaurantId = getGlobalRestaurantId(),
  beforeTime?: string,
  conceptId?: string
) {
  if (!branchId || !restaurantId) throw new Error('Select the restaurant and branch before checking shift handover.');
  const { data: links, error: linkError } = await supabase.from('commerce_branch_links').select('flow_branch_id,external_branch_id')
    .eq('restaurant_id', restaurantId).or(`flow_branch_id.eq.${branchId},external_branch_id.eq.${branchId}`);
  if (linkError) throw new Error(linkError.message);
  const branches = [...new Set([branchId, ...(links || []).flatMap((l: any) => [l.flow_branch_id, l.external_branch_id])].filter(Boolean).map(String))];
  const orders: any[] = [];
  for (const branch of branches) orders.push(...await loadPreparingOrders(branch, undefined, restaurantId, beforeTime, conceptId));
  const preparation = pendingPreparation([...new Map(orders.map(o => [o.id, o])).values()]);
  
  const isDeliveryConcept = conceptId && conceptId !== '00000000-0000-0000-0000-000000000001';
  const tables: any[] = [];
  
  if (!isDeliveryConcept) {
    for (let offset = 0; ; offset += 500) {
      let q = supabase.from('pos_table_sessions').select('id,commerce_order_id,status').eq('restaurant_id', restaurantId)
        .in('branch_id', branches).in('status', ['opening', 'occupied', 'bill_requested', 'closing']).order('id').range(offset, offset + 499);
      if (beforeTime) q = q.lt('opened_at', beforeTime);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      tables.push(...(data || []));
      if (!data || data.length < 500) break;
    }
  }

  return { ...preparation, tables, blocked: tables.length > 0 || preparation.blocking.length > 0 };
}

export function handoverMessage(state: Awaited<ReturnType<typeof loadShiftHandover>>) {
  return `Close ${state.tables.length} open table(s) and ${state.blocking.length} unscheduled order(s) before closing the PM shift or opening the AM shift. Scheduled orders may remain open, paid or unpaid.`;
}
