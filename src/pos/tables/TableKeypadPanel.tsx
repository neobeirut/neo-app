import React, { useState, useEffect, useMemo } from 'react';
import type { PosTable, FloorArea, TableShape } from './types';
import { 
  openTableSession, 
  transferTable, 
  changeGuestCount, 
  upsertTable, 
  deleteTable, 
  closeTableSession,
  getOrCreateTableAndSession 
} from './tableService';
import { 
  Users, 
  Clock, 
  ArrowRightLeft, 
  Receipt, 
  Plus, 
  Check, 
  Trash2, 
  Edit2, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Layers, 
  DollarSign, 
  Sparkles, 
  Save,
  RotateCcw
} from 'lucide-react';

interface TableKeypadPanelProps {
  tables: PosTable[];
  areas: FloorArea[];
  activeAreaId: string | null;
  branchId: string;
  restaurantId: string;
  externalBranchId: string;
  cashierName: string;
  selectedTable: PosTable | null;
  initialTableCode?: string | null;
  onSelectTable: (table: PosTable | null) => void;
  onTableStateChange: () => Promise<void>;
  onOpenOrderInCart?: (
    orderId: number | null,
    tableCode: string,
    sessionId?: string,
    guestCount?: number,
    waiterName?: string
  ) => void;
  onPrintPreCheckDoc?: (table: PosTable) => void;
}

export const TableKeypadPanel: React.FC<TableKeypadPanelProps> = ({
  tables,
  areas,
  activeAreaId,
  branchId,
  restaurantId,
  externalBranchId,
  cashierName,
  selectedTable,
  initialTableCode,
  onSelectTable,
  onTableStateChange,
  onOpenOrderInCart,
  onPrintPreCheckDoc
}) => {
  // Keypad input string (e.g. "4", "12")
  const [tableInput, setTableInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'action' | 'edit'>('action');
  const [guestCount, setGuestCount] = useState<number>(2);
  const [waiterName, setWaiterName] = useState<string>(cashierName);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit table properties
  const [editTableCode, setEditTableCode] = useState<string>('');
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editCapacity, setEditCapacity] = useState<number>(4);
  const [editAreaId, setEditAreaId] = useState<string>('');
  const [editShape, setEditShape] = useState<TableShape>('square');

  // Transfer sub-mode
  const [isTransferMode, setIsTransferMode] = useState<boolean>(false);
  const [transferTargetInput, setTransferTargetInput] = useState<string>('');

  // Auto-dismiss feedback message after 4s
  useEffect(() => {
    if (feedbackMessage) {
      const t = setTimeout(() => setFeedbackMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedbackMessage]);

  // Sync when initialTableCode or selectedTable changes from outside
  useEffect(() => {
    if (selectedTable) {
      const code = selectedTable.table_code.replace(/^T/i, '');
      setTableInput(code || selectedTable.table_code);
      setGuestCount(selectedTable.status === 'occupied' && selectedTable.guest_count ? selectedTable.guest_count : (selectedTable.capacity || 2));
      setEditTableCode(selectedTable.table_code);
      setEditDisplayName(selectedTable.display_name || `Table ${selectedTable.table_code}`);
      setEditCapacity(selectedTable.capacity || 4);
      setEditAreaId(selectedTable.floor_area_id || (areas[0]?.id || ''));
      setEditShape(selectedTable.shape || 'square');
      setIsTransferMode(false);
      setTransferTargetInput('');
    } else if (initialTableCode && !tableInput) {
      const clean = initialTableCode.replace(/^T/i, '');
      setTableInput(clean);
    }
  }, [selectedTable]);

  // Match input with existing table in branch
  const matchedTable = useMemo(() => {
    if (!tableInput.trim()) return selectedTable || null;
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
    }) || null;
  }, [tableInput, tables, selectedTable]);

  // Notify parent if matched table changes
  useEffect(() => {
    if (matchedTable && matchedTable.id !== selectedTable?.id) {
      onSelectTable(matchedTable);
    } else if (!matchedTable && !tableInput.trim() && selectedTable) {
      onSelectTable(null);
    }
  }, [matchedTable]);

  // Destination table for transfer mode
  const matchedTransferTarget = useMemo(() => {
    if (!transferTargetInput.trim()) return null;
    const clean = transferTargetInput.trim().toUpperCase();
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
    }) || null;
  }, [transferTargetInput, tables]);

  // Keyboard listener for physical typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key >= '0' && e.key <= '9') {
        if (isTransferMode) {
          setTransferTargetInput(prev => (prev.length < 8 ? prev + e.key : prev));
        } else {
          setTableInput(prev => (prev.length < 8 ? prev + e.key : prev));
        }
      } else if (e.key === 'Backspace') {
        if (isTransferMode) {
          setTransferTargetInput(prev => prev.slice(0, -1));
        } else {
          setTableInput(prev => prev.slice(0, -1));
        }
      } else if (e.key === 'Escape') {
        if (isTransferMode) {
          setIsTransferMode(false);
        } else {
          handleClear();
        }
      } else if (e.key === 'Enter') {
        if (isTransferMode) {
          handleExecuteTransfer();
        } else if (matchedTable) {
          if (matchedTable.status === 'available') {
            handleOpenAvailableTable();
          } else {
            handleOpenOccupiedOrder();
          }
        } else if (tableInput.trim()) {
          handleCreateAndOpenTable();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTransferMode, tableInput, transferTargetInput, matchedTable]);

  // Keypad Handlers
  const handleDigit = (digit: string) => {
    if (isTransferMode) {
      if (transferTargetInput.length >= 8) return;
      setTransferTargetInput(prev => prev + digit);
    } else {
      if (tableInput.length >= 8) return;
      setTableInput(prev => prev + digit);
    }
  };

  const handleClear = () => {
    if (isTransferMode) {
      setTransferTargetInput('');
    } else {
      setTableInput('');
      onSelectTable(null);
      setActiveTab('action');
    }
  };

  const handleBackspace = () => {
    if (isTransferMode) {
      setTransferTargetInput(prev => prev.slice(0, -1));
    } else {
      setTableInput(prev => prev.slice(0, -1));
    }
  };

  // 1. Open Available Table & Start Order
  const handleOpenAvailableTable = async () => {
    if (!matchedTable || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await openTableSession({
        tableId: matchedTable.id,
        tableCode: matchedTable.table_code,
        branchId,
        restaurantId,
        externalBranchId,
        guestCount,
        waiterName: waiterName || cashierName,
        operatorName: cashierName
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to open table session');
      }

      await onTableStateChange();

      if (onOpenOrderInCart) {
        onOpenOrderInCart(
          res.orderId || null,
          matchedTable.table_code,
          res.sessionId,
          guestCount,
          waiterName || cashierName
        );
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error opening table.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Open / Edit Occupied Order in POS Sell Mode
  const handleOpenOccupiedOrder = () => {
    if (!matchedTable || !onOpenOrderInCart) return;
    onOpenOrderInCart(
      matchedTable.commerce_order_id || null,
      matchedTable.table_code,
      matchedTable.current_session_id || undefined,
      matchedTable.guest_count || undefined,
      matchedTable.assigned_waiter || undefined
    );
  };

  // 3. Create Table & Open Order (on-the-fly)
  const handleCreateAndOpenTable = async () => {
    const raw = tableInput.trim();
    if (!raw || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await getOrCreateTableAndSession({
        tableCodeInput: raw,
        branchId,
        restaurantId,
        externalBranchId,
        guestCount,
        operatorName: cashierName,
        waiterName: waiterName || cashierName
      });

      if (!res.success || !res.table) {
        throw new Error(res.error || 'Failed to create and open table.');
      }

      await onTableStateChange();

      if (onOpenOrderInCart) {
        onOpenOrderInCart(
          res.orderId || null,
          res.table.table_code,
          res.sessionId,
          res.guestCount,
          res.waiterName
        );
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error processing table.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Save Table to Floor Plan Only (without starting an order)
  const handleSaveTableToFloor = async () => {
    const raw = tableInput.trim();
    if (!raw || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const cleanCode = raw.toUpperCase().startsWith('T') ? raw.toUpperCase() : `T${raw}`;
      const targetAreaId = editAreaId || (areas.length > 0 ? areas[0].id : '');

      const res = await upsertTable({
        branch_id: branchId,
        floor_area_id: targetAreaId,
        table_code: cleanCode,
        display_name: `Table ${raw}`,
        capacity: editCapacity || 4,
        shape: editShape || 'square',
        active: true
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to save table.');
      }

      await onTableStateChange();
      setFeedbackMessage({ type: 'success', text: `Table ${cleanCode} created on floor plan!` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to create table.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Update Existing Table Configuration
  const handleUpdateTableConfig = async () => {
    if (!matchedTable || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await upsertTable({
        id: matchedTable.id,
        branch_id: branchId,
        floor_area_id: editAreaId || matchedTable.floor_area_id,
        table_code: editTableCode.trim().toUpperCase() || matchedTable.table_code,
        display_name: editDisplayName.trim() || `Table ${editTableCode}`,
        capacity: editCapacity,
        shape: editShape,
        active: true
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to update table.');
      }

      await onTableStateChange();
      setFeedbackMessage({ type: 'success', text: 'Table settings updated successfully!' });
      setActiveTab('action');
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to update table.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 6. Delete Table
  const handleDeleteTable = async () => {
    if (!matchedTable || isSubmitting) return;
    if (matchedTable.status !== 'available') {
      alert('Cannot delete an occupied table. Please settle or close the session first.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Table ${matchedTable.table_code}?`)) return;

    setIsSubmitting(true);
    try {
      const res = await deleteTable(matchedTable.id);
      if (!res.success) throw new Error(res.error || 'Failed to delete table.');
      await onTableStateChange();
      handleClear();
      setFeedbackMessage({ type: 'success', text: `Table ${matchedTable.table_code} deleted.` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to delete table.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Execute Table Transfer
  const handleExecuteTransfer = async () => {
    if (!matchedTable || !matchedTransferTarget || isSubmitting) return;
    if (matchedTransferTarget.status !== 'available') {
      setFeedbackMessage({ type: 'error', text: `Destination Table ${matchedTransferTarget.table_code} is occupied.` });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await transferTable({
        sessionId: matchedTable.current_session_id!,
        commerceOrderId: matchedTable.commerce_order_id || null,
        fromTableId: matchedTable.id,
        toTableId: matchedTransferTarget.id,
        toTableCode: matchedTransferTarget.table_code,
        operatorName: cashierName
      });

      if (!res.success) throw new Error(res.error || 'Transfer failed.');

      await onTableStateChange();
      setFeedbackMessage({ 
        type: 'success', 
        text: `Transferred Table ${matchedTable.table_code} ➔ Table ${matchedTransferTarget.table_code}!` 
      });
      setIsTransferMode(false);
      setTransferTargetInput('');
      setTableInput(matchedTransferTarget.table_code.replace(/^T/i, ''));
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Transfer failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 8. Change Guest Count on Occupied Table
  const handleUpdateGuests = async (delta: number) => {
    if (!matchedTable || !matchedTable.current_session_id) return;
    const newCount = Math.max(1, (matchedTable.guest_count || 1) + delta);
    try {
      await changeGuestCount(matchedTable.current_session_id, matchedTable.commerce_order_id || null, newCount);
      await onTableStateChange();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: 'Failed to update guest count.' });
    }
  };

  // 9. Settle / Close Table Session
  const handleCloseSession = async () => {
    if (!matchedTable || !matchedTable.current_session_id) return;
    if (!window.confirm(`Close session for Table ${matchedTable.table_code}?`)) return;
    setIsSubmitting(true);
    try {
      const res = await closeTableSession(matchedTable.current_session_id, matchedTable.commerce_order_id);
      if (!res.success) throw new Error(res.error || 'Failed to close session.');
      await onTableStateChange();
      setFeedbackMessage({ type: 'success', text: `Table ${matchedTable.table_code} session closed.` });
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to close session.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOccupied = matchedTable && (matchedTable.status === 'occupied' || matchedTable.status === 'bill_requested');
  const isAvailable = matchedTable && matchedTable.status === 'available';
  const isNewTable = !matchedTable && Boolean(tableInput.trim());

  return (
    <div className="h-full flex flex-col bg-[#131722] text-white select-none overflow-hidden">
      {/* PANEL HEADER */}
      <div className="p-3.5 bg-[#181C26] border-b border-[#262D3D] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-base flex-shrink-0 shadow-inner">
            🪑
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-white tracking-wide truncate">
              {isTransferMode ? 'Transfer Table' : 'Table Keypad & Control'}
            </h3>
            <p className="text-[10px] text-slate-400 truncate">
              {isTransferMode 
                ? 'Punch target table number' 
                : matchedTable 
                ? `Table ${matchedTable.table_code} • ${matchedTable.display_name || ''}` 
                : isNewTable 
                ? `New Table ${tableInput.trim()}` 
                : 'Select table or enter number'}
            </p>
          </div>
        </div>

        {/* Clear / Reset Button */}
        {(tableInput || isTransferMode) && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 py-1 rounded-lg bg-[#222838] hover:bg-[#2C354A] text-slate-400 hover:text-white text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
            title="Clear input"
          >
            <span>Clear</span>
            <span>✕</span>
          </button>
        )}
      </div>

      {/* FEEDBACK TOAST BANNER */}
      {feedbackMessage && (
        <div className={`px-3 py-2 text-xs font-bold flex items-center gap-2 border-b flex-shrink-0 animate-fadeIn ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50'
            : 'bg-rose-950/90 text-rose-300 border-rose-500/50'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
          <span className="truncate">{feedbackMessage.text}</span>
        </div>
      )}

      {/* SCROLLABLE WORKSPACE */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {/* TABLE CODE DISPLAY & STATUS BADGE */}
        <div className="bg-[#0C0F17] rounded-2xl p-3 border border-[#262D3D] shadow-inner">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            <span>{isTransferMode ? 'Target Table #' : 'Active Table #'}</span>
            <span>
              {isTransferMode ? (
                matchedTransferTarget ? (
                  matchedTransferTarget.status === 'available' ? (
                    <span className="text-emerald-400 font-black">● Target Free</span>
                  ) : (
                    <span className="text-rose-400 font-black">● Target Busy</span>
                  )
                ) : (
                  <span className="text-slate-500">Awaiting Target</span>
                )
              ) : isOccupied ? (
                <span className="text-rose-400 font-black">● Occupied</span>
              ) : isAvailable ? (
                <span className="text-emerald-400 font-black">● Available</span>
              ) : isNewTable ? (
                <span className="text-amber-400 font-black">✨ New Table</span>
              ) : (
                <span className="text-slate-500">Ready</span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 font-mono font-black text-2xl tracking-wider text-white truncate flex items-center gap-1.5">
              <span className="text-amber-400 text-lg">🪑</span>
              <span>
                {isTransferMode
                  ? (transferTargetInput ? `T${transferTargetInput}` : '—')
                  : (tableInput ? `T${tableInput}` : '—')}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleBackspace}
                className="w-10 h-9 rounded-xl bg-[#1A202C] hover:bg-[#252E3E] text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition active:scale-95 cursor-pointer shadow-sm border border-[#2B354D]"
                title="Backspace"
              >
                ⌫
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="w-10 h-9 rounded-xl bg-[#1A202C] hover:bg-[#252E3E] text-slate-300 hover:text-white flex items-center justify-center font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm border border-[#2B354D]"
                title="Clear"
              >
                C
              </button>
            </div>
          </div>
        </div>

        {/* TOUCH NUMERIC KEYPAD */}
        <div className="grid grid-cols-3 gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-11 rounded-xl bg-[#181D28] hover:bg-[#22293A] active:bg-amber-500 active:text-slate-950 text-white font-black text-lg border border-[#2B354D] transition-all flex items-center justify-center shadow cursor-pointer active:scale-95"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-11 rounded-xl bg-[#1E1720] hover:bg-[#2A1F2D] active:bg-rose-600 text-rose-300 hover:text-white font-black text-xs border border-rose-500/30 transition-all flex items-center justify-center shadow cursor-pointer active:scale-95"
          >
            CLEAR
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-11 rounded-xl bg-[#181D28] hover:bg-[#22293A] active:bg-amber-500 active:text-slate-950 text-white font-black text-lg border border-[#2B354D] transition-all flex items-center justify-center shadow cursor-pointer active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-11 rounded-xl bg-[#1A202C] hover:bg-[#252E3E] active:bg-amber-500 active:text-slate-950 text-slate-300 hover:text-white font-black text-base border border-[#2B354D] transition-all flex items-center justify-center shadow cursor-pointer active:scale-95"
          >
            ⌫
          </button>
        </div>

        {/* MODE TABS (When table is selected) */}
        {matchedTable && !isTransferMode && (
          <div className="flex rounded-xl bg-[#0C0F17] p-1 border border-[#262D3D]">
            <button
              type="button"
              onClick={() => setActiveTab('action')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeTab === 'action'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⚡ Operations</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeTab === 'edit'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Table</span>
            </button>
          </div>
        )}

        {/* SUB-MODE: TRANSFER TABLE */}
        {isTransferMode && matchedTable && (
          <div className="bg-[#10141E] rounded-2xl p-3 border border-indigo-500/40 space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
              <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
              <span>Transfer Table {matchedTable.table_code}</span>
            </div>

            <p className="text-[11px] text-slate-300">
              Punch destination table number on the keypad above.
            </p>

            {matchedTransferTarget ? (
              <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                matchedTransferTarget.status === 'available'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}>
                Destination: <strong>Table {matchedTransferTarget.table_code}</strong> ({matchedTransferTarget.status})
              </div>
            ) : transferTargetInput ? (
              <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-300 text-xs font-bold">
                Table {transferTargetInput} does not exist on floor map.
              </div>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={!matchedTransferTarget || matchedTransferTarget.status !== 'available' || isSubmitting}
                onClick={handleExecuteTransfer}
                className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-40 text-white font-black text-xs rounded-xl transition shadow cursor-pointer"
              >
                {isSubmitting ? 'Transferring...' : `Confirm Transfer ➔ T${transferTargetInput || ''}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsTransferMode(false);
                  setTransferTargetInput('');
                }}
                className="px-3 h-11 bg-[#1E2433] hover:bg-[#2A3347] text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: ACTIONS (AVAILABLE TABLE) */}
        {!isTransferMode && activeTab === 'action' && isAvailable && matchedTable && (
          <div className="bg-[#10141E] rounded-2xl p-3.5 border border-emerald-500/40 space-y-3 shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-black text-emerald-300">Table {matchedTable.table_code} is Available</span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">{matchedTable.capacity} Seats</span>
            </div>

            {/* Guest Count Stepper */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Guest Count: {guestCount} Guests
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGuestCount(prev => Math.max(1, prev - 1))}
                  className="w-10 h-9 rounded-xl bg-[#1C2230] hover:bg-[#252E40] text-slate-200 font-black text-base transition flex items-center justify-center border border-[#2B354D] cursor-pointer"
                >
                  -
                </button>
                <div className="flex-1 h-9 rounded-xl bg-[#0C0F17] border border-[#2B354D] flex items-center justify-center font-black text-sm text-white">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                  <span>{guestCount}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGuestCount(prev => prev + 1)}
                  className="w-10 h-9 rounded-xl bg-[#1C2230] hover:bg-[#252E40] text-slate-200 font-black text-base transition flex items-center justify-center border border-[#2B354D] cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-5 gap-1.5 mt-1.5">
                {[1, 2, 4, 6, 8].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setGuestCount(num)}
                    className={`py-1 rounded-lg text-xs font-bold transition border ${
                      guestCount === num
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                        : 'bg-[#181D28] text-slate-400 border-[#2B354D] hover:text-white'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* PRIMARY BUTTON: OPEN TABLE & START ORDER */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleOpenAvailableTable}
              className="w-full h-13 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 active:scale-95 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>{isSubmitting ? 'Opening Table...' : `Open Table ${matchedTable.table_code} & Start Order`}</span>
            </button>
          </div>
        )}

        {/* TAB 1: ACTIONS (OCCUPIED TABLE) */}
        {!isTransferMode && activeTab === 'action' && isOccupied && matchedTable && (
          <div className="bg-[#10141E] rounded-2xl p-3.5 border border-rose-500/40 space-y-3 shadow">
            {/* OCCUPIED STATUS & FINANCIALS */}
            <div className="flex items-center justify-between border-b border-[#262D3D] pb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-black text-rose-300">Table {matchedTable.table_code} Occupied</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Server: <strong className="text-white">{matchedTable.assigned_waiter || cashierName}</strong>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-white">
                  ${(matchedTable.current_bill || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-amber-400 font-bold">
                  Due: ${(matchedTable.amount_remaining || matchedTable.current_bill || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* QUICK STATS PILLS */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-[#0C0F17] border border-[#262D3D] flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">Guests</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateGuests(-1)}
                    className="w-5 h-5 rounded bg-[#1C2230] text-slate-300 font-bold flex items-center justify-center hover:text-white"
                  >
                    -
                  </button>
                  <span className="font-black text-white px-1">{matchedTable.guest_count || 1}</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateGuests(1)}
                    className="w-5 h-5 rounded bg-[#1C2230] text-slate-300 font-bold flex items-center justify-center hover:text-white"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-[#0C0F17] border border-[#262D3D] flex items-center justify-between">
                <span className="text-slate-400 text-[10px]">Elapsed</span>
                <span className="font-black text-amber-300 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  {matchedTable.elapsed_minutes || 0}m
                </span>
              </div>
            </div>

            {/* PRIMARY BUTTON: OPEN / EDIT ORDER IN POS */}
            <button
              type="button"
              onClick={handleOpenOccupiedOrder}
              className="w-full h-12 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>📝 Open / Edit Order in POS</span>
            </button>

            {/* SECONDARY ACTION BUTTONS */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsTransferMode(true);
                  setTransferTargetInput('');
                }}
                className="h-10 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>Transfer Table</span>
              </button>

              <button
                type="button"
                onClick={() => onPrintPreCheckDoc && onPrintPreCheckDoc(matchedTable)}
                className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
                <span>Pre-Check</span>
              </button>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleCloseSession}
              className="w-full py-2 rounded-xl bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border border-rose-500/30 font-bold text-xs transition cursor-pointer"
            >
              ✕ Close / Release Table Session
            </button>
          </div>
        )}

        {/* TAB 2: EDIT TABLE CONFIGURATION */}
        {!isTransferMode && activeTab === 'edit' && matchedTable && (
          <div className="bg-[#10141E] rounded-2xl p-3.5 border border-[#262D3D] space-y-3 shadow">
            <div className="flex items-center justify-between border-b border-[#262D3D] pb-2">
              <span className="text-xs font-black text-white">Edit Table {matchedTable.table_code}</span>
              <button
                type="button"
                onClick={() => setActiveTab('action')}
                className="text-[11px] text-amber-400 font-bold hover:underline"
              >
                ← Back to Operations
              </button>
            </div>

            {/* Table Code */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Table Code / Label
              </label>
              <input
                type="text"
                value={editTableCode}
                onChange={e => setEditTableCode(e.target.value)}
                className="w-full h-9 bg-[#181D28] border border-[#2B354D] rounded-xl px-3 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Display Name */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={e => setEditDisplayName(e.target.value)}
                className="w-full h-9 bg-[#181D28] border border-[#2B354D] rounded-xl px-3 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Capacity */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Seating Capacity: {editCapacity} seats
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditCapacity(prev => Math.max(1, prev - 1))}
                  className="w-10 h-8 rounded-lg bg-[#1C2230] text-slate-200 font-bold"
                >
                  -
                </button>
                <div className="flex-1 h-8 bg-[#0C0F17] rounded-lg border border-[#2B354D] flex items-center justify-center font-bold text-xs text-white">
                  {editCapacity} Seats
                </div>
                <button
                  type="button"
                  onClick={() => setEditCapacity(prev => prev + 1)}
                  className="w-10 h-8 rounded-lg bg-[#1C2230] text-slate-200 font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Floor Area */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Floor Area
              </label>
              <select
                value={editAreaId}
                onChange={e => setEditAreaId(e.target.value)}
                className="w-full h-9 bg-[#181D28] border border-[#2B354D] rounded-xl px-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              >
                {areas.map(a => (
                  <option key={a.id} value={a.id} className="bg-[#181D28] text-white">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shape */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Shape
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['square', 'round', 'rectangle'] as TableShape[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditShape(s)}
                    className={`py-1 rounded-lg text-xs font-bold capitalize transition border ${
                      editShape === s
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                        : 'bg-[#181D28] text-slate-400 border-[#2B354D]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Save & Delete Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleUpdateTableConfig}
                className="w-full h-10 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>

              {matchedTable.status === 'available' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDeleteTable}
                  className="w-full py-1.5 text-rose-400 hover:text-rose-300 text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Table from Floor</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* NEW TABLE CREATION FORM */}
        {isNewTable && (
          <div className="bg-[#10141E] rounded-2xl p-3.5 border border-amber-500/40 space-y-3 shadow">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black text-white">Create Table {tableInput.trim()}</span>
            </div>

            <p className="text-[11px] text-slate-400">
              Table {tableInput.trim()} is not on the floor plan yet. Choose options to create it:
            </p>

            {/* Capacity */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Seating Capacity: {editCapacity} seats
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditCapacity(prev => Math.max(1, prev - 1))}
                  className="w-10 h-8 rounded-lg bg-[#1C2230] text-slate-200 font-bold"
                >
                  -
                </button>
                <div className="flex-1 h-8 bg-[#0C0F17] rounded-lg border border-[#2B354D] flex items-center justify-center font-bold text-xs text-white">
                  {editCapacity} Seats
                </div>
                <button
                  type="button"
                  onClick={() => setEditCapacity(prev => prev + 1)}
                  className="w-10 h-8 rounded-lg bg-[#1C2230] text-slate-200 font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Area */}
            {areas.length > 0 && (
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Floor Area
                </label>
                <select
                  value={editAreaId || areas[0]?.id}
                  onChange={e => setEditAreaId(e.target.value)}
                  className="w-full h-9 bg-[#181D28] border border-[#2B354D] rounded-xl px-2.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                >
                  {areas.map(a => (
                    <option key={a.id} value={a.id} className="bg-[#181D28] text-white">
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Shape */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Shape
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['square', 'round', 'rectangle'] as TableShape[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditShape(s)}
                    className={`py-1 rounded-lg text-xs font-bold capitalize transition border ${
                      editShape === s
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                        : 'bg-[#181D28] text-slate-400 border-[#2B354D]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* CREATE ACTIONS */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCreateAndOpenTable}
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? 'Creating...' : `Create & Start Order for Table ${tableInput.trim()}`}</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveTableToFloor}
                className="w-full h-10 bg-[#1C2230] hover:bg-[#252E40] text-slate-200 border border-[#2B354D] font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Table to Floor Only</span>
              </button>
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {!matchedTable && !tableInput.trim() && (
          <div className="bg-[#10141E] rounded-2xl p-4 border border-[#262D3D] text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center text-lg">
              👆
            </div>
            <h4 className="text-xs font-black text-white">Select or Enter Table</h4>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Tap any table on the Floor Map on the left to view, edit, or open. Or punch a table number above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
