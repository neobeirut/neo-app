import { updateDirectOrderStatus } from '../services/posOrderService';
import { loadShiftPaymentOrders } from '../services/shiftPaymentOrders';
import { canHoldPreviousPm, loadShiftHandover, handoverMessage } from '../services/shiftHandoverPolicy';
import { isScheduledCarryover } from '../services/preparingOrders';
import { loadShiftReportingPeriod, shiftReportingPeriod } from '../services/shiftReportingPeriod';
import { loadPreparingOrders, pendingPreparation, isFutureScheduled, businessDay } from '../services/preparingOrders';
import React, { useState, useEffect, useMemo } from 'react';
import type { ShiftCashRecord } from '../services/shiftCashBridge';
import {
  closeShift,
  getDailyPayments,
  getActiveWallets,
  getShiftCashByDateAndShift,
  getRecentAmShifts,
  getDrawerTerminalAliases
} from '../services/shiftCashBridge';
import {
  calculateShiftReconciliation,
  checkVarianceThresholds,
  verifyManagerPin,
  getBranchReconSettings,
  generateShiftReportPrintPayload,
  printShiftReport
} from '../services/shiftReconciliationService';
import type { ShiftReconciliationSummary, BranchReconSettings } from '../services/shiftReconciliationService';
import { X, RefreshCw, Calculator, DollarSign, ShieldCheck, Check, AlertTriangle, Lock, PauseCircle } from 'lucide-react';
import { api } from '../../api/client';
import { supabase, getGlobalRestaurantId } from '../../api/supabase';

// --- Inline Numeric Keypad ---
interface NumPadProps {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  label: string;
  allowDecimal?: boolean;
}

const NumPad: React.FC<NumPadProps> = ({ value, onChange, onClose, label, allowDecimal = true }) => {
  const handleKey = (key: string) => {
    if (key === 'DEL') {
      onChange(value.slice(0, -1) || '');
    } else if (key === 'CLR') {
      onChange('');
    } else if (key === '.' && (!allowDecimal || value.includes('.'))) {
      return;
    } else {
      onChange(value + key);
    }
  };
  const keys = ['7','8','9','4','5','6','1','2','3',allowDecimal ? '.' : '','0','DEL'];
  return (
    <div className="fixed inset-0 bg-black/60 z-[80] flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-sm bg-white border-t-2 border-[#1e5c4f] rounded-t-2xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-slate-900 font-mono min-w-[80px] text-right">{value || '0'}</span>
            <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 px-2 py-1 text-xs font-bold">✕ Done</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k, i) => k ? (
            <button
              key={i}
              type="button"
              onClick={() => handleKey(k)}
              className={`h-14 rounded-xl text-xl font-black transition active:scale-95 ${
                k === 'DEL' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                k === '.' ? 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200' :
                'bg-white text-slate-900 border border-slate-300 hover:bg-slate-100 shadow-xs'
              }`}
            >
              {k === 'DEL' ? '⌫' : k}
            </button>
          ) : <div key={i} />)}
        </div>
        <button type="button" onClick={() => handleKey('CLR')} className="mt-2 w-full h-10 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold border border-slate-300 hover:bg-slate-200 shadow-xs">Clear</button>
      </div>
    </div>
  );
};

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftCashRecord | null;
  branchName: string;
  branchId?: string;
  /** Numeric external branch ID (e.g. "2") stored in pos_orders.branch_id */
  externalBranchId?: string;
  locationKey: string;
  terminalId?: string;
  cashierName: string;
  onShiftClosed: (closedShift: ShiftCashRecord, recon: ShiftReconciliationSummary) => void;
  onHoldShift?: (notes?: string) => Promise<{ success: boolean; error?: string }>;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({
  isOpen,
  onClose,
  shift,
  branchName,
  branchId,
  externalBranchId,
  locationKey,
  terminalId = 'TERM-1',
  cashierName,
  onShiftClosed,
  onHoldShift
}) => {
  // NOTE: Component is only mounted when shift is non-null (guarded in parent).
  // The isOpen guard is placed after hooks below.

  const [loadingRecon, setLoadingRecon] = useState(false);
  const [fetchingCashFlow, setFetchingCashFlow] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [reconData, setReconData] = useState<ShiftReconciliationSummary | null>(null);
  const [branchSettings, setBranchSettings] = useState<BranchReconSettings>({
    allowed_usd_variance: 5.0,
    allowed_lbp_variance: 450000,
    blind_cash_close_enabled: false,
    denomination_helper_enabled: true
  });

  // Safe shift reference — all accessors use ?. to guard against null during initial render
  const s = shift || {} as ShiftCashRecord;

  // Shift Header Information
  const [date, setDate] = useState<string>(() => {
    const raw = s.date || '';
    if (raw.includes('T')) return raw.split('T')[0];
    if (raw.includes(' ')) return raw.split(' ')[0];
    return raw || new Date().toISOString().split('T')[0];
  });
  const [shiftType, setShiftType] = useState<string>(s.shift === 'PM' ? 'PM' : 'AM');
  useEffect(() => {
    if (shift) { setDate(shiftReportingPeriod(shift).day); setShiftType(shift.shift === 'PM' ? 'PM' : 'AM'); }
  }, [shift?.id]);
  const [systemRate, setSystemRate] = useState<number>(Number(s.rate) || 90000);
  const [rate, setRate] = useState<number>(Number(s.rate) || 90000);
  const [rateInputStr, setRateInputStr] = useState<string>(String(s.rate || 90000));
  const [showBreakdown, setShowBreakdown] = useState(false);

  // E-Wallets
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletInputs, setWalletInputs] = useState<Record<string, { amount_usd: string; amount_lbp: string }>>({});

  // AM Shift Cash Handover Reference for PM Shift (Float only, PM calculations are independent)
  const [amShiftData, setAmShiftData] = useState<any | null>(null);
  const [recentAmShifts, setRecentAmShifts] = useState<any[]>([]);
  const [isFetchingAm, setIsFetchingAm] = useState<boolean>(false);
  const [showAmShiftPicker, setShowAmShiftPicker] = useState<boolean>(false);

  // Active / Open Tables & Orders Validation (Enforcing: all must be closed or saved as credit)
  const [openTables, setOpenTables] = useState<any[]>([]);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [preparingOrders, setPreparingOrders] = useState<any[]>([]);
  const [preparingCheckError, setPreparingCheckError] = useState<string | null>(null);
  const [checkingPreparation, setCheckingPreparation] = useState(true);
  const preparation = pendingPreparation(preparingOrders, shiftReportingPeriod(s).day);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const refresh = async () => {
      setCheckingPreparation(true);
      try {
        const rows = await loadPreparingOrders(shift?.branch_id || branchId, externalBranchId, shift?.restaurant_id, (await loadShiftReportingPeriod(s, await getDrawerTerminalAliases(s.branch_id || branchId, s.terminal_id || terminalId))).endTime, s.concept_id);
        if (!cancelled) { setPreparingOrders(rows); setPreparingCheckError(null); }
      } catch (error: any) { if (!cancelled) setPreparingCheckError(error.message); }
      finally { if (!cancelled) setCheckingPreparation(false); }
    };
    void refresh();
    const timer = setInterval(refresh, 10000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isOpen, branchId, externalBranchId, shift?.id]);
  const unpaidTables = useMemo(() => openTables.filter(t => !t.isPaidInAdvance), [openTables]);
  const unpaidOrders = useMemo(() => openOrders.filter(o => !o.isPaidInAdvance && !isFutureScheduled(o, shiftReportingPeriod(s).day)), [openOrders]);
  const unpaidCount = unpaidTables.length + unpaidOrders.length;
  const [checkingEntities, setCheckingEntities] = useState<boolean>(false);
  const [quickSettleLoading, setQuickSettleLoading] = useState<string | null>(null);
  const [creditPromptTarget, setCreditPromptTarget] = useState<{ type: 'table' | 'order'; id: string | number; orderId?: number; label: string; defaultName: string } | null>(null);
  const [creditPromptName, setCreditPromptName] = useState<string>('');

  // Open Entities Popup state
  const [showOpenEntitiesPopup, setShowOpenEntitiesPopup] = useState(true);

  // Financial Inputs (Mobile App ShiftCashScreen parity)
  const [salesLbp, setSalesLbp] = useState<string>('');
  const [openingUsd, setOpeningUsd] = useState<string>(String(s.opening_usd || 0));
  const [openingLbp, setOpeningLbp] = useState<string>(String(s.opening_lbp || 0));

  const [cashInUsd, setCashInUsd] = useState<string>(String(s.cash_in_usd || '0'));
  const [cashInLbp, setCashInLbp] = useState<string>(String(s.cash_in_lbp || '0'));

  const [paymentsUsd, setPaymentsUsd] = useState<string>(String(s.payments_usd || '0'));
  const [paymentsLbp, setPaymentsLbp] = useState<string>(String(s.payments_lbp || '0'));

  const [creditCardUsd, setCreditCardUsd] = useState<string>(String(s.credit_card_usd || ''));
  const [creditCardLbp, setCreditCardLbp] = useState<string>(String(s.credit_card_lbp || ''));

  const [cashOutUsd, setCashOutUsd] = useState<string>(String(s.cash_out_usd || '0'));
  const [cashOutLbp, setCashOutLbp] = useState<string>(String(s.cash_out_lbp || '0'));

  const [onCreditLbp, setOnCreditLbp] = useState<string>(String(s.on_credit_lbp || ''));

  // Physical Actual Drawer Counts (0 by default)
  const [actualUsd, setActualUsd] = useState<string>('0');
  const [actualLbp, setActualLbp] = useState<string>('0');

  // Denomination Helper State
  const [showDenomHelper, setShowDenomHelper] = useState(false);
  const [usdDenoms, setUsdDenoms] = useState<{ [key: string]: number }>({
    '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0
  });
  const [lbpDenoms, setLbpDenoms] = useState<{ [key: string]: number }>({
    '100000': 0, '50000': 0, '20000': 0, '10000': 0, '5000': 0
  });

  // Manager Authorization State
  const [managerPin, setManagerPin] = useState('');
  const [managerName, setManagerName] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [varianceReason, setVarianceReason] = useState('Counting difference');
  const [varianceNotes, setVarianceNotes] = useState('');

  // Execution States
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cashFlowMessage, setCashFlowMessage] = useState<string | null>(null);

  // NumPad / Integrated Keypad State
  const [activeKeypadField, setActiveKeypadField] = useState<string>('actualUsd');
  const [numpadField, setNumpadField] = useState<{ label: string; value: string; setter: (v: string) => void } | null>(null);

  // Auto-dismiss open entities popup when no open entities
  useEffect(() => {
    if (openTables.length === 0 && openOrders.length === 0) setShowOpenEntitiesPopup(false);
  }, [openTables, openOrders]);

  // 1. Check Open Entities (Tables & Orders) and Calculate Shift Sales & On-Account
  const checkOpenEntitiesAndSales = async (currentRateVal: number, preloadedOrders?: any[]) => {
    setCheckingEntities(true);
    try {
      // 1. Query all orders created in this shift window (reusing preloaded orders if available)
      const aliases = await getDrawerTerminalAliases(branchId || shift?.branch_id || '', shift?.terminal_id || terminalId);
      const period = await loadShiftReportingPeriod(shift, aliases);
      const shiftStartTime = period.startTime;
      const branchIds = Array.from(new Set([shift?.branch_id || branchId, externalBranchId].filter(Boolean).map(String)));
      const restaurantId = shift?.restaurant_id || getGlobalRestaurantId();
      const shiftOrders = preloadedOrders || await loadShiftPaymentOrders({ restaurantId, branchIds, terminalIds: aliases, startTime: shiftStartTime, endTime: period.endTime });
      const ordersMap = new Map<number, any>();
      shiftOrders.forEach((o: any) => ordersMap.set(o.id, o));

      // Helper: determine if order was paid in advance
      const isOrderPaidInAdvance = (o: any) => {
        if (!o) return false;
        if (o.status === 'paid') return true;
        if (o.special_instructions && o.special_instructions.includes('PAID_IN_ADVANCE')) return true;
        const tendered = Number(o.tendered_amount) || 0;
        const total = Number(o.total_amount) || 0;
        const pMethod = String(o.payment_method || '').toLowerCase();
        if (tendered > 0 && tendered >= total && !['pending', 'unpaid', ''].includes(pMethod)) return true;
        return false;
      };

      // Helper: determine if an order is settled or paid in advance
      const isOrderSettledOrPaid = (o: any) => {
        if (!o) return false;
        if (['completed', 'closed', 'delivered'].includes(o.status)) return true;
        return isOrderPaidInAdvance(o);
      };

      // 2. Query active table sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('pos_table_sessions')
        .select(`
          id, branch_id, commerce_order_id, guest_count, status, opened_at,
          tables:pos_table_session_tables(table:pos_tables(table_code), is_primary)
        `)
        .in('status', ['opening', 'occupied', 'bill_requested', 'closing']).eq('restaurant_id', restaurantId).in('branch_id', branchIds).lt('opened_at', period.endTime);
      if (sessionError) throw new Error(sessionError.message);

      const activeSessions = (sessionData || []).filter((s: any) => {
        // pos_table_sessions.branch_id uses the flow UUID (branchId), not external integer
        if (branchId) {
          return s.branch_id === branchId;
        }
        return true;
      });

      // If an order for the table isn't in shiftOrders, fetch it
      const missingOrderIds = activeSessions
        .map((s: any) => s.commerce_order_id)
        .filter((id: any) => id && !ordersMap.has(id));

      if (missingOrderIds.length > 0) {
        const { data: missingOrders } = await supabase
          .from('pos_orders')
          .select('id, customer_name, table_label, total_amount, exchange_rate, status, payment_method, tendered_amount, special_instructions, branch_id, created_at, is_scheduled, scheduled_for')
          .in('id', missingOrderIds);
        (missingOrders || []).forEach((o: any) => ordersMap.set(o.id, o));
      }

      const isDeliveryConcept = Boolean(shift?.concept_id && shift.concept_id !== '00000000-0000-0000-0000-000000000001');

      let formattedTables: any[] = [];
      if (!isDeliveryConcept) {
        formattedTables = activeSessions.map((sess: any) => {
          const primaryTable = (sess.tables || []).find((t: any) => t.is_primary)?.table?.table_code 
            || (sess.tables?.[0]?.table?.table_code) 
            || 'Table';
          const linkedOrder = sess.commerce_order_id ? ordersMap.get(sess.commerce_order_id) : null;
          const paidAdv = isOrderPaidInAdvance(linkedOrder);

          return {
            id: sess.id,
            tableCode: primaryTable,
            guestCount: sess.guest_count || 1,
            status: sess.status,
            orderId: sess.commerce_order_id,
            openedAt: sess.opened_at,
            totalAmount: linkedOrder ? (Number(linkedOrder.total_amount) || 0) : 0,
            isPaidInAdvance: paidAdv,
            paymentMethod: linkedOrder?.payment_method || null
          };
        });
      }
      setOpenTables(formattedTables);

      // 3. Query open / held / preparing orders scoped to concept
      let ordersQuery = supabase
        .from('pos_orders')
        .select('id, customer_name, table_label, total_amount, exchange_rate, status, payment_method, tendered_amount, special_instructions, branch_id, created_at, is_scheduled, scheduled_for, concept_id')
        .in('status', ['held', 'preparing', 'pending', 'open', 'new', 'confirmed', 'ready', 'paid'])
        .eq('restaurant_id', restaurantId)
        .in('branch_id', branchIds)
        .lt('created_at', period.endTime);

      if (isDeliveryConcept) {
        ordersQuery = ordersQuery.eq('concept_id', shift?.concept_id);
      } else if (typeof ordersQuery.or === 'function') {
        ordersQuery = ordersQuery.or('concept_id.eq.00000000-0000-0000-0000-000000000001,concept_id.is.null');
      }

      let { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError && (String(ordersError.message || '').includes('concept_id') || (ordersError as any).code === '42703' || (ordersError as any).code === 'PGRST204')) {
        const retryQuery = await supabase
          .from('pos_orders')
          .select('id, customer_name, table_label, total_amount, exchange_rate, status, payment_method, tendered_amount, special_instructions, branch_id, created_at, is_scheduled, scheduled_for')
          .in('status', ['held', 'preparing', 'pending', 'open', 'new', 'confirmed', 'ready', 'paid'])
          .eq('restaurant_id', restaurantId)
          .in('branch_id', branchIds)
          .lt('created_at', period.endTime);
        ordersData = retryQuery.data;
        ordersError = retryQuery.error;
      }
      if (ordersError) throw new Error(ordersError.message);

      const activeOrders = (ordersData || []).filter((o: any) => {
        if (externalBranchId) {
          return [branchId, externalBranchId].filter(Boolean).map(String).includes(String(o.branch_id));
        }
        return true;
      }).map((o: any) => ({
        ...o,
        isPaidInAdvance: isOrderPaidInAdvance(o)
      }));
      setOpenOrders(activeOrders.filter((o: any) => !isScheduledCarryover(o)));


      // 4. Compute Shift Sales (LBP) and On-Account (Receivables LBP)
      // Sales include: completed orders OR orders paid in advance
      // Unpaid open / held / preparing orders are EXCLUDED!
      let computedSalesLbp = 0;
      let computedOnCreditLbp = 0;

      shiftOrders.forEach((ord: any) => {
        {
          const orderRate = Number(ord.exchange_rate) || currentRateVal;
          const totalLbpVal = Math.round((Number(ord.total_amount) || 0) * orderRate);
          computedSalesLbp += totalLbpVal;

          const pMethod = String(ord.payment_method || '').toLowerCase();
          if (pMethod.includes('account') || pMethod.includes('credit')) {
            computedOnCreditLbp += totalLbpVal;
          }
        }
      });

      // If no pos_orders were found locally, fallback to reconData netSales if present
      if (shiftOrders.length === 0 && reconData?.netSales && reconData.netSales > 0) {
        computedSalesLbp = Math.round(reconData.netSales * currentRateVal);
      }

      setSalesLbp(String(computedSalesLbp));
      setOnCreditLbp(String(computedOnCreditLbp));
    } catch (err) {
      console.warn('Error checking open entities and sales:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Could not load shift sales.');
    } finally {
      setCheckingEntities(false);
    }
  };

  // Quick Settle or Save as Credit or Pay in Advance for Open Tables / Orders
  const handleQuickResolve = async (
    target: { type: 'table' | 'order'; id: string | number; orderId?: number; totalAmount?: number },
    resolution: 'credit' | 'cash' | 'advance_cash',
    clientName?: string
  ) => {
    setQuickSettleLoading(`${target.type}-${target.id}`);
    try {
      const isAdvance = resolution === 'advance_cash';
      const pMethod = resolution === 'credit' ? 'On Account' : 'Cash USD';
      const cName = resolution === 'credit' ? (clientName || 'Credit Client') : undefined;

      let resolvedTotal = target.totalAmount || 0;
      if (!resolvedTotal && (target.orderId || target.type === 'order')) {
        const orderIdToFetch = target.type === 'order' ? target.id : target.orderId;
        const { data: oData } = await supabase.from('pos_orders').select('total_amount').eq('id', orderIdToFetch).single();
        if (oData?.total_amount) resolvedTotal = Number(oData.total_amount);
      }

      const orderId = target.type === 'table' ? target.orderId : target.id;
      if (orderId) {
        const { data: current, error: readError } = await supabase.from('pos_orders').select('status,tendered_amount,total_amount').eq('id', orderId).eq('restaurant_id', shift.restaurant_id).single();
        if (readError || !current) throw new Error(readError?.message || 'Order not found.');
        const alreadyPaid = ['paid','completed','delivered','closed'].includes(current.status);
        const result = await updateDirectOrderStatus(orderId, alreadyPaid ? { status: isAdvance ? 'paid' : 'completed' } : {
          status: isAdvance ? 'paid' : 'completed', payment_method: pMethod, payment_status: 'paid', terminalId: shift.terminal_id || terminalId,
          tendered_amount: resolvedTotal, ...(isAdvance ? { special_instructions: '[PAID_IN_ADVANCE]' } : {}), ...(cName ? { customer_name: cName } : {})
        });
        if (!result.success) throw new Error(result.error || 'Payment could not be saved.');
      }
      if (target.type === 'table' && !isAdvance) {
        const { error } = await supabase.from('pos_table_sessions').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', target.id).eq('restaurant_id', shift.restaurant_id);
        if (error) throw new Error(error.message);
      }

      await checkOpenEntitiesAndSales(rate || systemRate || 90000);
      const aliases = await getDrawerTerminalAliases(shift.branch_id || branchId, shift.terminal_id || terminalId);
      const period = await loadShiftReportingPeriod(shift, aliases);
      const report = await calculateShiftReconciliation({ locationKey, shiftId: shift.id, branchId: shift.branch_id || branchId, externalBranchId,
        restaurantId: shift.restaurant_id, terminalIds: aliases, startTime: period.startTime, endTime: period.endTime, endExclusive: true,
        openingUsd: Number(shift.opening_usd || 0), openingLbp: Number(shift.opening_lbp || 0) });
      if (!report.success || !report.summary) throw new Error(report.error || 'Could not refresh shift totals.');
      setReconData(report.summary);
      setCreditPromptTarget(null);
      setCreditPromptName('');
    } catch (err: any) {
      setErrorMessage(`Failed to resolve ${target.type}: ${err.message}`);
    } finally {
      setQuickSettleLoading(null);
    }
  };

  // 1. Initial Load: Wallets, System Rate, POS Reconciliation, Open Entities & Draft
  useEffect(() => {
    if (!isOpen || !shift) return;

    const init = async () => {
      setLoadingRecon(true);
      setErrorMessage(null);
      try {
        let activeRate = rate;
        const currentTermId = shift.terminal_id || terminalId;

        // Fetch rate, wallets, settings, and drawer terminal aliases concurrently in parallel
        const [rateRes, walletRes, settings, aliases] = await Promise.all([
          shiftReportingPeriod(shift).day < businessDay() && Number(shift.rate) > 0
            ? { success: true, rate: Number(shift.rate) }
            : api.getExchangeRate(shift.restaurant_id),
          getActiveWallets(shift.restaurant_id),
          getBranchReconSettings(branchId || branchName),
          getDrawerTerminalAliases(branchId || shift.branch_id || '', currentTermId)
        ]);

        if (rateRes?.success && rateRes.rate) {
          setSystemRate(rateRes.rate);
          setRate(rateRes.rate);
          setRateInputStr(String(rateRes.rate));
          activeRate = rateRes.rate;
        }

        if (walletRes?.success && walletRes.data) {
          setWallets(walletRes.data);
        }

        if (settings) {
          setBranchSettings(settings);
        }

        // POS Reconciliation
        const period = await loadShiftReportingPeriod(shift, aliases);
        const res = await calculateShiftReconciliation({
          locationKey,
          shiftId: shift.id,
          startTime: period.startTime,
          endTime: period.endTime,
          endExclusive: true,
          branchId: shift.branch_id || branchId,
          externalBranchId,
          restaurantId: shift.restaurant_id || getGlobalRestaurantId(),
          terminalIds: aliases,
          openingUsd: Number(shift.opening_usd || 0),
          openingLbp: Number(shift.opening_lbp || 0)
        });

        if (!res.success || !res.summary) throw new Error(res.error || 'Could not load shift sales.');
        if (res.success && res.summary) {
          setReconData(res.summary);
          // Seed Credit Card if POS recorded card sales
          if (res.summary.tenders?.card_usd !== undefined && res.summary.tenders.card_usd > 0) {
            setCreditCardUsd(prev => prev ? prev : String(res.summary.tenders.card_usd));
          }
          // Seed preliminary sales immediately from reconciliation summary so UI does not lag
          if (res.summary.netSales !== undefined && res.summary.netSales >= 0) {
            setSalesLbp(prev => prev ? prev : String(Math.round(res.summary!.netSales * activeRate)));
          }

          // Automatically enter E-Wallets from POS recorded tenders (can be corrected by cashier)
          const loadedWallets = walletRes?.success && Array.isArray(walletRes.data) ? walletRes.data : [];
          if (loadedWallets.length > 0) {
            const initialWalletInputs: Record<string, { amount_usd: string; amount_lbp: string }> = {};
            const shiftOrdersList = res.orders || [];

            loadedWallets.forEach((w: any) => {
              const wName = (w.name || '').toLowerCase().trim();
              const isWhishWallet = wName.includes('wish') || wName.includes('whish') || loadedWallets.length === 1;

              let walletUsd = 0;
              let walletLbp = 0;

              shiftOrdersList.forEach((o: any) => {
                const pm = (o.payment_method || '').toLowerCase().trim();
                const matchesThisWallet =
                  (wName && pm.includes(wName)) ||
                  (isWhishWallet && (pm.includes('wish') || pm.includes('whish') || pm.includes('wallet')));

                if (matchesThisWallet) {
                  const total = Number(o.total_amount) || 0;
                  if (pm.includes('lbp')) {
                    const rate = Number(o.exchange_rate) || activeRate;
                    walletLbp += Math.round(total * rate);
                  } else {
                    walletUsd += total;
                  }
                }
              });

              // Fallback to res.summary.tenders.whish_usd if whish_usd > 0 and per-order check was 0
              if (isWhishWallet && walletUsd === 0 && res.summary.tenders?.whish_usd && res.summary.tenders.whish_usd > 0) {
                walletUsd = res.summary.tenders.whish_usd;
              }

              initialWalletInputs[w.id] = {
                amount_usd: walletUsd > 0 ? String(parseFloat(walletUsd.toFixed(2))) : '',
                amount_lbp: walletLbp > 0 ? String(walletLbp) : ''
              };
            });

            // Auto-fill wallet inputs while preserving any already entered corrections
            setWalletInputs(prev => {
              const merged = { ...prev };
              Object.entries(initialWalletInputs).forEach(([wId, val]) => {
                if (!merged[wId] || (!merged[wId].amount_usd && !merged[wId].amount_lbp)) {
                  merged[wId] = val;
                }
              });
              return merged;
            });
          }
        }

        // Check Open Tables & Orders, reusing the shift orders already loaded in reconciliation
        await checkOpenEntitiesAndSales(activeRate, res.orders);

        // Load Draft from LocalStorage
        const targetDate = date || shift.date || '';
        const draftKey = `@shift_cash_draft_${branchName}_${targetDate}_${shift.shift || 'AM'}`;
        const draftStr = localStorage.getItem(draftKey);
        if (draftStr) {
          const draft = JSON.parse(draftStr);
          if (draft.openingUsd) setOpeningUsd(draft.openingUsd);
          if (draft.openingLbp) setOpeningLbp(draft.openingLbp);
          if (draft.creditCardUsd) setCreditCardUsd(draft.creditCardUsd);
          if (draft.creditCardLbp) setCreditCardLbp(draft.creditCardLbp);
          setActualUsd(draft.actualUsd !== undefined && draft.actualUsd !== '' ? draft.actualUsd : '0');
          setActualLbp(draft.actualLbp !== undefined && draft.actualLbp !== '' ? draft.actualLbp : '0');
          if (draft.walletInputs) setWalletInputs(draft.walletInputs);
        } else {
          setActualUsd('0');
          setActualLbp('0');
        }

        // Auto-fetch payments (Supplier, Cash Out, Cash In) from Daily Payments
        await handleFetchCashFlow(targetDate, shift.shift || 'AM');
      } catch (err: any) {
        setErrorMessage(err?.message || 'Error initializing close shift data');
      } finally {
        setLoadingRecon(false);
      }
    };

    init();
  }, [isOpen, shift, branchId, branchName, locationKey, terminalId]);

  // 1.b. Dedicated Reactive AM Shift Loader for PM Shift (Cash Handover only — NÉO restaurant only)
  useEffect(() => {
    if (!isOpen || shiftType !== 'PM' || (s.concept_id && s.concept_id !== '00000000-0000-0000-0000-000000000001')) {
      return;
    }

    let isMounted = true;
    const fetchAm = async () => {
      setIsFetchingAm(true);
      try {
        const [amRes, recentRes] = await Promise.all([
          getShiftCashByDateAndShift(branchName, date, 'AM'),
          getRecentAmShifts()
        ]);

        if (!isMounted) return;

        if (recentRes.success && recentRes.data) {
          setRecentAmShifts(recentRes.data);
        }

        const am = (amRes.success && amRes.data)
          ? amRes.data
          : ((recentRes.success && recentRes.data && recentRes.data.length > 0) ? recentRes.data[0] : null);

        if (am) {
          setAmShiftData(am);
          // Auto-prefill opening cash from AM actual cash if opening is 0 or default
          setOpeningUsd(prev => (!prev || prev === '0' || prev === '100') && am.actual_usd ? String(am.actual_usd) : prev);
          setOpeningLbp(prev => (!prev || prev === '0') && am.actual_lbp ? String(am.actual_lbp) : prev);
        }
      } catch (err) {
        console.error('Failed to load AM shift reference:', err);
      } finally {
        if (isMounted) setIsFetchingAm(false);
      }
    };

    fetchAm();
    return () => { isMounted = false; };
  }, [isOpen, shiftType, date, branchName]);

  // 2. Draft Auto-Saving (without AM subtractions)
  useEffect(() => {
    if (!isOpen || !shift) return;
    const targetDate = date || shift.date;
    const draftKey = `@shift_cash_draft_${branchName}_${targetDate}_${shiftType}`;
    const draftData = {
      salesLbp,
      openingUsd,
      openingLbp,
      cashInUsd,
      cashInLbp,
      paymentsUsd,
      paymentsLbp,
      creditCardUsd,
      creditCardLbp,
      cashOutUsd,
      cashOutLbp,
      onCreditLbp,
      actualUsd,
      actualLbp,
      walletInputs
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch {}
  }, [
    salesLbp, openingUsd, openingLbp, cashInUsd, cashInLbp,
    paymentsUsd, paymentsLbp, creditCardUsd, creditCardLbp,
    cashOutUsd, cashOutLbp, onCreditLbp, actualUsd, actualLbp,
    walletInputs, shiftType, date
  ]);

  // 3. Fetch Payments (Supplier, Cash Out, Cash In) from Daily Payments
  const handleFetchCashFlow = async (overrideDate?: string, overrideShift?: string) => {
    setFetchingCashFlow(true);
    setCashFlowMessage(null);
    try {
      const targetDate = overrideDate || date || (shift.date ? (shift.date.includes('T') ? shift.date.split('T')[0] : shift.date.split(' ')[0]) : new Date().toISOString().split('T')[0]);
      const targetShift = overrideShift || shiftType;
      if (!date && targetDate) setDate(targetDate);
      const res = await getDailyPayments(branchName, targetDate, targetShift, (shift as any)?.concept_id || '00000000-0000-0000-0000-000000000001');
      if (res.success && res.data) {
        const records = res.data;
        const isCashOut = (t: string) => t === 'CashOut' || t === 'Cashout Loan' || t === 'Cashout Bank' || t === 'Cashout Salary';

        const supplierUsd = records
          .filter((r: any) => (r.type === 'Supplier' || r.type === 'Delivery') && r.status !== 'Unpaid')
          .reduce((sum: number, r: any) => sum + (parseFloat(r.amount_usd) || 0), 0);

        const supplierLbp = records
          .filter((r: any) => (r.type === 'Supplier' || r.type === 'Delivery') && r.status !== 'Unpaid')
          .reduce((sum: number, r: any) => sum + (parseFloat(r.amount_lbp) || 0), 0);

        const inUsd = records
          .filter((r: any) => r.type === 'CashIn')
          .reduce((sum: number, r: any) => sum + (parseFloat(r.amount_usd) || 0), 0);

        const inLbp = records
          .filter((r: any) => r.type === 'CashIn')
          .reduce((sum: number, r: any) => sum + (parseFloat(r.amount_lbp) || 0), 0);

        const outUsd = records
          .filter((r: any) => isCashOut(r.type))
          .reduce((sum: number, r: any) => sum + (parseFloat(r.amount_usd) || 0), 0);

        const outLbp = records
          .filter((r: any) => isCashOut(r.type))
          .reduce((sum: number, r: any) => sum + (parseFloat(r.amount_lbp) || 0), 0);

        setPaymentsUsd(String(supplierUsd));
        setPaymentsLbp(String(supplierLbp));
        setCashInUsd(String(inUsd));
        setCashInLbp(String(inLbp));
        setCashOutUsd(String(outUsd));
        setCashOutLbp(String(outLbp));

        // Auto-seed e-wallet if currently empty
        if (reconData?.tenders?.whish_usd && reconData.tenders.whish_usd > 0 && wallets.length > 0) {
          setWalletInputs(prev => {
            const hasExisting = Object.values(prev).some(v => v.amount_usd || v.amount_lbp);
            if (!hasExisting) {
              const targetWallet = wallets.find((w: any) => {
                const n = (w.name || '').toLowerCase();
                return n.includes('wish') || n.includes('whish');
              }) || wallets[0];
              if (targetWallet) {
                return {
                  ...prev,
                  [targetWallet.id]: {
                    amount_usd: String(reconData.tenders.whish_usd),
                    amount_lbp: prev[targetWallet.id]?.amount_lbp || ''
                  }
                };
              }
            }
            return prev;
          });
        }

        setCashFlowMessage(`✓ Loaded ${records.length} payment records: Suppliers ($${supplierUsd.toFixed(2)} / ${supplierLbp.toLocaleString()} LBP), Cash In ($${inUsd.toFixed(2)} / ${inLbp.toLocaleString()} LBP), Cash Out ($${outUsd.toFixed(2)} / ${outLbp.toLocaleString()} LBP)`);
        setTimeout(() => setCashFlowMessage(null), 6000);
      } else {
        setPaymentsUsd('0');
        setPaymentsLbp('0');
        setCashInUsd('0');
        setCashInLbp('0');
        setCashOutUsd('0');
        setCashOutLbp('0');
        setCashFlowMessage('No daily payments records found for this shift.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to fetch payments');
    } finally {
      setFetchingCashFlow(false);
    }
  };

  // Denomination Helpers
  const calcDenomUsd = () => {
    return Object.entries(usdDenoms).reduce((sum, [bill, count]) => sum + Number(bill) * (count || 0), 0);
  };
  const calcDenomLbp = () => {
    return Object.entries(lbpDenoms).reduce((sum, [bill, count]) => sum + Number(bill) * (count || 0), 0);
  };
  const applyDenomTotals = () => {
    setActualUsd(String(calcDenomUsd()));
    setActualLbp(String(calcDenomLbp()));
    setShowDenomHelper(false);
  };

  // Mathematical Reconciliation Formulas
  const n = (val: string) => Number(val) || 0;
  const currentRate = rate || 90000;

  const {
    effectiveSalesLbp,
    effectiveOnCreditLbp,
    totalWalletUsd,
    totalWalletLbp,
    totalWalletOutflowUsd,
    totalWalletOutflowLbp,
    totalOpeningUsd,
    openingUsdNum,
    openingLbpNum,
    totalCashInUsd,
    salesLbpInUsd,
    totalInflowsUsd,
    totalPaymentsUsd,
    totalCashOutUsd,
    totalCreditCardUsd,
    onCreditLbpInUsd,
    totalOutflowsUsd,
    actualUsdNum,
    actualLbpNum,
    expectedUsd,
    actualTotalUsd,
    differenceUsd
  } = useMemo(() => {
    const effSalesLbp = n(salesLbp);
    const effCreditLbp = n(onCreditLbp);

    const openingUsdNum = n(openingUsd);
    const openingLbpNum = n(openingLbp);
    const openingLbpInUsd = openingLbpNum / currentRate;
    const totalOpeningUsd = openingUsdNum + openingLbpInUsd;

    const cashInUsdNum = n(cashInUsd);
    const cashInLbpNum = n(cashInLbp);
    const cashInLbpInUsd = cashInLbpNum / currentRate;
    const totalCashInUsd = cashInUsdNum + cashInLbpInUsd;

    const salesLbpInUsd = effSalesLbp / currentRate;
    const totalInflowsUsd = totalCashInUsd + salesLbpInUsd;

    const totalWalletUsd = Object.values(walletInputs).reduce((sum, w: any) => sum + n(w.amount_usd), 0);
    const totalWalletLbp = Object.values(walletInputs).reduce((sum, w: any) => sum + n(w.amount_lbp), 0);
    const walletOutflowUsd = totalWalletUsd + (totalWalletLbp / currentRate);
    const walletOutflowLbp = Math.round(totalWalletLbp + (totalWalletUsd * currentRate));

    const paymentsUsdNum = n(paymentsUsd);
    const paymentsLbpNum = n(paymentsLbp);
    const paymentsLbpInUsd = paymentsLbpNum / currentRate;
    const totalPaymentsUsd = paymentsUsdNum + paymentsLbpInUsd;

    const cashOutUsdNum = n(cashOutUsd);
    const cashOutLbpNum = n(cashOutLbp);
    const cashOutLbpInUsd = cashOutLbpNum / currentRate;
    const totalCashOutUsd = cashOutUsdNum + cashOutLbpInUsd;

    const creditCardUsdNum = n(creditCardUsd);
    const creditCardLbpNum = n(creditCardLbp);
    const creditCardLbpInUsd = creditCardLbpNum / currentRate;
    const totalCreditCardUsd = creditCardUsdNum + creditCardLbpInUsd;

    const onCreditLbpInUsd = effCreditLbp / currentRate;

    const totalOutflowsUsd =
      totalPaymentsUsd +
      totalCashOutUsd +
      onCreditLbpInUsd +
      totalCreditCardUsd +
      walletOutflowUsd;

    const expUsd = totalOpeningUsd + totalInflowsUsd - totalOutflowsUsd;
    const actualUsdNum = n(actualUsd);
    const actualLbpNum = n(actualLbp);
    const actualLbpInUsd = actualLbpNum / currentRate;
    const actTotalUsd = actualUsdNum + actualLbpInUsd;
    const diff = Math.round((actTotalUsd - expUsd) * 100) / 100;

    return {
      effectiveSalesLbp: effSalesLbp,
      effectiveOnCreditLbp: effCreditLbp,
      totalWalletUsd,
      totalWalletLbp,
      totalWalletOutflowUsd: walletOutflowUsd,
      totalWalletOutflowLbp: walletOutflowLbp,
      totalOpeningUsd,
      openingUsdNum,
      openingLbpNum,
      totalCashInUsd,
      salesLbpInUsd,
      totalInflowsUsd,
      totalPaymentsUsd,
      totalCashOutUsd,
      totalCreditCardUsd,
      onCreditLbpInUsd,
      totalOutflowsUsd,
      actualUsdNum,
      actualLbpNum,
      expectedUsd: Math.round(expUsd * 100) / 100,
      actualTotalUsd: Math.round(actTotalUsd * 100) / 100,
      differenceUsd: diff
    };
  }, [
    salesLbp, openingUsd, openingLbp, cashInUsd, cashInLbp,
    paymentsUsd, paymentsLbp, cashOutUsd, cashOutLbp,
    onCreditLbp, creditCardUsd, creditCardLbp, walletInputs,
    actualUsd, actualLbp, currentRate
  ]);


  // Manager Approval Check based on actual vs expected difference
  const varianceCheck = useMemo(() => {
    const absDiffUsd = Math.abs(differenceUsd);
    const usdLimit = branchSettings.allowed_usd_variance ?? 5.0;
    const isExceeded = absDiffUsd > usdLimit;
    return {
      exceeded: isExceeded,
      requiresManagerApproval: isExceeded,
      varianceUsd: differenceUsd,
      varianceLbp: Math.round(differenceUsd * currentRate)
    };
  }, [differenceUsd, branchSettings.allowed_usd_variance, currentRate]);

  const handleVerifyManager = async () => {
    if (!managerPin || managerPin.length < 4) {
      setPinError('Please enter a 4-digit Manager PIN');
      return;
    }
    setIsVerifyingPin(true);
    setPinError('');
    try {
      const res = await verifyManagerPin(managerPin);
      if (res.success && res.managerName) {
        setManagerName(res.managerName);
        setPinError('');
      } else {
        setPinError(res.error || 'Invalid manager PIN or insufficient permissions');
      }
    } catch (err: any) {
      setPinError(err.message || 'Error verifying PIN');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleFinalizeClose = async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);

    try {
      const rows = await loadPreparingOrders(shift?.branch_id || branchId, externalBranchId, shift?.restaurant_id, (await loadShiftReportingPeriod(s, await getDrawerTerminalAliases(s.branch_id || branchId, s.terminal_id || terminalId))).endTime);
      setPreparingOrders(rows);
      setPreparingCheckError(null);

      const handover = await loadShiftHandover(s.branch_id || branchId, s.restaurant_id, (await loadShiftReportingPeriod(s, await getDrawerTerminalAliases(s.branch_id || branchId, s.terminal_id || terminalId))).endTime);
      if (handover.blocked) { setErrorMessage(handoverMessage(handover)); setIsFinalizing(false); return; }
    } catch (error: any) {
      setPreparingCheckError(error.message); setErrorMessage('Cannot verify open tables and orders. Retry before closing.');
      setIsFinalizing(false); return;
    }

    if (varianceCheck.requiresManagerApproval && !managerName) {
      setIsFinalizing(false);
      setErrorMessage('⚠️ Manager approval is required due to cash variance exceeding threshold.');
      return;
    }

    setIsFinalizing(true);
    setErrorMessage(null);

    try {
      const fullNotes = varianceNotes
        ? `[${varianceReason}] ${varianceNotes}`
        : varianceReason;

      const activeWalletsArray = Object.entries(walletInputs)
        .map(([walletId, w]: [string, any]) => ({
          wallet_id: walletId,
          amount_usd: n(w.amount_usd),
          amount_lbp: n(w.amount_lbp)
        }))
        .filter(w => w.amount_usd > 0 || w.amount_lbp > 0);

      const closeOpId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'close-' + Date.now();

      const res = await closeShift({
        shiftId: shift.id,
        branchId,
        externalBranchId,

        closeOperationId: closeOpId,
        actualUsd: n(actualUsd),
        actualLbp: n(actualLbp),
        expectedCashUsd: expectedUsd,
        expectedCashLbp: Math.round(expectedUsd * currentRate),
        varianceUsd: differenceUsd,
        varianceLbp: Math.round(differenceUsd * currentRate),
        differenceUsd: differenceUsd,
        closedBy: cashierName,
        approvedBy: managerName || null,
        managerPinVerified: Boolean(managerName),
        blindClosed: branchSettings.blind_cash_close_enabled,
        closingNotes: differenceUsd !== 0 ? fullNotes : null,
        salesLbp: n(salesLbp),
        cashInUsd: n(cashInUsd),
        cashInLbp: n(cashInLbp),
        paymentsUsd: n(paymentsUsd),
        paymentsLbp: n(paymentsLbp),
        cashOutUsd: n(cashOutUsd),
        cashOutLbp: n(cashOutLbp),
        creditCardUsd: n(creditCardUsd),
        creditCardLbp: n(creditCardLbp),
        onCreditLbp: n(onCreditLbp),
        wallets: activeWalletsArray,
        tenderSummary: reconData?.tenders || {},
        kpiSummary: {
          ordersCount: reconData?.ordersCount || 0,
          grossSales: reconData?.grossSales || 0,
          totalDiscounts: reconData?.totalDiscounts || 0,
          totalRefunds: reconData?.totalRefunds || 0,
          netSales: reconData?.netSales || 0,
          avgTicket: reconData?.avgTicket || 0,
          voidCount: reconData?.voidCount || 0,
          voidTotal: reconData?.voidTotal || 0,
          channels: reconData?.channels || {}
        }
      });

      if (!res.success || !res.shift) {
        setErrorMessage(res.error || 'Failed to close shift in database');
        setIsFinalizing(false);
        return;
      }

      // Clear draft on successful close
      const draftKey = `@shift_cash_draft_${branchName}_${date}_${shiftType}`;
      localStorage.removeItem(draftKey);

      // Automatically dispatch Shift Close Report print
      if (reconData) {
        const printPayload = generateShiftReportPrintPayload({
          shift: res.shift,
          reconciliation: reconData,
          isXReport: false,
          actualUsd: n(actualUsd),
          actualLbp: n(actualLbp),
          varianceUsd: differenceUsd,
          varianceLbp: Math.round(differenceUsd * currentRate),
          managerName,
          notes: fullNotes
        });
        printShiftReport(printPayload).catch(() => {});
      }

      onShiftClosed(res.shift, reconData!);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error finalizing shift close');
    } finally {
      setIsFinalizing(false);
    }
  };

  // Active keypad field configuration helper
  const getActiveFieldInfo = () => {
    switch (activeKeypadField) {
      case 'actualUsd':
        return {
          id: 'actualUsd',
          label: 'Actual Cash USD ($)',
          shortLabel: 'Actual USD',
          value: actualUsd,
          currency: 'USD',
          symbol: '$',
          isUsd: true,
          allowDecimal: true,
          isPin: false,
          setValue: (v: string) => setActualUsd(v),
          next: 'actualLbp'
        };
      case 'actualLbp':
        return {
          id: 'actualLbp',
          label: 'Actual Cash LBP (L.L.)',
          shortLabel: 'Actual LBP',
          value: actualLbp,
          currency: 'LBP',
          symbol: 'L.L.',
          isUsd: false,
          allowDecimal: false,
          isPin: false,
          setValue: (v: string) => setActualLbp(v),
          next: 'openingUsd'
        };
      case 'openingUsd':
        return {
          id: 'openingUsd',
          label: 'Opening Cash Float USD ($)',
          shortLabel: 'Opening USD',
          value: openingUsd,
          currency: 'USD',
          symbol: '$',
          isUsd: true,
          allowDecimal: true,
          isPin: false,
          setValue: (v: string) => setOpeningUsd(v),
          next: 'openingLbp'
        };
      case 'openingLbp':
        return {
          id: 'openingLbp',
          label: 'Opening Cash Float LBP (L.L.)',
          shortLabel: 'Opening LBP',
          value: openingLbp,
          currency: 'LBP',
          symbol: 'L.L.',
          isUsd: false,
          allowDecimal: false,
          isPin: false,
          setValue: (v: string) => setOpeningLbp(v),
          next: 'dailySalesUsd'
        };
      case 'dailySalesUsd':
        return {
          id: 'dailySalesUsd',
          label: 'Daily Sales USD ($)',
          shortLabel: 'Daily Sales USD',
          value: salesLbpInUsd > 0 ? (salesLbpInUsd.toFixed(2).replace(/\.00$/, '')) : (salesLbp ? (Number(salesLbp)/currentRate).toFixed(2).replace(/\.00$/, '') : '0'),
          currency: 'USD',
          symbol: '$',
          isUsd: true,
          allowDecimal: true,
          isPin: false,
          setValue: (v: string) => {
            const usdVal = Number(v) || 0;
            setSalesLbp(String(Math.round(usdVal * currentRate)));
          },
          next: 'dailySalesLbp'
        };
      case 'dailySalesLbp':
        return {
          id: 'dailySalesLbp',
          label: 'Daily Sales LBP (L.L.)',
          shortLabel: 'Daily Sales LBP',
          value: salesLbp || '0',
          currency: 'LBP',
          symbol: 'L.L.',
          isUsd: false,
          allowDecimal: false,
          isPin: false,
          setValue: (v: string) => setSalesLbp(v),
          next: 'creditCardUsd'
        };
      case 'creditCardUsd':
        return {
          id: 'creditCardUsd',
          label: 'Credit Card USD ($)',
          shortLabel: 'Card USD',
          value: creditCardUsd,
          currency: 'USD',
          symbol: '$',
          isUsd: true,
          allowDecimal: true,
          isPin: false,
          setValue: (v: string) => setCreditCardUsd(v),
          next: 'creditCardLbp'
        };
      case 'creditCardLbp':
        return {
          id: 'creditCardLbp',
          label: 'Credit Card LBP (L.L.)',
          shortLabel: 'Card LBP',
          value: creditCardLbp,
          currency: 'LBP',
          symbol: 'L.L.',
          isUsd: false,
          allowDecimal: false,
          isPin: false,
          setValue: (v: string) => setCreditCardLbp(v),
          next: 'rate'
        };
      case 'rate':
        return {
          id: 'rate',
          label: 'USD Exchange Rate (LBP / $1)',
          shortLabel: 'Exchange Rate',
          value: rateInputStr,
          currency: 'LBP',
          symbol: 'L.L.',
          isUsd: false,
          allowDecimal: false,
          isPin: false,
          setValue: (v: string) => {
            setRateInputStr(v);
            setRate(Number(v) || 0);
          },
          next: varianceCheck.requiresManagerApproval ? 'managerPin' : 'actualUsd'
        };
      case 'managerPin':
        return {
          id: 'managerPin',
          label: 'Manager Authorization PIN',
          shortLabel: 'Manager PIN',
          value: managerPin,
          currency: 'PIN',
          symbol: '🔑',
          isUsd: false,
          allowDecimal: false,
          isPin: true,
          setValue: (v: string) => setManagerPin(v.slice(0, 6)),
          next: 'actualUsd'
        };
      default:
        if (activeKeypadField.startsWith('wallet_')) {
          const parts = activeKeypadField.split('_');
          const walletId = parts[1];
          const curr = parts[2];
          const w = wallets.find(x => x.id === walletId);
          const isUsd = curr === 'usd';
          return {
            id: activeKeypadField,
            label: `${w?.name || 'Wallet'} ${isUsd ? 'USD ($)' : 'LBP (L.L.)'}`,
            shortLabel: `${w?.name || 'Wallet'} ${isUsd ? 'USD' : 'LBP'}`,
            value: walletInputs[walletId]?.[isUsd ? 'amount_usd' : 'amount_lbp'] || '',
            currency: isUsd ? 'USD' : 'LBP',
            symbol: isUsd ? '$' : 'L.L.',
            isUsd,
            allowDecimal: isUsd,
            isPin: false,
            setValue: (v: string) => {
              setWalletInputs(prev => ({
                ...prev,
                [walletId]: {
                  amount_usd: isUsd ? v : (prev[walletId]?.amount_usd || ''),
                  amount_lbp: !isUsd ? v : (prev[walletId]?.amount_lbp || '')
                }
              }));
            },
            next: 'actualUsd'
          };
        }
        return {
          id: 'actualUsd',
          label: 'Actual Cash USD ($)',
          shortLabel: 'Actual USD',
          value: actualUsd,
          currency: 'USD',
          symbol: '$',
          isUsd: true,
          allowDecimal: true,
          isPin: false,
          setValue: (v: string) => setActualUsd(v),
          next: 'actualLbp'
        };
    }
  };

  const handleKeypadKey = (key: string) => {
    const info = getActiveFieldInfo();
    const val = String(info.value ?? '');

    if (key === 'CLR') {
      info.setValue('0');
      return;
    }
    if (key === 'DEL') {
      const nextVal = val.slice(0, -1);
      info.setValue(nextVal === '' ? '0' : nextVal);
      return;
    }
    if (key === 'NEXT') {
      setActiveKeypadField(info.next);
      return;
    }
    if (key === '.') {
      if (!info.allowDecimal) return;
      if (val.includes('.')) return;
      info.setValue((val === '0' || val === '' ? '0' : val) + '.');
      return;
    }
    if (key === '00') {
      if (val === '0' || val === '') return;
      info.setValue(val + '00');
      return;
    }
    // Digits 0-9
    if (info.isPin) {
      if (val.length >= 6) return;
      info.setValue(val + key);
      return;
    }
    if (val === '0' || val === '') {
      info.setValue(key);
    } else {
      info.setValue(val + key);
    }
  };

  const handleQuickAdd = (num: number) => {
    const info = getActiveFieldInfo();
    if (info.isPin) return;
    const current = Number(info.value) || 0;
    const next = current + num;
    info.setValue(info.allowDecimal ? next.toFixed(2).replace(/\.00$/, '') : String(Math.round(next)));
  };

  // Helper to render touch-tappable data entry field (No virtual OS keyboard!)
  const renderTouchField = (fieldKey: string, label: string, value: string, suffix?: string, subtitle?: string) => {
    const isActive = activeKeypadField === fieldKey;
    const hasValue = value && value !== '0';
    return (
      <div
        onClick={() => setActiveKeypadField(fieldKey)}
        className={`p-2 rounded-xl border transition cursor-pointer select-none flex items-center justify-between min-h-[42px] ${
          isActive
            ? 'bg-emerald-50/80 border-[#1e5c4f] ring-2 ring-[#1e5c4f] shadow-xs'
            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
        }`}
      >
        <div className="min-w-0 pr-1.5 flex-1">
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider truncate ${isActive ? 'text-[#1e5c4f]' : 'text-slate-600'}`}>
              {label}
            </span>
            {subtitle && <span className="text-[10px] text-slate-400 font-medium truncate ml-1">{subtitle}</span>}
          </div>
          <div className={`text-base font-black font-mono leading-tight truncate ${hasValue ? 'text-slate-900' : 'text-slate-400'}`}>
            {hasValue ? (suffix === '$' ? `$${value}` : suffix === 'LBP' ? `${Number(value).toLocaleString()}` : value) : '0'}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {suffix && <span className="text-[11px] font-bold text-slate-400 uppercase">{suffix}</span>}
          {isActive ? (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Active for Keypad" />
          ) : (
            <span className="text-slate-400 text-[10px] bg-slate-100 px-1 py-0.5 rounded border border-slate-200">⌨</span>
          )}
        </div>
      </div>
    );
  };

  // Helper to render locked / read-only fields from Daily Payments
  const renderReadOnlyField = (label: string, value: string | number, suffix?: string, subtitle?: string) => {
    const numVal = Number(value) || 0;
    return (
      <div className="p-2 rounded-xl border border-slate-200 bg-slate-50/90 flex items-center justify-between min-h-[42px] select-none">
        <div className="min-w-0 pr-1.5 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">
              {label}
            </span>
            {subtitle && <span className="text-[10px] text-slate-400 font-medium truncate ml-1">{subtitle}</span>}
          </div>
          <div className={`text-base font-black font-mono leading-tight truncate ${numVal > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
            {suffix === '$' ? `$${numVal.toFixed(2)}` : `${Math.round(numVal).toLocaleString()}`}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {suffix && <span className="text-[11px] font-bold text-slate-400 uppercase">{suffix}</span>}
          <span className="text-slate-400 text-xs" title="Auto-calculated from Payments">🔒</span>
        </div>
      </div>
    );
  };

  if (!isOpen || !shift) return null;

  const activeInfo = getActiveFieldInfo();

  return (
    <div className="fixed inset-0 bg-[#F5F6F4] z-50 flex flex-col h-screen max-h-screen overflow-hidden text-slate-900 select-none">
      <div className="w-full h-full flex flex-col overflow-hidden relative">

        {/* OPEN ENTITIES INFO POPUP — fixed overlay above the full-screen modal */}
        {(openTables.length > 0 || openOrders.length > 0) && showOpenEntitiesPopup && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
            <div className="bg-[#F5F6F4] border-2 border-amber-500/60 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
              {/* Popup Header */}
              <div className={`px-5 py-4 border-b border-slate-200 flex items-center justify-between ${shiftType === 'AM' ? 'bg-blue-50' : 'bg-amber-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 border border-amber-300 rounded-xl text-amber-700">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <div className="font-black text-base text-slate-900">Close Open Tables & Unscheduled Orders</div>
                    <div className="text-xs text-slate-500">Paid tables must still be closed. Scheduled orders may remain open.</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOpenEntitiesPopup(false)}
                  className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-300 flex items-center justify-center transition cursor-pointer flex-shrink-0 shadow-xs"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* ACTIVE TABLES LIST */}
                {openTables.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider block text-slate-700">
                      Active Tables ({openTables.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {openTables.map((t) => (
                        <div key={t.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                          <div className="space-y-1 min-w-0">
                            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>🪑 Table {t.tableCode}</span>
                              <span className="text-xs text-slate-500 font-mono">({t.guestCount} guests)</span>
                              {t.isPaidInAdvance ? (
                                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-extrabold rounded-md">
                                  Paid in Adv (${Number(t.totalAmount || 0).toFixed(2)})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md">
                                  Unpaid
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600">
                              Status: <span className="text-amber-700 font-bold">{t.status}</span>
                              {t.totalAmount > 0 && <span className="ml-1 text-emerald-700 font-mono font-bold">• Total: ${Number(t.totalAmount).toFixed(2)}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            {!t.isPaidInAdvance && (
                              <button
                                type="button"
                                disabled={Boolean(quickSettleLoading)}
                                onClick={() => {
                                  if (!t.orderId) {
                                    setErrorMessage(`Table ${t.tableCode} has no linked order yet to mark paid in advance.`);
                                    return;
                                  }
                                  handleQuickResolve(
                                    { type: 'table', id: t.id, orderId: t.orderId, totalAmount: t.totalAmount },
                                    'advance_cash'
                                  );
                                }}
                                className="px-2.5 py-1.5 min-h-[36px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-1"
                                title="Mark Paid in Advance (Keep Table Occupied)"
                              >
                                ⚡ Paid Adv
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={Boolean(quickSettleLoading)}
                              onClick={() => {
                                setCreditPromptTarget({
                                  type: 'table',
                                  id: t.id,
                                  orderId: t.orderId,
                                  label: `Table ${t.tableCode}`,
                                  defaultName: `Table ${t.tableCode}`
                                });
                                setCreditPromptName(`Table ${t.tableCode}`);
                              }}
                              className="px-2.5 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer transition"
                              title="Save as Credit by Client Name"
                            >
                              📋 Credit
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(quickSettleLoading)}
                              onClick={() => handleQuickResolve({ type: 'table', id: t.id, orderId: t.orderId, totalAmount: t.totalAmount }, 'cash')}
                              className="px-2.5 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black cursor-pointer transition shadow-xs"
                              title="Close & Paid Cash"
                            >
                              💵 Paid Cash
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* OPEN ORDERS LIST */}
                {openOrders.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider block text-slate-700">
                      Open / Held Orders ({openOrders.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {openOrders.map((o) => (
                        <div key={o.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                          <div className="space-y-1 min-w-0">
                            <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>🛍️ #{o.id}</span>
                              <span className="text-slate-700 truncate max-w-[120px]">
                                {o.customer_name || o.table_label || 'Direct Order'}
                              </span>
                              {o.isPaidInAdvance ? (
                                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-extrabold rounded-md">
                                  Paid in Adv
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md">
                                  Unpaid
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-600">
                              Total: <strong className="text-emerald-700">${Number(o.total_amount || 0).toFixed(2)}</strong> • {o.status}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            {!o.isPaidInAdvance && (
                              <button
                                type="button"
                                disabled={Boolean(quickSettleLoading)}
                                onClick={() => handleQuickResolve({ type: 'order', id: o.id, totalAmount: Number(o.total_amount) || 0 }, 'advance_cash')}
                                className="px-2.5 py-1.5 min-h-[36px] bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-1"
                                title="Mark Paid in Advance"
                              >
                                ⚡ Paid Adv
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={Boolean(quickSettleLoading)}
                              onClick={() => {
                                setCreditPromptTarget({
                                  type: 'order',
                                  id: o.id,
                                  label: `Order #${o.id}`,
                                  defaultName: o.customer_name || ''
                                });
                                setCreditPromptName(o.customer_name || '');
                              }}
                              className="px-2.5 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer transition"
                              title="Save as Credit by Client Name"
                            >
                              📋 Credit
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(quickSettleLoading)}
                              onClick={() => handleQuickResolve({ type: 'order', id: o.id, totalAmount: Number(o.total_amount) || 0 }, 'cash')}
                              className="px-2.5 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black cursor-pointer transition shadow-xs"
                              title="Settle as Paid Cash"
                            >
                              💵 Paid Cash
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COMPACT TOP HEADER BAR (h-12 / 48px shrink-0) */}
        <div className="h-12 px-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E9F4ED] text-[#1e5c4f] border border-[#1e5c4f]/20 flex items-center justify-center text-base font-black shrink-0 shadow-2xs">
              🔒
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-900 leading-tight">Close Shift Cash Session</h2>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  disabled={Boolean(s.id)}
                  onClick={() => setShiftType('AM')}
                  className={`px-2 py-0.5 rounded text-[11px] font-black transition ${
                    shiftType === 'AM' ? 'bg-[#1e5c4f] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ☀️ AM
                </button>
                <button
                  type="button"
                  disabled={Boolean(s.id)}
                  onClick={() => setShiftType('PM')}
                  className={`px-2 py-0.5 rounded text-[11px] font-black transition ${
                    shiftType === 'PM' ? 'bg-[#1e5c4f] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🌙 PM
                </button>
              </div>

              {/* PROMINENT DAILY SALES BADGE IN HEADER */}
              <div
                onClick={() => setActiveKeypadField('dailySalesUsd')}
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-mono font-black shadow-2xs cursor-pointer transition ${
                  activeKeypadField.startsWith('dailySales')
                    ? 'bg-emerald-100 border-[#1e5c4f] text-[#1e5c4f] ring-1 ring-[#1e5c4f]'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:border-emerald-300'
                }`}
                title="Daily Sales (Tap to edit on keypad)"
              >
                <span className="font-sans font-black text-emerald-700 uppercase text-[10px]">Daily Sales:</span>
                <span>${salesLbpInUsd.toFixed(2)}</span>
                <span className="text-emerald-600 font-bold text-[11px]">({Number(salesLbp || 0).toLocaleString()} L.L.)</span>
              </div>

              <span className="hidden sm:inline text-xs text-slate-500 font-medium">
                • <strong className="text-slate-700">{branchName}</strong> • {cashierName} • {date}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Open Entities Indicator */}
            {(openTables.length > 0 || openOrders.length > 0) && (
              <button
                type="button"
                onClick={() => setShowOpenEntitiesPopup(true)}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <AlertTriangle size={13} className="text-amber-600" />
                <span>{openTables.length + openOrders.length} Open</span>
              </button>
            )}

            {/* Live Exchange Rate Pill */}
            <div
              onClick={() => setActiveKeypadField('rate')}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold cursor-pointer transition flex items-center gap-1.5 shadow-2xs ${
                activeKeypadField === 'rate'
                  ? 'bg-emerald-50 border-[#1e5c4f] text-[#1e5c4f] ring-1 ring-[#1e5c4f]'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
              }`}
              title="Click to edit exchange rate via keypad"
            >
              <span className="text-slate-400 font-sans text-[11px]">Rate:</span>
              <span>{Number(rate || systemRate).toLocaleString()} L.L.</span>
            </div>

            {/* Get Payments Button */}
            <button
              type="button"
              disabled={fetchingCashFlow}
              onClick={() => handleFetchCashFlow()}
              className="px-2.5 py-1 bg-white hover:bg-slate-50 text-[#1e5c4f] hover:text-[#16473D] border border-slate-300 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Pull supplier payments and cash in/out from Daily Payments"
            >
              <RefreshCw size={12} className={fetchingCashFlow ? 'animate-spin' : ''} />
              <span>{fetchingCashFlow ? 'Fetching...' : '⚡ Get Payments'}</span>
            </button>

            {/* Close Modal Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-300 flex items-center justify-center transition cursor-pointer shadow-2xs"
              title="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* STATUS / NOTICE MESSAGES (shrink-0) */}
        {errorMessage && (
          <div className="px-4 py-1.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900 text-xs">✕</button>
          </div>
        )}
        {cashFlowMessage && (
          <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-200 text-blue-800 text-xs font-bold flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span>ℹ️</span>
              <span>{cashFlowMessage}</span>
            </div>
            <button type="button" onClick={() => setCashFlowMessage(null)} className="text-blue-600 hover:text-blue-900 text-xs">✕</button>
          </div>
        )}

        {/* MAIN BODY: 2 COLUMNS (FLEX-1 MIN-H-0 OVERFLOW-HIDDEN ZERO SCROLL) */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden p-2.5 sm:p-3 gap-2.5 sm:gap-3 bg-[#F5F6F4]">

          {/* LEFT COLUMN: RECONCILIATION & FINANCIAL OVERVIEW (65% width) */}
          <div className="flex-1 min-w-0 flex flex-col justify-between overflow-hidden gap-2.5">

            {/* 1. HERO CASH RECONCILIATION STRIP (4 CARDS) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
              {/* CARD 1: ACTUAL USD (TAPPABLE -> KEYPAD) */}
              <div
                onClick={() => setActiveKeypadField('actualUsd')}
                className={`p-3 rounded-2xl border-2 transition cursor-pointer select-none flex flex-col justify-between min-h-[92px] ${
                  activeKeypadField === 'actualUsd'
                    ? 'bg-emerald-50/90 border-[#1e5c4f] ring-2 ring-[#1e5c4f] shadow-md'
                    : 'bg-white border-slate-200 hover:border-[#1e5c4f]/50 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black uppercase tracking-wider ${
                    activeKeypadField === 'actualUsd' ? 'text-[#1e5c4f]' : 'text-slate-600'
                  }`}>
                    Actual Cash USD
                  </span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                    activeKeypadField === 'actualUsd' ? 'bg-[#1e5c4f] text-white animate-pulse' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {activeKeypadField === 'actualUsd' ? '● Active' : 'Tap to edit'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                    ${actualUsd || '0'}
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase font-mono">USD ($)</span>
                </div>
              </div>

              {/* CARD 2: ACTUAL LBP (TAPPABLE -> KEYPAD) */}
              <div
                onClick={() => setActiveKeypadField('actualLbp')}
                className={`p-3 rounded-2xl border-2 transition cursor-pointer select-none flex flex-col justify-between min-h-[92px] ${
                  activeKeypadField === 'actualLbp'
                    ? 'bg-emerald-50/90 border-[#1e5c4f] ring-2 ring-[#1e5c4f] shadow-md'
                    : 'bg-white border-slate-200 hover:border-[#1e5c4f]/50 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black uppercase tracking-wider ${
                    activeKeypadField === 'actualLbp' ? 'text-[#1e5c4f]' : 'text-slate-600'
                  }`}>
                    Actual Cash LBP
                  </span>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                    activeKeypadField === 'actualLbp' ? 'bg-[#1e5c4f] text-white animate-pulse' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {activeKeypadField === 'actualLbp' ? '● Active' : 'Tap to edit'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 tracking-tight truncate">
                    {Number(actualLbp || 0).toLocaleString()}
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase font-mono shrink-0 ml-1">L.L.</span>
                </div>
              </div>

              {/* CARD 3: EXPECTED IN DRAWER */}
              <div className="p-3 rounded-2xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between min-h-[92px] select-none">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <span>Expected in Drawer</span>
                  <span className="text-[10px] text-slate-400 font-sans">Formula</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                    ${expectedUsd.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono font-medium truncate mt-0.5">
                    ≈ {Math.round(expectedUsd * currentRate).toLocaleString()} L.L.
                  </div>
                </div>
              </div>

              {/* CARD 4: CASH VARIANCE */}
              <div className={`p-3 rounded-2xl border-2 shadow-2xs flex flex-col justify-between min-h-[92px] select-none ${
                differenceUsd === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : differenceUsd > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider">Variance</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    differenceUsd === 0
                      ? 'bg-emerald-200 text-emerald-900'
                      : differenceUsd > 0
                      ? 'bg-emerald-200 text-emerald-900'
                      : 'bg-rose-200 text-rose-900'
                  }`}>
                    {differenceUsd === 0 ? '✓ Balanced' : differenceUsd > 0 ? 'Surplus' : 'Shortage'}
                  </span>
                </div>
                <div>
                  <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                    differenceUsd === 0 ? 'text-emerald-700' : differenceUsd > 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {differenceUsd >= 0 ? '+' : ''}${differenceUsd.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono font-medium opacity-80 truncate mt-0.5">
                    {differenceUsd >= 0 ? '+' : ''}{Math.round(differenceUsd * currentRate).toLocaleString()} L.L.
                  </div>
                </div>
              </div>
            </div>

            {/* 2. MANAGER AUTHORIZATION STRIP (IF VARIANCE EXCEEDS THRESHOLD, shrink-0) */}
            {varianceCheck.requiresManagerApproval && (
              <div className="px-3.5 py-2.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between gap-3 shrink-0 shadow-2xs">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs shrink-0">
                  <ShieldCheck size={16} className="text-amber-700" />
                  <span>Manager Approval (Variance &gt; ${branchSettings.allowed_usd_variance ?? 5.00})</span>
                </div>

                <div className="flex items-center gap-2 flex-1 justify-end">
                  <select
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-bold outline-none shadow-2xs max-w-[180px]"
                  >
                    <option value="Counting difference">Counting difference</option>
                    <option value="Unrecorded payout">Unrecorded payout</option>
                    <option value="Customer change error">Customer change error</option>
                    <option value="Approved cashier shortage">Approved cashier shortage</option>
                  </select>

                  <div
                    onClick={() => setActiveKeypadField('managerPin')}
                    className={`px-3 py-1.5 rounded-lg border font-mono font-black text-sm tracking-widest cursor-pointer transition min-w-[90px] text-center shadow-2xs ${
                      activeKeypadField === 'managerPin'
                        ? 'bg-amber-100 border-amber-500 text-amber-950 ring-2 ring-amber-400'
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                    title="Tap to type PIN on Keypad"
                  >
                    {managerPin ? '●'.repeat(managerPin.length) : <span className="text-slate-400 text-xs tracking-normal font-sans">PIN...</span>}
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyManager}
                    disabled={isVerifyingPin || !managerPin}
                    className={`px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer shadow-2xs ${
                      managerName ? 'bg-emerald-600 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {managerName ? '✓ Approved' : isVerifyingPin ? '...' : 'Verify'}
                  </button>
                  {managerName && <span className="text-xs text-emerald-800 font-bold shrink-0">({managerName})</span>}
                  {pinError && <span className="text-xs text-rose-600 font-bold shrink-0">{pinError}</span>}
                </div>
              </div>
            )}

            {/* 3. COMPACT FINANCIAL DETAILS GRID (2 EQUAL CARDS, FLEX-1 OVERFLOW-HIDDEN) */}
            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-hidden">

              {/* CARD A: FLOAT & CASH INFLOWS / OUTFLOWS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col justify-between overflow-hidden shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span>📥</span>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Opening Float & Cash Flow
                    </h3>
                  </div>
                  {shiftType === 'PM' && amShiftData && (
                    <button
                      type="button"
                      onClick={() => {
                        if (amShiftData.actual_usd != null) setOpeningUsd(String(amShiftData.actual_usd));
                        if (amShiftData.actual_lbp != null) setOpeningLbp(String(amShiftData.actual_lbp));
                      }}
                      className="px-2 py-0.5 bg-[#E9F4ED] hover:bg-[#d8ece0] border border-[#1e5c4f]/30 text-[#1e5c4f] rounded text-[10px] font-bold cursor-pointer transition"
                      title="Set PM opening float from AM actual closing cash"
                    >
                      ⎘ Copy AM Float
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 flex-1 pt-1.5 overflow-hidden">
                  {/* EDITABLE OPENING FLOAT */}
                  {renderTouchField('openingUsd', 'Opening USD', openingUsd, '$', 'Float')}
                  {renderTouchField('openingLbp', 'Opening LBP', openingLbp, 'LBP', 'Float')}

                  {/* CASH IN (FROM PAYMENTS) */}
                  {renderReadOnlyField('Cash In USD', cashInUsd, '$', 'From Payments')}
                  {renderReadOnlyField('Cash In LBP', cashInLbp, 'LBP', 'From Payments')}

                  {/* SUPPLIER PAYOUTS (FROM PAYMENTS) */}
                  {renderReadOnlyField('Supplier USD', paymentsUsd, '$', 'Payout')}
                  {renderReadOnlyField('Supplier LBP', paymentsLbp, 'LBP', 'Payout')}

                  {/* CASH OUT (FROM PAYMENTS) */}
                  {renderReadOnlyField('Cash Out USD', cashOutUsd, '$', 'Expense')}
                  {renderReadOnlyField('Cash Out LBP', cashOutLbp, 'LBP', 'Expense')}
                </div>
              </div>

              {/* CARD B: DAILY SALES & NON-CASH TENDERS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col justify-between overflow-hidden shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span>📊</span>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Daily Sales & Non-Cash Tenders
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => checkOpenEntitiesAndSales(rate || systemRate)}
                    disabled={checkingEntities}
                    className="text-[11px] text-[#1e5c4f] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    title="Refresh sales directly from POS orders"
                  >
                    <RefreshCw size={11} className={checkingEntities ? 'animate-spin' : ''} />
                    <span>Sync Orders</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 flex-1 pt-1.5 overflow-hidden">
                  {/* DAILY SALES (USD & LBP, TAP-EDITABLE VIA KEYPAD & AUTO-SEEDED FROM ORDERS) */}
                  {renderTouchField(
                    'dailySalesUsd',
                    'Daily Sales USD',
                    salesLbpInUsd > 0 ? salesLbpInUsd.toFixed(2).replace(/\.00$/, '') : (salesLbp ? (Number(salesLbp)/currentRate).toFixed(2).replace(/\.00$/, '') : '0'),
                    '$',
                    'From Orders'
                  )}
                  {renderTouchField(
                    'dailySalesLbp',
                    'Daily Sales LBP',
                    salesLbp || '0',
                    'LBP',
                    'From Orders'
                  )}

                  {/* CREDIT CARDS (EDITABLE VIA KEYPAD) */}
                  {renderTouchField('creditCardUsd', 'Credit Card USD', creditCardUsd, '$')}
                  {renderTouchField('creditCardLbp', 'Credit Card LBP', creditCardLbp, 'LBP')}

                  {/* ON CREDIT / RECEIVABLES */}
                  {renderReadOnlyField('On Credit USD', onCreditLbpInUsd, '$', 'Receivable')}
                  {renderReadOnlyField('On Credit LBP', onCreditLbp, 'LBP', 'Receivable')}

                  {/* EQUATION FORMULA SUMMARY WITH DAILY SALES EXPLICITLY INCLUDED */}
                  <div className="col-span-2 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-mono text-slate-700">
                    <span className="font-sans font-bold text-slate-500 text-[11px]">Equation:</span>
                    <span className="font-bold truncate">
                      Float (${totalOpeningUsd.toFixed(0)}) + Sales (${salesLbpInUsd.toFixed(0)}) + In (${totalCashInUsd.toFixed(0)}) - Out (${totalOutflowsUsd.toFixed(0)}) = <strong className="text-slate-900">${expectedUsd.toFixed(2)}</strong>
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: DEDICATED POS ON-SCREEN KEYPAD (35% width, w-[360px] to w-[390px]) */}
          <div className="w-full md:w-[350px] lg:w-[380px] shrink-0 flex flex-col bg-white border border-slate-200 rounded-2xl p-3 shadow-xs justify-between overflow-hidden">

            {/* KEYPAD HEADER: CURRENTLY ACTIVE FIELD DISPLAY */}
            <div className="bg-slate-50 border-2 border-[#1e5c4f]/30 rounded-xl p-3 shrink-0 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 truncate max-w-[200px]">
                    {activeInfo.shortLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDenomHelper(true)}
                  className="px-2 py-0.5 bg-[#E9F4ED] hover:bg-[#d8ece0] text-[#1e5c4f] border border-[#1e5c4f]/30 rounded text-[10px] font-black transition flex items-center gap-1 cursor-pointer"
                  title="Open denomination calculator to count bills"
                >
                  <Calculator size={11} />
                  <span>Bills Counter</span>
                </button>
              </div>

              <div className="flex items-baseline justify-between font-mono mt-1">
                <span className="text-xs font-bold text-slate-400 uppercase">{activeInfo.symbol}</span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">
                  {activeInfo.isPin ? ('●'.repeat(activeInfo.value.length) || '••••') : (activeInfo.value || '0')}
                </span>
                <button
                  type="button"
                  onClick={() => handleKeypadKey('CLR')}
                  className="text-xs text-slate-400 hover:text-slate-800 font-bold px-1.5 py-0.5 rounded hover:bg-slate-200 transition"
                  title="Clear field to 0"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* QUICK SHORTCUT BUTTONS (USD OR LBP BILLS) */}
            <div className="grid grid-cols-6 gap-1 my-2 shrink-0">
              {activeInfo.isUsd ? (
                <>
                  {[1, 5, 10, 20, 50, 100].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAdd(amt)}
                      className="py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-black font-mono text-xs transition active:scale-95 shadow-2xs"
                    >
                      +${amt}
                    </button>
                  ))}
                </>
              ) : activeInfo.id === 'managerPin' ? (
                <div className="col-span-6 text-center text-xs text-amber-800 font-bold py-1 bg-amber-50 rounded-lg border border-amber-200">
                  Enter 4 to 6 digit Manager PIN
                </div>
              ) : (
                <>
                  {[10000, 20000, 50000, 100000, 500000, 1000000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAdd(amt)}
                      className="py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-black font-mono text-xs transition active:scale-95 shadow-2xs truncate"
                    >
                      +{amt >= 1000000 ? '1M' : `${amt/1000}k`}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* MAIN NUMERIC KEYPAD GRID (3 COLUMNS x 4 ROWS) */}
            <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
              {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleKeypadKey(k)}
                  className="rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 font-black font-mono text-xl sm:text-2xl flex items-center justify-center transition active:scale-95 shadow-2xs select-none"
                >
                  {k}
                </button>
              ))}

              {/* ROW 4: DECIMAL (OR EMPTY IF NOT ALLOWED), 0, 00 */}
              <button
                type="button"
                onClick={() => handleKeypadKey('.')}
                disabled={!activeInfo.allowDecimal}
                className={`rounded-xl border font-black font-mono text-xl sm:text-2xl flex items-center justify-center transition active:scale-95 select-none ${
                  activeInfo.allowDecimal
                    ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900 shadow-2xs'
                    : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                }`}
              >
                .
              </button>

              <button
                type="button"
                onClick={() => handleKeypadKey('0')}
                className="rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 font-black font-mono text-xl sm:text-2xl flex items-center justify-center transition active:scale-95 shadow-2xs select-none"
              >
                0
              </button>

              <button
                type="button"
                onClick={() => handleKeypadKey('00')}
                disabled={activeInfo.isPin}
                className={`rounded-xl border font-black font-mono text-lg sm:text-xl flex items-center justify-center transition active:scale-95 select-none ${
                  !activeInfo.isPin
                    ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900 shadow-2xs'
                    : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                }`}
                title="Add 00"
              >
                00
              </button>
            </div>

            {/* KEYPAD BOTTOM ACTION BAR */}
            <div className="grid grid-cols-3 gap-2 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => handleKeypadKey('DEL')}
                className="h-12 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-black text-sm flex items-center justify-center gap-1 transition active:scale-95 shadow-2xs"
                title="Backspace (Delete last digit)"
              >
                <span>⌫</span>
                <span>Del</span>
              </button>

              <button
                type="button"
                onClick={() => handleKeypadKey('CLR')}
                className="h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-sm flex items-center justify-center transition active:scale-95 shadow-2xs"
                title="Reset field to 0"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => handleKeypadKey('NEXT')}
                className="h-12 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-sm flex items-center justify-center gap-1 transition active:scale-95 shadow-xs"
                title="Advance to next field"
              >
                <span>Next</span>
                <span>❯</span>
              </button>
            </div>

          </div>

        </div>

        {/* BOTTOM ACTION BAR (h-[52px] shrink-0) */}
        <div className="h-[52px] px-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-2xs transition cursor-pointer"
            >
              Cancel
            </button>
            {onHoldShift && canHoldPreviousPm(shift) && (
              <button
                type="button"
                disabled={isHolding || isFinalizing}
                onClick={async () => {
                  const reason = window.prompt("Enter handover note for Manager Audit (e.g. night shift pending count):");
                  if (reason === null) return;
                  setIsHolding(true);
                  try {
                    const res = await onHoldShift(reason);
                    if (res.success) {
                      onClose();
                    } else {
                      alert(res.error || "Failed to put shift on hold.");
                    }
                  } catch (e: any) {
                    alert(e?.message || "Failed to hold shift.");
                  } finally {
                    setIsHolding(false);
                  }
                }}
                className="h-9 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl border border-amber-300 shadow-2xs transition flex items-center gap-1 cursor-pointer"
                title="Put this shift on hold for Manager review and free the terminal"
              >
                <PauseCircle size={14} />
                <span>{isHolding ? 'Holding...' : '⏸️ Put on Hold'}</span>
              </button>
            )}

            <div role="status" className="text-xs text-amber-800 font-bold hidden sm:inline truncate max-w-xs">
              {checkingPreparation ? 'Checking preparing orders…' : preparingCheckError ? `⚠️ ${preparingCheckError}` : preparation.pending.length > 0 ? (
                <span><strong>{preparation.pending.length} preparing/paid.</strong></span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(openTables.length > 0 || openOrders.length > 0) && (
              <span className="text-xs text-rose-700 font-black hidden sm:inline">
                ⚠️ Close open tables & orders first
              </span>
            )}

            <button
              type="button"
              disabled={isFinalizing || checkingPreparation || Boolean(preparingCheckError) || (shiftType === 'PM' && unpaidCount > 0) || (varianceCheck.requiresManagerApproval && !managerName)}
              onClick={handleFinalizeClose}
              title={
                shiftType === 'PM' && unpaidCount > 0
                  ? 'All tables and unscheduled orders must be closed. Scheduled orders may remain open.'
                  : varianceCheck.requiresManagerApproval && !managerName
                  ? 'Manager authorization PIN required'
                  : undefined
              }
              className="h-9 px-6 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              {isFinalizing ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{isFinalizing ? 'Closing Shift...' : 'Submit & Close Shift'}</span>
            </button>
          </div>
        </div>

        {/* QUICK CREDIT CLIENT NAME PROMPT */}
        {creditPromptTarget && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-[#F5F6F4] border-2 border-amber-500/80 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl text-slate-900 animate-in zoom-in-95">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  <h3 className="text-sm font-black text-slate-900">Save {creditPromptTarget.label} as Credit</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCreditPromptTarget(null)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Client / Customer Name <span className="text-rose-400">* Required</span>
                </label>
                <input
                  type="text"
                  value={creditPromptName}
                  onChange={(e) => setCreditPromptName(e.target.value)}
                  placeholder="Enter client name (e.g. Elie Khoury)..."
                  className="w-full bg-white border border-slate-200 focus:border-amber-500 rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreditPromptTarget(null)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!creditPromptName.trim() || Boolean(quickSettleLoading)}
                  onClick={() => handleQuickResolve(creditPromptTarget, 'credit', creditPromptName.trim())}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl disabled:opacity-40 cursor-pointer"
                >
                  {quickSettleLoading ? 'Saving...' : 'Confirm & Save as Credit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DENOMINATION HELPER MODAL (TOUCH-FRIENDLY ZERO-KEYBOARD STEP COUNTERS) */}
        {showDenomHelper && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#F5F6F4] border border-slate-300 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col p-5 text-slate-900 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-600">
                    <Calculator size={18} />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 leading-tight">Cash Denomination Breakdown</h3>
                    <p className="text-xs text-slate-500">Tap + or - to count bills effortlessly (No keyboard needed)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDenomHelper(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200 text-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
                {/* USD Bills */}
                <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">USD Bills</span>
                    <button
                      type="button"
                      onClick={() => setUsdDenoms({ '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, '1': 0 })}
                      className="text-[10px] text-slate-400 hover:text-rose-600 font-bold underline"
                    >
                      Reset USD
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {['100', '50', '20', '10', '5', '1'].map((bill) => (
                      <div key={bill} className="flex items-center justify-between gap-1.5 py-0.5 text-xs">
                        <span className="w-10 font-bold font-mono text-slate-700">${bill}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setUsdDenoms(prev => ({ ...prev, [bill]: Math.max(0, (prev[bill] || 0) - 1) }))}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center border border-slate-200 active:scale-95 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-black text-sm text-slate-900">
                            {usdDenoms[bill] || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() => setUsdDenoms(prev => ({ ...prev, [bill]: (prev[bill] || 0) + 1 }))}
                            className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center border border-emerald-300 active:scale-95 cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setUsdDenoms(prev => ({ ...prev, [bill]: (prev[bill] || 0) + 5 }))}
                            className="px-1.5 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center border border-slate-200 active:scale-95 cursor-pointer"
                          >
                            +5
                          </button>
                        </div>
                        <span className="w-16 text-right font-mono font-bold text-slate-600 text-xs">
                          ${(Number(bill) * (usdDenoms[bill] || 0)).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-xs">
                    <span className="text-slate-600">USD Total:</span>
                    <span className="text-emerald-700 font-mono text-sm font-black">${calcDenomUsd()}</span>
                  </div>
                </div>

                {/* LBP Bills */}
                <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-xs font-black text-amber-700 uppercase tracking-wider">LBP Banknotes</span>
                    <button
                      type="button"
                      onClick={() => setLbpDenoms({ '100000': 0, '50000': 0, '20000': 0, '10000': 0, '5000': 0 })}
                      className="text-[10px] text-slate-400 hover:text-rose-600 font-bold underline"
                    >
                      Reset LBP
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {['100000', '50000', '20000', '10000', '5000'].map((bill) => (
                      <div key={bill} className="flex items-center justify-between gap-1.5 py-0.5 text-xs">
                        <span className="w-10 font-bold font-mono text-slate-700">{(Number(bill)/1000)}k</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setLbpDenoms(prev => ({ ...prev, [bill]: Math.max(0, (prev[bill] || 0) - 1) }))}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center border border-slate-200 active:scale-95 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-black text-sm text-slate-900">
                            {lbpDenoms[bill] || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() => setLbpDenoms(prev => ({ ...prev, [bill]: (prev[bill] || 0) + 1 }))}
                            className="w-7 h-7 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-black text-xs flex items-center justify-center border border-amber-300 active:scale-95 cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => setLbpDenoms(prev => ({ ...prev, [bill]: (prev[bill] || 0) + 5 }))}
                            className="px-1.5 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center border border-slate-200 active:scale-95 cursor-pointer"
                          >
                            +5
                          </button>
                        </div>
                        <span className="w-20 text-right font-mono font-bold text-slate-600 text-[11px]">
                          {(Number(bill) * (lbpDenoms[bill] || 0)).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-xs">
                    <span className="text-slate-600">LBP Total:</span>
                    <span className="text-amber-700 font-mono text-sm font-black">{calcDenomLbp().toLocaleString()} L.L.</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDenomHelper(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyDenomTotals}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all active:scale-[0.98]"
                >
                  Apply Count to Drawer
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

