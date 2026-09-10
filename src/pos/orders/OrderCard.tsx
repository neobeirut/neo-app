import React from 'react';
import type { FlowPosOrder } from './orderAdapter';

interface OrderCardProps {
  order: FlowPosOrder;
  isSelected?: boolean;
  onClick?: () => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isSelected = false,
  onClick
}) => {
  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case 'WhatsApp': return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      case 'Toters': return 'bg-green-950/80 text-green-300 border-green-500/40';
      case 'NokNok': return 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      case 'App': return 'bg-sky-950/80 text-sky-300 border-sky-500/40';
      default: return 'bg-blue-950/80 text-blue-300 border-blue-500/40';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse';
      case 'CONFIRMED': return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      case 'PREPARING': return 'bg-orange-500/20 text-orange-300 border-orange-500/50';
      case 'READY': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-black';
      case 'COMPLETED': return 'bg-gray-800 text-gray-400 border-gray-700';
      case 'HELD': return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
      case 'CANCELLED': return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
      default: return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  const getSlaBadge = () => {
    if (order.statusGroup === 'COMPLETED' || order.statusGroup === 'CANCELLED') {
      return <span className="text-gray-500 text-[11px] font-semibold">{order.elapsedMinutes}m</span>;
    }
    if (order.slaStatus === 'critical') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-rose-950/90 text-rose-300 border border-rose-500/60 text-[11px] font-black animate-pulse flex items-center gap-1">
          <span>⚠️</span> {order.elapsedMinutes} min
        </span>
      );
    }
    if (order.slaStatus === 'warning') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-amber-950/90 text-amber-300 border border-amber-500/60 text-[11px] font-extrabold flex items-center gap-1">
          <span>⏱️</span> {order.elapsedMinutes} min
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1">
        <span>⏱️</span> {order.elapsedMinutes} min
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      className={'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ' + (
        isSelected
          ? 'bg-[#1c2230] border-[#eb660c] shadow-xl shadow-[#eb660c]/15 ring-2 ring-[#eb660c]/30'
          : 'bg-[#141820] hover:bg-[#181d28] border-[#262D3D] hover:border-gray-600'
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white tracking-wide">
              {order.orderNumber}
            </span>
            <span className={'px-2 py-0.5 rounded-md border text-[10px] font-extrabold ' + getChannelBadge(order.channel)}>
              {order.channel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs font-semibold">{order.createdTimeFormatted}</span>
            {getSlaBadge()}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs mb-2">
          <div className="font-bold text-gray-200 truncate max-w-[180px]">
            {order.customerName}
          </div>
          <span className={'px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ' + (
            order.orderType === 'delivery'
              ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
              : 'bg-teal-950 text-teal-300 border border-teal-500/40'
          )}>
            {order.orderType}
          </span>
        </div>

        <div className="text-[11px] text-gray-400 mb-3 line-clamp-2">
          {order.items.length > 0 ? (
            order.items.map(i => i.quantity + 'x ' + i.name).join(', ')
          ) : (
            <span className="italic text-gray-500">No item details</span>
          )}
        </div>

        {order.claimedTerminal && (
          <div className="mb-3 px-2.5 py-1 bg-amber-950/80 text-amber-300 border border-amber-500/50 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
            <span>🔒</span>
            <span>Editing on {order.claimedTerminal} ({order.claimedBy || 'Cashier'})</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-[#262D3D] flex items-center justify-between">
        <div>
          <span className="text-sm font-black text-white">
            {'$' + order.totalAmount.toFixed(2)}
          </span>
          <span className={'ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ' + (
            order.paymentStatus === 'paid' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' :
            order.paymentStatus === 'paid_legacy' ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30' :
            order.paymentStatus === 'partially_paid' ? 'bg-amber-950/60 text-amber-400 border-amber-500/30' :
            order.paymentStatus === 'refunded' ? 'bg-purple-950/60 text-purple-400 border-purple-500/30' :
            order.paymentStatus === 'partially_refunded' ? 'bg-purple-950/60 text-purple-300 border-purple-500/30' :
            'bg-rose-950/60 text-rose-400 border-rose-500/30'
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
    </div>
  );
};