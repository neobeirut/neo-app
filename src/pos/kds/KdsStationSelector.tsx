import React from 'react';
import type { KdsStation } from './types';

interface KdsStationSelectorProps {
  stations: KdsStation[];
  activeStation: KdsStation | null;
  onSelectStation: (station: KdsStation) => void;
  onClose: () => void;
}

export const KdsStationSelector: React.FC<KdsStationSelectorProps> = ({
  stations,
  activeStation,
  onSelectStation,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white">Select KDS Station</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {stations.map((s) => {
            const isCurrent = activeStation?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  onSelectStation(s);
                  onClose();
                }}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 ${
                  isCurrent
                    ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                    : 'border-gray-800 bg-gray-850 hover:border-gray-700 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-black text-white text-base">{s.name}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                    {s.station_type}
                  </span>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  KEY: {s.code}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
