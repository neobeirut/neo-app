import { supabase, getGlobalRestaurantId } from '../../api/supabase';
import { businessDay } from './preparingOrders';
const boundaries = new Map<string, number>();
export function dayStart(day: string): number {
  if (boundaries.has(day)) return boundaries.get(day)!;
  const nominal = Date.parse(day + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 10) !== day) throw new Error('Invalid shift business date.');
  let low = nominal - 36 * 3600000, high = nominal + 36 * 3600000;
  // First instant of the Beirut calendar day, including daylight-saving transitions.
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (businessDay(new Date(mid)) < day) low = mid; else high = mid;
  }
  boundaries.set(day, high); return high;
}
export function shiftReportingPeriod(shift: any, now = new Date(), nextOpenedAt?: string) {
  const day = String(shift.date || '').slice(0, 10) || businessDay(shift.created_at || now);
  const nextDay = new Date(Date.parse(day + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  const first = dayStart(day), last = dayStart(nextDay);
  const opened = Date.parse(shift.created_at || '');
  const start = Number.isFinite(opened) && opened >= first && opened < last ? opened : first;
  const endings = [now.getTime(), Date.parse(shift.closed_at || ''), Date.parse(nextOpenedAt || '')].filter(value => Number.isFinite(value) && value >= start);
  return { day, startTime: new Date(start).toISOString(), endTime: new Date(Math.min(...endings)).toISOString() };
}
export async function loadShiftReportingPeriod(shift: any, terminalIds: string[] = []) {
  const period = shiftReportingPeriod(shift);
  const restaurantId = shift.restaurant_id || getGlobalRestaurantId();
  if (!restaurantId || (!shift.branch_id && !shift.branch)) throw new Error('Cannot resolve the saved shift branch.');
  let query = supabase.from('shift_cash').select('created_at').eq('restaurant_id', restaurantId)
    .gt('created_at', period.startTime).lte('created_at', new Date().toISOString()).neq('id', shift.id);
  query = shift.branch_id ? query.eq('branch_id', shift.branch_id) : query.eq('branch', shift.branch);
  const terminals = terminalIds.length ? terminalIds : (shift.terminal_id ? [shift.terminal_id] : []);
  if (terminals.length) query = query.in('terminal_id', terminals);
  const { data, error } = await query.order('created_at').limit(1);
  if (error) throw new Error(error.message);
  return shiftReportingPeriod(shift, new Date(), data?.[0]?.created_at);
}
