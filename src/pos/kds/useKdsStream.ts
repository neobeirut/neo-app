import { useState, useEffect, useRef, useCallback } from 'react';
import type { KdsFire, KdsEventPayload } from './types';
import { fetchKdsFires } from './kdsService';
import { kdsAudio } from './kdsAudio';

import { COMMERCE_API_BASE } from '../config';

export function useKdsStream(
  locationKey: string,
  stationKey?: string,
  onNewFire?: (fire: KdsFire) => void
) {
  const [fires, setFires] = useState<KdsFire[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const seenEventIds = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshFires = useCallback(async () => {
    if (!locationKey) return;
    const res = await fetchKdsFires(locationKey, stationKey, 'active');
    if (res.success) {
      setFires(res.fires);
      setLastRefreshedAt(new Date());
    }
  }, [locationKey, stationKey]);

  useEffect(() => {
    refreshFires();
  }, [refreshFires]);

  // Primary transport: Authenticated Fetch Streaming (SSE)
  useEffect(() => {
    if (!locationKey) return;

    let isSubscribed = true;
    let fallbackInterval: any = null;

    const startStreaming = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        // Safe authenticated fetch: token passed in headers, NEVER in query string
        const streamUrl = `${COMMERCE_API_BASE}/api/pos/kds/stream?location_key=${encodeURIComponent(locationKey)}`;
        const res = await fetch(streamUrl, {
          signal: abortControllerRef.current.signal,
          headers: {
            'Accept': 'text/event-stream'
          }
        });

        if (!res.ok || !res.body) {
          throw new Error(`Streaming HTTP ${res.status}`);
        }

        setIsConnected(true);
        setIsStreaming(true);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (isSubscribed) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = 'message';
          let currentData = '';
          let currentId = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.substring(7).trim();
            } else if (line.startsWith('id: ')) {
              currentId = line.substring(4).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.substring(6).trim();
            } else if (line === '') {
              // End of SSE message block
              if (currentData) {
                try {
                  const parsed = JSON.parse(currentData);
                  const eventId = currentId || parsed.event_id;
                  if (eventId && !seenEventIds.current.has(eventId)) {
                    seenEventIds.current.add(eventId);

                    // Handle event
                    if (parsed.type === 'kds_new_fire') {
                      kdsAudio.playNewFireChime();
                      refreshFires();
                    } else if (parsed.type === 'kds_item_status_changed' || parsed.type === 'kds_item_refired') {
                      refreshFires();
                    }
                  }
                } catch {}
              }
              currentEvent = 'message';
              currentData = '';
              currentId = '';
            }
          }
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        setIsStreaming(false);
        // Fallback: 3-second polling if stream disconnected
        if (!fallbackInterval) {
          fallbackInterval = setInterval(() => {
            refreshFires();
          }, 3000);
        }
      }
    };

    startStreaming();

    return () => {
      isSubscribed = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [locationKey, refreshFires]);

  return {
    fires,
    setFires,
    refreshFires,
    isConnected,
    isStreaming,
    lastRefreshedAt
  };
}
