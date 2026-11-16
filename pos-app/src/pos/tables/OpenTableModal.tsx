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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md max-h-[94dvh] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-slate-900">Open Table {table.table_code}</span>
            <span className="text-xs text-slate-500 font-bold">({table.display_name})</span>
          </div>
          <button onClick={onClose} disabled={submitting} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 bg-white">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Guest Count */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#1e5c4f]" />
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
                      ? 'bg-[#1e5c4f] text-white shadow-md'
                      : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>

          {/* Assigned Waiter */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#1e5c4f]" />
              <span>Assigned Waiter</span>
            </label>
            <input
              type="text"
              value={waiterName}
              onChange={e => setWaiterName(e.target.value)}
              className="w-full bg-white border border-slate-300 text-slate-900 font-bold px-3.5 py-2.5 rounded-xl focus:border-[#1e5c4f] focus:outline-none shadow-xs"
              placeholder="Enter waiter name"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOpen}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs shadow-md transition-all cursor-pointer"
          >
            {submitting ? 'Opening Table...' : 'Open Table & Start Order'}
          </button>
        </div>
      </div>
    </div>
  );
};
