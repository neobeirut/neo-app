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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div 
        className="w-full max-w-md bg-[#131722] border border-[#262D3D] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 bg-[#181C26] border-b border-[#262D3D] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🪑</span>
            <div>
              <h2 className="text-base font-black text-white tracking-wide">
                {currentTableCode ? (isCurrentTableOccupied ? 'Table Locked' : 'Change Table') : 'Enter Table Number'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
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
            className="w-9 h-9 rounded-xl bg-[#222838] hover:bg-[#2C354A] text-slate-400 hover:text-white flex items-center justify-center text-sm font-black transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* OCCUPIED TABLE LOCK BANNER & ENFORCEMENT */}
        {currentTableCode && isCurrentTableOccupied ? (
          <div className="p-6 space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-3xl shadow-inner">
              🔒
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Table {currentTableCode} is Occupied</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                This table already has an active order. You cannot change the table number directly.
              </p>
            </div>
            <div className="p-3 bg-[#0C0F17] rounded-2xl border border-[#262D3D] text-xs text-slate-300">
              To move this order to another table, click <strong className="text-amber-400">Transfer Table</strong> below:
            </div>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenTransferModal) onOpenTransferModal();
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-2xl transition shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-blue-900/40"
              >
                <span>🔀</span>
                <span>Transfer Table to Another Table</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-[#181C26] hover:bg-[#222838] text-slate-400 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel / Keep Table {currentTableCode}
              </button>
            </div>
          </div>
        ) : (
          /* UNCOMMITTED / BEFORE ORDER ENTERED OR FRESH TABLE ENTRY */
          <div className="p-4 space-y-3">
            {/* CURRENT TABLE INFO IF CHANGING BEFORE ENTERED */}
            {currentTableCode && (
              <div className="px-3.5 py-2 bg-amber-950/40 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <span>Current:</span>
                  <span className="font-black text-amber-400 underline">Table {currentTableCode}</span>
                  <span className="text-[10px] text-slate-400 font-normal">(not entered yet)</span>
                </div>
                {onClearTable && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearTable();
                      onClose();
                    }}
                    className="text-[11px] font-black text-red-400 hover:text-red-300 bg-red-950/60 hover:bg-red-900/60 px-2 py-0.5 rounded border border-red-500/40 transition cursor-pointer"
                  >
                    Clear Table
                  </button>
                )}
              </div>
            )}

            {/* NUMERIC DISPLAY */}
            <div className="bg-[#0C0F17] border-2 border-[#2B354D] rounded-2xl p-3 flex flex-col items-center justify-center min-h-[78px] text-center shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {currentTableCode ? 'New Destination Table' : 'Selected Table'}
              </div>
              <div className="text-3xl font-black text-amber-400 tracking-wider">
                {tableInput ? `Table ${tableInput}` : <span className="text-slate-600 font-bold text-lg">Enter Table # (e.g. 5, 12)</span>}
              </div>

              {/* LIVE TABLE STATUS PREVIEW */}
              {matchedTable ? (
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {matchedTable.status === 'occupied' ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Occupied {matchedTable.current_bill ? `• $${Number(matchedTable.current_bill).toFixed(2)}` : ''}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Available
                    </span>
                  )}
                  {matchedTable.assigned_waiter && (
                    <span className="text-slate-400 font-semibold">• {matchedTable.assigned_waiter}</span>
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
                  className="h-13 bg-[#181D2A] hover:bg-[#232A3D] text-white text-2xl font-black rounded-2xl border border-[#262F44] transition-all active:scale-95 flex items-center justify-center shadow-sm cursor-pointer"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                className="h-13 bg-[#231A1F] hover:bg-[#33222B] text-rose-400 hover:text-rose-300 text-xs font-black rounded-2xl border border-rose-500/30 transition-all active:scale-95 flex items-center justify-center cursor-pointer uppercase tracking-wider"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-13 bg-[#181D2A] hover:bg-[#232A3D] text-white text-2xl font-black rounded-2xl border border-[#262F44] transition-all active:scale-95 flex items-center justify-center shadow-sm cursor-pointer"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                className="h-13 bg-[#1E2333] hover:bg-[#283147] text-amber-400 hover:text-amber-300 text-xl font-black rounded-2xl border border-[#2C364D] transition-all active:scale-95 flex items-center justify-center cursor-pointer"
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
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-[#222838] text-slate-950 disabled:text-slate-600 font-black text-base rounded-2xl transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
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
            <div className="pt-1 border-t border-[#222838]">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFloorMap();
                }}
                className="w-full py-2.5 rounded-xl bg-[#181C26] hover:bg-[#222838] text-slate-400 hover:text-slate-200 text-xs font-bold border border-[#2B354D] flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <span>🗺️</span>
                <span>View Floor Map (Visual Layout)</span>
                <span className="text-[10px] text-slate-500 font-normal">• rarely used</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
