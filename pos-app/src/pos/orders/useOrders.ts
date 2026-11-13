import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { adaptOvrloadOrder, DEFAULT_SLA_CONFIG } from './orderAdapter';
import type { FlowPosOrder, StatusGroup, ChannelType, SlaConfig } from './orderAdapter';
import { filterOrders, countOrdersByStatus, isTableOrderOpen } from './orderStore';
import type { MigrationFilterType } from './orderStore';

import { COMMERCE_API_BASE, HAS_COMMERCE_API } from '../config';
import { fetchDirectOrders, getTodayShiftsCutoffIso } from '../services/posOrderService';

function playNewOrderChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(698.46, ctx.currentTime);
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn('[useOrders] Audio chime blocked by policy');
  }
}

export interface UseOrdersOptions {
  restaurantId?: string | null;
  branchId?: string | number | null;
  flowBranchId?: string | null;
  branchName?: string;
  activeShift?: any;
  shiftCutoffTime?: string | null;
  pollingIntervalMs?: number;
  slaConfig?: SlaConfig;
  autoChime?: boolean;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const {
    restaurantId,
    branchId,
    flowBranchId,
    branchName,
    activeShift,
    shiftCutoffTime,
    pollingIntervalMs = 10000,
    slaConfig = DEFAULT_SLA_CONFIG,
    autoChime = true
  } = options;

  const [orders, setOrders] = useState<FlowPosOrder[]>([]);
  const [activeStatusTab, setActiveStatusTab] = useState<StatusGroup | 'TABLES' | 'ALL'>('NEW');
  const [activeChannelFilter, setActiveChannelFilter] = useState<'All' | ChannelType>('All');
  const [activeConceptFilter, setActiveConceptFilter] = useState<'All' | 'NEO' | 'OVRLOAD' | 'WICKD'>('All');
  const [activeMigrationFilter, setActiveMigrationFilter] = useState<MigrationFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const knownOrderIdsRef = useRef<Set<string | number>>(new Set());
  const isFirstFetchRef = useRef(true);

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      let cutoff = shiftCutoffTime;
      if (!cutoff) {
        cutoff = await getTodayShiftsCutoffIso(branchName, restaurantId || undefined, activeShift);
      }

      let list: any[] = [];
      if (!HAS_COMMERCE_API) {
        const directRes = await fetchDirectOrders(restaurantId || undefined, branchId || undefined, flowBranchId || undefined, cutoff);
        list = directRes.orders || [];
      } else {
        const qs: string[] = ['type=all'];
        if (restaurantId) qs.push(`restaurant_id=${encodeURIComponent(restaurantId)}`);
        if (branchId) qs.push(`branch_id=${encodeURIComponent(String(branchId))}`);
        if (cutoff) qs.push(`created_after=${encodeURIComponent(cutoff)}`);
        const queryStr = `?${qs.join('&')}`;

        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders${queryStr}`);
        if (!res.ok) throw new Error('Failed to fetch orders (HTTP ' + res.status + ')');
        const rawOrders = await res.json();
        list = Array.isArray(rawOrders) ? rawOrders : (rawOrders.orders || []);
      }
      let adapted = list.map((o: any) => adaptOvrloadOrder(o, slaConfig));

      // Strictly scope completed/cancelled history to today's shifts cycle,
      // while keeping active open table orders and migration records visible:
      if (cutoff) {
        const cutoffMs = new Date(cutoff).getTime();
        adapted = adapted.filter(o => {
          if (o.isMigration || isTableOrderOpen(o) || (o.statusGroup !== 'COMPLETED' && o.statusGroup !== 'CANCELLED')) {
            return true;
          }
          return o.createdAt.getTime() >= cutoffMs;
        });
      }

      if (!isFirstFetchRef.current && autoChime && !isMuted) {
        let hasNew = false;
        for (const order of adapted) {
          if (!knownOrderIdsRef.current.has(order.id) && (order.statusGroup === 'NEW' || order.statusGroup === 'CONFIRMED')) {
            hasNew = true;
            break;
          }
        }
        if (hasNew) playNewOrderChime();
      }

      const nextKnown = new Set<string | number>();
      for (const order of adapted) nextKnown.add(order.id);
      knownOrderIdsRef.current = nextKnown;
      isFirstFetchRef.current = false;

      setOrders(adapted);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('[useOrders] Fetch error:', err);
      setError(err?.message || 'Error fetching orders');
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [restaurantId, branchId, flowBranchId, branchName, activeShift, shiftCutoffTime, slaConfig, autoChime, isMuted]);

  useEffect(() => {
    fetchOrders(false);
    const interval = setInterval(() => fetchOrders(true), pollingIntervalMs);
    return () => clearInterval(interval);
  }, [fetchOrders, pollingIntervalMs]);

  // Listen to instant table & order settlement events for 0ms instant UI dismissal
  useEffect(() => {
    const handleSettled = (e: any) => {
      const { orderId, tableCode, tableId } = e.detail || {};
      setOrders(prev => prev.map(o => {
        const orderTableCode = (o.tableLabel || (o.customerName ? o.customerName.replace(/^Table\s*/i, '') : '')).toUpperCase();
        const matchesOrder = orderId && (String(o.id) === String(orderId) || Number(o.id) === Number(orderId));
        const matchesTable = tableCode && orderTableCode === String(tableCode).toUpperCase();
        const matchesTableId = tableId && o.rawOrder?.table_id === tableId;

        if (matchesOrder || matchesTable || matchesTableId) {
          return {
            ...o,
            statusGroup: 'COMPLETED' as const,
            rawStatus: 'completed',
            isBillRequested: false
          };
        }
        return o;
      }));
      // Immediately re-fetch orders in background
      fetchOrders(true);
    };

    window.addEventListener('flow:table_settled', handleSettled);
    window.addEventListener('flow:order_settled', handleSettled);
    window.addEventListener('flow:order_created', handleSettled);
    return () => {
      window.removeEventListener('flow:table_settled', handleSettled);
      window.removeEventListener('flow:order_settled', handleSettled);
      window.removeEventListener('flow:order_created', handleSettled);
    };
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    return filterOrders(orders, { activeStatusTab, activeChannelFilter, activeConceptFilter, activeMigrationFilter, searchQuery });
  }, [orders, activeStatusTab, activeChannelFilter, activeConceptFilter, activeMigrationFilter, searchQuery]);

  const counts = useMemo(() => {
    const conceptScopedOrders = activeConceptFilter && activeConceptFilter !== 'All'
      ? orders.filter(o => o.conceptCode === activeConceptFilter)
      : orders;
    return countOrdersByStatus(conceptScopedOrders);
  }, [orders, activeConceptFilter]);

  return {
    orders,
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
    refreshOrders: () => fetchOrders(false)
  };
}
