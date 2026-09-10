import React, { useState, useEffect } from 'react';
import type { KdsFire, KdsFireItem } from './types';
import { KdsItem } from './KdsItem';
import { updateFireItemStatus, printStationChit } from './kdsService';
import { kdsAudio } from './kdsAudio';

interface KdsTicketProps {
  fire: KdsFire;
  currentStationKey?: string;
  stationColor?: string;
  yellowThresholdSeconds?: number;
  redThresholdSeconds?: number;
  onTicketUpdated: () => void;
}

export const KdsTicket: React.FC<KdsTicketProps> = ({
  fire,
  currentStationKey,
  stationColor,
  yellowThresholdSeconds = 600, // 10m
  redThresholdSeconds = 900,   // 15m
  onTicketUpdated
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasAlerted, setHasAlerted] = useState(false);

  useEffect(() => {
    const firedDate = new Date(fire.fired_at || fire.created_at);
    const updateElapsed = () => {
      const sec = Math.max(0, Math.floor((Date.now() - firedDate.getTime()) / 1000));
      setElapsedSeconds(sec);
      if (sec >= redThresholdSeconds && !hasAlerted) {
        kdsAudio.playLateAlertChime();
        setHasAlerted(true);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [fire.fired_at, fire.created_at, redThresholdSeconds, hasAlerted]);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const isWarning = elapsedSeconds >= yellowThresholdSeconds && elapsedSeconds < redThresholdSeconds;
  const isCritical = elapsedSeconds >= redThresholdSeconds;

  const getHeaderBadgeColor = () => {
    if (isCritical) return 'bg-rose-600 text-white animate-pulse';
    if (isWarning) return 'bg-amber-600 text-white';
    return 'bg-emerald-700 text-white';
  };

  // Filter items for current station if stationKey provided and not EXPO
  const stationItems = (currentStationKey && currentStationKey !== 'EXPO')
    ? (fire.items || []).filter(i => i.station_key === currentStationKey)
    : (fire.items || []);

  const activeItems = stationItems.filter(i => i.status !== 'bumped' && i.status !== 'voided');
  const allReady = activeItems.length > 0 && activeItems.every(i => i.status === 'ready');

  const handleBumpAll = async () => {
    for (const item of activeItems) {
      const nextStatus = item.status === 'ready' ? 'bumped' : 'ready';
      await updateFireItemStatus(item.id, nextStatus);
    }
    onTicketUpdated();
  };

  if (stationItems.length === 0) return null;

  return (
    <div className={`bg-gray-900 rounded-xl border flex flex-col overflow-hidden shadow-xl transition-all ${
      isCritical ? 'border-rose-500 ring-2 ring-rose-500/50' : isWarning ? 'border-amber-500/80' : 'border-gray-800'
    }`}>
      {/* Header */}
      <div className="bg-gray-850 p-3 border-b border-gray-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-lg text-white">
              {fire.table_label_snapshot ? `TABLE ${fire.table_label_snapshot}` : `ORDER #${fire.order_id}`}
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-black bg-gray-800 text-amber-400 border border-gray-700">
              FIRE #{fire.fire_number}
            </span>
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
            <span>{fire.service_type?.toUpperCase()}</span>
            {fire.waiter_reference_snapshot && (
              <>
                <span>•</span>
                <span>{fire.waiter_reference_snapshot}</span>
              </>
            )}
            {fire.guest_count_snapshot && (
              <>
                <span>•</span>
                <span>{fire.guest_count_snapshot} guests</span>
              </>
            )}
          </div>
        </div>

        {/* SLA Timer */}
        <div className={`px-3 py-1 rounded-lg font-mono font-black text-sm ${getHeaderBadgeColor()}`}>
          {timeFormatted}
        </div>
      </div>

      {/* Items list */}
      <div className="p-3 flex-1 overflow-y-auto max-h-[420px]">
        {stationItems.map((item) => (
          <KdsItem
            key={item.id}
            item={item}
            stationType={currentStationKey}
            onItemUpdated={onTicketUpdated}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 bg-gray-850 border-t border-gray-800 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-400">
          {activeItems.length} active items
        </div>

        {activeItems.length > 0 && (
          <button
            onClick={handleBumpAll}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              allReady
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
            }`}
          >
            {allReady ? 'Bump Ticket' : 'Mark All Ready'}
          </button>
        )}
      </div>
    </div>
  );
};
