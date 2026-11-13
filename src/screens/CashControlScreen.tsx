import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, AlertTriangle, RefreshCw, 
  CheckCircle2, Shield, Calendar, Layers, FileText, 
  Activity, Scale, Eye, Award, CheckSquare, XCircle, Clock,
  ArrowRightLeft, Landmark, Wallet, PlusCircle, AlertCircle,
  HelpCircle, ChevronRight, Check, X, ShieldAlert
} from 'lucide-react';
import { cashReconciliationApi } from '../api/cashReconciliationApi';
import type { 
  DailyRevenueReconciliationSnapshot, 
  CashShiftItem, 
  CashCustodyTransferItem, 
  OrderTenderReceivableItem, 
  SettlementBatchItem, 
  SettlementExceptionItem 
} from '../api/cashReconciliationApi';
import { api } from '../api/client';

export default function CashControlScreen({ user, permissions }: { user: any; permissions: any }) {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'overview' | 'drawers' | 'safe' | 'tenders' | 'settlements'>('overview');

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Data states
  const [snapshot, setSnapshot] = useState<DailyRevenueReconciliationSnapshot | null>(null);
  const [shifts, setShifts] = useState<CashShiftItem[]>([]);
  const [transfers, setTransfers] = useState<CashCustodyTransferItem[]>([]);
  const [tenders, setTenders] = useState<OrderTenderReceivableItem[]>([]);
  const [batches, setBatches] = useState<SettlementBatchItem[]>([]);
  const [exceptions, setExceptions] = useState<SettlementExceptionItem[]>([]);
  const [safeBalance, setSafeBalance] = useState<{ balance_usd: number; balance_lbp: number }>({ balance_usd: 0, balance_lbp: 0 });

  // Modals
  const [showBlindCountModal, setShowBlindCountModal] = useState<boolean>(false);
  const [selectedShiftForCount, setSelectedShiftForCount] = useState<CashShiftItem | null>(null);
  const [countUsd, setCountUsd] = useState<string>('0');
  const [countLbp, setCountLbp] = useState<string>('0');
  const [countNotes, setCountNotes] = useState<string>('');

  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferType, setTransferType] = useState<'DRAWER_TO_SAFE' | 'SAFE_TO_BANK'>('DRAWER_TO_SAFE');
  const [transferAmount, setTransferAmount] = useState<string>('0');
  const [transferCurrency, setTransferCurrency] = useState<string>('USD');
  const [transferRef, setTransferRef] = useState<string>('');
  const [transferShiftId, setTransferShiftId] = useState<string>('');

  const [showBankConfirmModal, setShowBankConfirmModal] = useState<boolean>(false);
  const [bankConfirmAmount, setBankConfirmAmount] = useState<string>('0');
  const [bankConfirmCurrency, setBankConfirmCurrency] = useState<string>('USD');
  const [bankReference, setBankReference] = useState<string>('');
  const [depositType, setDepositType] = useState<'PHYSICAL_CASH' | 'ELECTRONIC_SETTLEMENT'>('PHYSICAL_CASH');

  const [showPettyCashModal, setShowPettyCashModal] = useState<boolean>(false);
  const [pettyCashShiftId, setPettyCashShiftId] = useState<string>('');
  const [pettyCashAmount, setPettyCashAmount] = useState<string>('0');
  const [pettyCashCurrency, setPettyCashCurrency] = useState<string>('USD');
  const [pettyCashReason, setPettyCashReason] = useState<string>('');

  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenShiftId, setReopenShiftId] = useState<string>('');
  const [reopenReason, setReopenReason] = useState<string>('');

  const restaurantId = user?.restaurant_id || user?.restaurants?.id || 'rest-brime-01';

  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await api.getBranches();
        const bList = Array.isArray(res) ? res : (res?.data || []);
        setBranches(bList);
        if (bList && bList.length > 0) {
          const defaultB = user?.branch_id || bList[0].id;
          setSelectedBranch(defaultB);
        } else {
          setSelectedBranch('badaro-central');
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
        setSelectedBranch('badaro-central');
      }
    }
    loadBranches();
  }, [user]);

  const loadData = async () => {
    const activeRestId = restaurantId || 'rest-brime-01';
    const activeBranchId = selectedBranch || 'badaro-central';
    setLoading(true);
    try {
      const [snapRes, shiftRes, transRes, tenderRes, batchRes, exRes, safeRes] = await Promise.all([
        cashReconciliationApi.getReconciliationSnapshot(activeRestId, activeBranchId, selectedDate),
        cashReconciliationApi.getCashShifts(activeRestId, activeBranchId, selectedDate),
        cashReconciliationApi.getCustodyTransfers(activeRestId, activeBranchId, selectedDate),
        cashReconciliationApi.getOrderTenderReceivables(activeRestId, activeBranchId, selectedDate),
        cashReconciliationApi.getSettlementBatches(activeRestId, activeBranchId),
        cashReconciliationApi.getSettlementExceptions(activeRestId, activeBranchId),
        cashReconciliationApi.getSafeBalance(activeRestId, activeBranchId)
      ]);

      setSnapshot(snapRes);
      setShifts(shiftRes);
      setTransfers(transRes);
      setTenders(tenderRes);
      setBatches(batchRes);
      setExceptions(exRes);
      setSafeBalance(safeRes);
    } catch (err) {
      console.error('Failed to load cash reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [restaurantId, selectedBranch, selectedDate]);

  const handleRebuildSnapshot = async () => {
    const activeRestId = restaurantId || 'rest-brime-01';
    const activeBranchId = selectedBranch || 'badaro-central';
    setActionLoading(true);
    try {
      await cashReconciliationApi.rebuildDailySnapshot(activeRestId, activeBranchId, selectedDate);
      await loadData();
    } catch (err) {
      alert('Snapshot rebuild failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitBlindCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !selectedShiftForCount) return;
    setActionLoading(true);
    try {
      await cashReconciliationApi.submitBlindCount(
        restaurantId,
        selectedShiftForCount.cash_shift_id,
        parseFloat(countUsd) || 0,
        parseFloat(countLbp) || 0,
        countNotes
      );
      setShowBlindCountModal(false);
      setSelectedShiftForCount(null);
      await loadData();
    } catch (err) {
      alert('Blind count submission failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewShift = async (shiftId: string, action: 'APPROVE' | 'REJECT') => {
    if (!restaurantId) return;
    const notes = prompt(`Enter review notes for ${action}:`);
    if (notes === null) return;
    setActionLoading(true);
    try {
      await cashReconciliationApi.reviewShiftClose(restaurantId, shiftId, action, notes);
      await loadData();
    } catch (err) {
      alert('Review action failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !reopenShiftId || !reopenReason) return;
    setActionLoading(true);
    try {
      await cashReconciliationApi.reopenCashShift(restaurantId, reopenShiftId, reopenReason);
      setShowReopenModal(false);
      setReopenReason('');
      setReopenShiftId('');
      await loadData();
    } catch (err) {
      alert('Reopening shift failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !selectedBranch) return;
    setActionLoading(true);
    try {
      await cashReconciliationApi.executeCustodyTransfer({
        restaurantId,
        branchId: selectedBranch,
        businessDate: selectedDate,
        transferType,
        sourceType: transferType === 'DRAWER_TO_SAFE' ? 'DRAWER' : 'SAFE',
        sourceId: transferType === 'DRAWER_TO_SAFE' ? (transferShiftId || 'DRAWER_MAIN') : 'SAFE_MAIN',
        destType: transferType === 'DRAWER_TO_SAFE' ? 'SAFE' : 'BANK',
        destId: transferType === 'DRAWER_TO_SAFE' ? 'SAFE_MAIN' : 'BANK_ACCOUNT_PRIMARY',
        currency: transferCurrency,
        amount: parseFloat(transferAmount) || 0,
        reference: transferRef || `TRANS-${Date.now()}`
      });
      setShowTransferModal(false);
      setTransferAmount('0');
      setTransferRef('');
      await loadData();
    } catch (err) {
      alert('Transfer execution failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmBankCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !selectedBranch) return;
    setActionLoading(true);
    try {
      await cashReconciliationApi.confirmBankCollection({
        restaurantId,
        branchId: selectedBranch,
        depositType,
        amount: parseFloat(bankConfirmAmount) || 0,
        currency: bankConfirmCurrency,
        bankReference
      });
      setShowBankConfirmModal(false);
      setBankConfirmAmount('0');
      setBankReference('');
      await loadData();
    } catch (err) {
      alert('Bank confirmation failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePettyCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !selectedBranch || !pettyCashShiftId) return;
    setActionLoading(true);
    try {
      await cashReconciliationApi.recordPettyCash({
        restaurantId,
        branchId: selectedBranch,
        shiftId: pettyCashShiftId,
        currency: pettyCashCurrency,
        amount: parseFloat(pettyCashAmount) || 0,
        reason: pettyCashReason,
        expenseCategory: 'CONTROLLABLE_VARIABLE'
      });
      setShowPettyCashModal(false);
      setPettyCashAmount('0');
      setPettyCashReason('');
      await loadData();
    } catch (err) {
      alert('Petty cash recording failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMatchBatch = async (batchId: string) => {
    if (!restaurantId) return;
    setActionLoading(true);
    try {
      const res = await cashReconciliationApi.executeDeterministicMatching(restaurantId, batchId);
      alert(`Matching executed: ${res?.matched_count || 0} items allocated.`);
      await loadData();
    } catch (err) {
      alert('Matching failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Cash Control & Settlement Reconciliation
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Phase 11
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Deterministic cash custody lifecycle, split-tender accounting, blind drawer balancing, and electronic settlement reconciliation.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-lg border shadow-sm">
            <Calendar size={16} className="text-slate-400 ml-1" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-sm bg-transparent border-none outline-none font-medium"
            />
          </div>

          <select 
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="text-sm bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border shadow-sm font-medium outline-none"
          >
            {Array.isArray(branches) && branches.map(b => (
              <option key={b.id} value={b.id}>{b.name || b.code}</option>
            ))}
          </select>

          <button
            onClick={handleRebuildSnapshot}
            disabled={actionLoading || loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
            title="Rebuild Daily Reconciliation Snapshot"
          >
            <RefreshCw size={15} className={actionLoading ? 'animate-spin' : ''} />
            <span>Rebuild Snapshot</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 gap-2">
        {[
          { key: 'overview', label: 'Revenue & Custody Stack', icon: <Scale size={16} /> },
          { key: 'drawers', label: 'Drawer Shifts & Blind Counts', icon: <Wallet size={16} /> },
          { key: 'safe', label: 'Safe Custody & Bank Transit', icon: <Landmark size={16} /> },
          { key: 'tenders', label: 'Split-Tender Receivables', icon: <FileText size={16} /> },
          { key: 'settlements', label: 'Settlement Batches & Exceptions', icon: <ShieldAlert size={16} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key 
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & CUSTODY STACK */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Snapshot Status Bar */}
          {snapshot && (
            <div className={`p-4 rounded-xl border flex items-center justify-between ${
              snapshot.status === 'COMPLETE' 
                ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' 
                : snapshot.status === 'FAILED'
                ? 'bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                : 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
            }`}>
              <div className="flex items-center gap-3">
                {snapshot.status === 'COMPLETE' ? (
                  <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={24} />
                ) : (
                  <AlertCircle className="text-amber-600 dark:text-amber-400" size={24} />
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Reconciliation Snapshot: {snapshot.status} (v{snapshot.run_version})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Business Date: {snapshot.business_date} • Last reconciled {new Date(snapshot.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              {snapshot.error_message && (
                <div className="text-xs text-red-600 font-mono bg-red-100 px-3 py-1 rounded max-w-md">
                  {snapshot.error_message}
                </div>
              )}
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">POS Gross Sales</span>
              <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">
                ${Number(snapshot?.total_pos_gross_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-slate-400">Canonical order line aggregate</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tendered (USD)</span>
              <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                ${Number(snapshot?.total_tendered_amount_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-slate-400">Split-tender receivable grain</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Settled vs Unsettled</span>
              <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <span>${Number(snapshot?.total_settled_amount_usd || 0).toFixed(2)}</span>
                <span className="text-xs font-normal text-slate-400">/</span>
                <span className="text-amber-600 dark:text-amber-400">${Number(snapshot?.total_unsettled_amount_usd || 0).toFixed(2)}</span>
              </div>
              <span className="text-xs text-slate-400">Settled / Outstanding</span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Over / Short</span>
              <div className={`text-2xl font-bold mt-1 ${
                (snapshot?.total_cash_over_short_usd || 0) < 0 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'
              }`}>
                ${Number(snapshot?.total_cash_over_short_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-slate-400">Drawer variance aggregate</span>
            </div>
          </div>

          {/* Dual-Currency Physical Cash Custody Stack */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Landmark size={18} className="text-blue-500" />
                  Dual-Currency Physical Cash Custody Stack
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Physical money lifecycle from cashier drawer through vault custody to confirmed bank receipt.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x border-b">
              {/* Drawer Cash */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                  <span>1. Drawer Cash</span>
                  <Wallet size={16} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    ${Number(snapshot?.drawer_cash_balance_usd || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    LBP {Number(snapshot?.drawer_cash_balance_lbp || 0).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-slate-400">Active floats & uncollected cash</div>
              </div>

              {/* Safe Cash */}
              <div className="p-4 space-y-2 bg-slate-50/50 dark:bg-slate-900/20">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                  <span>2. Safe Vault</span>
                  <Shield size={16} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    ${Number(snapshot?.safe_cash_balance_usd || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    LBP {Number(snapshot?.safe_cash_balance_lbp || 0).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-slate-400">Audited safe custody balance</div>
              </div>

              {/* In Transit to Bank */}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                  <span>3. In-Transit Bank</span>
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    ${Number(snapshot?.in_transit_bank_usd || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    LBP {Number(snapshot?.in_transit_bank_lbp || 0).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-slate-400">Safe-to-Bank drops pending receipt</div>
              </div>

              {/* Confirmed Bank Deposit */}
              <div className="p-4 space-y-2 bg-emerald-50/30 dark:bg-emerald-950/10">
                <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-semibold uppercase">
                  <span>4. Confirmed Bank</span>
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    ${Number(snapshot?.confirmed_bank_deposit_usd || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    LBP {Number(snapshot?.confirmed_bank_deposit_lbp || 0).toLocaleString()}
                  </div>
                </div>
                <div className="text-xs text-slate-400">Bank-certified physical deposits</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DRAWER SHIFTS & BLIND COUNTS */}
      {activeTab === 'drawers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cash Drawer Sessions</h3>
              <p className="text-xs text-slate-500">Enforces two-party blind count segregation: cashiers submit counts with zero visibility into expected balances.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPettyCashModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border transition"
              >
                <DollarSign size={14} />
                <span>Record Drawer Petty Cash</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="p-3">Shift Code</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Opening Float</th>
                  <th className="p-3">Declared Cash (Blind)</th>
                  <th className="p-3">System Expected</th>
                  <th className="p-3">Variance</th>
                  <th className="p-3">Review</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {shifts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      No drawer shifts recorded for this date.
                    </td>
                  </tr>
                ) : (
                  shifts.map(shift => (
                    <tr key={shift.cash_shift_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {shift.shift_code}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          shift.status === 'CLOSED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : shift.status === 'COUNT_SUBMITTED'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {shift.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-mono">
                        ${Number(shift.opening_float_usd).toFixed(2)}<br />
                        <span className="text-slate-400">LBP {Number(shift.opening_float_lbp).toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-xs font-mono">
                        {shift.declared_cash_usd !== null ? (
                          <>
                            ${Number(shift.declared_cash_usd).toFixed(2)}<br />
                            <span className="text-slate-400">LBP {Number(shift.declared_cash_lbp || 0).toLocaleString()}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">Pending Count</span>
                        )}
                      </td>
                      <td className="p-3 text-xs font-mono">
                        ${Number(shift.system_expected_cash_usd).toFixed(2)}<br />
                        <span className="text-slate-400">LBP {Number(shift.system_expected_cash_lbp).toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-xs font-mono">
                        <span className={Number(shift.cash_variance_usd) < 0 ? 'text-red-600 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                          ${Number(shift.cash_variance_usd).toFixed(2)}
                        </span><br />
                        <span className="text-slate-400">LBP {Number(shift.cash_variance_lbp).toLocaleString()}</span>
                      </td>
                      <td className="p-3 text-xs">
                        <span className={`font-semibold ${
                          shift.review_status === 'APPROVED' ? 'text-emerald-600' :
                          shift.review_status === 'REJECTED' ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {shift.review_status}
                        </span>
                        {shift.review_notes && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]" title={shift.review_notes}>
                            {shift.review_notes}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {shift.status === 'OPEN' && (
                          <button
                            onClick={() => {
                              setSelectedShiftForCount(shift);
                              setShowBlindCountModal(true);
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm"
                          >
                            Submit Blind Count
                          </button>
                        )}
                        {shift.status === 'COUNT_SUBMITTED' && (
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => handleReviewShift(shift.cash_shift_id, 'APPROVE')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded flex items-center gap-1"
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              onClick={() => handleReviewShift(shift.cash_shift_id, 'REJECT')}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded flex items-center gap-1"
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        )}
                        {shift.status === 'CLOSED' && (
                          <button
                            onClick={() => {
                              setReopenShiftId(shift.cash_shift_id);
                              setShowReopenModal(true);
                            }}
                            className="px-2 py-1 border text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 text-xs rounded"
                          >
                            Reopen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SAFE CUSTODY & BANK DEPOSITS */}
      {activeTab === 'safe' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Safe Vault Custody & Banking</h3>
              <p className="text-xs text-slate-500">Atomic custody handoffs between drawer registers, vault safe, and armored bank transport.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
              >
                <ArrowRightLeft size={14} />
                <span>Execute Custody Transfer</span>
              </button>
              <button
                onClick={() => setShowBankConfirmModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm transition"
              >
                <Landmark size={14} />
                <span>Confirm Bank Collection</span>
              </button>
            </div>
          </div>

          {/* Safe Live Balance Card */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-xl shadow-md flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Active Safe Ledger Reconstruction</span>
              <div className="text-3xl font-extrabold mt-1 text-emerald-400">
                ${safeBalance.balance_usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-slate-300 font-mono mt-0.5">
                LBP {safeBalance.balance_lbp.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-white/10 rounded-full">
              <Shield size={32} className="text-emerald-400" />
            </div>
          </div>

          {/* Custody Transfers Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Business Date Custody Transfers</h4>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="p-3">Transfer Type</th>
                  <th className="p-3">Source &rarr; Destination</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                      No custody transfers recorded for this date.
                    </td>
                  </tr>
                ) : (
                  transfers.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {t.transfer_type}
                      </td>
                      <td className="p-3 text-xs font-mono">
                        {t.source_custody_type} ({t.source_custody_id}) &rarr; {t.destination_custody_type} ({t.destination_custody_id})
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-900 dark:text-slate-100">
                        {t.currency} {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-xs font-mono text-slate-500">
                        {t.source_reference}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-400">
                        {new Date(t.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SPLIT-TENDER RECEIVABLES */}
      {activeTab === 'tenders' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Split-Tender Order Receivables</h3>
            <p className="text-xs text-slate-500">Order-level tender legs supporting split-payments (Card, Cash, Delivery Aggregators).</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="p-3">Order # / Pos ID</th>
                  <th className="p-3">Seq</th>
                  <th className="p-3">Tender Type</th>
                  <th className="p-3">Tendered</th>
                  <th className="p-3">Change Amount</th>
                  <th className="p-3">Allocated Settled</th>
                  <th className="p-3">Outstanding</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {tenders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      No order tender receivables recorded for this date.
                    </td>
                  </tr>
                ) : (
                  tenders.map(tr => (
                    <tr key={tr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="p-3 text-xs font-mono font-medium">
                        {tr.order_number || tr.pos_order_id.slice(0, 8)}
                      </td>
                      <td className="p-3 text-xs font-mono">
                        #{tr.tender_sequence}
                      </td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {tr.tender_type}
                      </td>
                      <td className="p-3 text-xs font-bold font-mono">
                        {tr.tender_currency} {Number(tr.tendered_amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-xs font-mono text-slate-500">
                        {tr.change_amount > 0 ? `${tr.change_currency} ${Number(tr.change_amount).toFixed(2)}` : '—'}
                      </td>
                      <td className="p-3 text-xs font-mono text-emerald-600 font-bold">
                        ${Number(tr.allocated_amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-xs font-mono text-amber-600 font-bold">
                        ${Number(tr.outstanding_unsettled_amount).toFixed(2)}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          tr.settlement_status === 'SETTLED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tr.settlement_status === 'PARTIALLY_SETTLED'
                            ? 'bg-blue-100 text-blue-800'
                            : tr.settlement_status === 'DISCREPANT'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {tr.settlement_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SETTLEMENT BATCHES & EXCEPTIONS */}
      {activeTab === 'settlements' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Settlement Batches & Exceptions</h3>
            <p className="text-xs text-slate-500">Card processor and delivery aggregator statements with deterministic allocation and discrepancy workflows.</p>
          </div>

          {/* Batches Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">External Settlement Batches</h4>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="p-3">Channel / Provider</th>
                  <th className="p-3">Statement Ref</th>
                  <th className="p-3">Gross Amount</th>
                  <th className="p-3">Rows (Settled / Discrepant / Total)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                      No settlement batches imported.
                    </td>
                  </tr>
                ) : (
                  batches.map(b => (
                    <tr key={b.batch_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {b.channel} <span className="text-xs font-normal text-slate-500">({b.provider_code})</span>
                      </td>
                      <td className="p-3 text-xs font-mono text-slate-600 dark:text-slate-300">
                        {b.statement_reference} <span className="text-[10px] text-slate-400">(v{b.version_number})</span>
                      </td>
                      <td className="p-3 text-xs font-bold font-mono">
                        {b.currency} {Number(b.total_gross_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-xs font-mono">
                        <span className="text-emerald-600 font-bold">{b.settled_rows}</span> / <span className="text-red-500 font-bold">{b.discrepant_rows}</span> / {b.total_rows}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleMatchBatch(b.batch_id)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm disabled:opacity-50"
                        >
                          Run Auto-Match
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Exceptions Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500" />
                Settlement Reconciliation Exceptions
              </h4>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 uppercase font-semibold border-b">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Expected Amount</th>
                  <th className="p-3">Discrepancy</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Strategy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {exceptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                      No unresolved settlement exceptions.
                    </td>
                  </tr>
                ) : (
                  exceptions.map(ex => (
                    <tr key={ex.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 text-xs">
                        {ex.exception_type}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          ex.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ex.severity}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-mono">
                        {ex.currency} {Number(ex.amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-xs font-mono font-bold text-red-600">
                        {ex.currency} {Number(ex.discrepancy_amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-xs font-semibold">
                        {ex.status}
                      </td>
                      <td className="p-3 text-xs text-slate-500">
                        {ex.resolution_strategy || 'UNDER_REVIEW'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT BLIND COUNT */}
      {showBlindCountModal && selectedShiftForCount && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Submit Blind Cash Count</h3>
              <button onClick={() => setShowBlindCountModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitBlindCount} className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                Cashier blind entry: Enter actual physical cash counted in drawer. System expected totals are hidden to preserve audit integrity.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Declared Cash USD</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={countUsd} 
                  onChange={e => setCountUsd(e.target.value)} 
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Declared Cash LBP</label>
                <input 
                  type="number" 
                  step="1000" 
                  value={countLbp} 
                  onChange={e => setCountLbp(e.target.value)} 
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Count Notes / Denomination Breakdown</label>
                <textarea 
                  value={countNotes} 
                  onChange={e => setCountNotes(e.target.value)} 
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  placeholder="Optional notes"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowBlindCountModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting...' : 'Submit Count'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CUSTODY TRANSFER */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Execute Cash Custody Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Transfer Route</label>
                <select 
                  value={transferType} 
                  onChange={e => setTransferType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                >
                  <option value="DRAWER_TO_SAFE">Drawer &rarr; Safe Vault</option>
                  <option value="SAFE_TO_BANK">Safe Vault &rarr; Bank Deposit</option>
                </select>
              </div>
              {transferType === 'DRAWER_TO_SAFE' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Source Shift</label>
                  <select 
                    value={transferShiftId} 
                    onChange={e => setTransferShiftId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  >
                    <option value="">Select Shift</option>
                    {shifts.map(s => (
                      <option key={s.cash_shift_id} value={s.cash_shift_id}>{s.shift_code} ({s.status})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Currency</label>
                  <select 
                    value={transferCurrency} 
                    onChange={e => setTransferCurrency(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  >
                    <option value="USD">USD</option>
                    <option value="LBP">LBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={transferAmount} 
                    onChange={e => setTransferAmount(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Reference / Envelope #</label>
                <input 
                  type="text" 
                  value={transferRef} 
                  onChange={e => setTransferRef(e.target.value)} 
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  placeholder="e.g. ENV-2026-001"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Executing...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BANK CONFIRMATION */}
      {showBankConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Confirm Bank Collection</h3>
              <button onClick={() => setShowBankConfirmModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmBankCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Deposit Type</label>
                <select 
                  value={depositType} 
                  onChange={e => setDepositType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                >
                  <option value="PHYSICAL_CASH">Physical Cash Armored Collection</option>
                  <option value="ELECTRONIC_SETTLEMENT">Electronic Gateway Settlement Payout</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Currency</label>
                  <select 
                    value={bankConfirmCurrency} 
                    onChange={e => setBankConfirmCurrency(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  >
                    <option value="USD">USD</option>
                    <option value="LBP">LBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={bankConfirmAmount} 
                    onChange={e => setBankConfirmAmount(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Bank Statement Reference</label>
                <input 
                  type="text" 
                  value={bankReference} 
                  onChange={e => setBankReference(e.target.value)} 
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent font-mono"
                  placeholder="e.g. BNK-DEP-2026-99"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowBankConfirmModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Confirming...' : 'Certify Bank Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DRAWER PETTY CASH */}
      {showPettyCashModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Record Drawer Petty Cash Payment</h3>
              <button onClick={() => setShowPettyCashModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePettyCashSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Drawer Shift</label>
                <select 
                  value={pettyCashShiftId} 
                  onChange={e => setPettyCashShiftId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  required
                >
                  <option value="">Select Shift</option>
                  {shifts.filter(s => s.status === 'OPEN').map(s => (
                    <option key={s.cash_shift_id} value={s.cash_shift_id}>{s.shift_code}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Currency</label>
                  <select 
                    value={pettyCashCurrency} 
                    onChange={e => setPettyCashCurrency(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  >
                    <option value="USD">USD</option>
                    <option value="LBP">LBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={pettyCashAmount} 
                    onChange={e => setPettyCashAmount(e.target.value)} 
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Payment Reason / Vendor</label>
                <input 
                  type="text" 
                  value={pettyCashReason} 
                  onChange={e => setPettyCashReason(e.target.value)} 
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  placeholder="e.g. Ice delivery, emergency lemons"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowPettyCashModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REOPEN SHIFT */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl border space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">Reopen Closed Cash Shift</h3>
              <button onClick={() => setShowReopenModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReopenShift} className="space-y-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-300">
                Mandatory audit log: Reopening a shift requires supervisory justification. Subsequent reconciliation snapshots will be marked STALE.
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Reason for Reopening</label>
                <textarea 
                  value={reopenReason} 
                  onChange={e => setReopenReason(e.target.value)} 
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-transparent"
                  placeholder="Detail the recount error or audit justification"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Reopening...' : 'Confirm Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
