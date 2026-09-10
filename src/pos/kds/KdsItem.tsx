import React, { useState } from 'react';
import type { KdsFireItem, KdsFireItemStatus } from './types';
import { updateFireItemStatus, refireFireItem } from './kdsService';

interface KdsItemProps {
  item: KdsFireItem;
  stationType?: string;
  onItemUpdated: () => void;
}

export const KdsItem: React.FC<KdsItemProps> = ({ item, stationType, onItemUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [showRefireModal, setShowRefireModal] = useState(false);
  const [refireReason, setRefireReason] = useState('Customer Remake');
  const [refireQty, setRefireQty] = useState(1);

  const getStatusColor = (status: KdsFireItemStatus) => {
    switch (status) {
      case 'queued': return 'bg-gray-800 text-gray-300 border-gray-700';
      case 'in_progress': return 'bg-amber-950/40 text-amber-300 border-amber-500/50';
      case 'ready': return 'bg-emerald-950/50 text-emerald-300 border-emerald-500';
      case 'bumped': return 'bg-slate-900 text-slate-500 border-slate-800 line-through';
      case 'voided': return 'bg-rose-950/40 text-rose-400 border-rose-800 line-through';
      default: return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  const advanceStatus = async () => {
    if (loading || item.status === 'bumped' || item.status === 'voided') return;
    setLoading(true);
    let nextStatus: KdsFireItemStatus = 'in_progress';
    if (item.status === 'queued') nextStatus = 'in_progress';
    else if (item.status === 'in_progress') nextStatus = 'ready';
    else if (item.status === 'ready') nextStatus = 'bumped';

    await updateFireItemStatus(item.id, nextStatus);
    setLoading(false);
    onItemUpdated();
  };

  const handleRefireSubmit = async () => {
    if (!refireReason.trim()) return;
    setLoading(true);
    await refireFireItem(item.id, refireReason, refireQty);
    setLoading(false);
    setShowRefireModal(false);
    onItemUpdated();
  };

  return (
    <div
      onClick={advanceStatus}
      className={`p-3 rounded-lg border transition-all cursor-pointer select-none mb-2 ${getStatusColor(item.status)} hover:brightness-110`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <span className="flex-shrink-0 w-7 h-7 rounded bg-amber-500/20 text-amber-400 font-black text-sm flex items-center justify-center border border-amber-500/30">
            {item.quantity}x
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white text-base leading-tight">
              {item.product_name_snapshot}
            </div>

            {/* Modifiers Snapshot */}
            {item.modifiers_snapshot && item.modifiers_snapshot.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.modifiers_snapshot.map((m, idx) => {
                  const isRemove = m.action === 'remove' || m.name.toLowerCase().startsWith('no ') || m.name.toLowerCase().startsWith('without ');
                  return (
                    <span
                      key={idx}
                      className={`text-xs px-1.5 py-0.5 rounded font-medium border ${
                        isRemove
                          ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                          : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {isRemove ? `[- ${m.name}]` : `[+ ${m.name}]`}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Special Instructions / Notes */}
            {item.notes_snapshot && (
              <div className="mt-1 text-xs text-amber-300 font-semibold italic flex items-center gap-1">
                <span className="px-1 bg-amber-500/20 rounded">NOTE</span> {item.notes_snapshot}
              </div>
            )}

            {/* Refire Indicator */}
            {item.refire_of_fire_item_id && (
              <div className="mt-1 text-xs text-orange-400 font-black flex items-center gap-1 bg-orange-950/60 p-1 rounded border border-orange-500/40">
                <span>🔥 RE-FIRE:</span> {item.refire_reason || 'Remake'}
              </div>
            )}
          </div>
        </div>

        {/* Status indicator and action buttons */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded border">
            {item.status.replace('_', ' ')}
          </span>

          {item.status !== 'bumped' && item.status !== 'voided' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRefireModal(true);
              }}
              className="text-[10px] text-gray-400 hover:text-orange-400 p-1 transition-colors"
              title="Refire this item"
            >
              🔥 Re-fire
            </button>
          )}
        </div>
      </div>

      {/* Refire Modal */}
      {showRefireModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              🔥 Re-fire Item
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Re-fire creates a priority replacement item on the KDS without charging the customer again.
            </p>

            <div className="mb-4">
              <label className="text-xs text-gray-400 font-medium block mb-1">Reason for Re-fire</label>
              <select
                value={refireReason}
                onChange={(e) => setRefireReason(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-white text-sm focus:border-amber-500 outline-none"
              >
                <option value="Customer Remake">Customer Remake</option>
                <option value="Cold / Remake">Food was Cold</option>
                <option value="Wrong Modifier">Incorrect Modifiers / Prep</option>
                <option value="Spill / Dropped">Spilled / Dropped in Service</option>
                <option value="Overcooked / Burned">Overcooked / Quality Issue</option>
              </select>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowRefireModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={handleRefireSubmit}
                className="px-4 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-all"
              >
                {loading ? 'Firing...' : 'Confirm Re-fire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
