import React, { useState, useEffect, useMemo } from 'react';
import type { PosTable } from './types';

interface TableKeypadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTable: (tableCode: string) => Promise<void> | void;
  onOpenFloorMap: () => void;
  currentTableCode?: string | null;
  isCurrentTableOccupied?: boolean;
  onOpenTransferModal?: () => void;
  onClearTable?: () => void;
  tables?: PosTable[];
  isLoading?: boolean;
}

export const TableKeypadModal: React.FC<TableKeypadModalProps> = ({
  isOpen,
  onClose,
  onSelectTable,
  onOpenFloorMap,
  currentTableCode,
  isCurrentTableOccupied = false,
  onOpenTransferModal,
  onClearTable,
  tables = [],
  isLoading = false
}) => {
  const [tableInput, setTableInput] = useState<string>('');

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTableInput('');
    }
  }, [isOpen]);

  // Keyboard listener for dev / physical typing
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setTableInput(prev => (prev.length < 8 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        setTableInput(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (tableInput.trim() && !isCurrentTableOccupied) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tableInput, isCurrentTableOccupied]);

  // Find matching table in current branch if already loaded
  const matchedTable = useMemo(() => {
    if (!tableInput.trim()) return null;
    const clean = tableInput.trim().toUpperCase();
    return tables.find(t => {
      const c = (t.table_code || '').toUpperCase();
      const d = (t.display_name || '').toUpperCase();
      return (
        c === clean ||
        c === `T${clean}` ||
        c.replace(/^T/, '') === clean ||
        d === clean ||
        d === `TABLE ${clean}`
      );
    });
  }, [tableInput, tables]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (tableInput.length >= 8) return;
    setTableInput(prev => prev + digit);
  };

  const handleClear = () => {
    setTableInput('');
  };

  const handleBackspace = () => {
    setTableInput(prev => prev.slice(0, -1));
  };

  const handleSubmit = () => {
    const raw = tableInput.trim();
    if (!raw) return;
    onSelectTable(raw);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none">
      <div 
        className="w-full max-w-md max-h-[94dvh] bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🪑</span>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-wide">
                {currentTableCode ? (isCurrentTableOccupied ? 'Table Locked' : 'Change Table') : 'Enter Table Number'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {currentTableCode
                  ? (isCurrentTableOccupied
                      ? 'Occupied table requires transfer'
                      : `Change Table ${currentTableCode} before order is entered`)
                  : 'Punch table number to open dine-in ticket'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm font-black transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* OCCUPIED TABLE LOCK BANNER & ENFORCEMENT */}
        {currentTableCode && isCurrentTableOccupied ? (
          <div className="p-6 space-y-4 text-center bg-white">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center text-3xl shadow-xs">
              🔒
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Table {currentTableCode} is Occupied</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                This table already has an active order. You cannot change the table number directly.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700">
              To move this order to another table, click <strong className="text-[#1e5c4f]">Transfer Table</strong> below:
            </div>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenTransferModal) onOpenTransferModal();
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl transition shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🔀</span>
                <span>Transfer Table to Another Table</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel / Keep Table {currentTableCode}
              </button>
            </div>
          </div>
        ) : (
          /* UNCOMMITTED / BEFORE ORDER ENTERED OR FRESH TABLE ENTRY */
          <div className="p-4 space-y-3 bg-white">
            {/* CURRENT TABLE INFO IF CHANGING BEFORE ENTERED */}
            {currentTableCode && (
              <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                  <span>Current:</span>
                  <span className="font-black text-amber-950 underline">Table {currentTableCode}</span>
                  <span className="text-[10px] text-slate-500 font-normal">(not entered yet)</span>
                </div>
                {onClearTable && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearTable();
                      onClose();
                    }}
                    className="text-[11px] font-black text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer"
                  >
                    Clear Table
                  </button>
                )}
              </div>
            )}

            {/* NUMERIC DISPLAY */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 flex flex-col items-center justify-center min-h-[78px] text-center shadow-inner">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {currentTableCode ? 'New Destination Table' : 'Selected Table'}
              </div>
              <div className="text-3xl font-black text-[#1e5c4f] tracking-wider">
                {tableInput ? `Table ${tableInput}` : <span className="text-slate-400 font-bold text-lg">Enter Table # (e.g. 5, 12)</span>}
              </div>

              {/* LIVE TABLE STATUS PREVIEW */}
              {matchedTable ? (
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {matchedTable.status === 'occupied' ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Occupied {matchedTable.current_bill ? `• $${Number(matchedTable.current_bill).toFixed(2)}` : ''}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-[#1e5c4f] border border-emerald-200 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#1e5c4f]"></span>
                      Available
                    </span>
                  )}
                  {matchedTable.assigned_waiter && (
                    <span className="text-slate-500 font-bold">• {matchedTable.assigned_waiter}</span>
                  )}
                </div>
              ) : tableInput ? (
                <div className="mt-1 text-[11px] text-slate-500 font-medium">
                  Will {currentTableCode ? 'switch to' : 'open'} Table {tableInput}
                </div>
              ) : null}
            </div>

            {/* 3x4 TOUCH NUMERIC KEYPAD */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="aspect-square bg-white hover:bg-slate-100 active:bg-[#1e5c4f] active:text-white text-slate-900 text-2xl font-black rounded-2xl border border-slate-200 transition-all active:scale-95 flex items-center justify-center shadow-xs cursor-pointer select-none"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                className="aspect-square bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-2xl border border-rose-200 transition-all active:scale-95 flex items-center justify-center cursor-pointer uppercase tracking-wider select-none"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="aspect-square bg-white hover:bg-slate-100 active:bg-[#1e5c4f] active:text-white text-slate-900 text-2xl font-black rounded-2xl border border-slate-200 transition-all active:scale-95 flex items-center justify-center shadow-xs cursor-pointer select-none"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                className="aspect-square bg-slate-100 hover:bg-slate-200 text-slate-700 text-xl font-black rounded-2xl border border-slate-200 transition-all active:scale-95 flex items-center justify-center cursor-pointer select-none"
                title="Backspace"
              >
                ⌫
              </button>
            </div>

            {/* PRIMARY CONFIRM BUTTON */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!tableInput.trim() || isLoading}
                className="w-full py-3.5 bg-[#1e5c4f] hover:bg-[#16473D] disabled:bg-slate-100 text-white disabled:text-slate-400 font-black text-base rounded-2xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin">⌛</span>
                    <span>Updating Table...</span>
                  </>
                ) : (
                  <>
                    <span>➔</span>
                    <span>
                      {tableInput
                        ? (currentTableCode ? `Change to Table ${tableInput}` : `Open Table ${tableInput}`)
                        : 'Enter Table Number'}
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* FLOOR MAP OPTION (RARELY USED OPTION) */}
            <div className="pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFloorMap();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-200 flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <span>🗺️</span>
                <span>View Floor Map (Visual Layout)</span>
                <span className="text-[10px] text-slate-400 font-normal">• rarely used</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
