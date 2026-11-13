import React from 'react';
import type { ShiftCashRecord } from '../services/shiftCashBridge';
import { X, PauseCircle, CheckCircle2, FileText, Calendar, Clock, DollarSign, User, ShieldCheck, RefreshCw } from 'lucide-react';

interface ManagerHeldShiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  heldShifts: ShiftCashRecord[];
  onAuditShift: (shift: ShiftCashRecord) => void;
  branchName?: string;
  onRefresh?: () => void;
}

export const ManagerHeldShiftsModal: React.FC<ManagerHeldShiftsModalProps> = ({
  isOpen,
  onClose,
  heldShifts,
  onAuditShift,
  branchName,
  onRefresh
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-900">
        {/* HEADER */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
              <PauseCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">Held Shifts for Manager Audit</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 font-mono font-black text-xs">
                  {heldShifts.length} Held
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {branchName ? `${branchName} • ` : ''}Review and formally reconcile shifts placed on hold by morning cashiers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                title="Refresh held shifts"
                className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 transition cursor-pointer shadow-xs"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-300 transition cursor-pointer shadow-xs"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
          {heldShifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 space-y-3">
              <div className="p-4 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-base font-black text-slate-800">No Shifts Currently On Hold</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                All prior shifts for this branch and terminal have been verified, balanced, and closed.
              </p>
            </div>
          ) : (
            heldShifts.map((shift) => {
              const shiftDate = shift.date ? (shift.date.includes('T') ? shift.date.split('T')[0] : shift.date.split(' ')[0]) : 'Previous Date';
              const shiftType = (shift.shift || 'PM').toUpperCase();
              const heldAt = shift.finalized_at || shift.created_at;
              const formattedHeldTime = heldAt ? new Date(heldAt).toLocaleString() : 'N/A';
              const handoverNote = shift.closing_notes || shift.held_notes || 'Handed over by morning cashier for manager reconciliation.';

              return (
                <div
                  key={shift.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-[#1e5c4f]/50 transition shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-mono font-black text-xs">
                        {shiftType} SHIFT
                      </span>
                      <span className="text-sm font-black text-slate-900 font-mono">{shiftDate}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-xs text-slate-700 font-bold">{shift.branch || 'Branch'}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-xs font-mono text-slate-500">{shift.terminal_id || 'Drawer #1'}</span>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5">
                      <Clock size={13} className="text-amber-700" />
                      <span>Held: {formattedHeldTime}</span>
                    </span>
                  </div>

                  {/* HANDOVER NOTES CALLOUT */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                      <div className="flex items-center gap-1.5">
                        <FileText size={13} />
                        <span>AM Handover Note (Reported by {shift.closed_by || shift.held_by || 'Cashier'}):</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-mono bg-white p-2.5 rounded-lg border border-amber-100">
                      {handoverNote}
                    </p>
                  </div>

                  {/* LEDGER FIGURES */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Opened By</span>
                      <span className="font-bold text-slate-900 truncate block">{shift.user_name || 'Cashier'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Opening Float</span>
                      <span className="font-mono font-bold text-emerald-700">
                        ${shift.opening_usd || 0} / {(shift.opening_lbp || 0).toLocaleString()} L.L.
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Recorded Sales</span>
                      <span className="font-mono font-bold text-slate-900">
                        {(shift.sales_lbp || 0).toLocaleString()} L.L.
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Drawer Cash Snapshot</span>
                      <span className="font-mono font-bold text-amber-800">
                        {shift.actual_usd !== null && shift.actual_usd !== undefined ? `$${shift.actual_usd}` : 'Pending Count'}
                      </span>
                    </div>
                  </div>

                  {/* AUDIT ACTION */}
                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => onAuditShift(shift)}
                      className="px-5 py-2.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs transition active:scale-95 shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck size={16} />
                      <span>Audit & Formally Close Shift</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-slate-500">
            Formally closing a held shift calculates final cashier variances and permanently archives the register session.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer shadow-xs"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
