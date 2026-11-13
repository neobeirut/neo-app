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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-slate-900">Select KDS Station</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg cursor-pointer transition-colors"
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
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer ${
                  isCurrent
                    ? 'border-[#1e5c4f] bg-emerald-50 ring-2 ring-emerald-500/20 shadow-xs text-[#1e5c4f]'
                    : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-100 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-black text-slate-900 text-base">{s.name}</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                    {s.station_type}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono">
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
