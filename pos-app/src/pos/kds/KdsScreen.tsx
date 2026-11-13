import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { KdsStation, KdsFire } from './types';
import { loadKdsStations, getBranchLocationKey, normalizeBranchId, isHoldItem, fetchTodayBumpedOrders } from './kdsService';
import { useKdsStream } from './useKdsStream';
import { KdsTicket } from './KdsTicket';
import { KdsExpoScreen } from './KdsExpoScreen';
import { KdsStationSelector } from './KdsStationSelector';
import { KdsSettingsModal } from './KdsSettingsModal';
import { KdsBumpedOrdersModal } from './KdsBumpedOrdersModal';

interface KdsScreenProps {
  branchId?: string;
  onExit?: () => void;
}

/**
 * Masonry grid item that dynamically calculates its grid row-span based on natural content height,
 * enabling tickets in each column to stack directly beneath each other with zero wasted vertical space.
 */
const KdsTicketGridItem: React.FC<{
  children: React.ReactNode;
  colSpanClass?: string;
  itemCount: number;
}> = ({ children, colSpanClass = '', itemCount }) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const initialEstimate = 130 + itemCount * 52;
  const initialSpan = Math.max(8, Math.ceil((initialEstimate + 16) / 24));
  const [rowSpan, setRowSpan] = useState<number>(initialSpan);

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    const updateSpan = () => {
      const child = el.firstElementChild as HTMLElement | null;
      const height = child ? child.offsetHeight : el.offsetHeight;
      if (height > 0) {
        // With 8px row and 16px gap-4, step is 24px: span = ceil((height + gap) / (row + gap))
        const span = Math.ceil((height + 16) / 24);
        setRowSpan(span);
      }
    };

    updateSpan();

    const ro = new ResizeObserver(() => {
      updateSpan();
    });

    const target = (el.firstElementChild as HTMLElement) || el;
    ro.observe(target);

    return () => ro.disconnect();
  }, [itemCount]);

  return (
    <div
      ref={itemRef}
      className={colSpanClass}
      style={{ gridRowEnd: `span ${rowSpan}` }}
    >
      {children}
    </div>
  );
};

interface OpenTableInfo {
  key: string;
  label: string;
  tableNumber?: string;
  orderId: number;
  fires: KdsFire[];
  totalItems: number;
  waiter?: string;
  guestCount?: number;
  serviceType?: string;
  oldestFiredAt: string;
}

const TableSidebarItem: React.FC<{
  table: OpenTableInfo;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ table, isSelected, onSelect }) => {
  const [elapsedMins, setElapsedMins] = useState(0);

  useEffect(() => {
    const firedDate = new Date(table.oldestFiredAt);
    const update = () => {
      const sec = Math.max(0, Math.floor((Date.now() - firedDate.getTime()) / 1000));
      setElapsedMins(Math.floor(sec / 60));
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [table.oldestFiredAt]);

  const isCritical = elapsedMins >= 15;
  const isWarning = elapsedMins >= 10 && elapsedMins < 15;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
        isSelected
          ? 'bg-emerald-50 border-[#1e5c4f] ring-2 ring-emerald-500/20 shadow-xs'
          : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 border ${
            isSelected
              ? 'bg-[#1e5c4f] text-white border-[#1e5c4f] font-black'
              : isCritical
              ? 'bg-rose-100 text-rose-900 border-rose-300'
              : isWarning
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-slate-100 text-slate-800 border-slate-200'
          }`}
        >
          {table.tableNumber ? table.tableNumber : `#${table.orderId}`}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`font-black text-sm truncate ${isSelected ? 'text-[#1e5c4f]' : 'text-slate-900'}`}>
              {table.label}
            </span>
            {table.fires.length > 1 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                {table.fires.length}f
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
            <span className="font-bold text-slate-700">{table.totalItems} item{table.totalItems !== 1 ? 's' : ''}</span>
            {table.waiter && (
              <>
                <span>•</span>
                <span className="truncate">{table.waiter}</span>
              </>
            )}
            {table.guestCount && (
              <>
                <span>•</span>
                <span>{table.guestCount}g</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-mono font-black ${
            isCritical
              ? 'bg-rose-600 text-white animate-pulse'
              : isWarning
              ? 'bg-amber-500 text-white'
              : 'bg-slate-100 text-emerald-800 border border-slate-200 font-black'
          }`}
        >
          {elapsedMins}m
        </span>
        {isSelected ? (
          <span className="text-[9px] uppercase tracking-wider font-black text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
            ✓ Active
          </span>
        ) : (
          <span className="text-[9px] text-slate-400 font-medium uppercase">
            {table.serviceType || 'Dine-In'}
          </span>
        )}
      </div>
    </button>
  );
};

export const KdsScreen: React.FC<KdsScreenProps> = ({ branchId: propBranchId, onExit }) => {
  const branchId = normalizeBranchId(propBranchId || localStorage.getItem('flow_pos_selected_branch'));
  const [locationKey, setLocationKey] = useState<string>('badaro');
  const [stations, setStations] = useState<KdsStation[]>([]);
  const [activeStation, setActiveStation] = useState<KdsStation | null>(null);
  const [showStationSelector, setShowStationSelector] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showBumpedOrdersModal, setShowBumpedOrdersModal] = useState<boolean>(false);
  const [todayBumpedCount, setTodayBumpedCount] = useState<number>(0);

  // View preferences
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('flow_kds_view_mode') as 'grid' | 'list') || 'grid';
  });
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    return (localStorage.getItem('flow_kds_density') as 'comfortable' | 'compact') || 'compact';
  });
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('flow_kds_view_mode', mode);
  };

  const handleDensityToggle = () => {
    const next = density === 'comfortable' ? 'compact' : 'comfortable';
    setDensity(next);
    localStorage.setItem('flow_kds_density', next);
  };

  const handleToggleExpand = (fireId: number) => {
    setExpandedTicketId(prev => (prev === fireId ? null : fireId));
  };

  // 1. Initialize location_key and stations
  useEffect(() => {
    async function init() {
      const loc = await getBranchLocationKey(branchId);
      setLocationKey(loc);

      const stList = await loadKdsStations(branchId);
      setStations(stList);

      const savedStationCode = localStorage.getItem(`flow_kds_station_${branchId}`);
      const matched = stList.find(s => s.code === savedStationCode) || stList[0] || null;
      setActiveStation(matched);
    }
    init();
  }, [branchId]);

  const handleStationChange = (station: KdsStation) => {
    setActiveStation(station);
    localStorage.setItem(`flow_kds_station_${branchId}`, station.code);
  };

  // 2. Realtime Stream Hook
  const {
    fires,
    refreshFires,
    isConnected,
    isStreaming
  } = useKdsStream(locationKey, activeStation?.code, branchId);

  const activeFires = fires.filter(f => f.status === 'active');

  // Filter fires that have relevant items for the selected station
  const visibleFires = activeFires.filter(fire => {
    if (!activeStation || activeStation.code === 'EXPO' || activeStation.code === 'ALL') return true;
    return (fire.items || []).some(i => i.station_key === activeStation.code && i.status !== 'bumped');
  });

  // Table filtering and right sidebar state
  const [selectedTableKey, setSelectedTableKey] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Keep today's bumped orders count updated in real time
  useEffect(() => {
    let isMounted = true;
    fetchTodayBumpedOrders(branchId).then(data => {
      if (isMounted) setTodayBumpedCount(data.length);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [branchId, fires]);

  // Group visible active fires into distinct open tables
  const openTables: OpenTableInfo[] = useMemo(() => {
    const map = new Map<string, OpenTableInfo>();

    for (const fire of visibleFires) {
      const key = fire.table_label_snapshot
        ? `table:${fire.table_label_snapshot}`
        : `order:${fire.order_id}`;
      const existing = map.get(key);
      const foodItems = (fire.items || []).filter(i => !isHoldItem(i) && i.status !== 'bumped');
      const firedAt = fire.fired_at || fire.created_at;

      if (!existing) {
        map.set(key, {
          key,
          label: fire.table_label_snapshot ? `Table ${fire.table_label_snapshot}` : `Order #${fire.order_id}`,
          tableNumber: fire.table_label_snapshot,
          orderId: fire.order_id,
          fires: [fire],
          totalItems: foodItems.length,
          waiter: fire.waiter_reference_snapshot,
          guestCount: fire.guest_count_snapshot,
          serviceType: fire.service_type,
          oldestFiredAt: firedAt
        });
      } else {
        existing.fires.push(fire);
        existing.totalItems += foodItems.length;
        if (new Date(firedAt).getTime() < new Date(existing.oldestFiredAt).getTime()) {
          existing.oldestFiredAt = firedAt;
        }
      }
    }

    return Array.from(map.values());
  }, [visibleFires]);

  // If a specific table is selected from the sidebar, display only that table
  const displayedFires = useMemo(() => {
    if (!selectedTableKey) return visibleFires;
    return visibleFires.filter(fire => {
      const key = fire.table_label_snapshot
        ? `table:${fire.table_label_snapshot}`
        : `order:${fire.order_id}`;
      return key === selectedTableKey;
    });
  }, [visibleFires, selectedTableKey]);

  return (
    <div className="h-screen bg-slate-100 text-slate-900 flex flex-col select-none overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStationSelector(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300 transition-all cursor-pointer shadow-2xs"
          >
            <span className="font-black text-base text-[#1e5c4f]">
              {activeStation?.name || 'Select Station'}
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
              {activeStation?.station_type || 'KDS'}
            </span>
          </button>

          {/* Realtime Transport Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="font-mono text-[11px] font-bold">
              {isStreaming ? 'STREAM' : 'POLLING'}
            </span>
          </div>
        </div>

        {/* Center stats & view mode switcher */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
            <span className="text-[#1e5c4f] font-black mr-1">{visibleFires.length}</span> Active Ticket{visibleFires.length !== 1 ? 's' : ''}
          </div>

          {/* View Mode & Density Switchers */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-[#1e5c4f] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="Grid View (multi-column cards)"
            >
              <span>⊞</span>
              <span className="hidden md:inline">Grid</span>
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-[#1e5c4f] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title="List View (full-width chits, ideal for long orders)"
            >
              <span>☰</span>
              <span className="hidden md:inline">List / Wide</span>
            </button>

            <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

            <button
              onClick={handleDensityToggle}
              className={`px-2 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                density === 'compact'
                  ? 'bg-white text-[#1e5c4f] border border-slate-300 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
              title={density === 'compact' ? "Compact Density Active (Click for Normal)" : "Normal Density Active (Click for Compact)"}
            >
              <span>{density === 'compact' ? '📐 Compact' : '📐 Normal'}</span>
            </button>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Today's Bumped Orders Button (Read-Only Reference) */}
          <button
            onClick={() => setShowBumpedOrdersModal(true)}
            className="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-950 shadow-xs"
            title="View today's Bump orders for reference (read-only)"
          >
            <span>📦</span>
            <span className="hidden sm:inline">Bump Orders</span>
            {todayBumpedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black border border-emerald-200">
                {todayBumpedCount}
              </span>
            )}
          </button>

          {/* Open Tables Sidebar Toggle */}
          <button
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isSidebarOpen || selectedTableKey
                ? 'bg-emerald-50 text-[#1e5c4f] border-emerald-300 shadow-xs font-black'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-950 shadow-xs'
            }`}
            title={isSidebarOpen ? "Collapse Open Tables sidebar" : "Show Open Tables sidebar"}
          >
            <span>📋</span>
            <span className="hidden sm:inline">Tables</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-[#1e5c4f] text-[10px] font-black border border-slate-300">
              {openTables.length}
            </span>
            {selectedTableKey && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={refreshFires}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 border border-slate-300 transition-all cursor-pointer shadow-xs"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-all cursor-pointer shadow-xs"
            title="Settings"
          >
            ⚙️
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-700 border border-rose-200 transition-all flex items-center gap-1.5 ml-2 cursor-pointer shadow-xs"
              title="Exit KDS"
            >
              🚪 Exit KDS
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area: Workspace + Right Tables Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main KDS Workspace */}
        <main className="flex-1 overflow-auto bg-slate-100 flex flex-col">
          {/* Active Filter Banner when a specific table is isolated */}
          {selectedTableKey && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between flex-shrink-0 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                <span className="text-emerald-950 font-black text-xs uppercase tracking-wider">
                  Viewing Only Table:
                </span>
                <span className="bg-[#1e5c4f] text-white font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                  {openTables.find(t => t.key === selectedTableKey)?.label || selectedTableKey}
                </span>
                <span className="text-emerald-800 text-xs font-semibold">
                  ({displayedFires.length} ticket{displayedFires.length !== 1 ? 's' : ''})
                </span>
              </div>
              <button
                onClick={() => setSelectedTableKey(null)}
                className="text-xs px-3 py-1 rounded-lg bg-white hover:bg-emerald-100/60 text-[#1e5c4f] border border-emerald-300 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>✕</span>
                <span>Show All Tables</span>
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {activeStation?.station_type === 'expo' ? (
              <KdsExpoScreen
                fires={displayedFires}
                onTicketUpdated={refreshFires}
              />
            ) : viewMode === 'list' ? (
              /* List View: Spacious full-width or wide chits for high-volume orders */
              <div className="flex flex-col gap-4 p-4 max-w-6xl mx-auto w-full">
                {displayedFires.length === 0 ? (
                  <div className="py-20 text-center text-slate-500 font-medium">
                    {selectedTableKey ? (
                      <div className="flex flex-col items-center gap-2">
                        <span>No active tickets found for this table.</span>
                        <button
                          onClick={() => setSelectedTableKey(null)}
                          className="px-3 py-1.5 rounded-lg bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold text-xs shadow-xs transition-colors"
                        >
                          Show All Tables
                        </button>
                      </div>
                    ) : (
                      `No active tickets for ${activeStation?.name || 'this station'}. Kitchen clear.`
                    )}
                  </div>
                ) : (
                  displayedFires.map((fire) => (
                    <KdsTicket
                      key={fire.id}
                      fire={fire}
                      currentStation={activeStation}
                      currentStationKey={activeStation?.code}
                      stationColor={activeStation?.color}
                      yellowThresholdSeconds={activeStation?.default_timer_yellow_seconds}
                      redThresholdSeconds={activeStation?.default_timer_red_seconds}
                      onTicketUpdated={refreshFires}
                      viewMode="list"
                      density={density}
                      isExpanded={expandedTicketId === fire.id || displayedFires.length === 1}
                      onToggleExpand={() => handleToggleExpand(fire.id)}
                    />
                  ))
                )}
              </div>
            ) : (
              /* Grid View: Multi-column dense masonry layout - cards stack directly beneath each other */
              <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 p-4"
                style={{
                  gridAutoRows: '8px',
                  gridAutoFlow: 'dense'
                }}
              >
                {displayedFires.length === 0 ? (
                  <div className="col-span-full py-20 text-center text-slate-500 font-medium">
                    {selectedTableKey ? (
                      <div className="flex flex-col items-center gap-2">
                        <span>No active tickets found for this table.</span>
                        <button
                          onClick={() => setSelectedTableKey(null)}
                          className="px-3 py-1.5 rounded-lg bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold text-xs shadow-xs transition-colors"
                        >
                          Show All Tables
                        </button>
                      </div>
                    ) : (
                      `No active tickets for ${activeStation?.name || 'this station'}. Kitchen clear.`
                    )}
                  </div>
                ) : (
                  displayedFires.map((fire) => {
                    const isSingleDisplay = displayedFires.length === 1;
                    const isExpanded = expandedTicketId === fire.id || isSingleDisplay;
                    const itemCount = (fire.items || []).filter(i => !isHoldItem(i)).length;
                    // If single filtered table is shown, expand wide; if large (>6 items), span 2 cols; else 1 col
                    const colSpanClass = isExpanded
                      ? 'col-span-full max-w-5xl mx-auto w-full'
                      : itemCount > 6
                      ? 'col-span-1 md:col-span-2 xl:col-span-2'
                      : 'col-span-1';

                    return (
                      <KdsTicketGridItem
                        key={fire.id}
                        colSpanClass={colSpanClass}
                        itemCount={itemCount}
                      >
                        <KdsTicket
                          fire={fire}
                          currentStation={activeStation}
                          currentStationKey={activeStation?.code}
                          stationColor={activeStation?.color}
                          yellowThresholdSeconds={activeStation?.default_timer_yellow_seconds}
                          redThresholdSeconds={activeStation?.default_timer_red_seconds}
                          onTicketUpdated={refreshFires}
                          viewMode="grid"
                          density={density}
                          isExpanded={isExpanded}
                          onToggleExpand={() => handleToggleExpand(fire.id)}
                        />
                      </KdsTicketGridItem>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Open Tables Panel */}
        {isSidebarOpen && (
          <aside className="w-72 lg:w-80 bg-slate-50 border-l border-slate-200 flex flex-col flex-shrink-0 h-full overflow-hidden select-none">
            {/* Sidebar Header */}
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900 tracking-wide flex items-center gap-1.5">
                  <span>📋</span>
                  <span>Open Tables</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black border border-emerald-200">
                  {openTables.length}
                </span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-slate-400 hover:text-slate-800 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                title="Collapse Sidebar"
              >
                ✕
              </button>
            </div>

            {/* "All Open Tables" Button */}
            <div className="p-2.5 border-b border-slate-200 bg-white/80">
              <button
                type="button"
                onClick={() => setSelectedTableKey(null)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-between shadow-2xs ${
                  selectedTableKey === null
                    ? 'bg-[#1e5c4f] text-white font-black shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>🌟</span>
                  <span>All Tables</span>
                </span>
                <span className={`text-[11px] font-black px-1.5 py-0.2 rounded ${
                  selectedTableKey === null ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#1e5c4f]'
                }`}>
                  {visibleFires.length} tickets
                </span>
              </button>
            </div>

            {/* Scrollable List of Tables */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {openTables.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  No open tables active.
                </div>
              ) : (
                openTables.map((t) => (
                  <TableSidebarItem
                    key={t.key}
                    table={t}
                    isSelected={selectedTableKey === t.key}
                    onSelect={() => {
                      if (selectedTableKey === t.key) {
                        setSelectedTableKey(null); // toggle off to show all
                      } else {
                        setSelectedTableKey(t.key);
                      }
                    }}
                  />
                ))
              )}
            </div>

            {/* Sidebar Footer info */}
            <div className="p-2.5 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between">
              <span>{openTables.length} Active Table{openTables.length !== 1 ? 's' : ''}</span>
              <span className="text-slate-400">Click to isolate</span>
            </div>
          </aside>
        )}
      </div>

      {/* Station Selector Modal */}
      {showStationSelector && (
        <KdsStationSelector
          stations={stations}
          activeStation={activeStation}
          onSelectStation={handleStationChange}
          onClose={() => setShowStationSelector(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <KdsSettingsModal
          branchId={branchId}
          activeStation={activeStation}
          stations={stations}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Today's Bumped Orders Modal (Read-Only Reference) */}
      {showBumpedOrdersModal && (
        <KdsBumpedOrdersModal
          branchId={branchId}
          onClose={() => setShowBumpedOrdersModal(false)}
        />
      )}
    </div>
  );
};
