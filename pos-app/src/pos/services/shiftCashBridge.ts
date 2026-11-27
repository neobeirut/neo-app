import { canHoldPreviousPm, loadShiftHandover, handoverMessage } from './shiftHandoverPolicy';
import { loadShiftReportingPeriod } from './shiftReportingPeriod';
import { loadPreparingOrders, pendingPreparation, businessDay } from './preparingOrders';
import { supabase, getGlobalRestaurantId } from '../../api/supabase';

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
  sales_lbp?: number | null;
  cash_in_usd?: number | null;
  cash_in_lbp?: number | null;
  payments_usd?: number | null;
  payments_lbp?: number | null;
  cash_out_usd?: number | null;
  cash_out_lbp?: number | null;
  credit_card_usd?: number | null;
  credit_card_lbp?: number | null;
  on_credit_lbp?: number | null;
  status: 'open' | 'closed' | 'on_hold';
  held_at?: string | null;
  held_by?: string | null;
  held_notes?: string | null;
  created_at: string;
  opened_at?: string | null;
  closed_at?: string | null;
  finalized_at?: string | null;
  restaurant_id?: string;
  concept_id?: string | null;
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
  conceptId?: string;
}

export interface CloseShiftParams {
  branchId?: string;
  externalBranchId?: string;
  preparingHandoverConfirmed?: boolean;
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
  cashInUsd?: number;
  cashInLbp?: number;
  paymentsUsd?: number;
  paymentsLbp?: number;
  cashOutUsd?: number;
  cashOutLbp?: number;
  creditCardUsd?: number;
  creditCardLbp?: number;
  onCreditLbp?: number;
  wallets?: Array<{ wallet_id: string; amount_usd: number; amount_lbp: number }>;
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
export async function resolvePhysicalDrawerId(branchIdentifier?: string | number, terminalId?: string | number): Promise<string> {
  if (!terminalId) return 'DRAWER-01';
  const cleanTerminal = String(terminalId).trim();
  const cleanBranchId = branchIdentifier != null ? String(branchIdentifier).trim() : '';
  if (!cleanBranchId) return cleanTerminal;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanBranchId);
    let query = supabase
      .from('pos_drawer_terminal_links')
      .select('drawer_terminal_id')
      .eq('commerce_terminal_id', cleanTerminal)
      .eq('active', true);

    if (isUuid) {
      query = query.eq('branch_id', cleanBranchId);
    }

    const { data } = await query.limit(1);
    if (data && data.length > 0 && data[0].drawer_terminal_id) {
      return data[0].drawer_terminal_id;
    }
  } catch (err) {
    console.warn('[shiftCashBridge] Error resolving physical drawer ID:', err);
  }

  return cleanTerminal;
}

/**
 * Resolves all commerce terminal aliases mapped to a physical drawer.
 */
export async function getDrawerTerminalAliases(branchId: string, drawerTerminalId: string): Promise<string[]> {
  if (!branchId || !drawerTerminalId) return drawerTerminalId ? [String(drawerTerminalId)] : [];

  try {
    const canonicalDrawer = await resolvePhysicalDrawerId(branchId, drawerTerminalId);

    const { data, error } = await supabase
      .from('pos_drawer_terminal_links')
      .select('commerce_terminal_id')
      .eq('branch_id', String(branchId))
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
    return [String(drawerTerminalId)];
  }
}

/**
 * Cached detection of whether the connected database schema contains shift_cash.concept_id.
 * Allows graceful operation during staging rehearsals and backward-compatible environments.
 */
let hasConceptIdColumnOnDb: boolean | null = null;

export function isConceptIdMissingError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.details || err || '');
  return msg.includes('concept_id does not exist') ||
         msg.includes("'concept_id'") ||
         msg.includes('shift_cash.concept_id') ||
         (err as any).code === '42703' ||
         (err as any).code === 'PGRST204';
}

export function matchShiftConcept(shift: any, conceptId?: string): boolean {
  if (!conceptId) return true;
  if (shift.concept_id) {
    return shift.concept_id === conceptId;
  }
  const notes = String(shift.notes || '');
  const shiftType = String(shift.shift_type || '');
  if (conceptId === '00000000-0000-0000-0000-000000000002') {
    return notes.includes('00000000-0000-0000-0000-000000000002') ||
           notes.toUpperCase().includes('OVRLOAD') ||
           shiftType.toUpperCase().includes('OVRLOAD');
  }
  if (conceptId === '00000000-0000-0000-0000-000000000003') {
    return notes.includes('00000000-0000-0000-0000-000000000003') ||
           notes.toUpperCase().includes('WICKD') ||
           shiftType.toUpperCase().includes('WICKD');
  }
  // NÉO
  const isOther = notes.includes('00000000-0000-0000-0000-000000000002') ||
                  notes.includes('00000000-0000-0000-0000-000000000003') ||
                  shiftType.toUpperCase().includes('OVRLOAD') ||
                  shiftType.toUpperCase().includes('WICKD');
  return !isOther;
}

/**
 * Queries the active open shift for a branch and physical drawer.
 * Seamlessly handles 'All' branch indicators and hardware cash drawer fallback.
 */
export async function getActiveShift(
  branchIdentifier?: string | number,
  terminalId?: string | number,
  restaurantId?: string,
  conceptId?: string
): Promise<ShiftCashRecord | null> {
  const executeQuery = async (useConceptFilter: boolean): Promise<ShiftCashRecord | null> => {
    const targetRestaurantId = restaurantId || getGlobalRestaurantId();
    const cleanBranch = branchIdentifier != null ? String(branchIdentifier).trim() : '';
    const isBranchSpecified = cleanBranch.length > 0 && cleanBranch.toLowerCase() !== 'all' && cleanBranch !== '*';
    const isUuid = isBranchSpecified ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanBranch) : false;
    const canonicalDrawer = terminalId ? await resolvePhysicalDrawerId(cleanBranch || '', String(terminalId)) : undefined;

    // Helper to scope query by concept
    const applyConceptScope = (q: any) => {
      if (useConceptFilter && conceptId && hasConceptIdColumnOnDb !== false) {
        if (conceptId === '00000000-0000-0000-0000-000000000001') {
          return q.or(`concept_id.eq.${conceptId},concept_id.is.null`);
        }
        return q.eq('concept_id', conceptId);
      }
      return q;
    };

    // 1. Primary Query: if a specific branch is provided, query by branch (+ drawer if provided)
    if (isBranchSpecified) {
      let query = supabase
        .from('shift_cash')
        .select('*')
        .eq('status', 'open');

      query = applyConceptScope(query);

      if (targetRestaurantId) {
        query = query.eq('restaurant_id', targetRestaurantId);
      }

      if (isUuid) {
        query = query.eq('branch_id', cleanBranch);
      } else {
        query = query.ilike('branch', `%${cleanBranch}%`);
      }

      if (canonicalDrawer) {
        query = query.eq('terminal_id', canonicalDrawer);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (error) {
        if (isConceptIdMissingError(error)) {
          hasConceptIdColumnOnDb = false;
          throw error;
        }
        throw new Error(error.message);
      }
      if (data && data.length > 0) {
        const matched = data.find((row: any) => matchShiftConcept(row, conceptId));
        if (matched) {
          if (conceptId) matched.concept_id = conceptId;
          return matched as ShiftCashRecord;
        }
      }
    }

    // 2. Hardware / Physical Drawer Fallback:
    if (canonicalDrawer) {
      let drawerQuery = supabase
        .from('shift_cash')
        .select('*')
        .eq('status', 'open')
        .eq('terminal_id', canonicalDrawer);

      drawerQuery = applyConceptScope(drawerQuery);

      if (targetRestaurantId) {
        drawerQuery = drawerQuery.eq('restaurant_id', targetRestaurantId);
      }

      const { data: drawerData, error: drawerError } = await drawerQuery
        .order('created_at', { ascending: false });

      if (drawerError) {
        if (isConceptIdMissingError(drawerError)) {
          hasConceptIdColumnOnDb = false;
          throw drawerError;
        }
        throw new Error(drawerError.message);
      }
      if (drawerData && drawerData.length > 0) {
        const matched = drawerData.find((row: any) => matchShiftConcept(row, conceptId));
        if (matched) {
          if (conceptId) matched.concept_id = conceptId;
          return matched as ShiftCashRecord;
        }
      }
    }

    // 3. Branch-level Fallback:
    if (isBranchSpecified) {
      let branchFallbackQuery = supabase
        .from('shift_cash')
        .select('*')
        .eq('status', 'open');

      branchFallbackQuery = applyConceptScope(branchFallbackQuery);

      if (targetRestaurantId) {
        branchFallbackQuery = branchFallbackQuery.eq('restaurant_id', targetRestaurantId);
      }

      if (isUuid) {
        branchFallbackQuery = branchFallbackQuery.eq('branch_id', cleanBranch);
      } else {
        branchFallbackQuery = branchFallbackQuery.ilike('branch', `%${cleanBranch}%`);
      }

      const { data: branchData, error: branchErr } = await branchFallbackQuery
        .order('created_at', { ascending: false });

      if (branchErr) {
        if (isConceptIdMissingError(branchErr)) {
          hasConceptIdColumnOnDb = false;
          throw branchErr;
        }
      }
      if (!branchErr && branchData && branchData.length > 0) {
        const matched = branchData.find((row: any) => matchShiftConcept(row, conceptId));
        if (matched) {
          if (conceptId) matched.concept_id = conceptId;
          return matched as ShiftCashRecord;
        }
      }
    }

    // 4. Restaurant-level Fallback:
    if (!isBranchSpecified && targetRestaurantId && !canonicalDrawer) {
      let restQuery = supabase
        .from('shift_cash')
        .select('*')
        .eq('status', 'open')
        .eq('restaurant_id', targetRestaurantId);

      restQuery = applyConceptScope(restQuery);

      const { data: restData, error: restError } = await restQuery
        .order('created_at', { ascending: false });

      if (restError) {
        if (isConceptIdMissingError(restError)) {
          hasConceptIdColumnOnDb = false;
          throw restError;
        }
      }
      if (!restError && restData && restData.length > 0) {
        const matched = restData.find((row: any) => matchShiftConcept(row, conceptId));
        if (matched) {
          if (conceptId) matched.concept_id = conceptId;
          return matched as ShiftCashRecord;
        }
      }
    }

    return null;
  };

  try {
    try {
      return await executeQuery(hasConceptIdColumnOnDb !== false);
    } catch (err: any) {
      if (isConceptIdMissingError(err)) {
        console.warn('[shiftCashBridge] shift_cash.concept_id column missing on DB, re-querying with metadata match');
        hasConceptIdColumnOnDb = false;
        return await executeQuery(false);
      }
      throw err;
    }
  } catch (err) {
    console.error('[shiftCashBridge] Exception fetching active shift:', err);
    throw err;
  }
}

/**
 * Determines whether an active shift is overdue from a previous calendar day or past branch closing hours.
 */
export function isShiftOverdue(shift: ShiftCashRecord | null | undefined, currentTime: Date = new Date()): boolean {
  if (!shift || shift.status !== 'open') return false;

  // Extract YYYY-MM-DD from shift.date
  const shiftDateRaw = shift.date || '';
  const shiftDateStr = shiftDateRaw.includes('T')
    ? shiftDateRaw.split('T')[0]
    : shiftDateRaw.includes(' ')
    ? shiftDateRaw.split(' ')[0]
    : shiftDateRaw;

  // Local date today in YYYY-MM-DD
  const year = currentTime.getFullYear();
  const month = String(currentTime.getMonth() + 1).padStart(2, '0');
  const day = String(currentTime.getDate()).padStart(2, '0');
  const todayStr = businessDay(currentTime);

  // 1. Shift calendar date is strictly in the past (e.g. yesterday or earlier)
  if (shiftDateStr && shiftDateStr < todayStr) {
    return true;
  }

  // 2. Check elapsed hours from shift creation / opened_at
  const shiftStartTime = new Date((shift as any).opened_at || shift.created_at || currentTime);
  const elapsedMs = currentTime.getTime() - shiftStartTime.getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  // If shift has been open for more than 15 hours
  if (elapsedHours >= 15) {
    return true;
  }

  // 3. If PM shift and now it is morning operating hours (>= 5:00 AM) and at least 8h have passed
  const currentHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Beirut', hour: '2-digit', hourCycle: 'h23' }).format(currentTime));
  if (shift.shift === 'AM' && currentHour >= 16) return true;
  const isPmShift = String(shift.shift || '').toUpperCase() === 'PM';
  if (isPmShift && currentHour >= 5 && currentHour < 15 && elapsedHours >= 8) {
    return true;
  }

  return false;
}

export interface HoldShiftParams {
  shiftId: string;
  heldBy: string;
  notes?: string;
  cashSnapshotUsd?: number;
  cashSnapshotLbp?: number;
}

/**
 * Places an unclosed shift on hold for Manager review and audit.
 * Frees the terminal/drawer so the morning cashier can open a fresh shift.
 */
export async function holdShiftForManagerAudit(
  params: HoldShiftParams
): Promise<{ success: boolean; shift?: ShiftCashRecord; error?: string }> {
  try {
    const { data: previous, error: previousError } = await supabase.from('shift_cash').select('*').eq('id', params.shiftId).eq('restaurant_id', getGlobalRestaurantId()).single();
    if (previousError || !previous) throw new Error(previousError?.message || 'Previous shift not found.');
    if (!canHoldPreviousPm(previous)) return { success: false, error: 'Only a previous-day PM shift can be held during AM opening. AM shifts must be closed.' };
    const handover = await loadShiftHandover(previous.branch_id, previous.restaurant_id);
    if (handover.blocked) return { success: false, error: handoverMessage(handover) };
    const nowIso = new Date().toISOString();
    const noteText = params.notes
      ? `HELD FOR MANAGER AUDIT: ${params.notes.trim()}`
      : `HELD FOR MANAGER AUDIT by ${params.heldBy}`;

    const updatePayload: any = {
      status: 'on_hold',
      closed_by: params.heldBy,
      closing_notes: noteText,
      notes: noteText,
      finalized_at: nowIso
    };

    if (params.cashSnapshotUsd !== undefined) updatePayload.actual_usd = params.cashSnapshotUsd;
    if (params.cashSnapshotLbp !== undefined) updatePayload.actual_lbp = params.cashSnapshotLbp;

    const { data, error } = await supabase
      .from('shift_cash')
      .update(updatePayload)
      .eq('id', params.shiftId).eq('restaurant_id', previous.restaurant_id).eq('status', 'open')
      .select();

    if (error) {
      console.error('[shiftCashBridge] Error placing shift on hold:', error);
      return { success: false, error: error.message };
    }

    if (!data?.length) return { success: false, error: 'Shift changed. Reload before holding it.' };
    return {
      success: true,
      shift: data[0] as ShiftCashRecord
    };
  } catch (err: any) {
    console.error('[shiftCashBridge] Exception holding shift:', err);
    return { success: false, error: err?.message || 'Failed to hold shift' };
  }
}

/**
 * Retrieves all shifts currently flagged as 'on_hold' requiring manager review.
 */
export async function getHeldShifts(
  branchId?: string,
  restaurantId?: string
): Promise<ShiftCashRecord[]> {
  try {
    const targetRestaurantId = restaurantId || getGlobalRestaurantId();
    let query = supabase
      .from('shift_cash')
      .select('*')
      .eq('status', 'on_hold');

    if (targetRestaurantId) {
      query = query.eq('restaurant_id', targetRestaurantId);
    }

    if (branchId && branchId !== 'All' && branchId !== '*') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId);
      let branchQuery = supabase.from('shift_cash').select('*').eq('status', 'on_hold');
      if (targetRestaurantId) branchQuery = branchQuery.eq('restaurant_id', targetRestaurantId);
      branchQuery = isUuid ? branchQuery.eq('branch_id', branchId) : branchQuery.ilike('branch', `%${branchId}%`);

      const { data: branchData, error: branchErr } = await branchQuery.order('created_at', { ascending: false });
      if (!branchErr && branchData && branchData.length > 0) {
        return branchData as ShiftCashRecord[];
      }
    }

    // Return all held shifts for this restaurant so managers never miss an unclosed drawer
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      console.error('[shiftCashBridge] Error fetching held shifts:', error);
      return [];
    }
    return (data || []) as ShiftCashRecord[];
  } catch (err) {
    console.error('[shiftCashBridge] Exception fetching held shifts:', err);
    return [];
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
 * If an active open shift already exists on this physical drawer, gracefully adopts it.
 */
export interface ShiftEligibilityResult {
  allowedShift: 'AM' | 'PM';
  isAmEnabled: boolean;
  isPmEnabled: boolean;
  reason: string;
  prefillUsd: number | null;
  prefillLbp: number | null;
  prefillSource: 'AM' | 'PM' | null;
  todayAmShift?: ShiftCashRecord | null;
  lastPmShift?: ShiftCashRecord | null;
}

/**
 * Deterministically resolves which shift (AM or PM) is allowed to open, and pre-fills the opening cash float:
 * - If today's AM shift has occurred (open, closed, or on_hold): AM is disabled, PM is enabled. Opening float pre-fills from AM closing cash.
 * - If today's AM shift has not occurred: AM is enabled, PM is disabled. Opening float pre-fills from last closed/held PM shift.
 */
export async function resolveShiftEligibility(
  branchId?: string | number,
  terminalId?: string | number,
  restaurantId = getGlobalRestaurantId(),
  conceptId?: string
): Promise<ShiftEligibilityResult> {
  const targetRestaurantId = restaurantId || '79256f11-a9f8-4fec-901d-69baf929762d';
  const cleanBranch = branchId != null ? String(branchId).trim() : '';
  const isBranchSpecified = cleanBranch.length > 0 && cleanBranch.toLowerCase() !== 'all' && cleanBranch !== '*';
  const isUuid = isBranchSpecified ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanBranch) : false;
  const canonicalDrawer = terminalId ? await resolvePhysicalDrawerId(cleanBranch || '', String(terminalId)) : 'DRAWER-01';
  const terminals = await getDrawerTerminalAliases(cleanBranch, canonicalDrawer);
  const todayStr = businessDay();

  // If a delivery concept (OVRLOAD, WICKD, etc) is selected, completely isolate from restaurant AM/PM sequencing
  const isDeliveryConcept = conceptId && conceptId !== '00000000-0000-0000-0000-000000000001';
  if (isDeliveryConcept) {
    const active = await getActiveShift(cleanBranch, canonicalDrawer, targetRestaurantId, conceptId);
    if (active) {
      return {
        allowedShift: (active.shift as any) || 'ALL DAY',
        isAmEnabled: true,
        isPmEnabled: true,
        reason: 'Concept cash session is active.',
        prefillUsd: active.opening_float_usd ?? active.opening_usd ?? 0,
        prefillLbp: active.opening_float_lbp ?? active.opening_lbp ?? 0,
        prefillSource: null,
        todayAmShift: null,
        lastPmShift: null
      };
    }

    // Lookup last closed shift for THIS concept to prefill opening float
    let lastClosed: any[] | null = null;
    try {
      let lastClosedQuery = supabase
        .from('shift_cash')
        .select('*')
        .eq('restaurant_id', targetRestaurantId)
        .eq('status', 'closed');

      if (hasConceptIdColumnOnDb !== false && conceptId) {
        lastClosedQuery = lastClosedQuery.eq('concept_id', conceptId);
      }

      if (isBranchSpecified) {
        lastClosedQuery = isUuid ? lastClosedQuery.eq('branch_id', cleanBranch) : lastClosedQuery.ilike('branch', `%${cleanBranch}%`);
      }

      const res = await lastClosedQuery.order('closed_at', { ascending: false }).limit(5);
      if (res.error && isConceptIdMissingError(res.error)) {
        hasConceptIdColumnOnDb = false;
        let retryQuery = supabase
          .from('shift_cash')
          .select('*')
          .eq('restaurant_id', targetRestaurantId)
          .eq('status', 'closed');
        if (isBranchSpecified) {
          retryQuery = isUuid ? retryQuery.eq('branch_id', cleanBranch) : retryQuery.ilike('branch', `%${cleanBranch}%`);
        }
        const retryRes = await retryQuery.order('closed_at', { ascending: false }).limit(5);
        lastClosed = retryRes.data;
      } else {
        lastClosed = res.data;
      }
    } catch (e) {
      console.warn('[shiftCashBridge] Error loading last closed concept shift:', e);
    }

    const prev = (lastClosed || []).find((s: any) => matchShiftConcept(s, conceptId));

    return {
      allowedShift: 'ALL DAY',
      isAmEnabled: true,
      isPmEnabled: true,
      reason: prev ? "Enter opening float for concept session." : "Enter your opening cash float.",
      prefillUsd: prev ? (prev.actual_usd ?? prev.closing_cash_usd ?? 50) : 50,
      prefillLbp: prev ? (prev.actual_lbp ?? prev.closing_cash_lbp ?? 0) : 0,
      prefillSource: null,
      todayAmShift: null,
      lastPmShift: null
    };
  }

  // 1. Check for any AM shift today on this physical drawer (scoped strictly to NÉO)
  let todayAmQuery = supabase
    .from('shift_cash')
    .select('*')
    .eq('restaurant_id', targetRestaurantId)
    .eq('date', todayStr)
    .eq('shift', 'AM')
    .in('terminal_id', terminals);

  if (hasConceptIdColumnOnDb !== false) {
    todayAmQuery = todayAmQuery.or('concept_id.eq.00000000-0000-0000-0000-000000000001,concept_id.is.null');
  }

  if (isBranchSpecified) {
    todayAmQuery = isUuid ? todayAmQuery.eq('branch_id', cleanBranch) : todayAmQuery.ilike('branch', `%${cleanBranch}%`);
  }

  let { data: todayAmData, error: todayAmError } = await todayAmQuery
    .order('created_at', { ascending: false })
    .limit(5);

  if (todayAmError && isConceptIdMissingError(todayAmError)) {
    hasConceptIdColumnOnDb = false;
    let retryAm = supabase
      .from('shift_cash')
      .select('*')
      .eq('restaurant_id', targetRestaurantId)
      .eq('date', todayStr)
      .eq('shift', 'AM')
      .in('terminal_id', terminals);
    if (isBranchSpecified) {
      retryAm = isUuid ? retryAm.eq('branch_id', cleanBranch) : retryAm.ilike('branch', `%${cleanBranch}%`);
    }
    const amRetry = await retryAm.order('created_at', { ascending: false }).limit(5);
    todayAmData = amRetry.data;
  }

  const todayAm = (todayAmData || []).find((s: any) => matchShiftConcept(s, conceptId)) as ShiftCashRecord || null;

  if (todayAm) {
    // Today's AM shift has occurred.
    // Rule: AM is disabled, PM is enabled. Opening float pre-fills from AM closing cash.
    const prefillUsd = todayAm.actual_usd ?? null;
    const prefillLbp = todayAm.actual_lbp ?? null;
    const isAmClosed = todayAm.status === 'closed';

    return {
      allowedShift: 'PM',
      isAmEnabled: false,
      isPmEnabled: true,
      reason: isAmClosed
        ? "Today's AM shift is closed. Opening evening session (PM) with float from AM closing."
        : "Today's AM shift has already been opened. The next session is PM.",
      prefillUsd,
      prefillLbp,
      prefillSource: (prefillUsd != null || prefillLbp != null) ? 'AM' : null,
      todayAmShift: todayAm,
    };
  }

  // 2. Today's AM shift has NOT occurred.
  // Rule: AM is enabled, PM is disabled. Opening float pre-fills from the last closed/held PM shift (scoped strictly to NÉO).
  let lastPmQuery = supabase
    .from('shift_cash')
    .select('*')
    .eq('restaurant_id', targetRestaurantId)
    .eq('shift', 'PM')
    .in('status', ['closed', 'on_hold'])
    .in('terminal_id', terminals);

  if (hasConceptIdColumnOnDb !== false) {
    lastPmQuery = lastPmQuery.or('concept_id.eq.00000000-0000-0000-0000-000000000001,concept_id.is.null');
  }

  if (isBranchSpecified) {
    lastPmQuery = isUuid ? lastPmQuery.eq('branch_id', cleanBranch) : lastPmQuery.ilike('branch', `%${cleanBranch}%`);
  }

  let { data: lastPmData, error: lastPmError } = await lastPmQuery
    .order('created_at', { ascending: false })
    .limit(5);

  if (lastPmError && isConceptIdMissingError(lastPmError)) {
    hasConceptIdColumnOnDb = false;
    let retryPm = supabase
      .from('shift_cash')
      .select('*')
      .eq('restaurant_id', targetRestaurantId)
      .eq('shift', 'PM')
      .in('status', ['closed', 'on_hold'])
      .in('terminal_id', terminals);
    if (isBranchSpecified) {
      retryPm = isUuid ? retryPm.eq('branch_id', cleanBranch) : retryPm.ilike('branch', `%${cleanBranch}%`);
    }
    const pmRetry = await retryPm.order('created_at', { ascending: false }).limit(5);
    lastPmData = pmRetry.data;
  }

  const lastPm = (lastPmData || []).find((s: any) => matchShiftConcept(s, conceptId)) as ShiftCashRecord || null;
  const prefillUsd = lastPm ? (lastPm.actual_usd ?? null) : null;
  const prefillLbp = lastPm ? (lastPm.actual_lbp ?? null) : null;

  return {
    allowedShift: 'AM',
    isAmEnabled: true,
    isPmEnabled: false,
    reason: lastPm
      ? "Opening morning session (AM). Float transferred from last PM closing cash."
      : "Opening morning session (AM). Enter your opening drawer cash float.",
    prefillUsd,
    prefillLbp,
    prefillSource: (prefillUsd != null || prefillLbp != null) ? 'PM' : null,
    todayAmShift: null,
    lastPmShift: lastPm,
  };
}

export async function getClosedAmShift(branchId: string, terminalId: string, restaurantId = getGlobalRestaurantId()) {
  if (!branchId || !terminalId || !restaurantId) throw new Error('Select a branch and cash drawer before opening a shift.');
  const terminals = await getDrawerTerminalAliases(branchId, terminalId);
  let query = supabase.from('shift_cash').select('id,actual_usd,actual_lbp')
    .eq('restaurant_id', restaurantId).eq('date', businessDay()).eq('shift', 'AM').eq('status', 'closed')
    .in('terminal_id', terminals);
  query = /^[0-9a-f-]{36}$/i.test(branchId) ? query.eq('branch_id', branchId) : query.eq('branch', branchId);
  const { data, error } = await query.order('closed_at', { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

export async function openShift(params: OpenShiftParams): Promise<{ success: boolean; shift?: ShiftCashRecord; error?: string }> {
  try {
    if (!params.terminalId) {
      return { success: false, error: 'Cannot open shift without explicit terminal ID.' };
    }
    const deviceTerminalId = params.terminalId.trim();
    const canonicalDrawerId = await resolvePhysicalDrawerId(params.branchId || params.branchName, deviceTerminalId);
    
    // Resolve restaurant ID dynamically: from params, from global client, or fallback
    const targetRestaurantId = params.restaurantId || getGlobalRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
    const isDeliveryConcept = Boolean(params.conceptId && params.conceptId !== '00000000-0000-0000-0000-000000000001');

    const todayStr = businessDay();

    // Check for existing open shift for THIS concept on this canonical physical drawer
    const existing = await getActiveShift(params.branchId || params.branchName, canonicalDrawerId, targetRestaurantId, params.conceptId);
    if (existing) {
      if (isDeliveryConcept) {
        console.log(`[shiftCashBridge] Concept ${params.conceptId} already has active open shift (${existing.id}). Adopting existing shift.`);
        return {
          success: true,
          shift: existing
        };
      }
      if (isShiftOverdue(existing) || (params.shift && existing.shift !== params.shift)) {
        return {
          success: false,
          error: `The ${existing.shift} shift from ${existing.date} must be resolved before opening ${params.shift || 'new shift'}. AM shifts must be closed; only yesterday’s PM may be held during AM opening.`
        };
      }
      console.log(`[shiftCashBridge] Drawer ${canonicalDrawerId} already has active open shift (${existing.id}). Adopting existing shift.`);
      return {
        success: true,
        shift: existing
      };
    }

    if (isDeliveryConcept) {
      // DELIVERY CONCEPT (OVRLOAD / WICKD): Completely independent cash session
      const defaultRate = params.rate || 90000;
      const conceptCode = params.conceptId === '00000000-0000-0000-0000-000000000002' ? 'OVRLOAD' : 'WICKD';
      const conceptTag = `[CONCEPT:${params.conceptId}]`;

      const newRecord: any = {
        date: todayStr,
        branch: params.branchName,
        branch_id: params.branchId || null,
        terminal_id: canonicalDrawerId,
        shift: params.shift || 'ALL DAY',
        shift_type: `CONCEPT:${conceptCode}`,
        notes: `${conceptTag} Concept Cash Shift for ${conceptCode}`,
        rate: defaultRate,
        opening_usd: params.openingUsd || 0,
        opening_float_usd: params.openingUsd || 0,
        opening_lbp: params.openingLbp || 0,
        opening_float_lbp: params.openingLbp || 0,
        user_name: params.userName || 'Cashier',
        restaurant_id: targetRestaurantId,
        status: 'open',
        opened_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      if (hasConceptIdColumnOnDb !== false && params.conceptId) {
        newRecord.concept_id = params.conceptId;
      }

      let { data, error } = await supabase
        .from('shift_cash')
        .insert([newRecord])
        .select();

      if (error && isConceptIdMissingError(error)) {
        console.warn('[shiftCashBridge] shift_cash.concept_id column missing on DB, falling back to concept tag');
        hasConceptIdColumnOnDb = false;
        delete newRecord.concept_id;
        const retry = await supabase
          .from('shift_cash')
          .insert([newRecord])
          .select();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('[shiftCashBridge] Error opening delivery concept shift:', error);
        return { success: false, error: error.message };
      }

      const openedRecord = data && data[0] ? (data[0] as ShiftCashRecord) : undefined;
      if (openedRecord) {
        openedRecord.concept_id = params.conceptId;
      }

      return { success: true, shift: openedRecord };
    }

    // RESTAURANT CONCEPT (NÉO): Restaurant shift sequencing
    const eligibility = await resolveShiftEligibility(
      params.branchId || params.branchName,
      canonicalDrawerId,
      targetRestaurantId,
      params.conceptId
    );

    const defaultShift = params.shift || eligibility.allowedShift;
    if (params.shift && params.shift !== eligibility.allowedShift) {
      return {
        success: false,
        error: `Cannot open ${params.shift} shift. ${eligibility.reason}`
      };
    }

    const terminals = await getDrawerTerminalAliases(params.branchId || params.branchName, canonicalDrawerId);
    let heldAmQuery = supabase.from('shift_cash').select('id').eq('restaurant_id', targetRestaurantId)
      .eq('branch_id', params.branchId).in('terminal_id', terminals).eq('shift', 'AM').eq('status', 'on_hold');
    if (hasConceptIdColumnOnDb !== false) {
      heldAmQuery = heldAmQuery.or('concept_id.eq.00000000-0000-0000-0000-000000000001,concept_id.is.null');
    }
    let { data: heldAm, error: heldError } = await heldAmQuery.limit(1);
    if (heldError && isConceptIdMissingError(heldError)) {
      hasConceptIdColumnOnDb = false;
      const retryHeld = await supabase.from('shift_cash').select('id').eq('restaurant_id', targetRestaurantId)
        .eq('branch_id', params.branchId).in('terminal_id', terminals).eq('shift', 'AM').eq('status', 'on_hold').limit(1);
      heldAm = retryHeld.data;
      heldError = retryHeld.error;
    }
    if (heldError) throw new Error(heldError.message);
    if (heldAm?.length) return { success: false, error: 'The previous AM shift must be closed. AM shifts cannot be held.' };

    if (defaultShift === 'PM') {
      let latestQuery = supabase.from('shift_cash').select('status').eq('restaurant_id', targetRestaurantId)
        .eq('branch_id', params.branchId).in('terminal_id', terminals);
      if (hasConceptIdColumnOnDb !== false) {
        latestQuery = latestQuery.or('concept_id.eq.00000000-0000-0000-0000-000000000001,concept_id.is.null');
      }
      let { data: latest, error: latestError } = await latestQuery.order('created_at', { ascending: false }).limit(1);
      if (latestError && isConceptIdMissingError(latestError)) {
        hasConceptIdColumnOnDb = false;
        const retryLatest = await supabase.from('shift_cash').select('status').eq('restaurant_id', targetRestaurantId)
          .eq('branch_id', params.branchId).in('terminal_id', terminals).order('created_at', { ascending: false }).limit(1);
        latest = retryLatest.data;
        latestError = retryLatest.error;
      }
      if (latestError) throw new Error(latestError.message);
      if (latest?.length && latest[0].status !== 'closed') return { success: false, error: 'The previous shift must be closed before PM can open.' };
    }

    // Morning (AM) shift cannot open if any open tables or unscheduled open orders remain.
    // Afternoon (PM) shift can open and accept open tables or orders carried over from AM.
    if (defaultShift === 'AM') {
      const handover = await loadShiftHandover(params.branchId || params.branchIdentifier, targetRestaurantId, undefined, params.conceptId);
      if (handover.blocked) return { success: false, error: handoverMessage(handover) };
    }
    if (defaultShift === 'AM' && eligibility.allowedShift !== 'AM') {
      return { success: false, error: "Today's AM shift is already closed. Open the PM shift instead." };
    }

    const defaultRate = params.rate || 90000;
    const newRecord: any = {
      date: todayStr,
      branch: params.branchName,
      branch_id: params.branchId || null,
      terminal_id: canonicalDrawerId,
      shift: defaultShift,
      rate: defaultRate,
      opening_usd: params.openingUsd || 0,
      opening_float_usd: params.openingUsd || 0,
      opening_lbp: params.openingLbp || 0,
      opening_float_lbp: params.openingLbp || 0,
      user_name: params.userName || 'Cashier',
      restaurant_id: targetRestaurantId,
      status: 'open',
      opened_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    if (hasConceptIdColumnOnDb !== false && params.conceptId) {
      newRecord.concept_id = params.conceptId || '00000000-0000-0000-0000-000000000001';
    }

    let { data, error } = await supabase
      .from('shift_cash')
      .insert([newRecord])
      .select();

    if (error && isConceptIdMissingError(error)) {
      hasConceptIdColumnOnDb = false;
      delete newRecord.concept_id;
      const retry = await supabase
        .from('shift_cash')
        .insert([newRecord])
        .select();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[shiftCashBridge] Error opening shift:', error);
      return { success: false, error: error.message };
    }

    const openedRecord = data && data[0] ? (data[0] as ShiftCashRecord) : undefined;
    if (openedRecord) {
      openedRecord.concept_id = params.conceptId || '00000000-0000-0000-0000-000000000001';
    }

    return { success: true, shift: openedRecord };
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

    // Recheck at the shared write boundary using the saved shift, not the UI toggle.
    const { data: savedShift, error: shiftError } = await supabase.from('shift_cash').select('*')
      .eq('id', params.shiftId).eq('restaurant_id', getGlobalRestaurantId()).single();
    if (shiftError || !savedShift) return { success: false, error: shiftError?.message || 'Shift not found.' };
    if (savedShift.status === 'closed') return savedShift.close_operation_id === opId
      ? { success: true, shift: savedShift as ShiftCashRecord }
      : { success: false, error: 'Shift was already closed.' };
    
    const isDeliveryConcept = Boolean(
      (savedShift.concept_id && savedShift.concept_id !== '00000000-0000-0000-0000-000000000001') ||
      String(savedShift.shift_type || '').includes('CONCEPT:') ||
      String(savedShift.notes || '').includes('[CONCEPT:00000000-0000-0000-0000-000000000002]') ||
      String(savedShift.notes || '').includes('[CONCEPT:00000000-0000-0000-0000-000000000003]')
    );
    const resolvedConceptId = savedShift.concept_id || (
      String(savedShift.notes || '').includes('00000000-0000-0000-0000-000000000002') ? '00000000-0000-0000-0000-000000000002' :
      String(savedShift.notes || '').includes('00000000-0000-0000-0000-000000000003') ? '00000000-0000-0000-0000-000000000003' :
      '00000000-0000-0000-0000-000000000001'
    );
    const isAmShift = String(savedShift.shift || '').toUpperCase() === 'AM';
    // At night (PM close), all open tables and unscheduled orders must be closed (only scheduled orders may remain open).
    // Morning (AM) shift may close with open tables/orders so the afternoon (PM) shift can continue them.
    if (!isDeliveryConcept && !isAmShift) {
      const period = await loadShiftReportingPeriod(savedShift, await getDrawerTerminalAliases(savedShift.branch_id || params.branchId, savedShift.terminal_id));
      const handover = await loadShiftHandover(savedShift.branch_id || params.branchId, savedShift.restaurant_id, period.endTime, resolvedConceptId);
      if (handover.blocked) return { success: false, error: handoverMessage(handover) };
    }

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
    if (params.cashInUsd !== undefined) updatePayload.cash_in_usd = params.cashInUsd;
    if (params.cashInLbp !== undefined) updatePayload.cash_in_lbp = params.cashInLbp;
    if (params.paymentsUsd !== undefined) updatePayload.payments_usd = params.paymentsUsd;
    if (params.paymentsLbp !== undefined) updatePayload.payments_lbp = params.paymentsLbp;
    if (params.cashOutUsd !== undefined) updatePayload.cash_out_usd = params.cashOutUsd;
    if (params.cashOutLbp !== undefined) updatePayload.cash_out_lbp = params.cashOutLbp;
    if (params.creditCardUsd !== undefined) updatePayload.credit_card_usd = params.creditCardUsd;
    if (params.creditCardLbp !== undefined) updatePayload.credit_card_lbp = params.creditCardLbp;
    if (params.onCreditLbp !== undefined) updatePayload.on_credit_lbp = params.onCreditLbp;

    // Atomic conditional update: update ONLY IF status is 'open' or 'on_hold'
    const { data, error } = await supabase
      .from('shift_cash')
      .update(updatePayload)
      .eq('id', params.shiftId)
      .in('status', ['open', 'on_hold'])
      .select();

    if (error) {
      console.error('[shiftCashBridge] Error closing shift:', error);
      return { success: false, error: error.message };
    }

    // Save shift cash wallets if provided
    if (params.wallets && params.wallets.length > 0) {
      const walletPayload = params.wallets.map(w => ({
        shift_cash_id: params.shiftId,
        wallet_id: w.wallet_id,
        amount_usd: w.amount_usd,
        amount_lbp: w.amount_lbp
      }));
      await saveShiftCashWallets(walletPayload);
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

/**
 * Fetch daily payments for branch, date, and shift
 */
export async function getDailyPayments(branch: string, date: string, shift: string = 'All', conceptId?: string) {
  try {
    let query = supabase
      .from('daily_payments')
      .select('*')
      .eq('date', date);

    if (branch && branch !== 'All' && branch !== '*') {
      query = query.eq('branch', branch);
    }
    if (shift && shift !== 'All') {
      query = query.eq('shift', shift);
    }
    if (conceptId) {
      if (conceptId === '00000000-0000-0000-0000-000000000001') {
        query = query.or(`concept_id.eq.${conceptId},concept_id.is.null`);
      } else {
        query = query.eq('concept_id', conceptId);
      }
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message, data: [] };
  }
}

/**
 * Add a new daily payment record
 */
export async function addDailyPayment(payment: {
  date: string;
  branch: string;
  shift: string;
  supplier: string;
  amount_usd: number;
  amount_lbp: number;
  type: string;
  has_invoice: boolean;
  user_name: string;
  status: string;
  restaurant_id?: string;
}) {
  try {
    const { data, error } = await supabase
      .from('daily_payments')
      .insert([payment])
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Delete a daily payment record
 */
export async function deleteDailyPayment(id: string) {
  try {
    const { data: payment } = await supabase
      .from('daily_payments')
      .select('id, shift_id, date, branch')
      .eq('id', id)
      .maybeSingle();

    if (payment?.shift_id) {
      const { data: shift } = await supabase
        .from('shift_cash')
        .select('status')
        .eq('id', payment.shift_id)
        .maybeSingle();

      if (shift && shift.status === 'closed') {
        return { success: false, error: 'Shift is closed. Payments from a closed shift cannot be deleted.' };
      }
    }

    const { error } = await supabase
      .from('daily_payments')
      .delete()
      .eq('id', id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * Fetch active E-Wallets configured in e_wallets table
 */
/**
 * Fetch branch users for cash in / cash out recipient selection
 */
export async function getBranchUsers(restaurantId?: string) {
  try {
    const rid = restaurantId || getGlobalRestaurantId();
    let query = supabase.from('users').select('id, name, display_name, role, branch, is_active').eq('is_active', true).order('name', { ascending: true });
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }
    const { data, error } = await query;
    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message, data: [] };
  }
}

/**
 * Verify a selected user's PIN for Cash In authorization
 */
export async function verifyUserPin(userId: string, pin: string) {
  try {
    const cleanPin = pin.trim();
    if (!cleanPin) return { success: false, error: 'Please enter a PIN code.' };
    const { data, error } = await supabase
      .from('users')
      .select('id, name, display_name')
      .eq('id', userId)
      .or(`pin.eq.${cleanPin},pin_code.eq.${cleanPin}`)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Incorrect PIN code.' };
    return { success: true, user: data };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function getActiveWallets(restaurantId?: string) {
  try {
    const rid = restaurantId || getGlobalRestaurantId();
    let query = supabase.from('e_wallets').select('*').eq('active', true);
    if (rid) {
      query = query.eq('restaurant_id', rid);
    }
    const { data, error } = await query.order('name', { ascending: true });
    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message, data: [] };
  }
}

/**
 * Fetch shift cash closed record by date and shift (for AM reference)
 */
export async function getShiftCashByDateAndShift(branch: string, date: string, shift: string) {
  try {
    const cleanDate = date ? (date.includes('T') ? date.split('T')[0] : date.split(' ')[0]) : '';
    
    // 1. Exact or prefix date query with branch
    let query = supabase
      .from('shift_cash')
      .select('*')
      .eq('shift', shift);

    if (cleanDate) {
      query = query.ilike('date', `${cleanDate}%`);
    }

    if (branch && branch !== 'All' && branch !== '*') {
      const coreBranch = branch.split('(')[0].trim();
      query = query.ilike('branch', `%${coreBranch}%`);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query.limit(1);
    if (!error && data && data.length > 0) {
      return { success: true, data: data[0] };
    }

    // 2. Fallback: If not found for branch, check any branch on that date
    if (cleanDate) {
      const anyBranch = await supabase
        .from('shift_cash')
        .select('*')
        .eq('shift', shift)
        .ilike('date', `${cleanDate}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!anyBranch.error && anyBranch.data && anyBranch.data.length > 0) {
        return { success: true, data: anyBranch.data[0], isFallback: true };
      }
    }

    // 3. Fallback: Most recent closed AM shift in database
    const latest = await supabase
      .from('shift_cash')
      .select('*')
      .eq('shift', shift)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!latest.error && latest.data && latest.data.length > 0) {
      return { success: true, data: latest.data[0], isFallback: true };
    }

    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err?.message, data: null };
  }
}

/**
 * Fetch recent AM shifts for dropdown selector in PM shift
 */
export async function getRecentAmShifts() {
  try {
    const query = supabase
      .from('shift_cash')
      .select('id, date, shift, branch, sales_lbp, on_credit_lbp, actual_usd, actual_lbp, credit_card_usd, user_name, closed_by, created_at')
      .eq('shift', 'AM')
      .order('created_at', { ascending: false })
      .limit(10);
    const { data, error } = await query;
    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message, data: [] };
  }
}

/**
 * Fetch latest shift cash record before a date (to seed default opening float)
 */
export async function getLatestShiftCashBeforeDate(branch: string, date: string) {
  try {
    const cleanDate = date ? (date.includes('T') ? date.split('T')[0] : date.split(' ')[0]) : '';
    let query = supabase
      .from('shift_cash')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (cleanDate) {
      query = query.lt('date', cleanDate);
    }

    if (branch && branch !== 'All' && branch !== '*') {
      const coreBranch = branch.split('(')[0].trim();
      query = query.ilike('branch', `%${coreBranch}%`);
    }
    const { data, error } = await query.limit(1);
    if (error) return { success: false, error: error.message, data: null };
    return { success: true, data: data && data.length > 0 ? data[0] : null };
  } catch (err: any) {
    return { success: false, error: err?.message, data: null };
  }
}

/**
 * Fetch shift cash wallets breakdown
 */
export async function getShiftCashWallets(shiftCashId: string) {
  try {
    const { data, error } = await supabase
      .from('shift_cash_wallets')
      .select('*, e_wallets(name)')
      .eq('shift_cash_id', shiftCashId);
    if (error) return { success: false, error: error.message, data: [] };
    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err?.message, data: [] };
  }
}

/**
 * Save or upsert shift cash wallets
 */
export async function saveShiftCashWallets(wallets: Array<{ shift_cash_id: string; wallet_id: string; amount_usd: number; amount_lbp: number }>) {
  try {
    if (!wallets || wallets.length === 0) return { success: true };
    const { error } = await supabase
      .from('shift_cash_wallets')
      .upsert(wallets);
    if (error) {
      console.warn('[shiftCashBridge] Error upserting wallets:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}
