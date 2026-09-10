import React, { useState } from 'react';
import { X, Users, UserCheck } from 'lucide-react';
import type { PosTable, OpenTableParams } from './types';

interface OpenTableModalProps {
  isOpen: boolean;
  table: PosTable | null;
  defaultWaiterName: string;
  onClose: () => void;
  onConfirm: (params: { guestCount: number; waiterName: string }) => Promise<void>;
}

export const OpenTableModal: React.FC<OpenTableModalProps> = ({
  isOpen,
  table,
  defaultWaiterName,
  onClose,
  onConfirm
}) => {
  const [guestCount, setGuestCount] = useState<number>(table?.capacity || 2);
  const [waiterName, setWaiterName] = useState<string>(defaultWaiterName || 'Freddy');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !table) return null;

  const handleOpen = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirm({ guestCount, waiterName });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to open table');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-white">Open Table {table.table_code}</span>
            <span className="text-xs text-slate-400">({table.display_name})</span>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Guest Count */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Select Guest Count</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setGuestCount(cnt)}
                  className={`py-2.5 rounded-xl text-sm font-black transition-all ${
                    guestCount === cnt
                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-500/40 shadow'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned Waiter */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Assigned Waiter</span>
            </label>
            <input
              type="text"
              value={waiterName}
              onChange={e => setWaiterName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-slate-100 font-bold px-3.5 py-2.5 rounded-xl focus:border-amber-500 focus:outline-none"
              placeholder="Enter waiter name"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOpen}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20"
          >
            {submitting ? 'Opening Table...' : 'Open Table & Start Order'}
          </button>
        </div>
      </div>
    </div>
  );
};
