import React, { useState, useEffect } from 'react';
import type { KdsFire, KdsFireItem, KdsStation } from './types';
import { KdsItem } from './KdsItem';
import { updateFireItemStatus, retryPrintChit, bumpKdsFire, isHoldItem } from './kdsService';
import { kdsAudio } from './kdsAudio';

interface KdsTicketProps {
  fire: KdsFire;
  currentStation?: KdsStation | null;
  currentStationKey?: string;
  stationColor?: string;
  yellowThresholdSeconds?: number;
  redThresholdSeconds?: number;
  onTicketUpdated: () => void;
  viewMode?: 'grid' | 'list';
  density?: 'comfortable' | 'compact';
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const KdsTicket: React.FC<KdsTicketProps> = ({
  fire,
  currentStation,
  currentStationKey,
  stationColor,
  yellowThresholdSeconds = 600, // 10m
  redThresholdSeconds = 900,   // 15m
  onTicketUpdated,
  viewMode = 'grid',
  density = 'compact',
  isExpanded = false,
  onToggleExpand
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

  // Food items that belong to this station
  const stationFoodItems = (fire.items || []).filter(i =>
    !isHoldItem(i) && (
      !activeStationKey || activeStationKey === 'EXPO' || activeStationKey === 'ALL' || i.station_key === activeStationKey
    )
  );

  // If there are no food items for this station, ticket does not display on this station
  if (stationFoodItems.length === 0) return null;

  // Station items to display: include the HOLD separator if present in the fire
  const stationItems = (fire.items || []).filter(i => {
    if (isHoldItem(i)) return true;
    return !activeStationKey || activeStationKey === 'EXPO' || activeStationKey === 'ALL' || i.station_key === activeStationKey;
  });

  const holdIndex = stationItems.findIndex(isHoldItem);
  const hasHold = holdIndex !== -1;

  // Pre-hold food items (Course 1)
  const preHoldItems = hasHold
    ? stationItems.slice(0, holdIndex).filter(i => !isHoldItem(i) && i.status !== 'voided')
    : stationItems.filter(i => !isHoldItem(i) && i.status !== 'voided');

  // Post-hold food items (Course 2)
  const postHoldItems = hasHold
    ? stationItems.slice(holdIndex + 1).filter(i => !isHoldItem(i) && i.status !== 'voided')
    : [];

  const preHoldActive = preHoldItems.filter(i => i.status !== 'bumped');
  const postHoldActive = postHoldItems.filter(i => i.status !== 'bumped');

  const preHoldNeedsReady = preHoldActive.length > 0 && preHoldActive.some(i => i.status !== 'ready');
  const postHoldNeedsReady = postHoldActive.length > 0 && postHoldActive.some(i => i.status !== 'ready');

  const allActiveFoodItems = [...preHoldActive, ...postHoldActive];
  const allFoodReady = allActiveFoodItems.length > 0 && allActiveFoodItems.every(i => i.status === 'ready');

  // Determine stage of ticket action:
  // 1) If Hold exists and Course 1 has items not ready -> "Mark Course 1 Ready"
  // 2) If Hold exists and Course 1 is ready, but Course 2 is not ready -> "Mark Course 2 Ready"
  // 3) When all courses are ready -> "Bump Ticket"
  // 4) If no Hold -> "Mark All Ready" then "Bump Ticket"
  let actionLabel = 'Mark All Ready';
  let actionType: 'mark_pre' | 'mark_post' | 'mark_all' | 'bump' = 'mark_all';

  if (hasHold) {
    if (preHoldNeedsReady) {
      actionLabel = 'Mark Course 1 Ready';
      actionType = 'mark_pre';
    } else if (postHoldNeedsReady) {
      actionLabel = 'Mark Course 2 Ready';
      actionType = 'mark_post';
    } else if (allFoodReady) {
      actionLabel = 'Bump Ticket';
      actionType = 'bump';
    }
  } else {
    if (allFoodReady) {
      actionLabel = 'Bump Ticket';
      actionType = 'bump';
    } else {
      actionLabel = 'Mark All Ready';
      actionType = 'mark_all';
    }
  }

  const handleActionButton = async () => {
    if (actionType === 'mark_pre') {
      for (const item of preHoldActive) {
        if (item.status !== 'ready') {
          await updateFireItemStatus(item.id, 'ready');
        }
      }
    } else if (actionType === 'mark_post') {
      for (const item of postHoldActive) {
        if (item.status !== 'ready') {
          await updateFireItemStatus(item.id, 'ready');
        }
      }
    } else if (actionType === 'mark_all') {
      for (const item of allActiveFoodItems) {
        if (item.status !== 'ready') {
          await updateFireItemStatus(item.id, 'ready');
        }
      }
    } else if (actionType === 'bump') {
      for (const item of allActiveFoodItems) {
        await updateFireItemStatus(item.id, 'bumped');
      }
      await bumpKdsFire(fire.id);
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
    <div className={`bg-white rounded-2xl border flex flex-col overflow-hidden shadow-md transition-all ${
      isCritical
        ? 'border-rose-500 ring-2 ring-rose-500/40'
        : fire.fire_number > 1
        ? 'border-orange-500 ring-2 ring-orange-500/30'
        : isWarning
        ? 'border-amber-500/80'
        : 'border-slate-300'
    }`}>
      {/* Header */}
      <div className="bg-slate-50 p-3 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-lg text-slate-900">
              {fire.table_label_snapshot ? `TABLE ${fire.table_label_snapshot}` : `ORDER #${fire.order_id}`}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded font-black border ${
              fire.fire_number > 1
                ? 'bg-orange-600 text-white border-orange-500 animate-pulse'
                : 'bg-slate-200 text-slate-800 border-slate-300'
            }`}>
              {fire.fire_number > 1 ? `🔥 FIRE #${fire.fire_number}` : `FIRE #${fire.fire_number}`}
            </span>
            {isExpanded && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                Expanded Fullscreen
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
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

        {/* SLA Timer & Expand Button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`px-3 py-1 rounded-lg font-mono font-black text-sm shadow-xs ${getHeaderBadgeColor()}`}>
            {timeFormatted}
          </div>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className={`px-2 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isExpanded
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : 'bg-white text-slate-700 border-slate-300 hover:text-slate-950 hover:bg-slate-100 shadow-xs'
              }`}
              title={isExpanded ? "Collapse back to grid" : "Expand order to fill screen"}
            >
              <span>{isExpanded ? '⤓' : '⛶'}</span>
              <span className="hidden sm:inline">{isExpanded ? 'Normal' : 'Expand'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Items list - dynamic natural height, no fixed height or internal scrollbar */}
      <div className={`p-3 flex-1 bg-white ${
        isExpanded || viewMode === 'list'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5'
          : stationItems.length > 5
          ? 'grid grid-cols-1 sm:grid-cols-2 gap-2'
          : 'flex flex-col'
      }`}>
        {stationItems.map((item) => (
          <KdsItem
            key={item.id}
            item={item}
            stationType={activeStationKey}
            density={density}
            onItemUpdated={onTicketUpdated}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold">
            {allActiveFoodItems.length} active item{allActiveFoodItems.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleRetryPrint}
            className="text-[11px] px-2 py-1 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold transition-all cursor-pointer shadow-xs"
            title="Retry / Re-Print Chit to Station Printer"
          >
            {reprintLabel}
          </button>
        </div>

        {allActiveFoodItems.length > 0 && (
          <button
            onClick={handleActionButton}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
              actionType === 'bump'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : actionType === 'mark_post'
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25'
                : hasHold
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
            }`}
          >
            {actionType === 'bump' ? (
              <>
                <span>✓</span>
                <span>Bump Ticket</span>
              </>
            ) : actionType === 'mark_post' ? (
              <>
                <span>🍽️</span>
                <span>Mark Course 2 Ready</span>
              </>
            ) : hasHold ? (
              <>
                <span>🥗</span>
                <span>Mark Course 1 Ready</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>Mark All Ready</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
