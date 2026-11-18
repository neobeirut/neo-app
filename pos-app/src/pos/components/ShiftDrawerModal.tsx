import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  Receipt,
  Lock,
  Wallet
} from 'lucide-react';
import { 
  getDailyPayments, 
  addDailyPayment, 
  deleteDailyPayment 
} from '../services/shiftCashBridge';

interface ShiftDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName: string;
  cashierName: string;
  activeShift: any;
  currentRate: number;
  onOpenCloseShift: () => void;
  restaurantId?: string;
}

export const ShiftDrawerModal: React.FC<ShiftDrawerModalProps> = ({
  isOpen,
  onClose,
  branchName,
  cashierName,
  activeShift,
  currentRate,
  onOpenCloseShift,
  restaurantId
}) => {
  // Movement Type: Cash In vs Cash Out
  const [movementType, setMovementType] = useState<'CashIn' | 'CashOut'>('CashIn');
  const [cashOutSubtype, setCashOutSubtype] = useState<string>('CashOut');

  // Form Fields
  const [amountUsd, setAmountUsd] = useState<string>('');
  const [amountLbp, setAmountLbp] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Transactions list
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Derive target date and shift from active shift or fallback
  const targetDate = useMemo(() => {
    if (activeShift?.date) {
      if (activeShift.date.includes('T')) return activeShift.date.split('T')[0];
      if (activeShift.date.includes(' ')) return activeShift.date.split(' ')[0];
      return activeShift.date;
    }
    return new Date().toISOString().split('T')[0];
  }, [activeShift]);

  const targetShift = activeShift?.shift || 'AM';

  // Load records
  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await getDailyPayments(branchName, targetDate, targetShift);
      if (res.success && res.data) {
        setPaymentsList(res.data);
      } else {
        setPaymentsList([]);
      }
    } catch (err: any) {
      console.error('Failed to load drawer payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRecords();
      setFeedbackMsg(null);
      setAmountUsd('');
      setAmountLbp('');
      setDescription('');
    }
  }, [isOpen, branchName, targetDate, targetShift]);

  // Compute drawer totals
  const totals = useMemo(() => {
    const isCashOut = (t: string) => t === 'CashOut' || t === 'Cashout Loan' || t === 'Cashout Bank' || t === 'Cashout Salary';
    
    let cashInUsd = 0;
    let cashInLbp = 0;
    let cashOutUsd = 0;
    let cashOutLbp = 0;
    let supplierUsd = 0;
    let supplierLbp = 0;

    paymentsList.forEach((r: any) => {
      const u = parseFloat(r.amount_usd) || 0;
      const l = parseFloat(r.amount_lbp) || 0;

      if (r.type === 'CashIn') {
        cashInUsd += u;
        cashInLbp += l;
      } else if (isCashOut(r.type)) {
        cashOutUsd += u;
        cashOutLbp += l;
      } else if (r.type === 'Supplier' || r.type === 'Delivery') {
        supplierUsd += u;
        supplierLbp += l;
      }
    });

    const netUsd = cashInUsd - cashOutUsd - supplierUsd;
    const netLbp = cashInLbp - cashOutLbp - supplierLbp;

    return {
      cashInUsd,
      cashInLbp,
      cashOutUsd,
      cashOutLbp,
      supplierUsd,
      supplierLbp,
      netUsd,
      netLbp
    };
  }, [paymentsList]);

  // Save Cash In or Cash Out
  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const numUsd = parseFloat(amountUsd) || 0;
    const numLbp = parseFloat(amountLbp) || 0;

    if (numUsd === 0 && numLbp === 0) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a USD or LBP amount.' });
      return;
    }

    const effectiveType = movementType === 'CashIn' ? 'CashIn' : cashOutSubtype;
    const effectiveDesc = description.trim() || (movementType === 'CashIn' ? 'Cash In (Drawer Top-Up)' : 'Cash Out Payout');

    setSaving(true);
    setFeedbackMsg(null);

    try {
      const record = {
        date: targetDate,
        branch: branchName,
        shift: targetShift,
        supplier: effectiveDesc,
        amount_usd: numUsd,
        amount_lbp: numLbp,
        type: effectiveType,
        has_invoice: false,
        user_name: cashierName,
        status: 'Paid',
        restaurant_id: restaurantId
      };

      const res = await addDailyPayment(record);
      if (res.success) {
        setFeedbackMsg({ 
          type: 'success', 
          text: `✓ ${movementType === 'CashIn' ? 'Cash In' : 'Cash Out'} of ${numUsd > 0 ? `$${numUsd.toFixed(2)}` : ''}${numUsd > 0 && numLbp > 0 ? ' + ' : ''}${numLbp > 0 ? `${numLbp.toLocaleString()} LBP` : ''} recorded in drawer.` 
        });
        setAmountUsd('');
        setAmountLbp('');
        setDescription('');
        await loadRecords();
        setTimeout(() => setFeedbackMsg(null), 5000);
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to record transaction in daily payments.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Error recording drawer transaction.' });
    } finally {
      setSaving(false);
    }
  };

  // Delete transaction
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm('Delete this cash drawer transaction?')) return;
    try {
      const res = await deleteDailyPayment(id);
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: 'Transaction removed from drawer payments.' });
        await loadRecords();
        setTimeout(() => setFeedbackMsg(null), 4000);
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to delete transaction.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Error deleting transaction.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1e5c4f]/10 text-[#1e5c4f] flex items-center justify-center text-xl font-black">
              💼
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">Shift & Cash Drawer</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {targetShift} Shift Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {branchName} • {targetDate} • Cashier: <strong className="text-slate-700">{cashierName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadRecords}
              disabled={loading}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer shadow-2xs"
              title="Refresh payments list"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-800 transition cursor-pointer shadow-2xs"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* DRAWER SUMMARY TILES */}
        <div className="px-5 py-2.5 bg-[#F9FAFB] border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">Opening Float</span>
            <span className="text-sm font-black text-slate-800 font-mono">
              ${activeShift?.opening_usd || 0}
            </span>
            {Number(activeShift?.opening_lbp || 0) > 0 && (
              <span className="text-[10px] text-slate-500 block font-mono">
                {Number(activeShift.opening_lbp).toLocaleString()} LBP
              </span>
            )}
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
            <span className="text-[10px] font-extrabold uppercase text-emerald-700 block mb-0.5 flex items-center gap-1">
              <ArrowDownCircle size={11} /> Cash In (Shift)
            </span>
            <span className="text-sm font-black text-emerald-700 font-mono">
              +${totals.cashInUsd.toFixed(2)}
            </span>
            {totals.cashInLbp > 0 && (
              <span className="text-[10px] text-emerald-600 block font-mono">
                +{totals.cashInLbp.toLocaleString()} LBP
              </span>
            )}
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-rose-200 shadow-2xs">
            <span className="text-[10px] font-extrabold uppercase text-rose-700 block mb-0.5 flex items-center gap-1">
              <ArrowUpCircle size={11} /> Cash Out (Shift)
            </span>
            <span className="text-sm font-black text-rose-700 font-mono">
              -${totals.cashOutUsd.toFixed(2)}
            </span>
            {totals.cashOutLbp > 0 && (
              <span className="text-[10px] text-rose-600 block font-mono">
                -{totals.cashOutLbp.toLocaleString()} LBP
              </span>
            )}
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">Net Drawer Shift Flow</span>
            <span className={`text-sm font-black font-mono ${totals.netUsd >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {totals.netUsd >= 0 ? `+$${totals.netUsd.toFixed(2)}` : `-$${Math.abs(totals.netUsd).toFixed(2)}`}
            </span>
            <span className="text-[10px] text-slate-500 block font-mono">
              {totals.netLbp >= 0 ? `+${totals.netLbp.toLocaleString()} LBP` : `-${Math.abs(totals.netLbp).toLocaleString()} LBP`}
            </span>
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {feedbackMsg && (
          <div className={`px-5 py-2 text-xs font-bold flex items-center gap-2 flex-shrink-0 ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-b border-rose-200'
          }`}>
            {feedbackMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* BODY (TWO COLUMNS: LEFT FORM, RIGHT RECENT TRANSACTIONS) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* LEFT: ENTER CASH IN / CASH OUT FORM (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <form onSubmit={handleSaveMovement} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
              
              {/* Movement Type Toggle */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                  Action Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('CashIn')}
                    className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                      movementType === 'CashIn'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDownCircle size={16} />
                    <span>Cash In (Add to Drawer)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMovementType('CashOut')}
                    className={`py-2 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                      movementType === 'CashOut'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpCircle size={16} />
                    <span>Cash Out (Payout / Outflow)</span>
                  </button>
                </div>
              </div>

              {/* Subtype for Cash Out */}
              {movementType === 'CashOut' && (
                <div>
                  <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 tracking-wider">
                    Cash Out Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 'CashOut', label: 'General Expense' },
                      { id: 'Cashout Loan', label: 'Employee Advance' },
                      { id: 'Cashout Salary', label: 'Salary Payout' },
                      { id: 'Cashout Bank', label: 'Bank Deposit' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setCashOutSubtype(st.id)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          cashOutSubtype === st.id
                            ? 'bg-rose-100 text-rose-900 border-rose-300 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount Inputs with Presets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* USD Amount */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <label className="block text-[10px] font-black uppercase text-slate-500">
                    Amount USD ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      step="any"
                      value={amountUsd}
                      onChange={(e) => setAmountUsd(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#1e5c4f] rounded-lg font-mono font-black text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[5, 10, 20, 50, 100].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmountUsd(String((parseFloat(amountUsd) || 0) + val))}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      >
                        +${val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAmountUsd('')}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* LBP Amount */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                  <label className="block text-[10px] font-black uppercase text-slate-500">
                    Amount LBP (L.L.)
                  </label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">LBP</span>
                    <input
                      type="number"
                      step="any"
                      value={amountLbp}
                      onChange={(e) => setAmountLbp(e.target.value)}
                      placeholder="0"
                      className="w-full pl-3 pr-10 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-[#1e5c4f] rounded-lg font-mono font-black text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[100000, 250000, 500000, 1000000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmountLbp(String((parseFloat(amountLbp) || 0) + val))}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                      >
                        +{val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAmountLbp('')}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Description / Payee / Reason */}
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1 tracking-wider">
                  Reason / Description / Payee *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    movementType === 'CashIn' 
                      ? "e.g. Change top-up for register, petty cash return" 
                      : cashOutSubtype === 'Cashout Loan'
                      ? "e.g. Ahmad (advance request)"
                      : "e.g. Ice bags, Bread, Taxi delivery, Cleaning supplies"
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-[#1e5c4f] rounded-xl text-xs font-bold text-slate-900 outline-none shadow-2xs"
                />

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(movementType === 'CashIn' ? [
                    'Change Float Top-Up',
                    'Petty Cash Return',
                    'Owner Deposit',
                    'Drawer Balance Adjustment'
                  ] : [
                    'Ice / Cold Supplies',
                    'Bakery / Fresh Bread',
                    'Taxi / Rider Fee',
                    'Cleaning & Supplies',
                    'Maintenance / Repair',
                    'Vegetables / Emergency Market'
                  ]).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setDescription(tag)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving || (!amountUsd && !amountLbp)}
                className={`w-full py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-md ${
                  movementType === 'CashIn'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
                    : 'bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50'
                }`}
              >
                {saving ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : movementType === 'CashIn' ? (
                  <ArrowDownCircle size={16} />
                ) : (
                  <ArrowUpCircle size={16} />
                )}
                <span>
                  {saving 
                    ? 'Recording...' 
                    : movementType === 'CashIn' 
                    ? 'Save Cash In to Drawer' 
                    : 'Save Cash Out from Drawer'}
                </span>
              </button>
            </form>
          </div>

          {/* RIGHT: RECENT MOVEMENTS IN THIS SHIFT (5 cols) */}
          <div className="lg:col-span-5 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <Receipt size={14} className="text-[#1e5c4f]" />
                This Shift's Drawer Transactions ({paymentsList.length})
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">From Daily Payments</span>
            </div>

            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 overflow-y-auto space-y-2 max-h-[420px]">
              {paymentsList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 text-slate-400 text-center">
                  <Wallet size={32} className="mb-2 opacity-40" />
                  <p className="text-xs font-bold">No payments or drawer movements yet</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Use the form to record cash in or payouts</p>
                </div>
              ) : (
                paymentsList.map((rec) => {
                  const isCashIn = rec.type === 'CashIn';
                  const isSupplier = rec.type === 'Supplier' || rec.type === 'Delivery';
                  const u = parseFloat(rec.amount_usd) || 0;
                  const l = parseFloat(rec.amount_lbp) || 0;

                  return (
                    <div
                      key={rec.id}
                      className="bg-white p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition shadow-2xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            isCashIn 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : isSupplier
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {rec.type}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {rec.created_at ? new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {rec.supplier || 'No description'}
                        </p>
                      </div>

                      <div className="text-right flex items-center gap-2">
                        <div className="font-mono">
                          {u > 0 && (
                            <div className={`text-xs font-black ${isCashIn ? 'text-emerald-700' : 'text-slate-900'}`}>
                              {isCashIn ? '+' : '-'}${u.toFixed(2)}
                            </div>
                          )}
                          {l > 0 && (
                            <div className="text-[10px] font-bold text-slate-500">
                              {isCashIn ? '+' : '-'}{l.toLocaleString()} L.L.
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec.id)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete this transaction"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* FOOTER: CLOSE SHIFT CALL-TO-ACTION */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-500">
            <span>Ready to count physical cash and finalize this shift?</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition cursor-pointer"
            >
              Back to POS
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCloseShift();
              }}
              className="px-4 py-2 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs transition cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <Lock size={14} />
              <span>Close Shift / Reconcile Drawer &rarr;</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
