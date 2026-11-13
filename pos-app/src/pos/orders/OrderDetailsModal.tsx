import React, { useState } from 'react';
import type { FlowPosOrder } from './orderAdapter';

export interface OrderDetailsModalProps {
  order: FlowPosOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenInTicket?: (order: FlowPosOrder) => void;
  onStatusUpdate?: (orderId: string | number, newStatus: string, expectedVersion: number) => Promise<boolean | void>;
  onRequestVoid?: (order: FlowPosOrder) => void;
  onRequestDispatch?: (order: FlowPosOrder, etaMinutes: string) => Promise<boolean | void>;
  onReprint?: (order: FlowPosOrder) => void;
  onClaimOrder?: (order: FlowPosOrder, forceOverride?: boolean) => Promise<boolean | void>;
  onReleaseOrder?: (order: FlowPosOrder) => Promise<boolean | void>;
  onTakePayment?: (order: FlowPosOrder) => void;
  onRefund?: (order: FlowPosOrder) => void;
  onSettleOrder?: (order: FlowPosOrder) => void;
  onDriverHandover?: (order: FlowPosOrder) => void;
  currentTerminalId?: string;
  activeCashierName?: string;
  isShiftOpen?: boolean;
  onOpenShift?: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
  onOpenInTicket,
  onStatusUpdate,
  onRequestVoid,
  onRequestDispatch,
  onReprint,
  onClaimOrder,
  onReleaseOrder,
  onTakePayment,
  onRefund,
  onSettleOrder,
  onDriverHandover,
  currentTerminalId = 'pos-term-default',
  activeCashierName = 'Cashier',
  isShiftOpen = true,
  onOpenShift
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDispatchSelectorOpen, setIsDispatchSelectorOpen] = useState(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const isCancelled =
    order.statusGroup === 'CANCELLED' ||
    ['cancelled', 'canceled', 'voided'].includes(String(order.rawStatus || '').toLowerCase()) ||
    ['cancelled', 'canceled', 'voided'].includes(String(order.rawOrder?.status || '').toLowerCase());

  const isClaimedByMe = order.claimedTerminal === currentTerminalId;
  const isClaimedByOther = !!order.claimedTerminal && order.claimedTerminal !== currentTerminalId;

  const handleStatusChange = async (newStatus: string) => {
    if (isCancelled) return;
    // Intercept "complete" for unpaid orders — open the Settle & Close flow
    if (
      newStatus === 'completed' &&
      onSettleOrder &&
      order.paymentStatus !== 'paid' &&
      order.paymentStatus !== 'paid_legacy'
    ) {
      if (isShiftOpen === false) {
        onOpenShift?.();
        return;
      }
      onSettleOrder(order);
      onClose();
      return;
    }

    if (!onStatusUpdate) return;
    setIsUpdating(true);
    setActionError(null);
    try {
      await onStatusUpdate(order.id, newStatus, order.version);
      if (newStatus === 'completed') {
        onClose();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDispatch = async (etaMinutes: string) => {
    if (isCancelled || !onRequestDispatch) return;
    setIsUpdating(true);
    setActionError(null);
    try {
      await onRequestDispatch(order, etaMinutes);
      setDispatchSuccessMsg(`Driver request sent (${etaMinutes} min) ✓`);
      setIsDispatchSelectorOpen(false);
      setTimeout(() => setDispatchSuccessMsg(null), 2500);
    } catch (err: any) {
      setActionError(err.message || 'Failed to dispatch driver');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClaim = async (forceOverride = false) => {
    if (isCancelled || !onClaimOrder) return;
    setIsUpdating(true);
    setActionError(null);
    try {
      await onClaimOrder(order, forceOverride);
    } catch (err: any) {
      setActionError(err.message || 'Failed to claim order');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRelease = async () => {
    if (isCancelled || !onReleaseOrder) return;
    setIsUpdating(true);
    setActionError(null);
    try {
      await onReleaseOrder(order);
    } catch (err: any) {
      setActionError(err.message || 'Failed to release order claim');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'CONFIRMED': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'PREPARING': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'READY': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'COMPLETED': return 'bg-zinc-700/40 text-zinc-300 border-zinc-600';
      case 'HELD': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'CANCELLED': return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default: return 'bg-gray-800 text-slate-700 border-gray-700';
    }
  };

  const getChannelBadgeColor = (ch: string) => {
    switch (ch) {
      case 'Tables': return 'bg-amber-950/80 text-amber-300 border-amber-500/40';
      case 'WhatsApp': return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      case 'Toters': return 'bg-green-950/80 text-green-300 border-green-500/40';
      case 'NokNok': return 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      case 'App': return 'bg-sky-950/80 text-sky-300 border-sky-500/40';
      default: return 'bg-pos-primary/10 text-pos-primary border-pos-primary/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-black text-xl text-slate-900 tracking-wide">
              {order.orderNumber}
            </span>
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${getChannelBadgeColor(order.channel)}`}>
              {order.channel}
            </span>
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${getStatusBadgeColor(order.statusGroup)}`}>
              {order.statusGroup}
            </span>
            <span className="text-[11px] font-bold text-slate-500 uppercase bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
              {order.orderType}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-mono">
                {order.createdTimeFormatted}
              </div>
              <div className={`text-[10px] font-black ${
                order.slaStatus === 'critical' ? 'text-rose-400 animate-pulse' :
                order.slaStatus === 'warning' ? 'text-amber-400' : 'text-slate-500'
              }`}>
                ⏱️ {order.elapsedMinutes}m ago
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold text-base transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Shift Closed Warning Banner */}
        {isShiftOpen === false && (
          <div className="bg-rose-950/95 border-b border-rose-500/60 p-2.5 px-4 text-xs font-black text-rose-200 flex items-center justify-between flex-shrink-0 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-base">🔒</span>
              <span>Shift is Closed — Invoicing and Payment Settlement are Disabled</span>
            </div>
            {onOpenShift && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShift();
                }}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-slate-900 rounded-lg text-[11px] font-black transition active:scale-95 cursor-pointer shadow"
              >
                Open Shift
              </button>
            )}
          </div>
        )}

        {/* Synthetic Migration Disclaimer Banner */}
        {order.isMigration && (
          <div className="bg-purple-950/95 border-b border-purple-500/60 p-3 px-4 text-xs font-bold text-purple-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <div>
                <span className="font-extrabold uppercase tracking-wide">Generated Migration Record</span>
                <span className="text-purple-300 ml-2">— Imported via one-time data migration. Not a genuine customer purchase receipt.</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-purple-900/80 border border-purple-600/50 text-[11px] font-mono text-purple-200">
              Read-Only Migration
            </span>
          </div>
        )}

        {/* Canceled Order Read-Only Notice */}
        {isCancelled && (
          <div className="bg-rose-950/95 border-b border-rose-500/60 p-3 px-4 text-xs font-bold text-rose-200 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">🚫</span>
              <div>
                <span className="font-extrabold uppercase tracking-wide">Order Canceled</span>
                <span className="text-rose-300 ml-2">— Read-only details. No updates or modifications can be made to this order.</span>
              </div>
            </div>
            {order.voidReason && (
              <span className="px-2.5 py-1 rounded bg-rose-900/80 border border-rose-600/50 text-[11px] font-mono text-rose-200">
                Reason: {order.voidReason}
              </span>
            )}
          </div>
        )}

        {/* Action Error / Conflict Notice */}
        {actionError && (
          <div className="bg-rose-950/80 border-b border-rose-500/50 p-3 px-4 text-xs font-semibold text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-[10px] underline hover:text-slate-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dispatch success feedback */}
        {dispatchSuccessMsg && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/50 p-2.5 px-4 text-xs font-bold text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <span>🛵</span>
            <span>{dispatchSuccessMsg}</span>
          </div>
        )}

        {/* Claim Status Indicator for Held Orders */}
        {order.statusGroup === 'HELD' && !isCancelled && (
          <div className="p-3 px-4 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
            {isClaimedByOther ? (
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <span className="animate-pulse">🔒</span>
                <span>
                  Currently claimed by <strong className="text-slate-900">{order.claimedBy || 'Cashier'}</strong> on terminal <code className="text-amber-200">{order.claimedTerminal}</code>
                </span>
              </div>
            ) : isClaimedByMe ? (
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <span>✓</span>
                <span>Claimed by this terminal ({currentTerminalId})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>⏸️</span>
                <span>Ticket is held and available to claim</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {isClaimedByMe && onReleaseOrder && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleRelease}
                  className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg transition shadow-xs"
                >
                  Release Claim
                </button>
              )}
              {isClaimedByOther && onClaimOrder && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleClaim(true)}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition shadow-xs"
                  title="Force override claim using manager authorization"
                >
                  Manager Override
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Table Context Banner */}
          {order.isTableOrder && (
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-xl">
                  🪑
                </div>
                <div>
                  <div className="text-base font-black text-amber-900 flex items-center gap-2">
                    <span>Table {order.tableLabel || order.customerName}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 font-bold uppercase">
                      Dine-in
                    </span>
                  </div>
                  <div className="text-xs text-amber-800 font-medium mt-0.5 flex items-center gap-2">
                    {order.guestCount ? <span>👥 {order.guestCount} Guests</span> : null}
                    {order.guestCount && order.waiterName ? <span>•</span> : null}
                    {order.waiterName ? <span>🤵 Waiter: {order.waiterName}</span> : null}
                  </div>
                </div>
              </div>
              {order.isPaidInAdvance && (
                <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black flex items-center gap-1.5 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Paid in Advance</span>
                </div>
              )}
            </div>
          )}

          {/* Customer & Delivery Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
              Customer & Fulfillment
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500">Name:</span>{' '}
                <strong className="text-slate-900 font-bold">{order.customerName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Phone:</span>{' '}
                {order.customerPhone ? (
                  <a
                    href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1e5c4f] hover:underline font-mono font-bold inline-flex items-center gap-1"
                  >
                    <span>💬</span>
                    <span>{order.customerPhone}</span>
                  </a>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </div>
              {order.deliveryAddress && (
                <div className="col-span-2 pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500">Delivery Address:</span>{' '}
                  <span className="text-slate-800 font-medium">{order.deliveryAddress}</span>
                </div>
              )}
              {order.specialInstructions && (
                <div className="col-span-2 pt-1 border-t border-slate-200/60">
                  <span className="text-amber-800 font-bold">Kitchen Note:</span>{' '}
                  <span className="text-amber-900 italic font-medium">{order.specialInstructions}</span>
                </div>
              )}
              {order.voidReason && (
                <div className="col-span-2 pt-1 border-t border-slate-200/60 text-rose-700">
                  <span className="font-bold">Void / Cancel Reason:</span>{' '}
                  <span>{order.voidReason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items Breakdown Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-xs font-black text-slate-700 uppercase tracking-wider">
              <span>Order Items ({order.items.reduce((s, i) => s + i.quantity, 0)})</span>
              <span>Total</span>
            </div>
            <div className="divide-y divide-[#262D3D]/60">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-3 flex justify-between items-start text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-slate-200 text-pos-primary font-black flex items-center justify-center text-[11px]">
                        {item.quantity}×
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {item.name}
                      </span>
                    </div>
                    {item.customizations && item.customizations.length > 0 && (
                      <div className="pl-7 space-y-0.5">
                        {item.customizations.map((c, cIdx) => (
                          <div key={cIdx} className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                            <span className="text-pos-primary">•</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.comment && (
                      <div className="pl-7 text-[10px] text-amber-300 italic font-medium">
                        "{item.comment}"
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900">
                      ${item.totalPrice.toFixed(2)}
                    </span>
                    {item.quantity > 1 && (
                      <div className="text-[10px] text-slate-500">
                        ${item.unitPrice.toFixed(2)} each
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500 font-medium">
              <span>Subtotal:</span>
              <span>${order.subtotalAmount.toFixed(2)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Delivery Fee:</span>
                <span>${order.deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400 font-medium">
                <span>Discount:</span>
                <span>-${order.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-black text-sm uppercase text-slate-900 tracking-wider">Total</span>
                  <span className="ml-2 text-[11px] font-bold text-slate-500">
                    via {order.paymentMethod}
                  </span>
                </div>
                <span className="font-black text-2xl text-pos-primary">
                  ${order.totalAmount.toFixed(2)}
                </span>
              </div>

              {/* Enhanced Financial Ledger Breakdown */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Paid</span>
                  <span className="font-bold text-[#1e5c4f]">
                    ${(order.amountPaid || (order.paymentStatus === 'paid_legacy' ? order.totalAmount : 0)).toFixed(2)}
                  </span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Remaining</span>
                  <span className="font-bold text-amber-800">
                    ${(order.amountRemaining !== undefined ? order.amountRemaining : (order.paymentStatus === 'paid_legacy' || order.paymentStatus === 'paid' ? 0 : order.totalAmount)).toFixed(2)}
                  </span>
                </div>

                <div className="bg-white p-2 rounded-lg border border-slate-200 flex flex-col justify-between">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Status</span>
                  <span className={'px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase text-center ' + (
                    order.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    order.paymentStatus === 'paid_legacy' ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' :
                    order.paymentStatus === 'partially_paid' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    order.paymentStatus === 'refunded' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                    order.paymentStatus === 'partially_refunded' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                    'bg-rose-50 text-rose-800 border border-rose-200'
                  )}>
                    {order.paymentStatus === 'paid_legacy' ? 'PAID — LEGACY' :
                     order.paymentStatus === 'partially_paid' ? 'PARTIAL' :
                     order.paymentStatus === 'partially_refunded' ? 'PART. REFUND' :
                     order.paymentStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Driver Dispatch Selector Panel */}
          {isDispatchSelectorOpen && !isCancelled && (
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-blue-900">🛵 Select Driver Pickup ETA:</span>
                <button
                  type="button"
                  onClick={() => setIsDispatchSelectorOpen(false)}
                  className="text-slate-500 hover:text-slate-900 font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {['Now', '5', '10', '15', '20'].map((time) => (
                  <button
                    key={time}
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleDispatch(time)}
                    className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs transition active:scale-95 border border-blue-600 shadow-xs"
                  >
                    {time === 'Now' ? 'Now ⚡' : `${time} min`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contextual Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          {/* Left Actions: Print / Reprint & Open in Ticket */}
          <div className="flex items-center gap-2">
            {onReprint && !order.isMigration && (
              <button
                type="button"
                onClick={() => onReprint(order)}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 hover:text-slate-950 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 border border-slate-300 shadow-xs"
              >
                <span>🖨️</span>
                <span>Print Ticket</span>
              </button>
            )}

            {onOpenInTicket && !isCancelled && !order.isMigration && (
              <button
                type="button"
                onClick={() => {
                  onOpenInTicket(order);
                  onClose();
                }}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 border shadow-sm ${
                  order.isTableOrder
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 font-black'
                    : 'bg-white hover:bg-slate-100 text-slate-800 hover:text-slate-950 border border-slate-300 shadow-xs'
                }`}
              >
                <span>{order.isTableOrder ? '🪑' : '🛒'}</span>
                <span>{order.isTableOrder ? 'Open Table in POS' : 'Open in Ticket'}</span>
              </button>
            )}

            {/* Delivery Driver Dispatch Trigger Button */}
            {order.orderType === 'delivery' && !isCancelled && !order.isMigration && order.statusGroup !== 'COMPLETED' && (
              <button
                type="button"
                onClick={() => setIsDispatchSelectorOpen(prev => !prev)}
                className="px-3.5 py-2.5 bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5"
              >
                <span>🛵</span>
                <span>Dispatch Driver</span>
              </button>
            )}
          </div>

          {/* Right Actions: Contextual Status Step Transitions & Void */}
          <div className="flex items-center gap-2">
            {order.isMigration ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-700 text-xs font-black shadow-sm">
                <span>📦</span>
                <span>Generated Migration Record (Historical Only)</span>
              </div>
            ) : isCancelled ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-black shadow-sm">
                <span>🔒</span>
                <span>Canceled Order — Locked</span>
              </div>
            ) : (
              <>
            {/* Status Promotion Buttons */}
            {order.statusGroup === 'NEW' && onStatusUpdate && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange('confirmed')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-slate-900 rounded-xl text-xs font-black transition shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
              >
                <span>✓</span>
                <span>{isUpdating ? 'Updating...' : 'Accept Order'}</span>
              </button>
            )}

            {order.statusGroup === 'CONFIRMED' && onStatusUpdate && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange('preparing')}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-slate-900 rounded-xl text-xs font-black transition shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
              >
                <span>🍳</span>
                <span>{isUpdating ? 'Updating...' : 'Start Preparing'}</span>
              </button>
            )}

            {order.statusGroup === 'PREPARING' && onStatusUpdate && (
              <>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleStatusChange('ready')}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-slate-900 rounded-xl text-xs font-black transition shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
                >
                  <span>🔔</span>
                  <span>{isUpdating ? 'Updating...' : 'Mark Ready'}</span>
                </button>
                <button
                  type="button"
                  disabled={isUpdating || (isShiftOpen === false && Boolean(onSettleOrder && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_legacy'))}
                  onClick={() => handleStatusChange('completed')}
                  className={`px-4 py-2.5 disabled:opacity-50 text-slate-900 rounded-xl text-xs font-black transition shadow-lg flex items-center gap-1.5 ${
                    onSettleOrder && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_legacy'
                      ? isShiftOpen === false
                        ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30 text-slate-950 cursor-pointer'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 cursor-pointer'
                  }`}
                >
                  <span>{onSettleOrder && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_legacy' ? (isShiftOpen === false ? '🔒' : '💳') : '✅'}</span>
                  <span>{isUpdating ? 'Opening...' : onSettleOrder && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_legacy' ? (isShiftOpen === false ? 'Shift Closed (Settle Disabled)' : 'Settle & Pay') : 'Complete & Close'}</span>
                </button>
              </>
            )}

            {order.statusGroup === 'READY' && onStatusUpdate && (
              <button
                type="button"
                disabled={isUpdating || (isShiftOpen === false && Boolean(onSettleOrder && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_legacy'))}
                onClick={() => handleStatusChange('completed')}
                className={`px-5 py-2.5 disabled:opacity-50 rounded-xl text-xs font-black transition shadow-lg flex items-center gap-1.5 ${
                  onSettleOrder && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_legacy'
                    ? isShiftOpen === false
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30 text-slate-950 cursor-pointer'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 text-slate-900 cursor-pointer'
                }`}
              >
                <span>{onSettleOrder && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_legacy' ? (isShiftOpen === false ? '🔒' : '💳') : '✅'}</span>
                <span>{isUpdating ? 'Opening...' : onSettleOrder && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_legacy' ? (isShiftOpen === false ? 'Shift Closed (Settle Disabled)' : 'Settle & Pay') : 'Complete & Close'}</span>
              </button>
            )}

            {order.statusGroup === 'HELD' && onClaimOrder && (
              <button
                type="button"
                disabled={isUpdating || isClaimedByOther}
                onClick={() => {
                  handleClaim(false);
                  if (onOpenInTicket) {
                    onOpenInTicket(order);
                    onClose();
                  }
                }}
                className={`px-5 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  isClaimedByOther
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                    : order.isTableOrder
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                    : 'bg-pos-primary hover:bg-pos-primary-hover text-white shadow-lg cursor-pointer'
                }`}
              >
                <span>{order.isTableOrder ? '🪑' : '🔓'}</span>
                <span>{isUpdating ? 'Opening...' : order.isTableOrder ? 'Open Table in POS' : 'Claim & Open'}</span>
              </button>
            )}

            {/* POS Payment & Refund Actions */}
            {onDriverHandover && !isCancelled && order.statusGroup !== 'COMPLETED' && order.rawStatus !== 'dispatched' && (
              <button
                type="button"
                onClick={() => {
                  onDriverHandover(order);
                }}
                className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-black rounded-xl text-xs transition shadow-lg shadow-sky-600/30 flex items-center gap-1.5 cursor-pointer"
                title="Driver Handover & Cash Collection"
              >
                <span>🛵</span>
                <span>Driver Handover</span>
              </button>
            )}

            {onTakePayment && order.paymentStatus !== 'paid' && order.paymentStatus !== 'paid_legacy' && order.statusGroup !== 'CANCELLED' && (
              <button
                type="button"
                onClick={() => {
                  onTakePayment(order);
                  onClose();
                }}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
              >
                <span>💵</span>
                <span>Take Payment</span>
              </button>
            )}

            {onRefund && order.statusGroup === 'COMPLETED' && (order.paymentStatus === 'paid' || order.paymentStatus === 'paid_legacy' || order.paymentStatus === 'partially_paid' || order.paymentStatus === 'partially_refunded') && (
              <button
                type="button"
                onClick={() => {
                  onRefund(order);
                  onClose();
                }}
                className="px-3.5 py-2.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5"
              >
                <span>↩️</span>
                <span>Refund</span>
              </button>
            )}

            {/* FLOW Two-Phase Void / Cancellation Action */}
            {onRequestVoid && (
              <button
                type="button"
                onClick={() => {
                  onRequestVoid(order);
                  onClose();
                }}
                className="px-3.5 py-2.5 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5"
                title={order.statusGroup === 'COMPLETED' ? 'Manager Refund with FLOW Audit' : 'Cancel order with FLOW Void Audit'}
              >
                <span>🛡️</span>
                <span>{order.statusGroup === 'COMPLETED' ? 'Refund / Void' : 'Void / Cancel'}</span>
              </button>
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
