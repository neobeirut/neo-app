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
  currentTerminalId?: string;
  activeCashierName?: string;
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
  currentTerminalId = 'pos-term-default',
  activeCashierName = 'Cashier'
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDispatchSelectorOpen, setIsDispatchSelectorOpen] = useState(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const isClaimedByMe = order.claimedTerminal === currentTerminalId;
  const isClaimedByOther = !!order.claimedTerminal && order.claimedTerminal !== currentTerminalId;

  const handleStatusChange = async (newStatus: string) => {
    if (!onStatusUpdate) return;
    setIsUpdating(true);
    setActionError(null);
    try {
      await onStatusUpdate(order.id, newStatus, order.version);
    } catch (err: any) {
      setActionError(err.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDispatch = async (etaMinutes: string) => {
    if (!onRequestDispatch) return;
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
    if (!onClaimOrder) return;
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
    if (!onReleaseOrder) return;
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
      default: return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  const getChannelBadgeColor = (ch: string) => {
    switch (ch) {
      case 'WhatsApp': return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      case 'Toters': return 'bg-green-950/80 text-green-300 border-green-500/40';
      case 'NokNok': return 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      case 'App': return 'bg-sky-950/80 text-sky-300 border-sky-500/40';
      default: return 'bg-[#eb660c]/20 text-[#eb660c] border-[#eb660c]/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#14171F] border border-[#262D3D] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#181C24] border-b border-[#262D3D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono font-black text-xl text-white tracking-wide">
              {order.orderNumber}
            </span>
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${getChannelBadgeColor(order.channel)}`}>
              {order.channel}
            </span>
            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${getStatusBadgeColor(order.statusGroup)}`}>
              {order.statusGroup}
            </span>
            <span className="text-[11px] font-bold text-gray-400 uppercase bg-[#202532] px-2 py-0.5 rounded">
              {order.orderType}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-400 font-mono">
                {order.createdTimeFormatted}
              </div>
              <div className={`text-[10px] font-black ${
                order.slaStatus === 'critical' ? 'text-rose-400 animate-pulse' :
                order.slaStatus === 'warning' ? 'text-amber-400' : 'text-gray-400'
              }`}>
                ⏱️ {order.elapsedMinutes}m ago
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[#262D3D] hover:bg-[#323B4E] text-gray-400 hover:text-white flex items-center justify-center font-bold text-base transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Action Error / Conflict Notice */}
        {actionError && (
          <div className="bg-rose-950/80 border-b border-rose-500/50 p-3 px-4 text-xs font-semibold text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-[10px] underline hover:text-white font-bold"
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
        {order.statusGroup === 'HELD' && (
          <div className="p-3 px-4 border-b border-[#262D3D] bg-[#1a1f2c] flex items-center justify-between">
            {isClaimedByOther ? (
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <span className="animate-pulse">🔒</span>
                <span>
                  Currently claimed by <strong className="text-white">{order.claimedBy || 'Cashier'}</strong> on terminal <code className="text-amber-200">{order.claimedTerminal}</code>
                </span>
              </div>
            ) : isClaimedByMe ? (
              <div className="flex items-center gap-2 text-xs text-emerald-300">
                <span>✓</span>
                <span>Claimed by this terminal ({currentTerminalId})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-400">
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
                  className="px-2.5 py-1 text-xs font-bold bg-[#262D3D] hover:bg-[#323B4E] text-gray-300 rounded-lg transition"
                >
                  Release Claim
                </button>
              )}
              {isClaimedByOther && onClaimOrder && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleClaim(true)}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg transition"
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
          {/* Customer & Delivery Card */}
          <div className="bg-[#181C24] border border-[#262D3D] rounded-xl p-3.5 space-y-2">
            <div className="text-[11px] font-black uppercase text-gray-400 tracking-wider">
              Customer & Fulfillment
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400">Name:</span>{' '}
                <strong className="text-white font-bold">{order.customerName}</strong>
              </div>
              <div>
                <span className="text-gray-400">Phone:</span>{' '}
                {order.customerPhone ? (
                  <a
                    href={`https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline font-mono font-bold inline-flex items-center gap-1"
                  >
                    <span>💬</span>
                    <span>{order.customerPhone}</span>
                  </a>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </div>
              {order.deliveryAddress && (
                <div className="col-span-2 pt-1 border-t border-[#262D3D]/60">
                  <span className="text-gray-400">Delivery Address:</span>{' '}
                  <span className="text-slate-200 font-medium">{order.deliveryAddress}</span>
                </div>
              )}
              {order.specialInstructions && (
                <div className="col-span-2 pt-1 border-t border-[#262D3D]/60">
                  <span className="text-amber-400 font-bold">Kitchen Note:</span>{' '}
                  <span className="text-amber-200/90 italic font-medium">{order.specialInstructions}</span>
                </div>
              )}
              {order.voidReason && (
                <div className="col-span-2 pt-1 border-t border-[#262D3D]/60 text-rose-300">
                  <span className="font-bold">Void / Cancel Reason:</span>{' '}
                  <span>{order.voidReason}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items Breakdown Table */}
          <div className="bg-[#181C24] border border-[#262D3D] rounded-xl overflow-hidden">
            <div className="p-3 bg-[#1D222C] border-b border-[#262D3D] flex justify-between items-center text-xs font-black text-gray-300 uppercase tracking-wider">
              <span>Order Items ({order.items.reduce((s, i) => s + i.quantity, 0)})</span>
              <span>Total</span>
            </div>
            <div className="divide-y divide-[#262D3D]/60">
              {order.items.map((item, idx) => (
                <div key={idx} className="p-3 flex justify-between items-start text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-[#262D3D] text-[#eb660c] font-black flex items-center justify-center text-[11px]">
                        {item.quantity}×
                      </span>
                      <span className="font-extrabold text-white text-sm">
                        {item.name}
                      </span>
                    </div>
                    {item.customizations && item.customizations.length > 0 && (
                      <div className="pl-7 space-y-0.5">
                        {item.customizations.map((c, cIdx) => (
                          <div key={cIdx} className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                            <span className="text-[#eb660c]">•</span>
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
                    <span className="font-extrabold text-white">
                      ${item.totalPrice.toFixed(2)}
                    </span>
                    {item.quantity > 1 && (
                      <div className="text-[10px] text-gray-400">
                        ${item.unitPrice.toFixed(2)} each
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-[#181C24] border border-[#262D3D] rounded-xl p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-400 font-medium">
              <span>Subtotal:</span>
              <span>${order.subtotalAmount.toFixed(2)}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-gray-400 font-medium">
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
            <div className="pt-2 border-t border-[#262D3D] flex justify-between items-center">
              <div>
                <span className="font-black text-sm uppercase text-white tracking-wider">Total</span>
                <span className="ml-2 text-[11px] font-bold text-gray-400">
                  via {order.paymentMethod} ({order.paymentStatus})
                </span>
              </div>
              <span className="font-black text-2xl text-[#eb660c]">
                ${order.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Driver Dispatch Selector Panel */}
          {isDispatchSelectorOpen && (
            <div className="bg-[#1b212e] border border-blue-500/40 rounded-xl p-3.5 space-y-2.5 animate-fadeIn">
              <div className="flex justify-between items-center text-xs">
                <span className="font-extrabold text-blue-300">🛵 Select Driver Pickup ETA:</span>
                <button
                  type="button"
                  onClick={() => setIsDispatchSelectorOpen(false)}
                  className="text-gray-400 hover:text-white font-bold"
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
                    className="py-2.5 bg-blue-600/80 hover:bg-blue-600 text-white font-extrabold rounded-lg text-xs transition active:scale-95 border border-blue-400/40"
                  >
                    {time === 'Now' ? 'Now ⚡' : `${time} min`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Contextual Action Footer */}
        <div className="p-4 bg-[#181C24] border-t border-[#262D3D] flex items-center justify-between gap-2 flex-wrap">
          {/* Left Actions: Print / Reprint & Open in Ticket */}
          <div className="flex items-center gap-2">
            {onReprint && (
              <button
                type="button"
                onClick={() => onReprint(order)}
                className="px-3.5 py-2.5 bg-[#262D3D] hover:bg-[#323B4E] text-gray-200 hover:text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 border border-[#3A455C]"
              >
                <span>🖨️</span>
                <span>Print Ticket</span>
              </button>
            )}

            {onOpenInTicket && order.statusGroup !== 'CANCELLED' && (
              <button
                type="button"
                onClick={() => {
                  onOpenInTicket(order);
                  onClose();
                }}
                className="px-3.5 py-2.5 bg-[#262D3D] hover:bg-[#323B4E] text-gray-200 hover:text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 border border-[#3A455C]"
              >
                <span>🛒</span>
                <span>Open in Ticket</span>
              </button>
            )}

            {/* Delivery Driver Dispatch Trigger Button */}
            {order.orderType === 'delivery' && order.statusGroup !== 'COMPLETED' && order.statusGroup !== 'CANCELLED' && (
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
            {/* Status Promotion Buttons */}
            {order.statusGroup === 'NEW' && onStatusUpdate && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange('confirmed')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
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
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
              >
                <span>🍳</span>
                <span>{isUpdating ? 'Updating...' : 'Start Preparing'}</span>
              </button>
            )}

            {order.statusGroup === 'PREPARING' && onStatusUpdate && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange('ready')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
              >
                <span>🔔</span>
                <span>{isUpdating ? 'Updating...' : 'Mark Ready'}</span>
              </button>
            )}

            {order.statusGroup === 'READY' && onStatusUpdate && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange('completed')}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-black transition shadow-lg shadow-emerald-700/30 flex items-center gap-1.5"
              >
                <span>✅</span>
                <span>{isUpdating ? 'Completing...' : 'Complete Order'}</span>
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
                    : 'bg-[#eb660c] hover:bg-[#d55909] text-white shadow-lg shadow-[#eb660c]/20'
                }`}
              >
                <span>🔓</span>
                <span>{isUpdating ? 'Claiming...' : 'Claim & Open'}</span>
              </button>
            )}

            {/* FLOW Two-Phase Void / Cancellation Action */}
            {onRequestVoid && order.statusGroup !== 'CANCELLED' && (
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
          </div>
        </div>
      </div>
    </div>
  );
};
