import { canHoldPreviousPm, loadShiftHandover, handoverMessage } from '../services/shiftHandoverPolicy';
import React, { useState, useEffect } from 'react';
import type { ShiftCashRecord } from '../services/shiftCashBridge';
import { AlertTriangle, Clock, Lock, ArrowRight, PauseCircle, CheckCircle2, DollarSign, Calendar, User, ShieldAlert } from 'lucide-react';

interface OverdueShiftModalProps {
  isOpen: boolean;
  onResolveTables: () => void;
  onResolveOrders: () => void;
  shift: ShiftCashRecord | null;
  cashierName: string;
  onCloseShiftNow: () => void;
  onHoldShift: (notes?: string, cashUsd?: number, cashLbp?: number) => Promise<{ success: boolean; error?: string }>;
  /** Optional: dismiss the modal and continue without acting (browse-only mode) */
  onDismiss?: () => void;
}

export const OverdueShiftModal: React.FC<OverdueShiftModalProps> = ({
  isOpen,
  shift,
  cashierName,
  onCloseShiftNow,
  onHoldShift,
  onDismiss, onResolveTables, onResolveOrders
}) => {

  const [mode, setMode] = useState<'CHOICE' | 'HOLD_FORM'>('CHOICE');
  const [handoverNotes, setHandoverNotes] = useState<string>('');
  const [cashSnapshotUsd, setCashSnapshotUsd] = useState<string>('');
  const [cashSnapshotLbp, setCashSnapshotLbp] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [handover, setHandover] = useState<Awaited<ReturnType<typeof loadShiftHandover>> | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!isOpen || !shift) return;
    let cancelled = false; setChecking(true); setHandover(null); setCheckError(''); setMode('CHOICE');
    loadShiftHandover(shift.branch_id || '', shift.restaurant_id).then(result => { if (!cancelled) setHandover(result); })
      .catch(error => { if (!cancelled) setCheckError(error.message); }).finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [isOpen, shift?.id, refresh]);
  if (!isOpen || !shift) return null;
  const isAmShift = String(shift.shift || '').toUpperCase() === 'AM';
  const holdAllowed = canHoldPreviousPm(shift);
  const blocked = !isAmShift && (checking || Boolean(checkError) || !handover || handover.blocked);

  // Formatting helpers
  const shiftDate = shift.date ? (shift.date.includes('T') ? shift.date.split('T')[0] : shift.date.split(' ')[0]) : 'Previous Day';
  const shiftType = (shift.shift || 'PM').toUpperCase();
  const openedBy = shift.user_name || 'Previous Cashier';
  const terminalId = shift.terminal_id || 'Drawer #1';

  // Calculate elapsed hours since creation
  const createdDate = shift.created_at ? new Date(shift.created_at) : new Date();
  const elapsedHours = Math.max(1, Math.round((Date.now() - createdDate.getTime()) / (1000 * 60 * 60)));

  const handleConfirmHold = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const parsedUsd = cashSnapshotUsd.trim() ? parseFloat(cashSnapshotUsd) : undefined;
      const parsedLbp = cashSnapshotLbp.trim() ? parseFloat(cashSnapshotLbp.replace(/,/g, '')) : undefined;

      const finalNote = handoverNotes.trim()
        ? handoverNotes.trim()
        : `Handed over by ${cashierName}. Previous ${shiftType} shift (${shiftDate}) was left unclosed.`;

      const result = await onHoldShift(finalNote, parsedUsd, parsedLbp);
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to place shift on hold. Please try again.');
        setIsSubmitting(false);
      }
      // If success, parent unmounts or closes modal automatically
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden text-slate-900">
        {/* TOP ALERT BANNER */}
        <div className="bg-amber-600 px-6 py-4 text-white flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-2xl">
            <ShieldAlert size={28} className="text-white stroke-[2.5]" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-black uppercase tracking-wider">Unclosed Shift Detected</h2>
            <p className="text-xs font-bold text-white/90">
              Terminal register locked: previous shift was not closed after closing time
            </p>
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition active:scale-95 cursor-pointer text-white"
              title="Dismiss — browse only"
            >
              <span className="font-black text-lg leading-none">✕</span>
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* SHIFT SUMMARY CARD */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-mono font-black text-xs">
                  {shiftType} SHIFT
                </span>
                <span className="text-sm font-black text-slate-900">
                  {shift.branch || 'Branch Terminal'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-900 font-mono font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                <Clock size={14} className="text-amber-700" />
                <span>Open for ~{elapsedHours}h</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-slate-500 font-bold uppercase text-[10px]">Date:</span>
                <span className="font-mono font-bold text-slate-900">{shiftDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={14} className="text-slate-400" />
                <span className="text-slate-500 font-bold uppercase text-[10px]">Opened by:</span>
                <span className="font-bold text-slate-900 truncate">{openedBy}</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-slate-400" />
                <span className="text-slate-500 font-bold uppercase text-[10px]">Terminal:</span>
                <span className="font-mono font-bold text-slate-900">{terminalId}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-emerald-600" />
                <span className="text-slate-500 font-bold uppercase text-[10px]">Opening Float:</span>
                <span className="font-mono font-black text-slate-900">
                  ${shift.opening_usd || 0} / {(shift.opening_lbp || 0).toLocaleString()} L.L.
                </span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* CHOICE MODE */}
          {blocked ? (
            <div className="space-y-3 text-sm">
              <p className="font-bold text-slate-800">{checking ? 'Checking open tables and orders…' : checkError || (handover ? handoverMessage(handover) : '')}</p>
              {handover?.blocking.length ? <p className="text-xs text-slate-600 font-mono">Orders: {handover.blocking.map(o => '#' + o.id).join(', ')}</p> : null}
              <div className="flex gap-2 pt-1">
                <button onClick={onResolveTables} className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs cursor-pointer shadow-xs">Open Tables</button>
                <button onClick={onResolveOrders} className="px-3.5 py-2 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs cursor-pointer shadow-xs">Open Orders</button>
                <button onClick={() => setRefresh(n => n + 1)} className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer">Recheck</button>
              </div>
              <p className="text-xs text-slate-500">Close all open tables and unscheduled orders before closing or holding the night shift. Scheduled orders may stay open whether paid or unpaid.</p>
            </div>
          ) : mode === 'CHOICE' ? (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 space-y-1">
                <p className="font-black text-slate-900 text-sm">What would you like to do?</p>
                <p className="text-slate-600 leading-relaxed">
                  {holdAllowed ? 'Close the previous PM shift now, or put it on hold for the manager before opening AM.' : 'Close the previous shift before opening the next one. AM shifts cannot be put on hold.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* OPTION 1: PUT ON HOLD (RECOMMENDED FOR AM CASHIERS) */}
                {holdAllowed && (
                  <button
                    type="button"
                    onClick={() => setMode('HOLD_FORM')}
                    className="p-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-[#1e5c4f] text-left transition active:scale-98 group cursor-pointer shadow-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200">
                        <PauseCircle size={20} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-[#1e5c4f] text-white px-2 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 group-hover:text-[#1e5c4f] transition">
                        Put On Hold for Manager
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                        Leave previous shift for manager review and open a fresh AM shift with your own float now.
                      </p>
                    </div>
                    <div className="pt-2 flex items-center text-xs font-black text-[#1e5c4f] gap-1">
                      <span>Continue to Hold</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                )}

                {/* OPTION 2: CLOSE AND SETTLE NOW */}
                <button
                  type="button"
                  onClick={onCloseShiftNow}
                  className="p-4 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-slate-400 text-left transition active:scale-98 group cursor-pointer shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                      <Lock size={20} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 group-hover:text-slate-800 transition">
                      Close & Settle Now
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      If you know the closing cash counts and have the reconciliation paperwork ready.
                    </p>
                  </div>
                  <div className="pt-2 flex items-center text-xs font-bold text-slate-700 gap-1">
                    <span>Open Reconciliation</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>
            </div>
          ) : (
            /* HOLD FORM MODE */
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                  <PauseCircle size={16} className="text-[#1e5c4f]" />
                  <span>Handover Note for Manager Audit</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Morning Handover Reason / Note
                  </label>
                  <textarea
                    rows={3}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder={`e.g., Arrived at 8:00 AM for AM shift. PM cashier (${openedBy}) did not reconcile the register. Drawer left intact.`}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#1e5c4f] transition resize-none shadow-2xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Drawer Cash Snapshot (USD) <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      step="0.01"
                      value={cashSnapshotUsd}
                      onChange={(e) => setCashSnapshotUsd(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono outline-none focus:border-[#1e5c4f] shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Drawer Cash Snapshot (LBP) <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={cashSnapshotLbp}
                      onChange={(e) => setCashSnapshotLbp(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono outline-none focus:border-[#1e5c4f] shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setMode('CHOICE')}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-xs transition cursor-pointer"
                >
                  ← Back
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmHold}
                  className="px-6 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving & Opening AM Shift...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Confirm Hold & Open Fresh Shift</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
