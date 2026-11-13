import { supabase, getGlobalRestaurantId } from '../../api/supabase';
export function businessDay(value: Date | string = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
export function isFutureScheduled(order: any, today = businessDay()): boolean {
  if (order.is_scheduled !== true || !order.scheduled_for) return false;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(order.scheduled_for) ? order.scheduled_for : businessDay(order.scheduled_for);
  return Boolean(day && day > today);
}
export function isScheduledCarryover(order: any) {
  return order.is_scheduled === true && Boolean(order.scheduled_for) && Number.isFinite(Date.parse(order.scheduled_for));
}
export function pendingPreparation(orders: any[], today = businessDay()) {
  const pending = orders.filter(order => ['held', 'pending', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested', 'preparing', 'paid'].includes(String(order.status || '').toLowerCase()));
  return { pending, blocking: pending.filter(order => !isScheduledCarryover(order)), future: pending.filter(order => isScheduledCarryover(order)) };
}
export async function loadPreparingOrders(
  branchId?: string | number,
  externalBranchId?: string | number,
  restaurantId = getGlobalRestaurantId(),
  beforeTime?: string,
  conceptId?: string
) {
  const branches = Array.from(new Set([branchId, externalBranchId].filter(value => value != null && String(value).trim()).map(String)));
  if (!restaurantId || !branches.length) throw new Error('The restaurant and branch must be resolved before checking preparing orders.');
  const orders: any[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from('pos_orders')
      .select('id,status,customer_name,table_label,is_scheduled,scheduled_for,concept_id')
      .eq('restaurant_id', restaurantId).in('branch_id', branches).in('status', ['held', 'pending', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested', 'preparing', 'paid'])
      .order('id').range(offset, offset + 499);
    if (beforeTime) query = query.lt('created_at', beforeTime);
    if (conceptId) {
      if (conceptId === '00000000-0000-0000-0000-000000000001') {
        query = query.or(`concept_id.eq.${conceptId},concept_id.is.null`);
      } else {
        query = query.eq('concept_id', conceptId);
      }
    }
    let { data, error } = await query;
    if (error && (String(error.message || '').includes('concept_id') || (error as any).code === '42703' || (error as any).code === 'PGRST204')) {
      let fallbackQuery = supabase.from('pos_orders')
        .select('id,status,customer_name,table_label,is_scheduled,scheduled_for')
        .eq('restaurant_id', restaurantId).in('branch_id', branches).in('status', ['held', 'pending', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested', 'preparing', 'paid'])
        .order('id').range(offset, offset + 499);
      if (beforeTime) fallbackQuery = fallbackQuery.lt('created_at', beforeTime);
      const res = await fallbackQuery;
      data = res.data;
      error = res.error;
    }
    if (error) throw new Error(error.message);
    orders.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return orders;
}
