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
    <div className="px-4 py-2 bg-gradient-to-r from-amber-950/40 via-[#181C24] to-pink-950/40 border-b border-amber-500/30 flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
      <div className="flex items-center gap-1.5 text-amber-400 font-black text-xs shrink-0 pr-1">
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all shrink-0 active:scale-95 ${
                is86
                  ? 'opacity-40 grayscale border-gray-700 bg-gray-900 cursor-not-allowed'
                  : 'bg-[#1F2430] hover:bg-[#282F40] border-amber-500/40 hover:border-amber-400 text-white shadow-sm'
              }`}
              title={is86 ? 'Unavailable (86)' : `Add ${up.product.name} to cart`}
            >
              <span className="text-[11px] font-extrabold text-amber-300">
                {up.type === 'limited' ? '🔥 Limited:' : '⭐ Special:'}
              </span>
              <span className="font-bold text-white truncate max-w-[150px]">
                {up.product.name}
              </span>
              <span className="font-black text-emerald-400">
                ${price}
              </span>
              {up.remaining_qty !== null && up.remaining_qty !== undefined && (
                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-mono font-bold">
                  {up.remaining_qty} left
                </span>
              )}
              <span className="text-amber-400 font-extrabold text-[11px] ml-0.5">+</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
