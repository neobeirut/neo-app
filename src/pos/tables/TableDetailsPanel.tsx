import React from 'react';
import {
  X,
  ShoppingCart,
  ArrowRightLeft,
  Link2,
  Users,
  Printer,
  Scissors,
  DollarSign,
  CheckCircle2
} from 'lucide-react';
import type { PosTable } from './types';

interface TableDetailsPanelProps {
  table: PosTable | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenInTicket: (table: PosTable) => void;
  onTransferTable: (table: PosTable) => void;
  onMergeTable: (table: PosTable) => void;
  onChangeGuests: (table: PosTable) => void;
  onPrintPreCheck: (table: PosTable) => void;
  onSplitBill: (table: PosTable) => void;
  onTakePayment: (table: PosTable) => void;
  onCloseTable: (table: PosTable) => void;
}

export const TableDetailsPanel: React.FC<TableDetailsPanelProps> = ({
  table,
  isOpen,
  onClose,
  onOpenInTicket,
  onTransferTable,
  onMergeTable,
  onChangeGuests,
  onPrintPreCheck,
  onSplitBill,
  onTakePayment,
  onCloseTable
}) => {
  if (!isOpen || !table) return null;

  const total = table.current_bill || 0;
  const paid = table.amount_paid || 0;
  const remaining = table.amount_remaining !== undefined ? table.amount_remaining : Math.max(0, total - paid);
  const canClose = remaining <= 0.01;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-white">{table.table_code}</span>
            <span className="text-xs text-slate-400 font-semibold">({table.display_name})</span>
            {table.merged_table_codes && table.merged_table_codes.length > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                +{table.merged_table_codes.join(', ')}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Waiter: <strong className="text-slate-200">{table.assigned_waiter || 'Staff'}</strong> • Guests: <strong className="text-slate-200">{table.guest_count || 1}</strong>
          </div>
        </div>

        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Financial Snapshot */}
      <div className="p-5 border-b border-slate-800 bg-slate-950/40">
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Bill</span>
            <span className="text-lg font-black text-slate-100">${total.toFixed(2)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Paid</span>
            <span className="text-lg font-black text-emerald-400">${paid.toFixed(2)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Remaining</span>
            <span className={`text-lg font-black ${remaining > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
              ${remaining.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons List */}
      <div className="p-5 space-y-2.5 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => onOpenInTicket(table)}
          className="w-full p-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-between transition shadow-lg shadow-amber-500/20"
        >
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5" />
            <span>Open Cart / Add Round</span>
          </div>
          <span className="text-xs bg-slate-950/20 px-2 py-0.5 rounded font-bold">Ticket</span>
        </button>

        <button
          type="button"
          onClick={() => onTakePayment(table)}
          className="w-full p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-between transition shadow-lg shadow-emerald-600/20"
        >
          <div className="flex items-center gap-2.5">
            <DollarSign className="w-5 h-5" />
            <span>Pay / Settle Table</span>
          </div>
          <span className="text-xs bg-black/20 px-2 py-0.5 rounded font-bold">${remaining.toFixed(2)}</span>
        </button>

        <button
          type="button"
          onClick={() => onSplitBill(table)}
          className="w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs flex items-center justify-between border border-slate-700 transition"
        >
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-purple-400" />
            <span>Split Bill (Equal or by Item)</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onPrintPreCheck(table)}
          className="w-full p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs flex items-center justify-between border border-slate-700 transition"
        >
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-400" />
            <span>Print Pre-Check (PRE-CHECK / BILL — NOT PAID)</span>
          </div>
        </button>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            type="button"
            onClick={() => onTransferTable(table)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex flex-col items-center gap-1 text-center"
          >
            <ArrowRightLeft className="w-4 h-4 text-slate-400" />
            <span>Move</span>
          </button>

          <button
            type="button"
            onClick={() => onMergeTable(table)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex flex-col items-center gap-1 text-center"
          >
            <Link2 className="w-4 h-4 text-slate-400" />
            <span>Merge</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeGuests(table)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-semibold flex flex-col items-center gap-1 text-center"
          >
            <Users className="w-4 h-4 text-slate-400" />
            <span>Guests</span>
          </button>
        </div>
      </div>

      {/* Footer: Close Table */}
      <div className="p-5 border-t border-slate-800 bg-slate-950/80">
        <button
          type="button"
          onClick={() => onCloseTable(table)}
          disabled={!canClose}
          className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition ${
            canClose
              ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{canClose ? 'Close Table Session' : 'Cannot Close: Unpaid Balance'}</span>
        </button>
      </div>
    </div>
  );
};
