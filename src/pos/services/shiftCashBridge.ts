import { supabase } from '../../api/supabase';

export interface ShiftCashRecord {
  id: string;
  date: string;
  branch: string;
  shift: 'AM' | 'PM' | 'ALL DAY' | string;
  rate: number;
  opening_usd: number;
  opening_lbp: number;
  actual_usd: number | null;
  actual_lbp: number | null;
  difference_usd: number | null;
  user_name: string;
  status: 'open' | 'closed';
  created_at: string;
  closed_at?: string | null;
  restaurant_id?: string;
}

export interface OpenShiftParams {
  branchName: string;
  userName: string;
  shift?: 'AM' | 'PM' | 'ALL DAY';
  openingUsd: number;
  openingLbp: number;
  rate?: number;
  restaurantId?: string;
}

export interface CloseShiftParams {
  shiftId: string;
  actualUsd: number;
  actualLbp: number;
  salesLbp?: number;
  differenceUsd?: number;
}

/**
 * Queries the active open shift for a branch.
 */
export async function getActiveShift(branchName: string): Promise<ShiftCashRecord | null> {
  if (!branchName) return null;

  try {
    const { data, error } = await supabase
      .from('shift_cash')
      .select('*')
      .ilike('branch', `%${branchName.trim()}%`)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[shiftCashBridge] Error fetching active shift:', error.message);
      return null;
    }

    if (data && data.length > 0) {
      return data[0] as ShiftCashRecord;
    }

    return null;
  } catch (err) {
    console.error('[shiftCashBridge] Exception fetching active shift:', err);
    return null;
  }
}

/**
 * Opens a new shift cash session in FLOW shift_cash.
 */
export async function openShift(params: OpenShiftParams): Promise<{ success: boolean; shift?: ShiftCashRecord; error?: string }> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const defaultShift = params.shift || (hour < 16 ? 'AM' : 'PM');
    const defaultRate = params.rate || 89500;
    const defaultRestaurantId = params.restaurantId || '79256f11-a9f8-4fec-901d-69baf929762d';

    const newRecord = {
      date: todayStr,
      branch: params.branchName,
      shift: defaultShift,
      rate: defaultRate,
      opening_usd: params.openingUsd || 0,
      opening_lbp: params.openingLbp || 0,
      user_name: params.userName || 'Cashier',
      restaurant_id: defaultRestaurantId,
      status: 'open',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('shift_cash')
      .insert([newRecord])
      .select();

    if (error) {
      console.error('[shiftCashBridge] Error opening shift:', error);
      return { success: false, error: error.message };
    }

    return { success: true, shift: (data && data[0]) as ShiftCashRecord };
  } catch (err: any) {
    console.error('[shiftCashBridge] Exception opening shift:', err);
    return { success: false, error: err?.message || 'Failed to open shift' };
  }
}

/**
 * Closes an existing shift cash session in FLOW shift_cash.
 */
export async function closeShift(params: CloseShiftParams): Promise<{ success: boolean; error?: string }> {
  try {
    const updatePayload: any = {
      status: 'closed',
      closed_at: new Date().toISOString(),
      actual_usd: params.actualUsd,
      actual_lbp: params.actualLbp
    };

    if (params.differenceUsd !== undefined) {
      updatePayload.difference_usd = params.differenceUsd;
    }
    if (params.salesLbp !== undefined) {
      updatePayload.sales_lbp = params.salesLbp;
    }

    const { error } = await supabase
      .from('shift_cash')
      .update(updatePayload)
      .eq('id', params.shiftId);

    if (error) {
      console.error('[shiftCashBridge] Error closing shift:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[shiftCashBridge] Exception closing shift:', err);
    return { success: false, error: err?.message || 'Failed to close shift' };
  }
}
