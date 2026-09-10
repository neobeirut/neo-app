import type { FlowPosOrder, StatusGroup, ChannelType } from './orderAdapter';

export interface OrdersFilterState {
  activeStatusTab: StatusGroup | 'ALL';
  activeChannelFilter: 'All' | ChannelType;
  searchQuery: string;
}

export function filterOrders(
  orders: FlowPosOrder[],
  filters: OrdersFilterState
): FlowPosOrder[] {
  return orders.filter(order => {
    if (filters.activeStatusTab !== 'ALL') {
      if (order.statusGroup !== filters.activeStatusTab) return false;
    }
    if (filters.activeChannelFilter !== 'All') {
      if (order.channel !== filters.activeChannelFilter) return false;
    }
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchNum = order.orderNumber.toLowerCase().includes(q) || String(order.id).includes(q);
      const matchCust = order.customerName.toLowerCase().includes(q);
      const matchPh = order.customerPhone.includes(q);
      const matchItm = order.items.some(i => i.name.toLowerCase().includes(q));
      if (!matchNum && !matchCust && !matchPh && !matchItm) return false;
    }
    return true;
  });
}

export function countOrdersByStatus(orders: FlowPosOrder[]): Record<StatusGroup | 'ALL', number> {
  const counts: Record<StatusGroup | 'ALL', number> = {
    NEW: 0,
    CONFIRMED: 0,
    PREPARING: 0,
    READY: 0,
    COMPLETED: 0,
    HELD: 0,
    CANCELLED: 0,
    ALL: orders.length
  };
  for (const o of orders) {
    if (counts[o.statusGroup] !== undefined) counts[o.statusGroup]++;
  }
  return counts;
}