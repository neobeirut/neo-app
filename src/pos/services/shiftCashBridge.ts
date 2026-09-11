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
  close_operation_id?: string | null;
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
  terminalId: string; // Mandatory explicit persistent terminal identity
  userName: string;
  shift?: 'AM' | 'PM' | 'ALL DAY';
  openingUsd: number;
  openingLbp: number;
  rate?: number;
  restaurantId?: string;
}

export interface CloseShiftParams {
  shiftId: string;
  closeOperationId?: string;
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

export interface CashMovementParams {
  shiftId: string;
  operationId: string;
  movementType: 'cash_in' | 'cash_drop' | 'payout';
  currency: 'USD' | 'LBP';
  amount: number;
  reason: string;
  createdBy: string;
  approvedBy?: string;
}

/**
 * Resolves the canonical physical drawer reconciliation ID for a branch and device terminal alias.
 * Decouples POS device identity from physical cash drawer identity.
 */
export async function resolvePhysicalDrawerId(branchIdentifier?: string, terminalId?: string): Promise<string> {
  if (!terminalId) return 'DRAWER-01';
  if (!branchIdentifier) return terminalId.trim();

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchIdentifier);
    let query = supabase
      .from('pos_drawer_terminal_links')
      .select('drawer_terminal_id')
      .eq('commerce_terminal_id', terminalId.trim())
      .eq('active', true);

    if (isUuid) {
      query = query.eq('branch_id', branchIdentifier);
    }

    const { data } = await query.limit(1);
    if (data && data.length > 0 && data[0].drawer_terminal_id) {
      return data[0].drawer_terminal_id;
    }
  } catch (err) {
    console.warn('[shiftCashBridge] Error resolving physical drawer ID:', err);
  }

  return terminalId.trim();
}

/**
 * Resolves all commerce terminal aliases mapped to a physical drawer.
 */
export async function getDrawerTerminalAliases(branchId: string, drawerTerminalId: string): Promise<string[]> {
  if (!branchId || !drawerTerminalId) return drawerTerminalId ? [drawerTerminalId] : [];

  try {
    const canonicalDrawer = await resolvePhysicalDrawerId(branchId, drawerTerminalId);

    const { data, error } = await supabase
      .from('pos_drawer_terminal_links')
      .select('commerce_terminal_id')
      .eq('branch_id', branchId)
      .eq('drawer_terminal_id', canonicalDrawer)
      .eq('active', true);

    if (error || !data || data.length === 0) {
      return [canonicalDrawer];
    }

    const aliases = data.map((r: any) => r.commerce_terminal_id);
    if (!aliases.includes(canonicalDrawer)) {
      aliases.push(canonicalDrawer);
    }
    if (!aliases.includes(drawerTerminalId)) {
      aliases.push(drawerTerminalId);
    }
    return aliases;
  } catch (err) {
    console.warn('[shiftCashBridge] Error fetching drawer terminal aliases:', err);
    return [drawerTerminalId];
  }
}

/**
 * Queries the active open shift for a branch and physical drawer.
 */
export async function getActiveShift(branchIdentifier: string, terminalId?: string): Promise<ShiftCashRecord | null> {
  if (!branchIdentifier) return null;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchIdentifier);
    const canonicalDrawer = terminalId ? await resolvePhysicalDrawerId(branchIdentifier, terminalId) : undefined;

    let query = supabase
      .from('shift_cash')
      .select('*')
      .eq('status', 'open');

    if (isUuid) {
      query = query.eq('branch_id', branchIdentifier);
    } else {
      query = query.ilike('branch', `%${branchIdentifier.trim()}%`);
    }

    if (canonicalDrawer) {
      query = query.eq('terminal_id', canonicalDrawer);
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
 * Records an operational cash movement in FLOW shift_cash_movements.
 */
export async function recordCashMovement(params: CashMovementParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('shift_cash_movements')
      .insert([{
        shift_id: params.shiftId,
        operation_id: params.operationId,
        movement_type: params.movementType,
        currency: params.currency,
        amount: params.amount,
        reason: params.reason,
        created_by: params.createdBy,
        approved_by: params.approvedBy || null
      }]);

    if (error) {
      console.error('[shiftCashBridge] Error recording cash movement:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to record cash movement' };
  }
}

/**
 * Opens a new shift cash session in FLOW shift_cash.
 * Ensures an explicit persistent terminal ID is provided and prevents concurrent open shifts.
 */
export async function openShift(params: OpenShiftParams): Promise<{ success: boolean; shift?: ShiftCashRecord; error?: string }> {
  try {
    if (!params.terminalId) {
      return { success: false, error: 'Cannot open shift without explicit terminal ID.' };
    }
    const deviceTerminalId = params.terminalId.trim();
    const canonicalDrawerId = await resolvePhysicalDrawerId(params.branchId || params.branchName, deviceTerminalId);
    
    // Check for existing open shift on this canonical physical drawer
    const existing = await getActiveShift(params.branchId || params.branchName, canonicalDrawerId);
    if (existing) {
      return {
        success: false,
        error: `Physical drawer ${canonicalDrawerId} already has an active open shift (opened by ${existing.user_name} at ${new Date(existing.created_at).toLocaleTimeString()}). Please close it first.`
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
      terminal_id: canonicalDrawerId,
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
 * Executes atomically and idempotently using close_operation_id.
 */
export async function closeShift(params: CloseShiftParams): Promise<{ success: boolean; shift?: ShiftCashRecord; error?: string }> {
  try {
    const nowIso = new Date().toISOString();
    const opId = params.closeOperationId || (
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'close-' + Date.now()
    );

    const updatePayload: any = {
      status: 'closed',
      closed_at: nowIso,
      finalized_at: nowIso,
      close_operation_id: opId,
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

    if (params.tenderSummary) updatePayload.tender_summary = params.tenderSummary;
    if (params.kpiSummary) updatePayload.kpi_summary = params.kpiSummary;
    if (params.salesLbp !== undefined) updatePayload.sales_lbp = params.salesLbp;

    // Atomic conditional update: update ONLY IF status is 'open'
    const { data, error } = await supabase
      .from('shift_cash')
      .update(updatePayload)
      .eq('id', params.shiftId)
      .eq('status', 'open')
      .select();

    if (error) {
      console.error('[shiftCashBridge] Error closing shift:', error);
      return { success: false, error: error.message };
    }

    if (data && data.length > 0) {
      return { success: true, shift: data[0] as ShiftCashRecord };
    }

    // If 0 rows updated, verify if already closed under the same operation_id (idempotency)
    const { data: existing, error: fetchErr } = await supabase
      .from('shift_cash')
      .select('*')
      .eq('id', params.shiftId)
      .single();

    if (!fetchErr && existing) {
      if (existing.close_operation_id === opId) {
        return { success: true, shift: existing as ShiftCashRecord };
      }
      if (existing.status === 'closed') {
        return { success: false, error: 'Shift was already closed and finalized under another operation.' };
      }
    }

    return { success: false, error: 'Failed to close shift: record not found or already closed.' };
  } catch (err: any) {
    console.error('[shiftCashBridge] Exception closing shift:', err);
    return { success: false, error: err?.message || 'Failed to close shift' };
  }
}
