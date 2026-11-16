import { useState, useEffect, useRef, useCallback } from 'react';
import type { KdsFire } from './types';
import { fetchKdsFires } from './kdsService';
import { kdsAudio } from './kdsAudio';
import { supabase } from '../../api/supabase';
import { COMMERCE_API_BASE } from '../config';

export function useKdsStream(
  locationKey: string,
  stationKey?: string,
  branchId?: string,
  onNewFire?: (fire: KdsFire) => void
) {
  const [fires, setFires] = useState<KdsFire[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const seenEventIds = useRef<Set<string>>(new Set());
  const lastKnownOrderCount = useRef<number>(-1);

  const refreshFires = useCallback(async () => {
    const res = await fetchKdsFires(locationKey, stationKey, 'active', branchId);
    if (res.success) {
      // If new orders arrived, trigger audio chime
      if (lastKnownOrderCount.current !== -1 && res.fires.length > lastKnownOrderCount.current) {
        kdsAudio.playNewFireChime();
        if (onNewFire && res.fires.length > 0) {
          onNewFire(res.fires[res.fires.length - 1]);
        }
      }
      lastKnownOrderCount.current = res.fires.length;
      setFires(res.fires);
      setLastRefreshedAt(new Date());
    }
  }, [locationKey, stationKey, branchId, onNewFire]);

  // Initial load
  useEffect(() => {
    refreshFires();
  }, [refreshFires]);

  // Primary transport: Supabase Realtime channel subscription + polling backup
  useEffect(() => {
    let isSubscribed = true;

    // 1. Supabase Realtime channel on pos_orders & pos_order_items
    const channelName = `kds-live-${stationKey || 'all'}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_orders' },
        (payload) => {
          if (!isSubscribed) return;
          if (payload.eventType === 'INSERT') {
            kdsAudio.playNewFireChime();
          } else if (payload.eventType === 'UPDATE') {
            const spec = (payload.new as any)?.special_instructions;
            if (spec && String(spec).includes('COURSE_FIRED')) {
              kdsAudio.playNewFireChime();
            }
          }
          refreshFires();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pos_order_items' },
        () => {
          if (!isSubscribed) return;
          refreshFires();
        }
      )
      .subscribe((status) => {
        if (!isSubscribed) return;
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setIsStreaming(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setIsStreaming(false);
        }
      });

    // 2. Backup Polling every 4 seconds to guarantee zero missed orders
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (isSubscribed) {
        refreshFires();
      }
    }, 4000);

    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // Safe cleanup
      }
    };
  }, [locationKey, stationKey, branchId, refreshFires]);

  return {
    fires,
    setFires,
    refreshFires,
    isConnected,
    isStreaming,
    lastRefreshedAt
  };
}
