import React, { useState, useEffect } from 'react';
import type { KdsStation, KdsFire } from './types';
import { loadKdsStations, getBranchLocationKey } from './kdsService';
import { useKdsStream } from './useKdsStream';
import { KdsTicket } from './KdsTicket';
import { KdsExpoScreen } from './KdsExpoScreen';
import { KdsStationSelector } from './KdsStationSelector';
import { KdsSettingsModal } from './KdsSettingsModal';

interface KdsScreenProps {
  branchId: string;
}

export const KdsScreen: React.FC<KdsScreenProps> = ({ branchId }) => {
  const [locationKey, setLocationKey] = useState<string>('badaro');
  const [stations, setStations] = useState<KdsStation[]>([]);
  const [activeStation, setActiveStation] = useState<KdsStation | null>(null);
  const [showStationSelector, setShowStationSelector] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

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
  } = useKdsStream(locationKey, activeStation?.code);

  const activeFires = fires.filter(f => f.status === 'active');

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      {/* Top Bar */}
      <header className="h-16 bg-gray-900 border-b border-gray-800 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStationSelector(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all"
          >
            <span className="font-black text-base text-amber-400">
              {activeStation?.name || 'Select Station'}
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-750 text-gray-400 border border-gray-650">
              {activeStation?.station_type || 'KDS'}
            </span>
          </button>

          {/* Realtime Transport Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="font-mono text-[11px]">
              {isStreaming ? 'STREAM' : 'POLLING'}
            </span>
          </div>
        </div>

        {/* Center stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="px-3 py-1 rounded bg-gray-800 border border-gray-700 font-bold">
            <span className="text-amber-400 font-black">{activeFires.length}</span> Active Tickets
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={refreshFires}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 border border-gray-700 transition-all"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-all"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main KDS Workspace */}
      <main className="flex-1 overflow-auto bg-gray-950">
        {activeStation?.station_type === 'expo' ? (
          <KdsExpoScreen
            fires={fires}
            onTicketUpdated={refreshFires}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 p-4">
            {activeFires.length === 0 ? (
              <div className="col-span-full py-20 text-center text-gray-500 font-medium">
                No active tickets for {activeStation?.name || 'this station'}. Kitchen clear.
              </div>
            ) : (
              activeFires.map((fire) => (
                <KdsTicket
                  key={fire.id}
                  fire={fire}
                  currentStationKey={activeStation?.code}
                  stationColor={activeStation?.color}
                  yellowThresholdSeconds={activeStation?.default_timer_yellow_seconds}
                  redThresholdSeconds={activeStation?.default_timer_red_seconds}
                  onTicketUpdated={refreshFires}
                />
              ))
            )}
          </div>
        )}
      </main>

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
          activeStation={activeStation}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};
