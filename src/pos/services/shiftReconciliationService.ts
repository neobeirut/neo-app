import { api } from '../../api/client';
import { supabase } from '../../api/supabase';
import type { ShiftCashRecord } from './shiftCashBridge';

const COMMERCE_API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OVRLOAD_API_URL)
    ? import.meta.env.VITE_OVRLOAD_API_URL
    : 'https://ovrload-backend-production.up.railway.app'
).replace(/\/+$/, '');

const PRINT_SERVER_URL = 'http://192.168.18.195:9191';

export interface ShiftTenderBreakdown {
  cash_usd: number;
  cash_lbp: number;
  cash_lbp_usd_equiv: number;
  whish_usd: number;
  card_usd: number;
  toters_usd: number;
  toters_orders: number;
  noknok_usd: number;
  noknok_orders: number;
  other_usd: number;
}

export interface ShiftChannelBreakdown {
  pos: number;
  whatsapp: number;
  toters: number;
  noknok: number;
  app: number;
  dine_in: number;
  takeaway: number;
  delivery: number;
}

export interface ShiftReconciliationSummary {
  branchId?: number;
  locationKey?: string;
  startTime: string;
  endTime: string;
  ordersCount: number;
  grossSales: number;
  totalDiscounts: number;
  discountedOrdersCount: number;
  totalRefunds: number;
  netSales: number;
  avgTicket: number;
  totalCovers: number;
  voidCount: number;
  voidTotal: number;
  tenders: ShiftTenderBreakdown;
  refunds?: {
    cash_usd: number;
    cash_lbp: number;
    cash_lbp_usd_equiv: number;
    whish_usd: number;
    card_usd: number;
    total_usd: number;
  };
  movements?: {
    cashInUsd: number;
    cashInLbp: number;
    cashDropsUsd: number;
    cashDropsLbp: number;
    payoutsUsd: number;
    payoutsLbp: number;
  };
  channels: ShiftChannelBreakdown;
  expectedCashUsd: number;
  expectedCashLbp: number;
}

export interface VarianceCheckResult {
  varianceUsd: number;
  varianceLbp: number;
  requiresManagerApproval: boolean;
  allowedUsd: number;
  allowedLbp: number;
  isUsdExceeded: boolean;
  isLbpExceeded: boolean;
}

export interface BranchReconSettings {
  allowed_usd_variance: number;
  allowed_lbp_variance: number;
  blind_cash_close_enabled: boolean;
  denomination_helper_enabled: boolean;
}

/**
 * Loads reconciliation settings for a branch from FLOW branches table.
 */
export async function getBranchReconSettings(branchIdentifier?: string): Promise<BranchReconSettings> {
  const defaults: BranchReconSettings = {
    allowed_usd_variance: 2.0,
    allowed_lbp_variance: 100000,
    blind_cash_close_enabled: false,
    denomination_helper_enabled: true
  };

  if (!branchIdentifier) return defaults;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchIdentifier);
    let query = supabase.from('branches').select('allowed_usd_variance, allowed_lbp_variance, blind_cash_close_enabled, denomination_helper_enabled');
    if (isUuid) {
      query = query.eq('id', branchIdentifier);
    } else {
      query = query.ilike('name', branchIdentifier);
    }
    const { data } = await query.limit(1);
    if (data && data.length > 0) {
      return {
        allowed_usd_variance: data[0].allowed_usd_variance != null ? Number(data[0].allowed_usd_variance) : 2.0,
        allowed_lbp_variance: data[0].allowed_lbp_variance != null ? Number(data[0].allowed_lbp_variance) : 100000,
        blind_cash_close_enabled: Boolean(data[0].blind_cash_close_enabled),
        denomination_helper_enabled: data[0].denomination_helper_enabled != null ? Boolean(data[0].denomination_helper_enabled) : true
      };
    }
  } catch (err) {
    console.warn('[shiftReconciliationService] Error fetching branch settings, using defaults:', err);
  }
  return defaults;
}

/**
 * Queries authoritative commerce transactions from OVRLOAD and builds
 * the full shift reconciliation summary including cash movements and refunds.
 */
export async function calculateShiftReconciliation(params: {
  locationKey: string;
  shiftId?: string;
  startTime: string;
  endTime?: string;
  terminalIds?: string[];
  terminalId?: string;
  openingUsd: number;
  openingLbp: number;
}): Promise<{ success: boolean; summary?: ShiftReconciliationSummary; error?: string }> {
  try {
    const end = params.endTime || new Date().toISOString();
    const url = new URL(`${COMMERCE_API_BASE}/api/pos/shifts/reconciliation`);
    url.searchParams.set('location_key', params.locationKey);
    url.searchParams.set('start_time', params.startTime);
    url.searchParams.set('end_time', end);

    const termList = params.terminalIds && params.terminalIds.length > 0
      ? params.terminalIds
      : (params.terminalId ? [params.terminalId] : []);
    if (termList.length > 0) {
      url.searchParams.set('terminal_ids', termList.join(','));
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Reconciliation service error: ${res.status} ${errText}` };
    }

    const data = await res.json();
    if (!data.success) {
      return { success: false, error: data.error || 'Failed to fetch reconciliation' };
    }

    // Query FLOW shift_cash_movements if shiftId is provided
    let cashInUsd = 0;
    let cashInLbp = 0;
    let cashDropsUsd = 0;
    let cashDropsLbp = 0;
    let payoutsUsd = 0;
    let payoutsLbp = 0;

    if (params.shiftId) {
      try {
        const { data: movements } = await supabase
          .from('shift_cash_movements')
          .select('*')
          .eq('shift_id', params.shiftId);

        if (movements) {
          for (const m of movements) {
            const amt = Number(m.amount || 0);
            if (m.currency === 'USD') {
              if (m.movement_type === 'cash_in') cashInUsd += amt;
              else if (m.movement_type === 'cash_drop') cashDropsUsd += amt;
              else if (m.movement_type === 'payout') payoutsUsd += amt;
            } else if (m.currency === 'LBP') {
              if (m.movement_type === 'cash_in') cashInLbp += amt;
              else if (m.movement_type === 'cash_drop') cashDropsLbp += amt;
              else if (m.movement_type === 'payout') payoutsLbp += amt;
            }
          }
        }
      } catch (movErr) {
        console.warn('[shiftReconciliationService] Error querying cash movements:', movErr);
      }
    }

    // Authoritative Physical Drawer Expected Cash formula:
    // Expected USD = Opening USD + Cash USD Sales + USD Cash In - Cash USD Refunds - USD Cash Drops - USD Payouts
    // Expected LBP = Opening LBP + Cash LBP Sales + LBP Cash In - Cash LBP Refunds - LBP Cash Drops - LBP Payouts
    const cashUsdSales = data.tenders?.cash_usd || 0;
    const cashLbpSales = data.tenders?.cash_lbp || 0;
    const cashUsdRefunds = data.refunds?.cash_usd || 0;
    const cashLbpRefunds = data.refunds?.cash_lbp || 0;

    const expectedUsd = (params.openingUsd || 0) + cashUsdSales + cashInUsd - cashUsdRefunds - cashDropsUsd - payoutsUsd;
    const expectedLbp = (params.openingLbp || 0) + cashLbpSales + cashInLbp - cashLbpRefunds - cashDropsLbp - payoutsLbp;

    const summary: ShiftReconciliationSummary = {
      locationKey: data.locationKey,
      startTime: params.startTime,
      endTime: end,
      ordersCount: data.ordersCount || 0,
      grossSales: data.grossSales || 0,
      totalDiscounts: data.totalDiscounts || 0,
      discountedOrdersCount: data.discountedOrdersCount || 0,
      totalRefunds: data.totalRefunds || 0,
      netSales: data.netSales || 0,
      avgTicket: data.avgTicket || 0,
      totalCovers: data.totalCovers || 0,
      voidCount: data.voidCount || 0,
      voidTotal: data.voidTotal || 0,
      tenders: data.tenders || {
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
      },
      refunds: data.refunds || {
        cash_usd: 0,
        cash_lbp: 0,
        cash_lbp_usd_equiv: 0,
        whish_usd: 0,
        card_usd: 0,
        total_usd: 0
      },
      movements: {
        cashInUsd,
        cashInLbp,
        cashDropsUsd,
        cashDropsLbp,
        payoutsUsd,
        payoutsLbp
      },
      channels: data.channels || {
        pos: 0,
        whatsapp: 0,
        toters: 0,
        noknok: 0,
        app: 0,
        dine_in: 0,
        takeaway: 0,
        delivery: 0
      },
      expectedCashUsd: parseFloat(expectedUsd.toFixed(2)),
      expectedCashLbp: Math.round(expectedLbp)
    };

    return { success: true, summary };
  } catch (err: any) {
    console.error('[shiftReconciliationService] Exception calculating shift reconciliation:', err);
    return { success: false, error: err?.message || 'Error calculating shift reconciliation' };
  }
}

/**
 * Checks if actual counts exceed configured branch variance thresholds.
 */
export function checkVarianceThresholds(
  actualUsd: number,
  actualLbp: number,
  expectedUsd: number,
  expectedLbp: number,
  settings: BranchReconSettings
): VarianceCheckResult {
  const varianceUsd = parseFloat((actualUsd - expectedUsd).toFixed(2));
  const varianceLbp = Math.round(actualLbp - expectedLbp);

  const allowedUsd = settings.allowed_usd_variance;
  const allowedLbp = settings.allowed_lbp_variance;

  const isUsdExceeded = Math.abs(varianceUsd) > allowedUsd;
  const isLbpExceeded = Math.abs(varianceLbp) > allowedLbp;
  const requiresManagerApproval = isUsdExceeded || isLbpExceeded;

  return {
    varianceUsd,
    varianceLbp,
    requiresManagerApproval,
    allowedUsd,
    allowedLbp,
    isUsdExceeded,
    isLbpExceeded
  };
}

/**
 * Verifies a Manager PIN code for variance override using permission check.
 */
export async function verifyManagerPin(pin: string): Promise<{ success: boolean; managerName?: string; managerId?: string; error?: string }> {
  try {
    const res = await api.verifyCashierPin(pin);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || 'Invalid PIN code' };
    }

    const u = res.data;
    const perms = typeof u.admin_permissions === 'object' && u.admin_permissions !== null ? u.admin_permissions : {};
    const isSuper = u.is_super_admin === true || (u.role || '').toLowerCase() === 'superadmin';
    const hasVariancePerm = perms['pos_shift_variance_approve'] === true || perms.pos_shift_variance_approve === true;
    const role = (u.role || '').toLowerCase();
    const hasFallbackMgmt = (role === 'manager' || role === 'admin') && (perms.finance === true || Object.keys(perms).length === 0);

    if (!isSuper && !hasVariancePerm && !hasFallbackMgmt) {
      return {
        success: false,
        error: `User "${u.name}" does not have the 'pos_shift_variance_approve' permission.`
      };
    }

    return {
      success: true,
      managerName: u.name,
      managerId: u.id
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error verifying manager PIN' };
  }
}

/**
 * Formats a print payload for LAN thermal receipt printer at 192.168.18.195:9191.
 * Handles both X REPORT (snapshot) and SHIFT CLOSE REPORT.
 */
export function generateShiftReportPrintPayload(params: {
  shift: ShiftCashRecord;
  reconciliation: ShiftReconciliationSummary;
  isXReport?: boolean;
  actualUsd?: number;
  actualLbp?: number;
  varianceUsd?: number;
  varianceLbp?: number;
  managerName?: string;
  notes?: string;
}) {
  const { shift, reconciliation, isXReport, actualUsd, actualLbp, varianceUsd, varianceLbp, managerName, notes } = params;
  const reportType = isXReport ? 'X REPORT (MID-SHIFT SNAPSHOT)' : 'SHIFT CLOSE REPORT';

  return {
    reportType,
    isXReport: Boolean(isXReport),
    shiftId: shift.id,
    branch: shift.branch,
    cashier: shift.user_name,
    terminal: shift.terminal_id || 'TERM-1',
    openedAt: shift.created_at,
    generatedAt: new Date().toISOString(),
    closedAt: isXReport ? null : (shift.closed_at || new Date().toISOString()),
    openingFloats: {
      usd: shift.opening_usd,
      lbp: shift.opening_lbp
    },
    financialTotals: {
      grossSales: reconciliation.grossSales,
      totalDiscounts: reconciliation.totalDiscounts,
      discountedOrders: reconciliation.discountedOrdersCount,
      totalRefunds: reconciliation.totalRefunds,
      netSales: reconciliation.netSales,
      avgTicket: reconciliation.avgTicket,
      totalOrders: reconciliation.ordersCount,
      totalCovers: reconciliation.totalCovers,
      voids: {
        count: reconciliation.voidCount,
        total: reconciliation.voidTotal
      }
    },
    tenderBreakdown: reconciliation.tenders,
    channelBreakdown: reconciliation.channels,
    reconciliation: {
      expectedCashUsd: reconciliation.expectedCashUsd,
      expectedCashLbp: reconciliation.expectedCashLbp,
      actualCashUsd: actualUsd !== undefined ? actualUsd : shift.actual_usd,
      actualCashLbp: actualLbp !== undefined ? actualLbp : shift.actual_lbp,
      varianceUsd: varianceUsd !== undefined ? varianceUsd : (shift.variance_usd || shift.difference_usd || 0),
      varianceLbp: varianceLbp !== undefined ? varianceLbp : (shift.variance_lbp || 0),
      managerApproval: managerName || shift.approved_by || (shift.manager_pin_verified ? 'Verified' : 'N/A'),
      closingNotes: notes || shift.closing_notes || ''
    }
  };
}

/**
 * Sends formatted report to LAN print server (192.168.18.195:9191).
 */
export async function printShiftReport(printPayload: any): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${PRINT_SERVER_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(printPayload)
    });
    if (res.ok) {
      return { success: true };
    }
    return { success: false, error: `Print server returned status ${res.status}` };
  } catch (err: any) {
    console.warn('[shiftReconciliationService] LAN print error:', err?.message);
    return { success: false, error: err?.message || 'Print server unreachable' };
  }
}

/**
 * Queries all shifts for a branch for a specific day and aggregates daily store metrics.
 */
export async function getDailyBranchControlSummary(branchIdentifier: string, dateStr?: string) {
  // Use Asia/Beirut local date boundary
  const targetDate = dateStr || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut' }).format(new Date());
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchIdentifier);
    let query = supabase
      .from('shift_cash')
      .select('*')
      .eq('date', targetDate);

    if (isUuid) {
      query = query.eq('branch_id', branchIdentifier);
    } else {
      query = query.ilike('branch', `%${branchIdentifier.trim()}%`);
    }

    const { data: shifts, error } = await query.order('created_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message, shifts: [], summary: null };
    }

    const shiftList: ShiftCashRecord[] = shifts || [];

    // Aggregate daily metrics
    let totalSalesUsd = 0;
    let totalOrders = 0;
    let totalOpeningUsd = 0;
    let totalOpeningLbp = 0;
    let totalExpectedUsd = 0;
    let totalExpectedLbp = 0;
    let totalActualUsd = 0;
    let totalActualLbp = 0;
    let totalVarianceUsd = 0;
    let totalVarianceLbp = 0;
    let totalDiscounts = 0;
    let totalRefunds = 0;
    let totalVoids = 0;

    const tenderTotals = {
      cash_usd: 0,
      cash_lbp: 0,
      whish_usd: 0,
      card_usd: 0,
      toters_usd: 0,
      noknok_usd: 0
    };

    for (const s of shiftList) {
      totalOpeningUsd += Number(s.opening_usd || 0);
      totalOpeningLbp += Number(s.opening_lbp || 0);
      totalExpectedUsd += Number(s.expected_cash_usd || 0);
      totalExpectedLbp += Number(s.expected_cash_lbp || 0);
      totalActualUsd += Number(s.actual_usd || 0);
      totalActualLbp += Number(s.actual_lbp || 0);
      totalVarianceUsd += Number(s.variance_usd || s.difference_usd || 0);
      totalVarianceLbp += Number(s.variance_lbp || 0);

      const kpis = s.kpi_summary;
      if (kpis) {
        totalSalesUsd += Number(kpis.netSales || 0);
        totalOrders += Number(kpis.ordersCount || 0);
        totalDiscounts += Number(kpis.totalDiscounts || 0);
        totalRefunds += Number(kpis.totalRefunds || 0);
        totalVoids += Number(kpis.voidTotal || 0);
      }

      const tenders = s.tender_summary;
      if (tenders) {
        tenderTotals.cash_usd += Number(tenders.cash_usd || 0);
        tenderTotals.cash_lbp += Number(tenders.cash_lbp || 0);
        tenderTotals.whish_usd += Number(tenders.whish_usd || 0);
        tenderTotals.card_usd += Number(tenders.card_usd || 0);
        tenderTotals.toters_usd += Number(tenders.toters_usd || 0);
        tenderTotals.noknok_usd += Number(tenders.noknok_usd || 0);
      }
    }

    const avgTicket = totalOrders > 0 ? (totalSalesUsd / totalOrders) : 0;

    return {
      success: true,
      date: targetDate,
      shifts: shiftList,
      summary: {
        totalSalesUsd: parseFloat(totalSalesUsd.toFixed(2)),
        totalOrders,
        avgTicket: parseFloat(avgTicket.toFixed(2)),
        totalOpeningUsd,
        totalOpeningLbp,
        totalExpectedUsd: parseFloat(totalExpectedUsd.toFixed(2)),
        totalExpectedLbp: Math.round(totalExpectedLbp),
        totalActualUsd: parseFloat(totalActualUsd.toFixed(2)),
        totalActualLbp: Math.round(totalActualLbp),
        totalVarianceUsd: parseFloat(totalVarianceUsd.toFixed(2)),
        totalVarianceLbp: Math.round(totalVarianceLbp),
        totalDiscounts: parseFloat(totalDiscounts.toFixed(2)),
        totalRefunds: parseFloat(totalRefunds.toFixed(2)),
        totalVoids: parseFloat(totalVoids.toFixed(2)),
        tenderTotals
      }
    };
  } catch (err: any) {
    return { success: false, error: err?.message, shifts: [], summary: null };
  }
}
