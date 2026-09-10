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
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Multi-Tender Breakdown ({tenders.length})</span>
        </div>
        {onAddTenderClick && remaining > 0 && (
          <button
            type="button"
            onClick={onAddTenderClick}
            className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30 transition-all"
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
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-xs flex items-center justify-center font-bold">
                  {index + 1}
                </span>
                <div>
                  <div className="font-semibold text-slate-200">{tender.method}</div>
                  {tender.currency === 'LBP' && tender.exchangeRate && (
                    <div className="text-[11px] text-slate-400">
                      {tender.tenderedAmount.toLocaleString()} LBP @ {tender.exchangeRate.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-bold text-emerald-400">
                    ${tender.appliedUsd.toFixed(2)}
                  </div>
                  {tender.changeAmount > 0 && (
                    <div className="text-[11px] text-amber-400">
                      Change: ${tender.changeAmount.toFixed(2)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveTender(tender.id)}
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                  title="Remove Tender"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-slate-800 flex justify-between text-xs font-semibold">
        <span className="text-slate-400">Total Applied:</span>
        <span className="text-emerald-400">${totalApplied.toFixed(2)} / ${orderTotal.toFixed(2)}</span>
      </div>
    </div>
  );
};
