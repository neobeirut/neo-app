import React from 'react';
import type { FlowPosOrder } from './orderAdapter';

interface OrderCardProps {
  order: FlowPosOrder;
  isSelected?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'table';
}

function formatElapsedHoursMinutes(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const hrs = Math.floor(m / 60);
  const remMins = m % 60;
  if (hrs > 0) {
    return `${hrs}h ${remMins}m`;
  }
  return `${remMins}m`;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isSelected = false,
  onClick,
  variant = 'default'
}) => {
  const isTableVariant = variant === 'table';

  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case 'Tables': return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'WhatsApp': return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Toters': return 'bg-green-100 text-green-900 border-green-300';
      case 'NokNok': return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'App': return 'bg-sky-100 text-sky-900 border-sky-300';
      default: return 'bg-blue-100 text-blue-900 border-blue-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'PREPARING': return 'bg-orange-100 text-orange-900 border-orange-300';
      case 'READY': return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black';
      case 'COMPLETED': return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'HELD': return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'CANCELLED': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getSlaBadge = () => {
    const elapsedFormatted = formatElapsedHoursMinutes(order.elapsedMinutes);
    if (order.statusGroup === 'COMPLETED' || order.statusGroup === 'CANCELLED') {
      return <span className="text-slate-500 text-[11px] font-semibold shrink-0">{elapsedFormatted}</span>;
    }
    if (order.slaStatus === 'critical') {
      return (
        <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black animate-pulse flex items-center gap-1 shrink-0 whitespace-nowrap">
          <span>⚠️</span> {elapsedFormatted}
        </span>
      );
    }
    if (order.slaStatus === 'warning') {
      return (
        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold flex items-center gap-1 shrink-0 whitespace-nowrap">
          <span>⏱️</span> {elapsedFormatted}
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
        <span>⏱️</span> {elapsedFormatted}
      </span>
    );
  };

  const rawCode = order.tableLabel || order.customerName || '';
  const cleanNum = rawCode.replace(/^table\s*[-#]?/i, '').replace(/^[Tt]/, '').trim();
  const tableDisplayName = cleanNum ? `Table ${cleanNum}` : (order.tableLabel || order.customerName || order.orderNumber || 'Table');

  return (
    <div
      onClick={onClick}
      className={isTableVariant
        ? 'select-none flex flex-col justify-between h-full p-1'
        : ('p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none shadow-xs hover:shadow-sm ' + (
          isSelected
            ? 'bg-[#E9F4ED] border-[#1e5c4f] ring-2 ring-[#1e5c4f]/30'
            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
        ))
      }
    >
      <div>
        {isTableVariant ? (
          <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-base font-black text-slate-900 tracking-tight shrink-0 whitespace-nowrap">
                {tableDisplayName}
              </span>
              {order.conceptCode && order.conceptCode !== 'NEO' && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border flex items-center gap-0.5 ${
                  order.conceptCode === 'OVRLOAD'
                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                    : 'bg-purple-100 text-purple-900 border-purple-300'
                }`}>
                  <span>{order.conceptCode === 'OVRLOAD' ? '🔥' : '✨'}</span>
                  <span>{order.conceptName || order.conceptCode}</span>
                </span>
              )}
              {order.isBillRequested && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse shrink-0 whitespace-nowrap">
                  🧾 Bill
                </span>
              )}
            </div>
            <div className="shrink-0">{getSlaBadge()}</div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-sm font-black text-slate-900 tracking-wide">
                {tableDisplayName}
              </span>
              {order.conceptCode && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border flex items-center gap-0.5 ${
                  order.conceptCode === 'OVRLOAD'
                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                    : order.conceptCode === 'WICKD'
                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                }`}>
                  <span>{order.conceptCode === 'OVRLOAD' ? '🔥' : order.conceptCode === 'WICKD' ? '✨' : '🌿'}</span>
                  <span>{order.conceptName || order.conceptCode}</span>
                </span>
              )}
              {order.isMigration ? (
                <span className="px-2 py-0.5 rounded-md border text-[10px] font-black bg-purple-100 text-purple-900 border-purple-300 flex items-center gap-1 shadow-xs">
                  <span>📦</span>
                  <span>Generated Migration</span>
                </span>
              ) : !isTableVariant && (
                <span className={'px-2 py-0.5 rounded-md border text-[10px] font-extrabold flex items-center gap-1 ' + getChannelBadge(order.channel)}>
                  {order.isTableOrder && <span>🪑</span>}
                  <span>{order.isTableOrder ? 'Tables' : order.channel}</span>
                </span>
              )}
              {order.isPaidInAdvance && (
                <span className="px-2 py-0.5 rounded-md border text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                  <span>🟢</span> Paid in Advance
                </span>
              )}
              {order.isBillRequested && !isTableVariant && (
                <span className="px-2 py-0.5 rounded-md border text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 animate-pulse">
                  <span>🧾</span> Bill Printed
                </span>
              )}
              {order.rawOrder?.kitchen_readiness && (
                <span className="px-2 py-0.5 rounded-md border text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                  <span>🍳</span> {order.rawOrder.kitchen_readiness}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isTableVariant && (
                <span className="text-slate-500 text-xs font-semibold">
                  {order.isMigration
                    ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + order.createdTimeFormatted
                    : order.createdTimeFormatted}
                </span>
              )}
              {getSlaBadge()}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs mb-1">
          <div className="font-bold text-slate-800 min-w-0 flex-1">
            {isTableVariant ? (
              <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                <div className="flex items-center gap-1.5">
                  {order.guestCount ? <span className="text-slate-500">👥{order.guestCount}</span> : null}
                  {order.waiterName && (
                    <span className="text-amber-800 truncate font-semibold">{order.waiterName.split(' ')[0]}</span>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="text-slate-800">
                  {order.isTableOrder
                    ? (order.guestCount ? `${order.guestCount} guest${order.guestCount > 1 ? 's' : ''}` : '')
                    : order.customerName}
                </div>
                {order.waiterName && (
                  <div className="text-[10px] font-medium text-amber-800 truncate">
                    Waiter: {order.waiterName}
                  </div>
                )}
              </>
            )}
          </div>
          {!isTableVariant && (
            <span className={'px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ' + (
              order.orderType === 'dine_in'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : order.orderType === 'delivery'
                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                : 'bg-teal-100 text-teal-900 border border-teal-300'
            )}>
              {order.orderType === 'dine_in' ? 'Dine In' : order.orderType}
            </span>
          )}
        </div>

        {!isTableVariant && (
          <div className="text-[11px] text-slate-500 mb-2.5 line-clamp-2">
            {order.items.length > 0 ? (
              order.items.map(i => i.quantity + 'x ' + i.name).join(', ')
            ) : (
              <span className="italic text-slate-400">No item details</span>
            )}
          </div>
        )}

        {order.claimedTerminal && (
          <div className="mb-2.5 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
            <span>🔒</span>
            <span>Editing on {order.claimedTerminal} ({order.claimedBy || 'Cashier'})</span>
          </div>
        )}

        {order.statusGroup === 'CANCELLED' && (order.voidReason || order.specialInstructions) && (
          <div className="mb-2.5 px-2.5 py-1 bg-rose-100 text-rose-900 border border-rose-300 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
            <span>🚫</span>
            <span className="truncate">{order.voidReason || order.specialInstructions}</span>
          </div>
        )}
      </div>

      {!isTableVariant && (
      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-black text-slate-900">
            {'$' + order.totalAmount.toFixed(2)}
          </span>
          <span className={'ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ' + (
            order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
            order.paymentStatus === 'paid_legacy' ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
            order.paymentStatus === 'partially_paid' ? 'bg-amber-100 text-amber-900 border-amber-300' :
            order.paymentStatus === 'refunded' ? 'bg-purple-100 text-purple-900 border-purple-300' :
            order.paymentStatus === 'partially_refunded' ? 'bg-purple-100 text-purple-900 border-purple-300' :
            'bg-rose-100 text-rose-900 border-rose-300'
          )}>
            {order.paymentStatus === 'paid_legacy' ? 'PAID — LEGACY' :
             order.paymentStatus === 'partially_paid' ? 'PARTIAL' :
             order.paymentStatus === 'partially_refunded' ? 'PART. REFUND' :
             order.paymentStatus.toUpperCase()}
          </span>
        </div>
        <span className={'px-2.5 py-1 rounded-lg border text-[11px] font-black tracking-wide ' + getStatusBadge(order.statusGroup)}>
          {order.statusGroup}
        </span>
      </div>
      )}
    </div>
  );
};