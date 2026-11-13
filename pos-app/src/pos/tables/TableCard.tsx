import React from 'react';
import { type PosTable, formatElapsedDuration } from './types';
import { Users, Clock } from 'lucide-react';
import { useRestaurantTheme } from '../theme/useRestaurantTheme';

interface TableCardProps {
  table: PosTable;
  isSelected?: boolean;
  onClick: () => void;
}

export const TableCard: React.FC<TableCardProps> = ({ table, isSelected = false, onClick }) => {
  const { primaryColor } = useRestaurantTheme();
  const isAvailable = table.status === 'available';
  const isOpenNoProduct = table.status === 'open';
  const isBillRequested = table.status === 'bill_requested';
  const isOccupied = table.status === 'occupied' || isBillRequested;

  const shapeClass = 
    table.shape === 'round' ? 'rounded-full aspect-square' :
    table.shape === 'rectangle' ? 'rounded-2xl aspect-[16/10]' :
    'rounded-2xl aspect-square';

  return (
    <div
      data-table-code={table.table_code}
      onClick={onClick}
      style={{
        backgroundColor: isSelected ? '#E9F4ED' : '#FFFFFF',
        borderColor: isSelected ? primaryColor : undefined
      }}
      className={`relative flex flex-col justify-between p-3.5 border transition-all cursor-pointer select-none shadow-sm hover:shadow-md active:scale-95 ${shapeClass} ${
        isSelected
          ? 'ring-4 shadow-md scale-[1.03] z-10'
          : isOpenNoProduct
          ? 'border-sky-300 hover:border-sky-400'
          : isAvailable
          ? 'border-[#E0E3DF] hover:border-emerald-500/60'
          : isBillRequested
          ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400 animate-pulse'
          : 'border-rose-300 hover:border-rose-400'
      }`}
    >
      {/* Top Header: Code & Capacity */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-black text-[#242B28] tracking-wider">
            {table.table_code}
          </span>
          {table.merged_table_codes && table.merged_table_codes.length > 0 && (
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
              +{table.merged_table_codes.join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-[11px] text-[#5E6964] font-semibold">
          <Users className="w-3.5 h-3.5" />
          <span>{(isOccupied || isOpenNoProduct) && table.guest_count ? table.guest_count : table.capacity}</span>
        </div>
      </div>

      {/* Middle: Status details */}
      <div className="my-auto py-1">
        {isOpenNoProduct ? (
          <div className="text-center">
            <span className="text-xs font-black text-sky-700 uppercase tracking-wider block">
              Open
            </span>
            <span className="text-[10px] font-bold text-[#5E6964]">
              No Products
            </span>
            <span className="text-[9px] text-sky-600 block mt-0.5 font-medium">
              Tap to Add Order
            </span>
          </div>
        ) : isAvailable ? (
          <div className="text-center">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
              Available
            </span>
            <span className="text-[10px] text-[#5E6964]">Tap to Open</span>
          </div>
        ) : (
          <div className="space-y-1 text-center">
            <span className="text-xs font-black uppercase tracking-wider block text-amber-800">
              OPEN
            </span>
            <div className="text-[10px] text-[#5E6964] font-medium truncate max-w-full">
              {table.assigned_waiter || 'Staff'}
            </div>
            {table.kitchen_readiness && (
              <div className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 inline-block mt-0.5">
                🍳 {table.kitchen_readiness}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom: Timer or Status indicator */}
      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#E0E3DF]">
        {isOpenNoProduct ? (
          <>
            <span className="text-[#5E6964] flex items-center gap-1 truncate max-w-[60%]">
              <Clock className="w-3 h-3 text-sky-600 flex-shrink-0" />
              <span>{formatElapsedDuration(table.elapsed_minutes)}</span>
            </span>

            <span className="font-extrabold uppercase px-1.5 py-0.5 rounded text-[9px] bg-sky-50 text-sky-700 border border-sky-200">
              OPEN
            </span>
          </>
        ) : isAvailable ? (
          <span className="text-[#5E6964] font-medium">Seats {table.capacity}</span>
        ) : (
          <>
            <span className="text-[#5E6964] flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#5E6964]" />
              <span>{formatElapsedDuration(table.elapsed_minutes)}</span>
            </span>

            <span className={`font-extrabold uppercase px-1.5 py-0.5 rounded text-[9px] ${
              isBillRequested
                ? 'bg-amber-500 text-slate-950 font-black animate-bounce'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {isBillRequested ? 'BILL' : 'OPEN'}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
