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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PAID
          </span>
        );
      case 'PAID_LEGACY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200" title="Settled in historical system">
            <ShieldCheck className="w-3.5 h-3.5" />
            PAID — LEGACY
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            PARTIAL
          </span>
        );
      case 'PARTIALLY_REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <RotateCcw className="w-3.5 h-3.5" />
            PARTIALLY REFUNDED
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <RotateCcw className="w-3.5 h-3.5" />
            REFUNDED
          </span>
        );
      case 'UNPAID':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5" />
            UNPAID
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase font-black tracking-wider text-slate-500">Payment Status</span>
        {renderBadge()}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-sm">
        <div>
          <span className="text-xs text-slate-500 font-bold">Total Bill</span>
          <div className="text-lg font-black text-slate-900">${totalAmount.toFixed(2)}</div>
          {exchangeRate && (
            <div className="text-[11px] text-slate-400">
              {(totalAmount * exchangeRate).toLocaleString()} LBP
            </div>
          )}
        </div>

        <div>
          <span className="text-xs text-slate-500 font-bold">Total Paid</span>
          <div className="text-lg font-black text-[#1e5c4f]">${amountPaid.toFixed(2)}</div>
          {amountRefunded > 0 && (
            <div className="text-[11px] text-purple-700 font-bold">
              (-${amountRefunded.toFixed(2)} refunded)
            </div>
          )}
        </div>

        <div>
          <span className="text-xs text-slate-500 font-bold">Balance Remaining</span>
          <div className={`text-lg font-black ${amountRemaining > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
            ${amountRemaining.toFixed(2)}
          </div>
        </div>

        <div>
          <span className="text-xs text-slate-500 font-bold">Change Due</span>
          <div className={`text-lg font-black ${changeDue > 0 ? 'text-[#1e5c4f]' : 'text-slate-400'}`}>
            ${changeDue.toFixed(2)}
          </div>
          {changeDue > 0 && exchangeRate && (
            <div className="text-[11px] text-[#1e5c4f] font-bold">
              {(changeDue * exchangeRate).toLocaleString()} LBP
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
