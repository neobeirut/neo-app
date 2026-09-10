import React, { useState } from 'react';
import { useOrders } from './useOrders';
import { OrderFilters } from './OrderFilters';
import { OrderCard } from './OrderCard';
import type { FlowPosOrder } from './orderAdapter';

interface OrdersHubScreenProps {
  branchName?: string;
  onSelectOrder?: (order: FlowPosOrder) => void;
  onOpenOrderToTicket?: (order: FlowPosOrder) => void;
}

export const OrdersHubScreen: React.FC<OrdersHubScreenProps> = ({
  branchName = 'Cloud Kitchen',
  onSelectOrder,
  onOpenOrderToTicket
}) => {
  const {
    filteredOrders,
    counts,
    activeStatusTab,
    setActiveStatusTab,
    activeChannelFilter,
    setActiveChannelFilter,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    lastRefreshed,
    isMuted,
    setIsMuted,
    refreshOrders
  } = useOrders();

  const [selectedOrderId, setSelectedOrderId] = useState<string | number | null>(null);

  const handleCardClick = (order: FlowPosOrder) => {
    setSelectedOrderId(order.id);
    if (onSelectOrder) {
      onSelectOrder(order);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0B0D12] text-white select-none">
      <div className="px-6 py-3 bg-[#11141B] border-b border-[#262D3D] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="font-black text-sm tracking-wider text-white uppercase">Orders Hub</h2>
          </div>
          <span className="text-gray-500 text-xs">|</span>
          <span className="text-xs font-bold text-gray-300">Branch: {branchName}</span>
          <span className="px-2 py-0.5 rounded-md bg-[#1d2330] text-gray-400 text-[10px] font-bold">
            Live Commerce Sync
          </span>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[11px] text-gray-500">
              Updated: {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={'px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ' + (
              isMuted
                ? 'bg-rose-950/60 text-rose-300 border-rose-500/50'
                : 'bg-[#181C24] text-gray-300 border-[#262D3D] hover:text-white'
            )}
            title={isMuted ? 'Chime muted' : 'Chime active on new orders'}
          >
            <span>{isMuted ? '🔇' : '🔔'}</span>
            <span>{isMuted ? 'Muted' : 'Alerts On'}</span>
          </button>
          <button
            type="button"
            onClick={refreshOrders}
            disabled={isLoading}
            className="px-3 py-1 bg-[#181C24] hover:bg-[#222838] border border-[#262D3D] rounded-lg text-xs font-bold text-gray-200 transition flex items-center gap-1"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
            <span>{isLoading ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="px-6 py-4 bg-[#0F1218] border-b border-[#262D3D]">
        <OrderFilters
          activeStatusTab={activeStatusTab}
          onStatusTabChange={setActiveStatusTab}
          activeChannelFilter={activeChannelFilter}
          onChannelFilterChange={setActiveChannelFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          counts={counts}
        />
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 bg-rose-950/80 border border-rose-500/60 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {filteredOrders.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <span className="text-4xl mb-3">📭</span>
            <div className="text-sm font-bold text-gray-300">No orders in {activeStatusTab}</div>
            <div className="text-xs text-gray-500 mt-1">
              {searchQuery ? 'Try clearing your search query' : 'New incoming orders will appear here automatically'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                isSelected={selectedOrderId === order.id}
                onClick={() => handleCardClick(order)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};