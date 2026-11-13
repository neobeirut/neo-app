import React from 'react';
import { useRestaurantTheme } from '../theme/useRestaurantTheme';
import { type PosTable, formatElapsedDuration } from './types';
import { TableCard } from './TableCard';
import { Users, Clock } from 'lucide-react';

interface FloorPlanProps {
  tables: PosTable[];
  viewMode?: 'canvas' | 'grid';
  selectedTableId?: string | null;
  onTableClick: (table) => void;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({ 
  tables, 
  viewMode = 'grid', 
  selectedTableId = null,
  onTableClick 
}) => {
  const { primaryColor } = useRestaurantTheme();

  if (viewMode === 'canvas') {
    return (
      <div 
        className="w-full h-full min-h-[560px] relative bg-[#F5F6F4] overflow-hidden select-none"
        style={{
          backgroundImage: 'radial-gradient(#CBD5E1 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }}
      >
        {tables.map(table => {
          const isAvailable = table.status === 'available';
          const isOpenNoProduct = table.status === 'open';
          const isBillRequested = table.status === 'bill_requested';
          const isOccupied = table.status === 'occupied' || isBillRequested;
          const isSelected = table.id === selectedTableId;

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
              data-table-code={table.table_code}
              onClick={() => onTableClick(table)}
              style={{
                left: `${table.position_x}%`,
                top: `${table.position_y}%`,
                width: `${renderedWidth}%`,
                ...(isSelected ? { borderColor: primaryColor } : {})
              }}
              className={`absolute p-1.5 sm:p-2 border transition-all cursor-pointer select-none shadow-md active:scale-95 flex flex-col justify-between ${shapeClass} ${
                isSelected
                  ? 'ring-4 bg-[#E9F4ED] shadow-lg z-20 scale-105'
                  : isOpenNoProduct
                  ? 'bg-white border-sky-400 hover:border-sky-500'
                  : isAvailable
                  ? 'bg-white border-emerald-400 hover:border-emerald-500'
                  : isBillRequested
                  ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400 animate-pulse'
                  : 'bg-white border-rose-400'
              }`}
            >
              {/* Top Code & Guests */}
              <div className="flex items-center justify-between leading-none">
                <span className="font-black text-[#242B28] text-xs tracking-wider">
                  {table.table_code}
                </span>
                <span className="flex items-center gap-0.5 text-[9px] text-[#5E6964] font-bold">
                  <Users className="w-2.5 h-2.5" />
                  {(isOccupied || isOpenNoProduct) && table.guest_count ? table.guest_count : table.capacity}
                </span>
              </div>

              {/* Status / Financials */}
              <div className="my-auto text-center py-0.5">
                {isOpenNoProduct ? (
                  <div>
                    <span className="text-[9px] sm:text-[10px] font-black text-sky-700 uppercase tracking-wider block">
                      Open
                    </span>
                    <span className="text-[8px] text-[#5E6964] block -mt-0.5">
                      No items
                    </span>
                  </div>
                ) : isAvailable ? (
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                    Free
                  </span>
                ) : (
                  <div>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider block" style={{ color: primaryColor }}>
                      OPEN
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Waiter / Timer */}
              <div className="flex items-center justify-between text-[8px] text-[#5E6964] pt-0.5 border-t border-[#E0E3DF] leading-none">
                <span className="truncate max-w-[48px] font-medium">
                  {isOpenNoProduct ? (table.assigned_waiter || 'Staff') : isOccupied ? (table.assigned_waiter || 'Staff') : `${table.capacity} seats`}
                </span>
                {(isOccupied || isOpenNoProduct) && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-2 h-2" />
                    <span>{formatElapsedDuration(table.elapsed_minutes)}</span>
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
            isSelected={table.id === selectedTableId}
            onClick={() => onTableClick(table)}
          />
        ))}
      </div>
    </div>
  );
};
