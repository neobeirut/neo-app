import React from 'react';
import type { PosTable } from './types';
import { TableCard } from './TableCard';
import { Users, Clock } from 'lucide-react';

interface FloorPlanProps {
  tables: PosTable[];
  viewMode?: 'canvas' | 'grid';
  onTableClick: (table: PosTable) => void;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({ 
  tables, 
  viewMode = 'grid', 
  onTableClick 
}) => {
  if (viewMode === 'canvas') {
    return (
      <div 
        className="w-full h-full min-h-[560px] relative bg-[#0E1118] overflow-hidden select-none"
        style={{
          backgroundImage: 'radial-gradient(#1C2333 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }}
      >
        {tables.map(table => {
          const isAvailable = table.status === 'available';
          const isBillRequested = table.status === 'bill_requested';
          const isOccupied = table.status === 'occupied' || isBillRequested;

          const shapeClass = 
            table.shape === 'round' ? 'rounded-full aspect-square' :
            table.shape === 'rectangle' ? 'rounded-xl aspect-[16/10]' :
            'rounded-xl aspect-square';

          const renderedWidth = table.width
            ? (table.width > 12 ? Math.round(table.width * 0.5 * 10) / 10 : table.width)
            : 7;

          return (
            <div
              key={table.id}
              onClick={() => onTableClick(table)}
              style={{
                left: `${table.position_x}%`,
                top: `${table.position_y}%`,
                width: `${renderedWidth}%`
              }}
              className={`absolute p-1.5 sm:p-2 border transition-all cursor-pointer select-none shadow-xl active:scale-95 flex flex-col justify-between ${shapeClass} ${
                isAvailable
                  ? 'bg-slate-900/90 border-emerald-500/50 hover:border-emerald-400 hover:bg-slate-900 shadow-emerald-500/5'
                  : isBillRequested
                  ? 'bg-amber-950/80 border-amber-500 shadow-amber-500/30 ring-2 ring-amber-500/50 animate-pulse'
                  : 'bg-slate-900 border-rose-500/60 shadow-rose-500/10'
              }`}
            >
              {/* Top Code & Guests */}
              <div className="flex items-center justify-between leading-none">
                <span className="font-black text-white text-xs tracking-wider">
                  {table.table_code}
                </span>
                <span className="flex items-center gap-0.5 text-[9px] text-slate-400 font-bold">
                  <Users className="w-2.5 h-2.5" />
                  {isOccupied && table.guest_count ? table.guest_count : table.capacity}
                </span>
              </div>

              {/* Status / Financials */}
              <div className="my-auto text-center py-0.5">
                {isAvailable ? (
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    Free
                  </span>
                ) : (
                  <div>
                    <div className="text-[10px] sm:text-xs font-black text-slate-100 leading-tight">
                      ${(table.current_bill || 0).toFixed(2)}
                    </div>
                    {table.amount_remaining !== undefined && table.amount_remaining > 0 && (
                      <div className="text-[8px] sm:text-[9px] font-bold text-amber-400 leading-tight">
                        Due:${table.amount_remaining.toFixed(0)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Waiter / Timer */}
              <div className="flex items-center justify-between text-[8px] text-slate-400 pt-0.5 border-t border-slate-800/80 leading-none">
                <span className="truncate max-w-[48px] font-medium">
                  {isOccupied ? (table.assigned_waiter || 'Staff') : `${table.capacity} seats`}
                </span>
                {isOccupied && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2 h-2" />
                    <span>{table.elapsed_minutes || 0}m</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Responsive Grid View
  return (
    <div className="p-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map(table => (
          <TableCard
            key={table.id}
            table={table}
            onClick={() => onTableClick(table)}
          />
        ))}
      </div>
    </div>
  );
};
