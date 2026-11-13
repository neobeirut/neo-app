import React from 'react';
import type { EnrichedUpsell } from '../hooks/usePosUpsell';

interface UpsellRecommendationBarProps {
  upsells: EnrichedUpsell[];
  onSelectProduct: (product: any) => void;
  isProduct86d?: (productId: string | number) => boolean;
}

export const UpsellRecommendationBar: React.FC<UpsellRecommendationBarProps> = ({
  upsells,
  onSelectProduct,
  isProduct86d
}) => {
  if (!upsells || upsells.length === 0) return null;

  return (
    <div className="px-4 py-2 bg-emerald-50/80 border-b border-emerald-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
      <div className="flex items-center gap-1.5 text-[#1e5c4f] font-black text-xs shrink-0 pr-1">
        <span className="animate-pulse">✨</span>
        <span className="uppercase tracking-wider text-[10px]">Chef Recommended:</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {upsells.map((up) => {
          const is86 = isProduct86d ? isProduct86d(up.product.id) : false;
          const price = parseFloat(up.product.price || up.product.unit_price_usd || 0).toFixed(2);

          return (
            <button
              key={up.id}
              type="button"
              disabled={is86}
              onClick={() => onSelectProduct(up.product)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all shrink-0 active:scale-95 cursor-pointer ${
                is86
                  ? 'opacity-40 grayscale border-slate-200 bg-slate-100 cursor-not-allowed'
                  : 'bg-white hover:bg-emerald-50 border-slate-200 hover:border-[#1e5c4f] text-slate-800 shadow-xs'
              }`}
              title={is86 ? 'Unavailable (86)' : `Add ${up.product.name} to cart`}
            >
              <span className="text-[11px] font-black text-[#1e5c4f]">
                {up.type === 'limited' ? '🔥 Limited:' : '⭐ Special:'}
              </span>
              <span className="font-bold text-slate-900 truncate max-w-[150px]">
                {up.product.name}
              </span>
              <span className="font-black text-[#1e5c4f]">
                ${price}
              </span>
              {up.remaining_qty !== null && up.remaining_qty !== undefined && (
                <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.2 rounded font-mono font-bold">
                  {up.remaining_qty} left
                </span>
              )}
              <span className="text-[#1e5c4f] font-black text-[12px] ml-0.5">+</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
