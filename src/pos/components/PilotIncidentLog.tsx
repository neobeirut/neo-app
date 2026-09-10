import React, { useState } from 'react';

export interface PilotIncident {
  id: string;
  timestamp: string;
  category: 'PRINTER' | 'KDS' | 'COMMERCE_SYNC' | 'PAYMENT' | 'OCC_CONFLICT' | 'TABLE_SYNC';
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  details?: any;
}

interface PilotIncidentLogProps {
  incidents: PilotIncident[];
  onClearIncidents?: () => void;
  onRetryIncident?: (incident: PilotIncident) => void;
}

export const PilotIncidentLog: React.FC<PilotIncidentLogProps> = ({
  incidents,
  onClearIncidents,
  onRetryIncident
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (incidents.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-rose-950/90 border border-rose-500 rounded-xl text-rose-300 text-xs font-black shadow-2xl hover:bg-rose-900 transition animate-pulse"
        >
          <span>⚠️</span>
          <span>Pilot Incident Log ({incidents.length})</span>
        </button>
      ) : (
        <div className="bg-[#181C24] border border-rose-500/50 rounded-2xl w-96 shadow-2xl text-white flex flex-col max-h-80 overflow-hidden">
          <div className="px-4 py-2.5 bg-rose-950/80 border-b border-rose-500/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <h4 className="text-xs font-black text-rose-200">Pilot Incident Log ({incidents.length})</h4>
            </div>
            <div className="flex items-center gap-2">
              {onClearIncidents && (
                <button
                  type="button"
                  onClick={onClearIncidents}
                  className="text-[10px] text-gray-400 hover:text-white underline"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-3 overflow-y-auto space-y-2 flex-1 text-xs">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className={`p-2.5 rounded-xl border ${inc.severity === 'CRITICAL' ? 'bg-rose-950/40 border-rose-500/40' : 'bg-amber-950/40 border-amber-500/40'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-[10px] px-1.5 py-0.5 rounded bg-[#1F2430] uppercase text-gray-300">
                    {inc.category}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(inc.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-200 text-xs font-medium">{inc.message}</p>
                {onRetryIncident && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRetryIncident(inc)}
                      className="px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-[10px] font-bold"
                    >
                      Retry Action
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
