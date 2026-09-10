import React, { useState, useEffect } from 'react';
import type { KdsFire, KdsFireItem, KdsStation } from './types';
import { KdsItem } from './KdsItem';
import { updateFireItemStatus, retryPrintChit } from './kdsService';
import { kdsAudio } from './kdsAudio';

interface KdsTicketProps {
  fire: KdsFire;
  currentStation?: KdsStation | null;
  currentStationKey?: string;
  stationColor?: string;
  yellowThresholdSeconds?: number;
  redThresholdSeconds?: number;
  onTicketUpdated: () => void;
}

export const KdsTicket: React.FC<KdsTicketProps> = ({
  fire,
  currentStation,
  currentStationKey,
  stationColor,
  yellowThresholdSeconds = 600, // 10m
  redThresholdSeconds = 900,   // 15m
  onTicketUpdated
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [hasAlerted, setHasAlerted] = useState(false);
  const [reprintLabel, setReprintLabel] = useState<string>('🖨️ Re-Print');

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

  const activeStationKey = currentStation?.code || currentStationKey;

  // Filter items for current station if stationKey provided and not EXPO
  const stationItems = (activeStationKey && activeStationKey !== 'EXPO')
    ? (fire.items || []).filter(i => i.station_key === activeStationKey)
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

  const handleRetryPrint = async () => {
    setReprintLabel('Printing...');
    const station = currentStation || {
      id: 'active-station',
      branch_id: '',
      code: activeStationKey || 'KITCHEN',
      name: activeStationKey || 'Kitchen Station',
      station_type: 'prep' as const,
      color: stationColor || '#f59e0b',
      sort_order: 1,
      active: true,
      display_mode: 'grid' as const,
      allow_bump_all: true,
      sound_enabled: true,
      default_timer_yellow_seconds: yellowThresholdSeconds,
      default_timer_red_seconds: redThresholdSeconds,
      printer_destination_key: 'kitchen-printer'
    };
    const res = await retryPrintChit({ fire, station, items: stationItems });
    setReprintLabel(res.success ? '✓ Printed' : 'Failed');
    setTimeout(() => setReprintLabel('🖨️ Re-Print'), 2500);
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
            stationType={activeStationKey}
            onItemUpdated={onTicketUpdated}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 bg-gray-850 border-t border-gray-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {activeItems.length} active
          </span>
          <button
            onClick={handleRetryPrint}
            className="text-[11px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-semibold transition-all"
            title="Retry / Re-Print Chit to Station Printer"
          >
            {reprintLabel}
          </button>
        </div>

        {activeItems.length > 0 && (
          <button
            onClick={handleBumpAll}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
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
