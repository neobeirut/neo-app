import React, { useState } from 'react';
import type { KdsStation } from './types';
import { kdsAudio } from './kdsAudio';

interface KdsSettingsModalProps {
  activeStation: KdsStation | null;
  onClose: () => void;
}

export const KdsSettingsModal: React.FC<KdsSettingsModalProps> = ({ activeStation, onClose }) => {
  const [isMuted, setIsMuted] = useState(kdsAudio.getMuted());

  const handleToggleMute = () => {
    const next = !isMuted;
    kdsAudio.setMuted(next);
    setIsMuted(next);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-white">KDS Station Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-lg">
            ✕
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {/* Audio Chimes */}
          <div className="p-4 rounded-xl bg-gray-850 border border-gray-800 flex items-center justify-between">
            <div>
              <div className="font-bold text-white text-sm">Audio Chimes</div>
              <div className="text-xs text-gray-400">Play bells for new fires and late tickets</div>
            </div>
            <button
              onClick={handleToggleMute}
              className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
                isMuted
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
              }`}
            >
              {isMuted ? 'MUTED' : 'ENABLED'}
            </button>
          </div>

          {/* Test Sound */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => kdsAudio.playNewFireChime()}
              className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 border border-gray-700"
            >
              🔔 Test New Fire Chime
            </button>
            <button
              onClick={() => kdsAudio.playLateAlertChime()}
              className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300 border border-gray-700"
            >
              ⚠️ Test Late Ticket Chime
            </button>
          </div>

          {/* Station Info */}
          {activeStation && (
            <div className="p-4 rounded-xl bg-gray-850 border border-gray-800 text-xs space-y-1.5 text-gray-300">
              <div className="text-gray-400 uppercase font-black tracking-wider text-[10px] mb-1">
                Active Station Info
              </div>
              <div><span className="text-gray-500">Name:</span> {activeStation.name}</div>
              <div><span className="text-gray-500">Code:</span> {activeStation.code}</div>
              <div><span className="text-gray-500">Type:</span> {activeStation.station_type}</div>
              <div><span className="text-gray-500">Warning SLA:</span> {Math.round(activeStation.default_timer_yellow_seconds / 60)} min</div>
              <div><span className="text-gray-500">Critical SLA:</span> {Math.round(activeStation.default_timer_red_seconds / 60)} min</div>
              <div><span className="text-gray-500">Printer:</span> {activeStation.default_printer_ip || 'None'}</div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
};
