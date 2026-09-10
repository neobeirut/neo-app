import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { adaptOvrloadOrder, DEFAULT_SLA_CONFIG } from './orderAdapter';
import type { FlowPosOrder, StatusGroup, ChannelType, SlaConfig } from './orderAdapter';
import { filterOrders, countOrdersByStatus } from './orderStore';

const COMMERCE_API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OVRLOAD_API_URL)
    ? import.meta.env.VITE_OVRLOAD_API_URL
    : 'https://ovrload-backend-production.up.railway.app'
).replace(/\/+$/, '');

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
  pollingIntervalMs?: number;
  slaConfig?: SlaConfig;
  autoChime?: boolean;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const {
    pollingIntervalMs = 10000,
    slaConfig = DEFAULT_SLA_CONFIG,
    autoChime = true
  } = options;

  const [orders, setOrders] = useState<FlowPosOrder[]>([]);
  const [activeStatusTab, setActiveStatusTab] = useState<StatusGroup | 'ALL'>('NEW');
  const [activeChannelFilter, setActiveChannelFilter] = useState<'All' | ChannelType>('All');
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
      const res = await fetch(COMMERCE_API_BASE + '/api/pos/orders?type=all');
      if (!res.ok) throw new Error('Failed to fetch orders (HTTP ' + res.status + ')');
      const rawOrders = await res.json();
      const adapted = (Array.isArray(rawOrders) ? rawOrders : []).map(o => adaptOvrloadOrder(o, slaConfig));

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
  }, [slaConfig, autoChime, isMuted]);

  useEffect(() => {
    fetchOrders(false);
    const interval = setInterval(() => fetchOrders(true), pollingIntervalMs);
    return () => clearInterval(interval);
  }, [fetchOrders, pollingIntervalMs]);

  const filteredOrders = useMemo(() => {
    return filterOrders(orders, { activeStatusTab, activeChannelFilter, searchQuery });
  }, [orders, activeStatusTab, activeChannelFilter, searchQuery]);

  const counts = useMemo(() => countOrdersByStatus(orders), [orders]);

  return {
    orders,
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
    refreshOrders: () => fetchOrders(false)
  };
}