import React from 'react';
import type { PaymentStatus } from './types';
import { CheckCircle2, Clock, AlertCircle, RotateCcw, ShieldCheck } from 'lucide-react';

interface PaymentSummaryProps {
  totalAmount: number;
  amountPaid: number;
  amountRefunded: number;
  amountRemaining: number;
  paymentStatus: PaymentStatus;
  changeDue?: number;
  exchangeRate?: number;
}

export const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  totalAmount,
  amountPaid,
  amountRefunded,
  amountRemaining,
  paymentStatus,
  changeDue = 0,
  exchangeRate
}) => {
  const renderBadge = () => {
    switch (paymentStatus) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PAID
          </span>
        );
      case 'PAID_LEGACY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" title="Settled in historical system">
            <ShieldCheck className="w-3.5 h-3.5" />
            PAID — LEGACY
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            PARTIAL
          </span>
        );
      case 'PARTIALLY_REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <RotateCcw className="w-3.5 h-3.5" />
            PARTIALLY REFUNDED
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <RotateCcw className="w-3.5 h-3.5" />
            REFUNDED
          </span>
        );
      case 'UNPAID':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            UNPAID
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Payment Status</span>
        {renderBadge()}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-sm">
        <div>
          <span className="text-xs text-slate-400">Total Bill</span>
          <div className="text-lg font-black text-slate-100">${totalAmount.toFixed(2)}</div>
          {exchangeRate && (
            <div className="text-[11px] text-slate-500">
              {(totalAmount * exchangeRate).toLocaleString()} LBP
            </div>
          )}
        </div>

        <div>
          <span className="text-xs text-slate-400">Total Paid</span>
          <div className="text-lg font-black text-emerald-400">${amountPaid.toFixed(2)}</div>
          {amountRefunded > 0 && (
            <div className="text-[11px] text-purple-400 font-medium">
              (-${amountRefunded.toFixed(2)} refunded)
            </div>
          )}
        </div>

        <div>
          <span className="text-xs text-slate-400">Balance Remaining</span>
          <div className={`text-lg font-black ${amountRemaining > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
            ${amountRemaining.toFixed(2)}
          </div>
        </div>

        <div>
          <span className="text-xs text-slate-400">Change Due</span>
          <div className={`text-lg font-black ${changeDue > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>
            ${changeDue.toFixed(2)}
          </div>
          {changeDue > 0 && exchangeRate && (
            <div className="text-[11px] text-emerald-400">
              {(changeDue * exchangeRate).toLocaleString()} LBP
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
