import React, { useState, useEffect } from 'react';
import { Camera, X } from 'lucide-react';
import type { KdsFireItem, KdsFireItemStatus } from './types';
import { updateFireItemStatus, refireFireItem, isHoldItem, resolveProductImageUrl } from './kdsService';

interface KdsItemProps {
  item: KdsFireItem;
  stationType?: string;
  density?: 'comfortable' | 'compact';
  onItemUpdated: () => void;
}

export const KdsItem: React.FC<KdsItemProps> = ({ item, stationType, density = 'compact', onItemUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [showRefireModal, setShowRefireModal] = useState(false);
  const [refireReason, setRefireReason] = useState('Customer Remake');
  const [refireQty, setRefireQty] = useState(1);

  // Product Image preview modal state
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(item.product_image || null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isCompact = density === 'compact';

  useEffect(() => {
    if (item.product_image) {
      setImageUrl(item.product_image);
    }
  }, [item.product_image]);

  const handleOpenImageModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowImageModal(true);
    setImageError(false);

    let currentUrl = item.product_image || imageUrl;
    if (!currentUrl) {
      setImageLoading(true);
      try {
        const resolved = await resolveProductImageUrl(item.product_id, item.product_name_snapshot);
        if (resolved) {
          setImageUrl(resolved);
        } else {
          setImageError(true);
        }
      } catch (err) {
        setImageError(true);
      } finally {
        setImageLoading(false);
      }
    }
  };

  // If item is a HOLD separator, render as an unclickable prominent course divider
  if (isHoldItem(item)) {
    const isFired = item.notes_snapshot?.includes('FIRED');

    if (isFired) {
      return (
        <div className={`col-span-full my-2 py-2 px-3 rounded-xl bg-orange-100 border-2 border-orange-500 flex items-center justify-between text-orange-950 shadow-sm select-none animate-pulse ${
          isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3'
        }`}>
          <div className="flex items-center gap-2">
            <span className={isCompact ? 'text-base' : 'text-lg'}>🔥</span>
            <span className={`font-black uppercase tracking-wider text-orange-900 ${isCompact ? 'text-[11px]' : 'text-xs'}`}>
              COURSE 2 FIRED • PREPARE NOW
            </span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-white bg-orange-600 px-2.5 py-0.5 rounded shadow-sm">
            FIRED
          </span>
        </div>
      );
    }

    return (
      <div className={`col-span-full my-2 rounded-xl bg-indigo-50 border-2 border-indigo-300 flex items-center justify-between text-indigo-950 shadow-sm select-none ${
        isCompact ? 'py-1.5 px-2.5' : 'py-2 px-3'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`animate-pulse ${isCompact ? 'text-sm' : 'text-base'}`}>⏸️</span>
          <span className={`font-black uppercase tracking-wider text-indigo-900 ${isCompact ? 'text-[11px]' : 'text-xs'}`}>
            HOLD • NEXT COURSE
          </span>
        </div>
        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded border border-indigo-300">
          {item.notes_snapshot || 'Kitchen waits for fire'}
        </span>
      </div>
    );
  }

  const getStatusColor = (status: KdsFireItemStatus) => {
    switch (status) {
      case 'queued': return 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-sm';
      case 'preparing': return 'bg-amber-50/80 text-amber-950 border-amber-400 ring-1 ring-amber-400/40 shadow-sm';
      case 'ready': return 'bg-emerald-50 text-emerald-950 border-emerald-500 ring-1 ring-emerald-500/40 shadow-sm';
      case 'bumped': return 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70';
      case 'voided': return 'bg-rose-50 text-rose-500 border-rose-200 line-through opacity-70';
      default: return 'bg-white text-slate-800 border-slate-300';
    }
  };

  const advanceStatus = async () => {
    if (loading || item.status === 'bumped' || item.status === 'voided') return;
    setLoading(true);
    let nextStatus: KdsFireItemStatus = 'preparing';
    if (item.status === 'queued') nextStatus = 'preparing';
    else if (item.status === 'preparing') nextStatus = 'ready';
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
      className={`rounded-lg border transition-all cursor-pointer select-none ${
        isCompact ? 'p-2 mb-1.5' : 'p-3 mb-2'
      } ${getStatusColor(item.status)} hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <span className={`flex-shrink-0 rounded bg-amber-100 text-amber-900 font-black flex items-center justify-center border border-amber-300 shadow-xs ${
            isCompact ? 'w-6 h-6 text-xs' : 'w-7 h-7 text-sm'
          }`}>
            {item.quantity}x
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-slate-900 leading-tight font-black ${isCompact ? 'text-sm' : 'text-base'}`}>
                {item.product_name_snapshot}
              </span>
              {/* Product Photo Button */}
              <button
                type="button"
                onClick={handleOpenImageModal}
                className="p-1 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                title={`View photo of ${item.product_name_snapshot}`}
              >
                <Camera size={isCompact ? 13 : 15} />
              </button>
            </div>

            {/* Modifiers Snapshot */}
            {item.modifiers_snapshot && item.modifiers_snapshot.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.modifiers_snapshot.map((m, idx) => {
                  const mName = String(m?.name || '');
                  const isRemove = m.action === 'remove' || mName.toLowerCase().startsWith('no ') || mName.toLowerCase().startsWith('without ');
                  return (
                    <span
                      key={idx}
                      className={`rounded font-bold border ${
                        isCompact ? 'text-[11px] px-1 py-0.25' : 'text-xs px-1.5 py-0.5'
                      } ${
                        isRemove
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {isRemove ? `[- ${mName}]` : `[+ ${mName}]`}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Special Instructions / Notes */}
            {item.notes_snapshot && (
              <div className="mt-1 text-xs text-amber-800 font-bold italic flex items-center gap-1">
                <span className="px-1.5 py-0.2 bg-amber-200/90 text-amber-950 rounded text-[10px] font-black uppercase">NOTE</span> {item.notes_snapshot}
              </div>
            )}

            {/* Refire Indicator */}
            {item.refire_of_fire_item_id && (
              <div className="mt-1 text-xs text-orange-900 font-black flex items-center gap-1 bg-orange-100 p-1 rounded border border-orange-300">
                <span>🔥 RE-FIRE:</span> {item.refire_reason || 'Remake'}
              </div>
            )}
          </div>
        </div>

        {/* Status indicator and action buttons */}
        <div className="flex flex-col items-end gap-1">
          <span className={`uppercase font-black tracking-wider rounded border ${
            isCompact ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
          } ${
            item.status === 'ready'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : item.status === 'preparing'
              ? 'bg-amber-500 text-slate-950 border-amber-600'
              : 'bg-slate-100 text-slate-700 border-slate-300'
          }`}>
            {item.status.replace('_', ' ')}
          </span>

          {item.status !== 'bumped' && item.status !== 'voided' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowRefireModal(true);
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-orange-600 p-1 transition-colors"
              title="Refire this item"
            >
              🔥 Re-fire
            </button>
          )}
        </div>
      </div>

      {/* Product Image Modal */}
      {showImageModal && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowImageModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 select-none cursor-default"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center">
                  <Camera size={18} />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight">
                    {item.product_name_snapshot}
                  </h3>
                  <span className="text-xs font-bold text-amber-700">
                    Quantity: {item.quantity}x
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Photo display */}
            <div className="p-4 bg-slate-900/5 flex flex-col items-center justify-center min-h-[260px] max-h-[70vh] overflow-y-auto">
              {imageLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <div className="text-3xl animate-spin mb-2">🔄</div>
                  <span className="text-xs font-bold">Loading photo...</span>
                </div>
              ) : (imageUrl && !imageError) ? (
                <div className="relative w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <img
                    src={imageUrl}
                    alt={item.product_name_snapshot}
                    onError={() => setImageError(true)}
                    className="w-full max-h-[380px] object-contain rounded-xl"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                    <Camera size={28} />
                  </div>
                  <p className="font-bold text-slate-700 text-sm">No photo available</p>
                  <p className="text-xs text-slate-400 mt-1">
                    No image URL has been configured for "{item.product_name_snapshot}" in the catalogue.
                  </p>
                </div>
              )}

              {/* Modifiers Snapshot */}
              {item.modifiers_snapshot && item.modifiers_snapshot.length > 0 && (
                <div className="mt-3 w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs">
                  <span className="font-black text-slate-700 block mb-1">Modifiers:</span>
                  <div className="flex flex-wrap gap-1">
                    {item.modifiers_snapshot.map((m, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-200"
                      >
                        {m.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {item.notes_snapshot && (
                <div className="mt-2 w-full p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-bold">
                  <span className="uppercase text-[10px] tracking-wider text-amber-800 block">Note:</span>
                  {item.notes_snapshot}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refire Modal */}
      {showRefireModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-2 flex items-center gap-2">
              🔥 Re-fire Item
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Re-fire creates a priority replacement item on the KDS without charging the customer again.
            </p>

            <div className="mb-4">
              <label className="text-xs text-slate-700 font-bold block mb-1">Reason for Re-fire</label>
              <select
                value={refireReason}
                onChange={(e) => setRefireReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 text-sm focus:border-amber-500 outline-none"
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
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                disabled={loading}
                onClick={handleRefireSubmit}
                className="px-4 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm transition-all"
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
