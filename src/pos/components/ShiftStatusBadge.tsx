import React from 'react';
import type { ShiftCashRecord } from '../services/shiftCashBridge';

interface ShiftStatusBadgeProps {
  shift: ShiftCashRecord | null;
  onOpenShiftClick: () => void;
  onCloseShiftClick?: () => void;
}

export const ShiftStatusBadge: React.FC<ShiftStatusBadgeProps> = ({
  shift,
  onOpenShiftClick,
  onCloseShiftClick
}) => {
  if (!shift) {
    return (
      <button
        type="button"
        onClick={onOpenShiftClick}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-black bg-rose-950/70 border border-rose-500/50 text-rose-300 hover:bg-rose-900 transition-all cursor-pointer animate-pulse"
        title="Shift is closed. Click to open shift and enable payments."
      >
        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
        <span>🔴 Shift Closed</span>
        <span className="text-[10px] bg-rose-900/60 px-1 py-0.5 rounded border border-rose-500/30">Open</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-[#222734] border border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-xs">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span className="text-gray-300 font-medium">Shift:</span>
      <span className="text-white font-extrabold">{shift.shift}</span>
      <span className="text-gray-400 text-[11px] font-mono">(${Number(shift.opening_usd).toFixed(0)})</span>
      {onCloseShiftClick && (
        <button
          type="button"
          onClick={onCloseShiftClick}
          className="ml-1 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-1.5 py-0.5 rounded border border-gray-600"
          title="Close current shift"
        >
          End
        </button>
      )}
    </div>
  );
};
