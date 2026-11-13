import React, { useState, useEffect, useRef } from 'react';
import { Camera, X } from 'lucide-react';
import type { KdsFire, KdsFireItem } from './types';
import { updateFireItemStatus, retryPrintChit, bumpKdsFire, isHoldItem, resolveProductImageUrl } from './kdsService';

interface KdsExpoScreenProps {
  fires: KdsFire[];
  onTicketUpdated: () => void;
}

const KdsExpoGridItem: React.FC<{
  children: React.ReactNode;
  colSpanClass?: string;
  itemCount: number;
}> = ({ children, colSpanClass = '', itemCount }) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const initialEstimate = 140 + itemCount * 46;
  const initialSpan = Math.max(8, Math.ceil((initialEstimate + 16) / 24));
  const [rowSpan, setRowSpan] = useState<number>(initialSpan);

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    const updateSpan = () => {
      const child = el.firstElementChild as HTMLElement | null;
      const height = child ? child.offsetHeight : el.offsetHeight;
      if (height > 0) {
        const span = Math.ceil((height + 16) / 24);
        setRowSpan(span);
      }
    };

    updateSpan();

    const ro = new ResizeObserver(() => {
      updateSpan();
    });

    const target = (el.firstElementChild as HTMLElement) || el;
    ro.observe(target);

    return () => ro.disconnect();
  }, [itemCount]);

  return (
    <div
      ref={itemRef}
      className={colSpanClass}
      style={{ gridRowEnd: `span ${rowSpan}` }}
    >
      {children}
    </div>
  );
};

export const KdsExpoScreen: React.FC<KdsExpoScreenProps> = ({ fires, onTicketUpdated }) => {
  const [printStatus, setPrintStatus] = useState<Record<number, string>>({});
  const [previewItem, setPreviewItem] = useState<KdsFireItem | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const activeFires = fires.filter(f => f.status === 'active');

  const handleOpenPreview = async (item: KdsFireItem) => {
    setPreviewItem(item);
    if (item.product_image) {
      setPreviewImageUrl(item.product_image);
      return;
    }
    setPreviewLoading(true);
    setPreviewImageUrl(null);
    try {
      const url = await resolveProductImageUrl(item.product_id, item.product_name_snapshot);
      setPreviewImageUrl(url);
    } catch {
      setPreviewImageUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBumpEntireOrder = async (fire: KdsFire) => {
    for (const item of (fire.items || [])) {
      if (!isHoldItem(item) && item.status !== 'bumped' && item.status !== 'voided') {
        await updateFireItemStatus(item.id, 'bumped');
      }
    }
    await bumpKdsFire(fire.id);
    onTicketUpdated();
  };

  const handleRetryPrint = async (fire: KdsFire) => {
    setPrintStatus(prev => ({ ...prev, [fire.id]: 'Printing...' }));
    const expoStation = {
      id: 'expo',
      branch_id: '',
      code: 'EXPO',
      name: 'Expo Station',
      station_type: 'expo' as const,
      color: '#10b981',
      sort_order: 99,
      active: true,
      display_mode: 'grid' as const,
      allow_bump_all: true,
      sound_enabled: true,
      default_timer_yellow_seconds: 600,
      default_timer_red_seconds: 900,
      printer_destination_key: 'kitchen-printer'
    };
    const res = await retryPrintChit({ fire, station: expoStation });
    setPrintStatus(prev => ({ ...prev, [fire.id]: res.success ? '✓ Printed' : 'Failed' }));
    setTimeout(() => {
      setPrintStatus(prev => {
        const next = { ...prev };
        delete next[fire.id];
        return next;
      });
    }, 2500);
  };

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4"
      style={{
        gridAutoRows: '8px',
        gridAutoFlow: 'dense'
      }}
    >
      {activeFires.length === 0 ? (
        <div className="col-span-full py-20 text-center text-gray-500 font-medium">
          No active orders on Expo. All items prepared and served.
        </div>
      ) : (
        activeFires.map((fire) => {
          const items = fire.items || [];
          const foodItems = items.filter(i => !isHoldItem(i) && i.status !== 'voided');
          const readyCount = foodItems.filter(i => i.status === 'ready' || i.status === 'bumped').length;
          const totalCount = foodItems.length;
          const isFullyReady = totalCount > 0 && readyCount === totalCount;
          const hasManyItems = foodItems.length > 6;
          const colSpanClass = hasManyItems ? 'col-span-1 md:col-span-2' : 'col-span-1';

          return (
            <KdsExpoGridItem
              key={fire.id}
              colSpanClass={colSpanClass}
              itemCount={foodItems.length}
            >
              <div
                className={`bg-white rounded-2xl border flex flex-col overflow-hidden shadow-md transition-all ${
                  isFullyReady
                    ? 'border-emerald-500 ring-2 ring-emerald-500 shadow-emerald-500/20'
                    : 'border-slate-300'
                }`}
              >
                {/* Header */}
                <div className="bg-slate-50 p-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xl text-slate-900">
                      {fire.table_label_snapshot ? `TABLE ${fire.table_label_snapshot}` : `ORDER #${fire.order_id}`}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-md font-black bg-slate-200 text-slate-800 border border-slate-300">
                      FIRE #{fire.fire_number}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                    <span>{fire.service_type?.toUpperCase()}</span>
                    <span>•</span>
                    <span>{fire.waiter_reference_snapshot || 'Staff'}</span>
                  </div>

                  {/* Readiness bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1 font-bold">
                      <span className={isFullyReady ? 'text-emerald-700' : 'text-amber-700'}>
                        {isFullyReady ? '✓ ALL ITEMS READY — READY TO SERVE' : `${readyCount} of ${totalCount} Ready`}
                      </span>
                      <span className="text-slate-500">
                        {totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${isFullyReady ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${totalCount > 0 ? (readyCount / totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Items grouped by station - dynamic natural height */}
                <div className={`p-4 flex-1 bg-white ${hasManyItems ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-2'}`}>
                  {items.map((item) => {
                    if (isHoldItem(item)) {
                      return (
                        <div
                          key={item.id}
                          className="col-span-full my-2 py-1.5 px-3 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between text-indigo-900 text-xs font-bold select-none"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>⏸️</span>
                            <span className="uppercase tracking-wider text-indigo-900">HOLD • NEXT COURSE</span>
                          </span>
                          <span className="text-[10px] font-mono text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300">
                            {item.notes_snapshot || 'Kitchen waits for fire'}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border text-sm flex items-center justify-between ${
                          item.status === 'ready'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-medium'
                            : item.status === 'preparing'
                            ? 'bg-amber-50 border-amber-300 text-amber-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-black text-amber-800">{item.quantity}x</span>
                          <span className="font-bold text-slate-900">{item.product_name_snapshot}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(item)}
                            className="p-1 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-800 border border-slate-200 hover:border-amber-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                            title={`View photo of ${item.product_name_snapshot}`}
                          >
                            <Camera size={13} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300">
                            {item.station_key}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            item.status === 'ready'
                              ? 'bg-emerald-600 text-white'
                              : item.status === 'preparing'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expo Action Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">#{fire.order_id}</span>
                    <button
                      onClick={() => handleRetryPrint(fire)}
                      className="text-xs px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold transition-all shadow-xs"
                      title="Retry / Re-Print Chit to Kitchen Printer"
                    >
                      {printStatus[fire.id] || '🖨️ Re-Print'}
                    </button>
                  </div>
                  <button
                    onClick={() => handleBumpEntireOrder(fire)}
                    className={`px-4 py-2 rounded-lg font-black text-xs uppercase tracking-wider transition-all shadow-sm ${
                      isFullyReady
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/30 scale-105'
                        : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    }`}
                  >
                    {isFullyReady ? 'Serve & Bump' : 'Bump Order'}
                  </button>
                </div>
            </div>
            </KdsExpoGridItem>
          );
        })
      )}

      {/* Product Image Modal */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
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
                    {previewItem.product_name_snapshot}
                  </h3>
                  <span className="text-xs font-bold text-amber-700">
                    Quantity: {previewItem.quantity}x
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Photo display */}
            <div className="p-4 bg-slate-900/5 flex flex-col items-center justify-center min-h-[260px] max-h-[70vh] overflow-y-auto">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <div className="text-3xl animate-spin mb-2">🔄</div>
                  <span className="text-xs font-bold">Loading photo...</span>
                </div>
              ) : previewImageUrl ? (
                <div className="relative w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <img
                    src={previewImageUrl}
                    alt={previewItem.product_name_snapshot}
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
                    No image URL has been configured for "{previewItem.product_name_snapshot}" in the catalogue.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
