import React, { useState, useEffect, useMemo } from 'react';
import { Camera, X } from 'lucide-react';
import type { KdsBumpedOrder, KdsBumpedItem } from './types';
import { fetchTodayBumpedOrders, resolveProductImageUrl } from './kdsService';

interface KdsBumpedOrdersModalProps {
  branchId?: string;
  onClose: () => void;
}

export const KdsBumpedOrdersModal: React.FC<KdsBumpedOrdersModalProps> = ({ branchId, onClose }) => {
  const [orders, setOrders] = useState<KdsBumpedOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'dine_in' | 'takeaway'>('all');
  const [previewItem, setPreviewItem] = useState<KdsBumpedItem | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleOpenPreview = async (item: KdsBumpedItem) => {
    setPreviewItem(item);
    if (item.product_image) {
      setPreviewImageUrl(item.product_image);
      return;
    }
    setPreviewLoading(true);
    setPreviewImageUrl(null);
    try {
      const url = await resolveProductImageUrl(item.productId, item.name);
      setPreviewImageUrl(url);
    } catch {
      setPreviewImageUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    const data = await fetchTodayBumpedOrders(branchId);
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [branchId]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Type filter
      if (filterType === 'dine_in') {
        const t = (order.serviceType || '').toLowerCase();
        if (t !== 'dine_in' && t !== 'dine-in') return false;
      } else if (filterType === 'takeaway') {
        const t = (order.serviceType || '').toLowerCase();
        if (t === 'dine_in' || t === 'dine-in') return false;
      }

      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchTable = (order.tableLabel || '').toLowerCase().includes(q);
      const matchOrderId = String(order.orderId).includes(q);
      const matchWaiter = (order.waiterName || '').toLowerCase().includes(q);
      const matchItems = (order.items || []).some(it => 
        it.name.toLowerCase().includes(q) || 
        it.modifiers.some(m => m.toLowerCase().includes(q)) ||
        (it.notes && it.notes.toLowerCase().includes(q))
      );

      return matchTable || matchOrderId || matchWaiter || matchItems;
    });
  }, [orders, searchQuery, filterType]);

  const totalFoodItemsToday = useMemo(() => {
    return orders.reduce((acc, o) => acc + o.totalFoodItems, 0);
  }, [orders]);

  const avgDurationMins = useMemo(() => {
    if (orders.length === 0) return 0;
    const total = orders.reduce((acc, o) => acc + (o.durationMinutes || 0), 0);
    return Math.round(total / orders.length);
  }, [orders]);

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '--:--';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 sm:p-6 select-none"
      onClick={onClose}
    >
      <div 
        className="bg-slate-100 w-full max-w-6xl h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Today's Bumped Orders
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300 text-xs font-bold uppercase tracking-wider">
                Read-Only Reference
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Historical record of orders bumped or served today from KDS • strictly view-only (no editing)
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Refresh today's bumped orders"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-300 hover:border-rose-300 transition-all cursor-pointer shadow-2xs"
              title="Close (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter & Summary Bar */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold">
              <span>✓ Total Bumped:</span>
              <span className="font-black text-sm">{orders.length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold">
              <span>🍽️ Items Served:</span>
              <span className="font-black text-sm">{totalFoodItemsToday}</span>
            </div>
            {avgDurationMins > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-bold">
                <span>⏱️ Avg Prep:</span>
                <span className="font-black text-sm">{avgDurationMins}m</span>
              </div>
            )}
          </div>

          {/* Search & Tabs */}
          <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'hover:text-slate-900'
                }`}
              >
                All ({orders.length})
              </button>
              <button
                onClick={() => setFilterType('dine_in')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === 'dine_in' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'hover:text-slate-900'
                }`}
              >
                Dine-In
              </button>
              <button
                onClick={() => setFilterType('takeaway')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === 'takeaway' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'hover:text-slate-900'
                }`}
              >
                Takeout / Delivery
              </button>
            </div>

            {/* Live Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Search table, order #, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-64 px-3 py-1.5 pl-8 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 shadow-2xs"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
                🔍
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Orders Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="text-3xl animate-spin mb-3">🔄</div>
              <p className="text-sm font-bold">Loading today's bumped orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <span className="text-4xl mb-3">📦</span>
              <p className="text-base font-bold text-slate-600">No Bumped Orders Found</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery || filterType !== 'all' 
                  ? 'No orders match your filter criteria.' 
                  : 'No orders have been bumped or completed yet today.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredOrders.map((order) => {
                const isDineIn = (order.serviceType || '').toLowerCase().includes('dine');
                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow flex flex-col overflow-hidden"
                  >
                    {/* Order Chit Header */}
                    <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg font-black text-xs uppercase tracking-wide ${
                          order.tableLabel 
                            ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                            : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                        }`}>
                          {order.tableLabel ? `Table ${order.tableLabel}` : (order.serviceType || 'Takeout')}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-400">
                          #{order.orderId}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ✓ Bumped
                      </span>
                    </div>

                    {/* Metadata Subheader */}
                    <div className="px-3.5 py-2 bg-slate-50/50 border-b border-slate-100 text-[11px] text-slate-500 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span>👤 {order.waiterName || 'Staff'}</span>
                        {order.guestCount ? (
                          <span>👥 {order.guestCount} {order.guestCount === 1 ? 'Guest' : 'Guests'}</span>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                        <span>🕐 In: {formatTime(order.firedAt)}</span>
                        <span>✓ Out: {formatTime(order.bumpedAt)} {order.durationMinutes ? `(${order.durationMinutes}m)` : ''}</span>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="p-3.5 flex-1 flex flex-col gap-2 overflow-y-auto max-h-64">
                      {order.items.map((item, idx) => {
                        if (item.isHold) {
                          return (
                            <div key={`${item.id}-${idx}`} className="text-center py-1 border-y border-dashed border-slate-300 my-1">
                              <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">
                                --- COURSE HOLD ---
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div 
                            key={`${item.id}-${idx}`}
                            className="flex items-start justify-between gap-2 text-xs py-1 border-b border-slate-100 last:border-b-0"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 text-[11px]">
                                  {item.quantity}x
                                </span>
                                <span className="font-bold text-slate-800">
                                  {item.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPreview(item)}
                                  className="p-0.5 rounded bg-slate-100 hover:bg-amber-100 text-slate-500 hover:text-amber-800 border border-slate-200 hover:border-amber-300 transition-all cursor-pointer shadow-2xs flex items-center justify-center"
                                  title={`View photo of ${item.name}`}
                                >
                                  <Camera size={12} />
                                </button>
                              </div>

                              {/* Modifiers */}
                              {item.modifiers.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 pl-6">
                                  {item.modifiers.map((mod, mIdx) => (
                                    <span 
                                      key={mIdx}
                                      className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200"
                                    >
                                      {mod}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Notes */}
                              {item.notes && (
                                <p className="text-[10px] font-medium text-amber-800 italic mt-0.5 pl-6">
                                  "{item.notes}"
                                </p>
                              )}
                            </div>

                            {item.stationKey && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200 flex-shrink-0">
                                {item.stationKey}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer: Read-only reference watermark */}
                    <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-slate-600">
                        {order.totalFoodItems} {order.totalFoodItems === 1 ? 'item' : 'items'}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                        <span>🔒</span>
                        <span>Reference Only</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700">
              Showing {filteredOrders.length} of {orders.length} bumped orders from today
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition-all cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>

      {/* Bumped Item Photo Modal */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 select-none cursor-default"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center">
                  <Camera size={18} />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight">
                    {previewItem.name}
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
                    alt={previewItem.name}
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
                    No image URL has been configured for "{previewItem.name}" in the catalogue.
                  </p>
                </div>
              )}
            </div>

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
