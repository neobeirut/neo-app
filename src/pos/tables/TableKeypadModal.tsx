import React, { useState, useEffect, useMemo } from 'react';
import type { PosTable } from './types';

interface TableKeypadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTable: (tableCode: string) => Promise<void> | void;
  onOpenFloorMap: () => void;
  currentTableCode?: string | null;
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
        if (tableInput.trim()) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tableInput]);

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

  // Filter occupied and available tables for quick chips
  const quickTables = useMemo(() => {
    return tables.filter(t => t.active).slice(0, 8);
  }, [tables]);

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

  const handleQuickChipClick = (code: string) => {
    const clean = code.replace(/^T/i, '');
    setTableInput(clean);
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
              <h2 className="text-base font-black text-white tracking-wide">Enter Table Number</h2>
              <p className="text-xs text-slate-400 font-medium">Punch table number to open dine-in ticket</p>
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

        {/* ACTIVE TABLE NOTICE (IF TICKET ALREADY HAS A TABLE) */}
        {currentTableCode && (
          <div className="px-4 py-2 bg-amber-950/50 border-b border-amber-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
              <span>Current Table:</span>
              <span className="font-black text-amber-400 underline">Table {currentTableCode}</span>
            </div>
            {onClearTable && (
              <button
                type="button"
                onClick={() => {
                  onClearTable();
                  onClose();
                }}
                className="text-[11px] font-black text-red-400 hover:text-red-300 bg-red-950/60 hover:bg-red-900/60 px-2.5 py-1 rounded-lg border border-red-500/40 transition cursor-pointer"
              >
                Clear / Exit Table
              </button>
            )}
          </div>
        )}

        {/* NUMERIC DISPLAY */}
        <div className="p-4 space-y-3">
          <div className="bg-[#0C0F17] border-2 border-[#2B354D] rounded-2xl p-3 flex flex-col items-center justify-center min-h-[78px] text-center shadow-inner">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Selected Table
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
                Will open or create Table {tableInput}
              </div>
            ) : null}
          </div>

          {/* QUICK TABLE CHIPS (IF TABLES CONFIGURED) */}
          {quickTables.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider px-1">
                Quick Select:
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {quickTables.map(t => {
                  const isOcc = t.status === 'occupied';
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleQuickChipClick(t.table_code)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border cursor-pointer active:scale-95 ${
                        isOcc
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/60'
                          : 'bg-[#181C26] border-[#2B354D] text-slate-300 hover:bg-[#222838] hover:text-white'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isOcc ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      <span>{t.table_code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                  <span>Opening Table...</span>
                </>
              ) : (
                <>
                  <span>➔</span>
                  <span>{tableInput ? `Open Table ${tableInput}` : 'Enter Table Number'}</span>
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
      </div>
    </div>
  );
};
