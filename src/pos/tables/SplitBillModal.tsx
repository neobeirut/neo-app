import React, { useState, useEffect } from 'react';
import { X, Scissors, DollarSign, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';
import type { PosTable, OrderCheck } from './types';
import { getOrderChecks, createEqualSplit, createItemSplit, deleteSplitChecks } from './splitService';

interface SplitBillModalProps {
  isOpen: boolean;
  table: PosTable | null;
  baseOrder?: any;
  onClose: () => void;
  onPayCheck: (check: OrderCheck) => void;
}

export const SplitBillModal: React.FC<SplitBillModalProps> = ({
  isOpen,
  table,
  baseOrder,
  onClose,
  onPayCheck
}) => {
  const [splitMode, setSplitMode] = useState<'equal' | 'item'>('equal');
  const [equalWays, setEqualWays] = useState<number>(2);
  const [checks, setChecks] = useState<OrderCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const orderId = table?.commerce_order_id;
  const orderTotal = table?.current_bill || 0;

  useEffect(() => {
    if (!isOpen || !orderId) return;
    setLoading(true);
    setErrorMessage(null);
    getOrderChecks(orderId)
      .then(res => {
        if (res.success) setChecks(res.checks);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen, orderId]);

  if (!isOpen || !table || !orderId) return null;

  const handleCreateEqual = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await createEqualSplit({
        orderId,
        ways: equalWays
      });
      if (!res.success) throw new Error(res.error);
      setChecks(res.checks);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create equal split');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDiscardSplit = async () => {
    setSubmitting(true);
    try {
      const res = await deleteSplitChecks(orderId);
      if (!res.success) throw new Error(res.error);
      setChecks([]);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-purple-400" />
            <span className="text-lg font-black text-white">Split Bill — Table {table.table_code}</span>
            <span className="text-xs text-slate-400">(Total: ${orderTotal.toFixed(2)})</span>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {checks.length === 0 ? (
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Split Whole Bill Equally Across Guests
              </label>

              <div className="grid grid-cols-5 gap-2.5">
                {[2, 3, 4, 5, 6].map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setEqualWays(w)}
                    className={`py-3 rounded-xl text-sm font-black transition ${
                      equalWays === w
                        ? 'bg-purple-600 text-white ring-2 ring-purple-500/40'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {w} Ways
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <span className="font-bold text-slate-200 block">Split Preview:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Array.from({ length: equalWays }).map((_, i) => {
                    const totalCents = Math.round(orderTotal * 100);
                    const baseCents = Math.floor(totalCents / equalWays);
                    const remCents = totalCents % equalWays;
                    const cents = baseCents + (i < remCents ? 1 : 0);
                    return (
                      <div key={i} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex justify-between">
                        <span className="text-slate-400 font-medium">Check {i + 1}:</span>
                        <span className="font-bold text-emerald-400">${(cents / 100).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateEqual}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20"
              >
                {submitting ? 'Creating Split...' : `Confirm ${equalWays}-Way Split`}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Split Checks ({checks.length})
                </span>

                <button
                  type="button"
                  onClick={handleDiscardSplit}
                  disabled={submitting || checks.some(c => c.status === 'paid')}
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Discard Split</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {checks.map(chk => {
                  const isPaid = chk.status === 'paid';
                  return (
                    <div
                      key={chk.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100 text-sm">{chk.label}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                            isPaid
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {chk.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Amount: <strong className="text-slate-200">${chk.total.toFixed(2)}</strong> • Paid: <strong className="text-emerald-400">${chk.amount_paid.toFixed(2)}</strong>
                        </div>
                      </div>

                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => {
                            onPayCheck(chk);
                            onClose();
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow"
                        >
                          Pay This Check
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
