import React, { useState } from 'react';
import { useOrders } from './useOrders';
import { OrderFilters } from './OrderFilters';
import { OrderCard } from './OrderCard';
import { OrderDetailsModal } from './OrderDetailsModal';
import { PaymentModal, RefundModal } from '../payments';
import { adaptOvrloadOrder } from './orderAdapter';
import type { FlowPosOrder } from './orderAdapter';

const COMMERCE_API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OVRLOAD_API_URL)
    ? import.meta.env.VITE_OVRLOAD_API_URL
    : 'https://ovrload-backend-production.up.railway.app'
).replace(/\/+$/, '');

interface OrdersHubScreenProps {
  branchName?: string;
  onSelectOrder?: (order: FlowPosOrder) => void;
  onOpenOrderToTicket?: (order: FlowPosOrder) => void;
  onRequestVoid?: (order: FlowPosOrder) => void;
  onReprint?: (order: FlowPosOrder) => void;
  currentTerminalId?: string;
  activeCashierName?: string;
}

export const OrdersHubScreen: React.FC<OrdersHubScreenProps> = ({
  branchName = 'Cloud Kitchen',
  onSelectOrder,
  onOpenOrderToTicket,
  onRequestVoid,
  onReprint,
  currentTerminalId = 'pos-term-flow',
  activeCashierName = 'Cashier'
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
  const [activeDetailOrder, setActiveDetailOrder] = useState<FlowPosOrder | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [orderForPaymentAction, setOrderForPaymentAction] = useState<FlowPosOrder | null>(null);

  const handleCardClick = (order: FlowPosOrder) => {
    setSelectedOrderId(order.id);
    setActiveDetailOrder(order);
    if (onSelectOrder) {
      onSelectOrder(order);
    }
  };

  const handleStatusUpdate = async (orderId: string | number, newStatus: string, expectedVersion: number) => {
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        expected_version: expectedVersion
      })
    });
    const data = await res.json();
    if (res.status === 409) {
      await refreshOrders();
      throw new Error(data.error || 'Concurrency Conflict: Order was modified by another terminal. Reloaded latest state.');
    }
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update order status');
    }
    await refreshOrders();
    if (data.order) {
      setActiveDetailOrder(adaptOvrloadOrder(data.order));
    }
  };

  const handleDispatchDriver = async (order: FlowPosOrder, etaMinutes: string) => {
    const dispatchOpId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'disp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/dispatch-driver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: order.id,
        etaMinutes: etaMinutes || '15',
        phone: '9613826136',
        dispatch_operation_id: dispatchOpId
      })
    });
    const data = await res.json();
    if (!res.ok && !data.success) {
      throw new Error(data.error || 'Failed to dispatch driver');
    }
  };

  const handleClaimOrder = async (order: FlowPosOrder, forceOverride = false) => {
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${order.id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posTerminalId: currentTerminalId,
        cashierName: activeCashierName,
        forceOverride
      })
    });
    const data = await res.json();
    if (res.status === 409) {
      await refreshOrders();
      throw new Error(data.error || 'Claim Conflict: Order is locked by another terminal.');
    }
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to claim order');
    }
    await refreshOrders();
    if (data.order) {
      setActiveDetailOrder(adaptOvrloadOrder(data.order));
    }
  };

  const handleReleaseOrder = async (order: FlowPosOrder) => {
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${order.id}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posTerminalId: currentTerminalId
      })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to release order');
    }
    await refreshOrders();
    if (data.order) {
      setActiveDetailOrder(adaptOvrloadOrder(data.order));
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0B0D12] text-white select-none relative">
      {/* Subheader Toolbar */}
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

      {/* Filter Tabs & Search Bar */}
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

      {/* Orders Grid / Cards Area */}
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

      {/* Order Details & Contextual Workflow Modal */}
      <OrderDetailsModal
        order={activeDetailOrder}
        isOpen={!!activeDetailOrder}
        onClose={() => setActiveDetailOrder(null)}
        onOpenInTicket={onOpenOrderToTicket}
        onStatusUpdate={handleStatusUpdate}
        onRequestVoid={onRequestVoid}
        onRequestDispatch={handleDispatchDriver}
        onReprint={onReprint}
        onClaimOrder={handleClaimOrder}
        onReleaseOrder={handleReleaseOrder}
        currentTerminalId={currentTerminalId}
        activeCashierName={activeCashierName}
      />
      {/* POS Payment Modal */}
      {isPaymentModalOpen && orderForPaymentAction && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          orderId={Number(orderForPaymentAction.id)}
          orderNumber={orderForPaymentAction.orderNumber}
          orderTotal={orderForPaymentAction.totalAmount}
          baseOrder={orderForPaymentAction.rawOrder}
          cashierName={activeCashierName}
          terminalId={currentTerminalId}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setOrderForPaymentAction(null);
          }}
          onPaymentComplete={async () => {
            await refreshOrders();
            setIsPaymentModalOpen(false);
            setOrderForPaymentAction(null);
          }}
        />
      )}

      {/* POS Refund Modal */}
      {isRefundModalOpen && orderForPaymentAction && (
        <RefundModal
          isOpen={isRefundModalOpen}
          orderId={Number(orderForPaymentAction.id)}
          orderNumber={orderForPaymentAction.orderNumber}
          maxRefundableAmount={orderForPaymentAction.netPaid || orderForPaymentAction.totalAmount}
          currentPaid={orderForPaymentAction.amountPaid || orderForPaymentAction.totalAmount}
          cashierName={activeCashierName}
          branchName={branchName}
          terminalId={currentTerminalId}
          onClose={() => {
            setIsRefundModalOpen(false);
            setOrderForPaymentAction(null);
          }}
          onRefundComplete={async () => {
            await refreshOrders();
            setIsRefundModalOpen(false);
            setOrderForPaymentAction(null);
          }}
        />
      )}
    </div>
  );
};
