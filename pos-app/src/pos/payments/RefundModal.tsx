import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Lock,
  DollarSign
} from 'lucide-react';
import { REFUND_REASON_PRESETS } from './paymentConfig';
import { submitRefundWithFlowAudit } from './paymentService';
import type { OrderFinancialSummary } from './types';

interface RefundModalProps {
  isOpen: boolean;
  orderId: number;
  orderNumber?: string | number;
  maxRefundableAmount: number;
  currentPaid: number;
  cashierName?: string;
  branchName?: string;
  branchId?: string | number;
  restaurantId?: string;
  terminalId?: string;
  onClose: () => void;
  onRefundComplete: (summary?: OrderFinancialSummary) => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({
  isOpen,
  orderId,
  orderNumber,
  maxRefundableAmount,
  currentPaid,
  cashierName = 'Cashier',
  branchName = 'Cloud Kitchen',
  branchId,
  restaurantId,
  terminalId = 'flow-pos-terminal',
  onClose,
  onRefundComplete
}) => {
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [amountInput, setAmountInput] = useState<string>(maxRefundableAmount.toFixed(2));
  const [selectedReason, setSelectedReason] = useState<string>(REFUND_REASON_PRESETS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [managerPin, setManagerPin] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stable operation identity across retries and concurrent submission guard
  const operationIdRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ref-${Date.now()}`
  );
  const isSubmittingRef = useRef<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      operationIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `ref-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      setErrorMessage(null);
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const refundAmount = refundType === 'full' 
    ? maxRefundableAmount 
    : (parseFloat(amountInput) || 0);

  const finalReason = selectedReason === 'Other (custom)'
    ? (customReason.trim() || 'Refund processed')
    : selectedReason;

  const handleSubmit = async () => {
    if (isSubmittingRef.current || submitting) return;

    if (!managerPin || !managerPin.trim()) {
      setErrorMessage('Manager PIN is strictly required to authorize refunds.');
      return;
    }

    if (refundAmount <= 0) {
      setErrorMessage('Refund amount must be greater than $0.00');
      return;
    }

    if (refundAmount > maxRefundableAmount) {
      setErrorMessage(`Refund amount exceeds available refundable balance ($${maxRefundableAmount.toFixed(2)})`);
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await submitRefundWithFlowAudit({
        orderId,
        amount: refundAmount,
        refundType,
        reason: finalReason,
        managerPin: managerPin.trim(),
        cashierName,
        branchName,
        branchId,
        restaurantId,
        terminalId,
        operationId: operationIdRef.current
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to process refund');
        return;
      }

      onRefundComplete(res.summary);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Refund request error');
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Authorize Refund — Order #{orderNumber || orderId}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Manager PIN authorization required for ledger audit
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 bg-white">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2 font-medium">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Info Notice: Preserve Order Integrity */}
          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-indigo-950">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Accounting Integrity Protected</span>
            </div>
            <p className="text-indigo-800">
              This order will remain completed in sales fulfillment history. The refund will be recorded in the OVRLOAD payment ledger and logged in FLOW void audit.
            </p>
          </div>

          {/* Refund Type Toggle */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2 block">
              Refund Scope
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRefundType('full');
                  setAmountInput(maxRefundableAmount.toFixed(2));
                }}
                className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                  refundType === 'full'
                    ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                Full Refund (${maxRefundableAmount.toFixed(2)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setRefundType('partial');
                }}
                className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                  refundType === 'partial'
                    ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                Partial Refund
              </button>
            </div>
          </div>

          {/* Partial Amount Input */}
          {refundType === 'partial' && (
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5 block">
                Refund Amount (Max: ${maxRefundableAmount.toFixed(2)})
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-black">$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  step="0.01"
                  max={maxRefundableAmount}
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 font-black px-8 py-2.5 rounded-xl focus:border-purple-600 focus:outline-none shadow-xs"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* Reason Selection */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5 block">
              Reason for Refund
            </label>
            <select
              value={selectedReason}
              onChange={e => setSelectedReason(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-800 text-sm font-medium px-3.5 py-2.5 rounded-xl focus:border-purple-600 focus:outline-none shadow-xs"
            >
              {REFUND_REASON_PRESETS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="Other (custom)">Other (custom reason)</option>
            </select>

            {selectedReason === 'Other (custom)' && (
              <textarea
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Enter specific explanation for refund..."
                className="w-full mt-2 bg-white border border-slate-300 text-slate-800 text-sm p-3 rounded-xl focus:border-purple-600 focus:outline-none resize-none h-20 shadow-xs"
              />
            )}
          </div>

          {/* Manager PIN Authorization Input */}
          <div className="pt-2 border-t border-slate-200">
            <label className="text-xs font-black uppercase tracking-wider text-[#1e5c4f] mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Manager PIN Verification</span>
            </label>
            <input
              type="password"
              value={managerPin}
              onChange={e => setManagerPin(e.target.value)}
              placeholder="Enter 4 or 6-digit Manager PIN"
              maxLength={8}
              className="w-full bg-white border border-slate-300 text-slate-900 font-mono text-center tracking-widest text-lg py-2.5 rounded-xl focus:border-[#1e5c4f] focus:outline-none shadow-xs"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-sm transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !managerPin}
            className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-black text-sm shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <span>Authorizing Refund...</span>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Authorize Refund (${refundAmount.toFixed(2)})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
