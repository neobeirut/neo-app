import { supabase } from '../../api/supabase';

export interface ShiftCashRecord {
  id: string;
  date: string;
  branch: string;
  branch_id?: string | null;
  terminal_id?: string;
  shift: 'AM' | 'PM' | 'ALL DAY' | string;
  rate: number;
  opening_usd: number;
  opening_lbp: number;
  expected_cash_usd?: number;
  expected_cash_lbp?: number;
  actual_usd: number | null;
  actual_lbp: number | null;
  difference_usd: number | null;
  variance_usd?: number | null;
  variance_lbp?: number | null;
  user_name: string;
  closed_by?: string | null;
  approved_by?: string | null;
  manager_pin_verified?: boolean;
  blind_closed?: boolean;
  closing_notes?: string | null;
  tender_summary?: any;
  kpi_summary?: any;
  status: 'open' | 'closed';
  created_at: string;
  closed_at?: string | null;
  finalized_at?: string | null;
  restaurant_id?: string;
}

export interface OpenShiftParams {
  branchIdentifier: string; // branch UUID or branch name
  branchId?: string;
  branchName: string;
  terminalId?: string;
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
  expectedCashUsd?: number;
  expectedCashLbp?: number;
  varianceUsd?: number;
  varianceLbp?: number;
  closedBy?: string;
  approvedBy?: string;
  managerPinVerified?: boolean;
  blindClosed?: boolean;
  closingNotes?: string;
  tenderSummary?: any;
  kpiSummary?: any;
  salesLbp?: number;
  differenceUsd?: number;
}

/**
 * Queries the active open shift for a branch and optional terminal.
 */
export async function getActiveShift(branchIdentifier: string, terminalId?: string): Promise<ShiftCashRecord | null> {
  if (!branchIdentifier) return null;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchIdentifier);
    let query = supabase
      .from('shift_cash')
      .select('*')
      .eq('status', 'open');

    if (isUuid) {
      query = query.eq('branch_id', branchIdentifier);
    } else {
      query = query.ilike('branch', `%${branchIdentifier.trim()}%`);
    }

    if (terminalId) {
      query = query.eq('terminal_id', terminalId);
    }

    const { data, error } = await query
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
 * Ensures a terminal does not have conflicting active open shifts.
 */
export async function openShift(params: OpenShiftParams): Promise<{ success: boolean; shift?: ShiftCashRecord; error?: string }> {
  try {
    const terminalId = params.terminalId || 'TERM-1';
    
    // Check for existing open shift on this terminal
    const existing = await getActiveShift(params.branchId || params.branchName, terminalId);
    if (existing) {
      return {
        success: false,
        error: `Terminal ${terminalId} already has an active open shift (opened by ${existing.user_name} at ${new Date(existing.created_at).toLocaleTimeString()}). Please close it first.`
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const defaultShift = params.shift || (hour < 16 ? 'AM' : 'PM');
    const defaultRate = params.rate || 89500;
    const defaultRestaurantId = params.restaurantId || '79256f11-a9f8-4fec-901d-69baf929762d';

    const newRecord: any = {
      date: todayStr,
      branch: params.branchName,
      branch_id: params.branchId || null,
      terminal_id: terminalId,
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
 * Closes an existing shift cash session in FLOW shift_cash with complete reconciliation data.
 */
export async function closeShift(params: CloseShiftParams): Promise<{ success: boolean; shift?: ShiftCashRecord; error?: string }> {
  try {
    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: 'closed',
      closed_at: nowIso,
      finalized_at: nowIso,
      actual_usd: params.actualUsd,
      actual_lbp: params.actualLbp,
      expected_cash_usd: params.expectedCashUsd !== undefined ? params.expectedCashUsd : 0,
      expected_cash_lbp: params.expectedCashLbp !== undefined ? params.expectedCashLbp : 0,
      variance_usd: params.varianceUsd !== undefined ? params.varianceUsd : (params.differenceUsd || 0),
      variance_lbp: params.varianceLbp !== undefined ? params.varianceLbp : 0,
      difference_usd: params.varianceUsd !== undefined ? params.varianceUsd : (params.differenceUsd || 0),
      closed_by: params.closedBy || null,
      approved_by: params.approvedBy || null,
      manager_pin_verified: Boolean(params.managerPinVerified),
      blind_closed: Boolean(params.blindClosed),
      closing_notes: params.closingNotes || null
    };

    if (params.tenderSummary) {
      updatePayload.tender_summary = params.tenderSummary;
    }
    if (params.kpiSummary) {
      updatePayload.kpi_summary = params.kpiSummary;
    }
    if (params.salesLbp !== undefined) {
      updatePayload.sales_lbp = params.salesLbp;
    }

    const { data, error } = await supabase
      .from('shift_cash')
      .update(updatePayload)
      .eq('id', params.shiftId)
      .select();

    if (error) {
      console.error('[shiftCashBridge] Error closing shift:', error);
      return { success: false, error: error.message };
    }

    return { success: true, shift: (data && data[0]) as ShiftCashRecord };
  } catch (err: any) {
    console.error('[shiftCashBridge] Exception closing shift:', err);
    return { success: false, error: err?.message || 'Failed to close shift' };
  }
}
