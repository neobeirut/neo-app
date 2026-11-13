import React, { useState } from 'react';
import { useOrders } from './useOrders';
import { OrderFilters } from './OrderFilters';
import { OrderCard } from './OrderCard';
import { OrderDetailsModal } from './OrderDetailsModal';
import { PaymentModal, RefundModal } from '../payments';
import { DriverHandoverModal } from '../components/DriverHandoverModal';
import { adaptOvrloadOrder } from './orderAdapter';
import type { FlowPosOrder } from './orderAdapter';

import { COMMERCE_API_BASE, DRIVER_DISPATCH_API_BASE, HAS_COMMERCE_API } from '../config';
import { updateDirectOrderStatus, claimDirectOrder } from '../services/posOrderService';
import { supabase } from '../../api/supabase';

interface OrdersHubScreenProps {
  branchName?: string;
  restaurantId?: string | null;
  branchId?: string | number | null;
  flowBranchId?: string | null;
  activeShift?: any;
  shiftCutoffTime?: string | null;
  activeConceptCode?: 'NEO' | 'OVRLOAD' | 'WICKD';
  onSelectOrder?: (order: FlowPosOrder) => void;
  onOpenOrderToTicket?: (order: FlowPosOrder) => void;
  onRequestVoid?: (order: FlowPosOrder) => void;
  onReprint?: (order: FlowPosOrder) => void;
  onSettleOrder?: (order: FlowPosOrder) => void;
  onPrintBill?: (order: FlowPosOrder) => void;
  getFireState?: (order: FlowPosOrder) => { holds: number; fired: number; busy: boolean; canFire: boolean };
  onFireOrder?: (order: FlowPosOrder) => Promise<void>;
  currentTerminalId?: string;
  activeCashierName?: string;
  isShiftOpen?: boolean;
  onOpenShift?: () => void;
}

export const OrdersHubScreen: React.FC<OrdersHubScreenProps> = ({
  branchName = 'Cloud Kitchen',
  restaurantId,
  branchId,
  flowBranchId,
  activeShift,
  shiftCutoffTime,
  activeConceptCode,
  onSelectOrder,
  onOpenOrderToTicket,
  onRequestVoid,
  onReprint,
  onSettleOrder,
  onPrintBill,
  getFireState,
  onFireOrder,
  currentTerminalId = 'pos-term-flow',
  activeCashierName = 'Cashier',
  isShiftOpen,
  onOpenShift
}) => {
  const {
    filteredOrders,
    counts,
    activeStatusTab,
    setActiveStatusTab,
    activeChannelFilter,
    setActiveChannelFilter,
    activeConceptFilter,
    setActiveConceptFilter,
    activeMigrationFilter,
    setActiveMigrationFilter,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    lastRefreshed,
    isMuted,
    setIsMuted,
    refreshOrders
  } = useOrders({
    restaurantId,
    branchId,
    flowBranchId,
    branchName,
    activeShift,
    shiftCutoffTime
  });

  // Synchronize concept filter with active POS terminal workspace concept
  React.useEffect(() => {
    if (activeConceptCode && ['NEO', 'OVRLOAD', 'WICKD'].includes(activeConceptCode)) {
      setActiveConceptFilter(activeConceptCode as any);
    }
  }, [activeConceptCode, setActiveConceptFilter]);

  // Ensure Tables tab and Tables channel are automatically cleared when on a delivery/pickup concept
  React.useEffect(() => {
    if (activeConceptFilter === 'OVRLOAD' || activeConceptFilter === 'WICKD') {
      if (activeStatusTab === 'TABLES') {
        setActiveStatusTab('ALL');
      }
      if (activeChannelFilter === 'Tables') {
        setActiveChannelFilter('All');
      }
    }
  }, [activeConceptFilter, activeStatusTab, activeChannelFilter, setActiveStatusTab, setActiveChannelFilter]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | number | null>(null);
  const [activeDetailOrder, setActiveDetailOrder] = useState<FlowPosOrder | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [orderForPaymentAction, setOrderForPaymentAction] = useState<FlowPosOrder | null>(null);
  const [handoverTargetOrder, setHandoverTargetOrder] = useState<FlowPosOrder | null>(null);

  const isOrderCanceled = (order: FlowPosOrder | null | undefined): boolean => {
    if (!order) return false;
    if (order.statusGroup === 'CANCELLED') return true;
    const rawSt = String(order.rawStatus || '').toLowerCase();
    if (rawSt === 'cancelled' || rawSt === 'canceled' || rawSt === 'voided') return true;
    const rawOrderSt = String(order.rawOrder?.status || '').toLowerCase();
    if (rawOrderSt === 'cancelled' || rawOrderSt === 'canceled' || rawOrderSt === 'voided') return true;
    return false;
  };

  const handleCardClick = (order: FlowPosOrder) => {
    setSelectedOrderId(order.id);
    const isCancelled = isOrderCanceled(order);
    if (!isCancelled && (order.isTableOrder || activeStatusTab === 'TABLES')) {
      if (isShiftOpen === false) {
        onOpenShift?.();
        return;
      }
      if (onOpenOrderToTicket) {
        onOpenOrderToTicket(order);
        return;
      }
    }
    setActiveDetailOrder(order);
    if (onSelectOrder) {
      onSelectOrder(order);
    }
  };

  const handleStatusUpdate = async (orderId: string | number, newStatus: string, expectedVersion: number) => {
    if (activeDetailOrder && String(activeDetailOrder.id) === String(orderId)) {
      if (isOrderCanceled(activeDetailOrder)) {
        throw new Error('This order is canceled and cannot be updated.');
      }
    }
    let success = false;
    let updatedOrder: any = null;

    if (HAS_COMMERCE_API) {
      try {
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
        if (res.ok && data.success) {
          success = true;
          updatedOrder = data.order;
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Concurrency Conflict')) throw err;
        console.warn('API status update failed, falling back to direct Supabase update:', err);
      }
    }

    if (!success) {
      // 1. Direct update in pos_orders
      const directRes = await updateDirectOrderStatus(orderId, { status: newStatus });
      if (directRes.success && directRes.order) {
        success = true;
        updatedOrder = directRes.order;
      } else {
        // 2. Fallback to orders table
        const { data: ordData, error: ordErr } = await supabase
          .from('orders')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', orderId)
          .select()
          .maybeSingle();

        if (ordData) {
          success = true;
          updatedOrder = ordData;
        } else if (directRes.error || ordErr) {
          throw new Error(directRes.error || ordErr?.message || 'Failed to update order status');
        }
      }
    }

    await refreshOrders();
    if (updatedOrder) {
      setActiveDetailOrder(adaptOvrloadOrder(updatedOrder));
    }
  };

  const formatDriverArrivalEta = (etaMinutes: any) => {
    const isNow = etaMinutes === "Now" || etaMinutes === 0 || etaMinutes === "0";
    const cleanMins = String(etaMinutes || "").replace(/[^0-9]/g, "");
    const mins = cleanMins ? parseInt(cleanMins, 10) : 15;
    const etaText = isNow ? "Now" : `in ${mins}'`;
    return {
      isNow,
      etaText,
      mins
    };
  };

  const handleDispatchDriver = async (order: FlowPosOrder, etaMinutes: string, customDriverPhone?: string) => {
    // Marketplace restriction: Toters and NokNok fleets handle their own deliveries
    const ch = String(order.channel || '').toLowerCase();
    if (ch.includes('toter') || ch.includes('noknok')) {
      alert(`Driver dispatch is managed directly by ${order.channel} fleet.`);
      return;
    }

    const dispatchOpId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'disp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    const etaInfo = formatDriverArrivalEta(etaMinutes || '15');
    const templateParam = `#${order.id} ${etaInfo.etaText}`;
    const msg = `Hello, driver needed for Order ${templateParam}\nThank you`;

    // Concept resolution: derive authoritatively from order or active POS filter
    const conceptId = (order as any).conceptId || (order as any).concept_id || 
      (activeConceptFilter === 'NEO' ? '00000000-0000-0000-0000-000000000001' :
       activeConceptFilter === 'WICKD' ? '00000000-0000-0000-0000-000000000003' :
       '00000000-0000-0000-0000-000000000002');

    const targetDriverPhone = customDriverPhone || (order as any).driverPhone || (order as any).driver_phone || '96170123456';

    if (DRIVER_DISPATCH_API_BASE) {
      try {
        const res = await fetch(`${DRIVER_DISPATCH_API_BASE}/api/pos/dispatch-driver`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            conceptId,
            etaMinutes: etaMinutes || '15',
            messageText: msg,
            phone: targetDriverPhone,
            driverPhone: targetDriverPhone,
            dispatch_operation_id: dispatchOpId
          })
        });
        const data = await res.json();
        if (!res.ok || data.blocked) {
          console.warn('[handleDispatchDriver] Dispatch blocked or error:', data.error);
          alert(`Driver Dispatch Notice: ${data.error || 'Could not notify driver'}`);
        } else if (res.ok && data.success) {
          return;
        }
      } catch (e) {
        console.warn('Driver dispatch API unavailable, updating directly:', e);
      }
    }

    await supabase.from('pos_orders').update({
      special_instructions: `Driver Dispatched to ${targetDriverPhone} (ETA: ${etaInfo.etaText})`,
      updated_at: new Date().toISOString()
    }).eq('id', order.id);
  };

  const handleClaimOrder = async (order: FlowPosOrder, forceOverride = false) => {
    let success = false;
    let updatedOrder: any = null;

    if (HAS_COMMERCE_API) {
      try {
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
        if (res.ok && data.success) {
          success = true;
          updatedOrder = data.order;
        }
      } catch (err: any) {
        if (err.message && err.message.includes('Claim Conflict')) throw err;
        console.warn('API claim failed, falling back to direct database claim:', err);
      }
    }

    if (!success) {
      const claimRes = await claimDirectOrder(order.id, activeCashierName, currentTerminalId);
      if (claimRes.success) {
        success = true;
        updatedOrder = claimRes.order;
      } else {
        throw new Error(claimRes.error || 'Failed to claim order');
      }
    }

    await refreshOrders();
    if (updatedOrder) {
      setActiveDetailOrder(adaptOvrloadOrder(updatedOrder));
    }
  };

  const handleReleaseOrder = async (order: FlowPosOrder) => {
    let success = false;
    let updatedOrder: any = null;

    if (HAS_COMMERCE_API) {
      try {
        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${order.id}/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            posTerminalId: currentTerminalId
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          success = true;
          updatedOrder = data.order;
        }
      } catch (err: any) {
        console.warn('API release failed, falling back to direct database release:', err);
      }
    }

    if (!success) {
      const { data, error } = await supabase
        .from('pos_orders')
        .update({
          terminal_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message || 'Failed to release order');
      success = true;
      updatedOrder = data;
    }

    await refreshOrders();
    if (updatedOrder) {
      setActiveDetailOrder(adaptOvrloadOrder(updatedOrder));
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F6F4] text-slate-900 select-none relative">
      {/* Subheader Toolbar */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="font-black text-sm tracking-wider text-slate-900 uppercase">Orders Hub</h2>
          </div>
          <span className="text-gray-500 text-xs">|</span>
          <span className="text-xs font-bold text-slate-700">Branch: {branchName}</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold">
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
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:text-slate-900'
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
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-xs transition flex items-center gap-1"
          >
            <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
            <span>{isLoading ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="px-6 py-4 bg-white border-b border-slate-200">
        <OrderFilters
          activeStatusTab={activeStatusTab}
          onStatusTabChange={setActiveStatusTab}
          activeChannelFilter={activeChannelFilter}
          onChannelFilterChange={setActiveChannelFilter}
          activeConceptFilter={activeConceptFilter}
          onConceptFilterChange={setActiveConceptFilter}
          isConceptLocked={Boolean(activeConceptCode)}
          activeMigrationFilter={activeMigrationFilter}
          onMigrationFilterChange={setActiveMigrationFilter}
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
            <span className="text-4xl mb-3">
              {activeStatusTab === 'TABLES' ? '🪑' : activeStatusTab === 'CANCELLED' ? '🚫' : '📭'}
            </span>
            <div className="text-sm font-bold text-slate-700">
              {activeStatusTab === 'TABLES'
                ? 'No active open tables at the moment'
                : activeStatusTab === 'CANCELLED'
                ? 'No canceled tables or orders in today\'s shift'
                : `No orders in ${activeStatusTab}`}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {searchQuery
                ? 'Try clearing your search query'
                : activeStatusTab === 'TABLES'
                ? 'Tables currently occupied or dining will appear here'
                : activeStatusTab === 'CANCELLED'
                ? 'Voided or canceled transactions from today\'s shifts will be recorded here'
                : 'New incoming orders will appear here automatically'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredOrders.map(order => {
              const isCancelled = isOrderCanceled(order);
              const isTable = !isCancelled && (order.isTableOrder || activeStatusTab === 'TABLES');
              const fire = isTable && getFireState ? getFireState(order) : null;
              const isBillPrinted = order.isBillRequested;

              if (isTable) {
                return (
                  <div
                    key={order.id}
                    className={`rounded-xl border transition-all flex flex-col justify-between overflow-hidden shadow-lg ${
                      isBillPrinted
                        ? 'bg-sky-50/80 border-sky-400 ring-2 ring-sky-400/40'
                        : selectedOrderId === order.id
                        ? 'bg-white border-pos-primary ring-2 ring-pos-primary/30 shadow-md'
                        : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
                    }`}
                  >
                    <div
                      className="p-1.5 flex-1 cursor-pointer"
                      onClick={() => handleCardClick(order)}
                    >
                      <OrderCard
                        order={order}
                        isSelected={selectedOrderId === order.id}
                        variant="table"
                      />
                    </div>

                    {fire && fire.holds > 0 && fire.fired < fire.holds && (
                      <div className="px-2 py-1.5 flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50">
                        <span className="text-xs text-slate-600 font-semibold" role="status">
                          {fire.holds - fire.fired} course{fire.holds - fire.fired !== 1 ? 's' : ''} held
                        </span>
                        <button
                          type="button"
                          disabled={!fire.canFire || !onFireOrder || isShiftOpen === false}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isShiftOpen === false) {
                              onOpenShift?.();
                              return;
                            }
                            onFireOrder?.(order);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition shadow-xs cursor-pointer"
                        >
                          {fire.busy ? 'Firing…' : '🔥 Fire'}
                        </button>
                      </div>
                    )}

                    {/* Action Buttons Toolbar on Card: Print Bill & Settle */}
                    <div className="p-1.5 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={isShiftOpen === false}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isShiftOpen === false) {
                            onOpenShift?.();
                            return;
                          }
                          onPrintBill?.(order);
                        }}
                        className={`py-1 rounded-lg font-black text-[10px] flex items-center justify-center gap-0.5 transition active:scale-95 shadow-xs ${
                          isShiftOpen === false
                            ? "bg-slate-100 text-slate-400 border border-slate-200 opacity-40 cursor-not-allowed"
                            : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer"
                        }`}
                        title={isShiftOpen === false ? "Cannot bill while shift is closed" : "Print customer pre-check bill receipt"}
                      >
                        <span>🧾</span>
                        <span className="truncate">Bill</span>
                      </button>

                      <button
                        type="button"
                        disabled={isShiftOpen === false}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isShiftOpen === false) {
                            onOpenShift?.();
                            return;
                          }
                          onSettleOrder?.(order);
                        }}
                        className={`py-1 rounded-lg font-black text-[10px] flex items-center justify-center gap-0.5 transition active:scale-95 shadow-xs ${
                          isShiftOpen === false
                            ? "bg-slate-100 text-slate-400 border border-slate-200 opacity-40 cursor-not-allowed"
                            : "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 cursor-pointer"
                        }`}
                        title={isShiftOpen === false ? "Cannot settle while shift is closed" : "Collect payment and close table"}
                      >
                        <span>💳</span>
                        <span className="truncate">Settle</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <OrderCard
                  key={order.id}
                  order={order}
                  isSelected={selectedOrderId === order.id}
                  onClick={() => handleCardClick(order)}
                />
              );
            })}
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
        onSettleOrder={onSettleOrder}
        onDriverHandover={(order) => setHandoverTargetOrder(order)}
        currentTerminalId={currentTerminalId}
        activeCashierName={activeCashierName}
        isShiftOpen={isShiftOpen}
        onOpenShift={onOpenShift}
      />

      {/* Driver Handover Cash Collection Modal */}
      {handoverTargetOrder && (
        <DriverHandoverModal
          isOpen={Boolean(handoverTargetOrder)}
          onClose={() => setHandoverTargetOrder(null)}
          order={handoverTargetOrder.rawOrder || handoverTargetOrder}
          activeCashierName={activeCashierName}
          activeShiftId={activeShift?.id}
          exchangeRate={89500}
          onHandoverSuccess={async () => {
            setHandoverTargetOrder(null);
            setActiveDetailOrder(null);
            await refreshOrders();
          }}
        />
      )}
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
          branchId={orderForPaymentAction.rawOrder?.branch_id || branchId || flowBranchId}
          restaurantId={orderForPaymentAction.rawOrder?.restaurant_id || restaurantId}
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
