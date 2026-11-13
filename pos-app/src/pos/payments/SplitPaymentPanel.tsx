import React from 'react';
import type { TenderItem } from './types';
import { Trash2, Plus, DollarSign, Layers } from 'lucide-react';

interface SplitPaymentPanelProps {
  tenders: TenderItem[];
  orderTotal: number;
  onRemoveTender: (id: string) => void;
  onAddTenderClick?: () => void;
}

export const SplitPaymentPanel: React.FC<SplitPaymentPanelProps> = ({
  tenders,
  orderTotal,
  onRemoveTender,
  onAddTenderClick
}) => {
  const totalApplied = tenders.reduce((sum, t) => sum + t.appliedUsd, 0);
  const remaining = Math.max(0, orderTotal - totalApplied);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Layers className="w-4 h-4 text-[#1e5c4f]" />
          <span>Multi-Tender Breakdown ({tenders.length})</span>
        </div>
        {onAddTenderClick && remaining > 0 && (
          <button
            type="button"
            onClick={onAddTenderClick}
            className="flex items-center gap-1 text-xs font-bold text-[#1e5c4f] hover:text-[#16473D] bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Tender</span>
          </button>
        )}
      </div>

      {tenders.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-2 text-center">
          No split tenders added yet. Enter tender amount and click "Add Tender".
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {tenders.map((tender, index) => (
            <div
              key={tender.id || index}
              className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-sm shadow-xs"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs flex items-center justify-center font-bold">
                  {index + 1}
                </span>
                <div>
                  <div className="font-bold text-slate-900">{tender.method}</div>
                  {tender.currency === 'LBP' && tender.exchangeRate && (
                    <div className="text-[11px] text-slate-500">
                      {tender.tenderedAmount.toLocaleString()} LBP @ {tender.exchangeRate.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-black text-[#1e5c4f]">
                    ${tender.appliedUsd.toFixed(2)}
                  </div>
                  {tender.changeAmount > 0 && (
                    <div className="text-[11px] text-amber-700 font-bold">
                      Change: ${tender.changeAmount.toFixed(2)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveTender(tender.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                  title="Remove Tender"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-slate-200 flex justify-between text-xs font-bold">
        <span className="text-slate-500">Total Applied:</span>
        <span className="text-[#1e5c4f] font-black">${totalApplied.toFixed(2)} / ${orderTotal.toFixed(2)}</span>
      </div>
    </div>
  );
};
