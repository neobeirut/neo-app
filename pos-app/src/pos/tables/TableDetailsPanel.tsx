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
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-900">{table.table_code}</span>
            <span className="text-xs text-slate-500 font-bold">({table.display_name})</span>
            {table.merged_table_codes && table.merged_table_codes.length > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                +{table.merged_table_codes.join(', ')}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            Waiter: <strong className="text-slate-800 font-bold">{table.assigned_waiter || 'Staff'}</strong> • Guests: <strong className="text-slate-800 font-bold">{table.guest_count || 1}</strong>
          </div>
        </div>

        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Financial Snapshot */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/60">
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Bill</span>
            <span className="text-lg font-black text-slate-900">${total.toFixed(2)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Paid</span>
            <span className="text-lg font-black text-[#1e5c4f]">${paid.toFixed(2)}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Remaining</span>
            <span className={`text-lg font-black ${remaining > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
              ${remaining.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons List */}
      <div className="p-5 space-y-2.5 flex-1 overflow-y-auto bg-white">
        <button
          type="button"
          onClick={() => onOpenInTicket(table)}
          className="w-full p-3.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-sm flex items-center justify-between transition shadow-md cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5" />
            <span>Open Cart / Add Round</span>
          </div>
          <span className="text-xs bg-black/20 px-2 py-0.5 rounded font-bold">Ticket</span>
        </button>

        <button
          type="button"
          onClick={() => onTakePayment(table)}
          className="w-full p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-between transition shadow-md cursor-pointer"
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
          className="w-full p-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-between border border-slate-200 transition shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-purple-600" />
            <span>Split Bill (Equal or by Item)</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onPrintPreCheck(table)}
          className="w-full p-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-between border border-slate-200 transition shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600" />
            <span>Print Pre-Check (PRE-CHECK / BILL — NOT PAID)</span>
          </div>
        </button>

        <div className="grid grid-cols-3 gap-2 pt-2">
          <button
            type="button"
            onClick={() => onTransferTable(table)}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex flex-col items-center gap-1 text-center transition cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-slate-500" />
            <span>Move</span>
          </button>

          <button
            type="button"
            onClick={() => onMergeTable(table)}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex flex-col items-center gap-1 text-center transition cursor-pointer"
          >
            <Link2 className="w-4 h-4 text-slate-500" />
            <span>Merge</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeGuests(table)}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex flex-col items-center gap-1 text-center transition cursor-pointer"
          >
            <Users className="w-4 h-4 text-slate-500" />
            <span>Guests</span>
          </button>
        </div>
      </div>

      {/* Footer: Close Table */}
      <div className="p-5 border-t border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={() => onCloseTable(table)}
          disabled={!canClose}
          className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition ${
            canClose
              ? 'bg-[#1e5c4f] hover:bg-[#16473D] text-white shadow-md cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{canClose ? 'Close Table Session' : 'Cannot Close: Unpaid Balance'}</span>
        </button>
      </div>
    </div>
  );
};
