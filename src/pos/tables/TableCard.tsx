import React from 'react';
import type { PosTable } from './types';
import { Users, Clock, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';

interface TableCardProps {
  table: PosTable;
  onClick: () => void;
}

export const TableCard: React.FC<TableCardProps> = ({ table, onClick }) => {
  const isAvailable = table.status === 'available';
  const isBillRequested = table.status === 'bill_requested';
  const isOccupied = table.status === 'occupied' || isBillRequested;

  const shapeClass = 
    table.shape === 'round' ? 'rounded-full aspect-square' :
    table.shape === 'rectangle' ? 'rounded-2xl aspect-[16/10]' :
    'rounded-2xl aspect-square';

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col justify-between p-3.5 border transition-all cursor-pointer select-none shadow-lg active:scale-95 ${shapeClass} ${
        isAvailable
          ? 'bg-slate-900/80 border-emerald-500/40 hover:border-emerald-400 hover:bg-slate-900 shadow-emerald-500/5'
          : isBillRequested
          ? 'bg-amber-950/60 border-amber-500/70 shadow-amber-500/20 ring-2 ring-amber-500/40 animate-pulse'
          : 'bg-slate-900 border-rose-500/50 shadow-rose-500/10'
      }`}
    >
      {/* Top Header: Code & Capacity */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-black text-white tracking-wider">
            {table.table_code}
          </span>
          {table.merged_table_codes && table.merged_table_codes.length > 0 && (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              +{table.merged_table_codes.join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold">
          <Users className="w-3.5 h-3.5" />
          <span>{isOccupied && table.guest_count ? table.guest_count : table.capacity}</span>
        </div>
      </div>

      {/* Middle: Status details */}
      <div className="my-auto py-1">
        {isAvailable ? (
          <div className="text-center">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
              Available
            </span>
            <span className="text-[10px] text-slate-500">Tap to Open</span>
          </div>
        ) : (
          <div className="space-y-1 text-center">
            <div className="text-sm font-black text-slate-100">
              ${(table.current_bill || 0).toFixed(2)}
            </div>
            {table.amount_remaining !== undefined && table.amount_remaining > 0 && (
              <div className="text-[10px] font-bold text-amber-400">
                Due: ${table.amount_remaining.toFixed(2)}
              </div>
            )}
            <div className="text-[10px] text-slate-400 truncate max-w-full">
              {table.assigned_waiter || 'Staff'}
            </div>
            {table.kitchen_readiness && (
              <div className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 inline-block mt-0.5">
                🍳 {table.kitchen_readiness}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom: Timer or Status indicator */}
      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-800/80">
        {isAvailable ? (
          <span className="text-slate-500 font-medium">Seats {table.capacity}</span>
        ) : (
          <>
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{table.elapsed_minutes || 0}m</span>
            </span>

            <span className={`font-extrabold uppercase px-1.5 py-0.5 rounded text-[9px] ${
              isBillRequested
                ? 'bg-amber-500 text-slate-950 animate-bounce'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {isBillRequested ? 'BILL' : 'BUSY'}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
