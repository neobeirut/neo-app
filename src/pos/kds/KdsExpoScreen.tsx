import React from 'react';
import type { KdsFire, KdsFireItem } from './types';
import { updateFireItemStatus } from './kdsService';

interface KdsExpoScreenProps {
  fires: KdsFire[];
  onTicketUpdated: () => void;
}

export const KdsExpoScreen: React.FC<KdsExpoScreenProps> = ({ fires, onTicketUpdated }) => {
  const activeFires = fires.filter(f => f.status === 'active');

  const handleBumpEntireOrder = async (fire: KdsFire) => {
    for (const item of (fire.items || [])) {
      if (item.status !== 'bumped' && item.status !== 'voided') {
        await updateFireItemStatus(item.id, 'bumped');
      }
    }
    onTicketUpdated();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {activeFires.length === 0 ? (
        <div className="col-span-full py-20 text-center text-gray-500 font-medium">
          No active orders on Expo. All items prepared and served.
        </div>
      ) : (
        activeFires.map((fire) => {
          const items = fire.items || [];
          const activeItems = items.filter(i => i.status !== 'voided');
          const readyCount = activeItems.filter(i => i.status === 'ready' || i.status === 'bumped').length;
          const totalCount = activeItems.length;
          const isFullyReady = totalCount > 0 && readyCount === totalCount;

          return (
            <div
              key={fire.id}
              className={`bg-gray-900 rounded-xl border flex flex-col overflow-hidden shadow-2xl transition-all ${
                isFullyReady
                  ? 'border-emerald-500 ring-2 ring-emerald-500 shadow-emerald-500/20'
                  : 'border-gray-800'
              }`}
            >
              {/* Header */}
              <div className="bg-gray-850 p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xl text-white">
                    {fire.table_label_snapshot ? `TABLE ${fire.table_label_snapshot}` : `ORDER #${fire.order_id}`}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-md font-black bg-gray-800 text-amber-400 border border-gray-700">
                    FIRE #{fire.fire_number}
                  </span>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                  <span>{fire.service_type?.toUpperCase()}</span>
                  <span>•</span>
                  <span>{fire.waiter_reference_snapshot || 'Staff'}</span>
                </div>

                {/* Readiness bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1 font-bold">
                    <span className={isFullyReady ? 'text-emerald-400' : 'text-amber-400'}>
                      {isFullyReady ? '✓ ALL ITEMS READY — READY TO SERVE' : `${readyCount} of ${totalCount} Ready`}
                    </span>
                    <span className="text-gray-400">
                      {totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${isFullyReady ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${totalCount > 0 ? (readyCount / totalCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Items grouped by station */}
              <div className="p-4 flex-1 overflow-y-auto max-h-[380px] space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-lg border text-sm flex items-center justify-between ${
                      item.status === 'ready'
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                        : item.status === 'in_progress'
                        ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                        : 'bg-gray-800/60 border-gray-700 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-black text-amber-400">{item.quantity}x</span>
                      <span className="font-semibold">{item.product_name_snapshot}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                        {item.station_key}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        item.status === 'ready' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {item.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Expo Action Footer */}
              <div className="p-4 bg-gray-850 border-t border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-400">Order #{fire.order_id}</span>
                <button
                  onClick={() => handleBumpEntireOrder(fire)}
                  className={`px-5 py-2.5 rounded-lg font-black text-sm uppercase tracking-wider transition-all ${
                    isFullyReady
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-gray-950 shadow-lg shadow-emerald-500/30 scale-105'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                  }`}
                >
                  {isFullyReady ? 'Serve & Bump' : 'Bump Order'}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
