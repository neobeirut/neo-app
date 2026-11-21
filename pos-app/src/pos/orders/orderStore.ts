import type { FlowPosOrder, StatusGroup, ChannelType } from './orderAdapter';

export type MigrationFilterType = 'ALL' | 'GENUINE' | 'MIGRATION';

export interface OrdersFilterState {
  activeStatusTab: StatusGroup | 'TABLES' | 'ALL';
  activeChannelFilter: 'All' | ChannelType;
  activeConceptFilter?: 'All' | 'NEO' | 'OVRLOAD' | 'WICKD';
  activeMigrationFilter?: MigrationFilterType;
  searchQuery: string;
}

export function isTableOrderOpen(order: FlowPosOrder): boolean {
  if (!order.isTableOrder) return false;
  if (order.statusGroup === 'COMPLETED' || order.statusGroup === 'CANCELLED') return false;
  const rawSt = String(order.rawStatus || '').toLowerCase();
  if (rawSt === 'completed' || rawSt === 'closed' || rawSt === 'cancelled' || rawSt === 'canceled' || rawSt === 'voided') {
    return false;
  }
  return true;
}

export function filterOrders(
  orders: FlowPosOrder[],
  filters: OrdersFilterState
): FlowPosOrder[] {
  return orders.filter(order => {
    // Migration origin filter
    if (filters.activeMigrationFilter === 'GENUINE' && order.isMigration) return false;
    if (filters.activeMigrationFilter === 'MIGRATION' && !order.isMigration) return false;

    // Concept filter (NÉO, OVRLOAD, WICKD)
    if (filters.activeConceptFilter && filters.activeConceptFilter !== 'All') {
      if (order.conceptCode !== filters.activeConceptFilter) return false;
    }

    if (filters.activeStatusTab !== 'ALL') {
      if (filters.activeStatusTab === 'TABLES') {
        // Tables tab should only display open tables (the active ones)
        if (!isTableOrderOpen(order)) return false;
      } else if (filters.activeStatusTab === 'PREORDERED') {
        if (order.statusGroup !== 'PREORDERED' && !order.isScheduled) return false;
        if (order.statusGroup === 'CANCELLED') return false;
      } else {
        if (order.statusGroup !== filters.activeStatusTab) return false;
      }
    }
    if (filters.activeChannelFilter !== 'All') {
      if (filters.activeChannelFilter === 'Tables') {
        if (!order.isTableOrder && order.channel !== 'Tables') return false;
      } else {
        if (order.channel !== filters.activeChannelFilter) return false;
      }
    }
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchNum = order.orderNumber.toLowerCase().includes(q) || String(order.id).includes(q);
      const matchCust = order.customerName.toLowerCase().includes(q);
      const matchTbl = order.tableLabel ? order.tableLabel.toLowerCase().includes(q) : false;
      const matchPh = order.customerPhone.includes(q);
      const matchItm = order.items.some(i => i.name.toLowerCase().includes(q));
      const matchNotes = order.specialInstructions ? order.specialInstructions.toLowerCase().includes(q) : false;
      const matchMig = Boolean(order.isMigration && (q.includes('migrat') || q.includes('synthetic') || (order.orderSource || '').toLowerCase().includes(q)));
      if (!matchNum && !matchCust && !matchTbl && !matchPh && !matchItm && !matchNotes && !matchMig) return false;
    }
    return true;
  });
}

export function countOrdersByStatus(orders: FlowPosOrder[]): Record<StatusGroup | 'TABLES' | 'ALL', number> {
  const counts: Record<StatusGroup | 'TABLES' | 'ALL', number> = {
    NEW: 0,
    CONFIRMED: 0,
    PREPARING: 0,
    READY: 0,
    COMPLETED: 0,
    HELD: 0,
    PREORDERED: 0,
    CANCELLED: 0,
    TABLES: 0,
    ALL: orders.length
  };
  for (const o of orders) {
    if (counts[o.statusGroup] !== undefined) counts[o.statusGroup]++;
    // Tables tab count should strictly count open active tables
    if (isTableOrderOpen(o)) counts.TABLES++;
  }
  return counts;
}
