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
          className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-black shadow-lg hover:bg-rose-100 transition animate-pulse cursor-pointer"
        >
          <span>⚠️</span>
          <span>Pilot Incident Log ({incidents.length})</span>
        </button>
      ) : (
        <div className="bg-white border border-rose-300 rounded-2xl w-96 shadow-2xl text-slate-900 flex flex-col max-h-80 overflow-hidden">
          <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <h4 className="text-xs font-black text-rose-900">Pilot Incident Log ({incidents.length})</h4>
            </div>
            <div className="flex items-center gap-2">
              {onClearIncidents && (
                <button
                  type="button"
                  onClick={onClearIncidents}
                  className="text-[10px] text-rose-700 hover:text-rose-950 underline font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-3 overflow-y-auto space-y-2 flex-1 text-xs bg-white">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className={`p-2.5 rounded-xl border ${inc.severity === 'CRITICAL' ? 'bg-rose-50/70 border-rose-200' : 'bg-amber-50/70 border-amber-200'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 uppercase text-slate-700 shadow-xs">
                    {inc.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(inc.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-slate-800 text-xs font-medium">{inc.message}</p>
                {onRetryIncident && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRetryIncident(inc)}
                      className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded text-[10px] font-bold shadow-xs cursor-pointer"
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
