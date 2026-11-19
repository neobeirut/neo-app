import type { FlowPosOrder } from '../orders/orderAdapter';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRestaurantTheme } from '../theme/useRestaurantTheme';
import { type PosTable, type FloorArea, type TableShape, formatElapsedDuration } from './types';
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
  RotateCcw,
  Lock
} from 'lucide-react';

interface TableKeypadPanelProps {
  tables: PosTable[];
  orders?: FlowPosOrder[];
  areas: FloorArea[];
  activeAreaId: string | null;
  branchId: string;
  restaurantId: string;
  externalBranchId: string;
  cashierName: string;
  canOpenNewTables?: boolean;
  selectedTable: PosTable | null;
  initialTableCode?: string | null;
  onSelectTable: (table: PosTable | null) => void;
  onTableStateChange: () => Promise<void>;
  onOpenOrderInCart?: (
    orderId: number | null,
    tableCode: string,
    sessionId?: string,
    guestCount?: number,
    waiterName?: string,
    tableId?: string,
    isNewlyCreated?: boolean
  ) => void;
  onPrintPreCheckDoc?: (table: PosTable) => void;
  onFireOrder?: (order: FlowPosOrder) => Promise<void>;
  getFireState?: (order: FlowPosOrder) => { holds: number; fired: number; busy: boolean; canFire: boolean };
  isTableAdmin?: boolean;
  isShiftOpen?: boolean;
  onOpenShift?: () => void;
}

export const TableKeypadPanel: React.FC<TableKeypadPanelProps> = ({
  tables,
  orders = [],
  areas,
  activeAreaId,
  branchId,
  restaurantId,
  externalBranchId,
  cashierName,
  canOpenNewTables = true,
  selectedTable,
  initialTableCode,
  onSelectTable,
  onTableStateChange,
  onOpenOrderInCart,
  onPrintPreCheckDoc,
  onFireOrder,
  getFireState,
  isTableAdmin,
  isShiftOpen = true,
  onOpenShift
}) => {
  const { primaryColor, primaryText } = useRestaurantTheme();
  // Keypad input string (e.g. "4", "12")
  const [tableInput, setTableInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'action' | 'edit'>('action');
  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [seatInput, setSeatInput] = useState<string>('');  // typed seat count (same logic as tableInput)
  const [waiterName, setWaiterName] = useState<string>(cashierName);

  // Edit Table button & configuration is strictly for Admins (NOT managers, cashiers, or regular users)
  const isAllowedToEditTable = useMemo(() => {
    if (typeof isTableAdmin === 'boolean') return isTableAdmin;
    try {
      const stored = JSON.parse(localStorage.getItem('pos_current_cashier') || '{}');
      const r = (stored.role || '').toLowerCase();
      if (r === 'manager') return false;
      return r === 'admin' || r === 'superadmin';
    } catch {
      return false;
    }
  }, [isTableAdmin]);

  // Ensure non-admins are never in edit tab
  useEffect(() => {
    if (!isAllowedToEditTable && activeTab === 'edit') {
      setActiveTab('action');
    }
  }, [isAllowedToEditTable, activeTab]);
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

  // Table confirmation state: when true, morphs keypad to seat selection (or direct occupied operations)
  const [isTableConfirmed, setIsTableConfirmed] = useState<boolean>(() => Boolean(selectedTable));
  const prevTableIdRef = useRef<string | null>(selectedTable?.id || null);
  const prevTableStatusRef = useRef<string | null>(selectedTable?.status || null);

  // Reset seatInput when leaving seat-selection mode

  // Auto-dismiss feedback message after 4s
  useEffect(() => {
    if (feedbackMessage) {
      const t = setTimeout(() => setFeedbackMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedbackMessage]);

  // Tracks whether the last selectedTable change was triggered by the keypad's own
  // debounce match (vs external floor-map click). Declared before the effects that use it.
  const isKeypadDrivenRef = useRef(false);

  // Sync when initialTableCode or selectedTable changes from outside
  useEffect(() => {
    if (selectedTable) {
      const isDifferentTable = selectedTable.id !== prevTableIdRef.current;
      const isDifferentStatus = selectedTable.status !== prevTableStatusRef.current;
      prevTableIdRef.current = selectedTable.id;
      prevTableStatusRef.current = selectedTable.status;

      // Was this change triggered by the keypad's own debounce? If so, DON'T auto-confirm —
      // the user may still be typing more digits (e.g. they typed "2" but want "20").
      const fromKeypad = isKeypadDrivenRef.current;
      isKeypadDrivenRef.current = false; // reset for next change

      if (isDifferentTable || isDifferentStatus) {
        const code = selectedTable.table_code.replace(/^T/i, '');
        setTableInput(code || selectedTable.table_code);
        if (selectedTable.status === 'occupied' || selectedTable.status === 'bill_requested' || selectedTable.status === 'open') {
          setGuestCount(selectedTable.guest_count || selectedTable.capacity || 1);
        } else if (isDifferentTable) {
          // Available table: Only reset guest count when changing to a DIFFERENT table!
          setGuestCount(null);
        }
        setEditTableCode(selectedTable.table_code);
        setEditDisplayName(selectedTable.display_name || `Table ${selectedTable.table_code}`);
        setEditCapacity(selectedTable.capacity || 4);
        setEditAreaId(selectedTable.floor_area_id || (areas[0]?.id || ''));
        setEditShape(selectedTable.shape || 'square');
        setIsTransferMode(false);
        setTransferTargetInput('');
        // Only auto-confirm when the change came from an external source (floor map click),
        // NOT when it came from the keypad's own match (user may still be typing).
        if (isDifferentTable && !fromKeypad) {
          setIsTableConfirmed(true);
        }
      }
    } else {
      prevTableIdRef.current = null;
      prevTableStatusRef.current = null;
      if (initialTableCode && !tableInput) {
        const clean = initialTableCode.replace(/^T/i, '');
        setTableInput(clean);
        setGuestCount(null);
      }
    }
  }, [selectedTable]);

  // Match input with existing table in branch
  // Debounced table input — used for matching so typing "20" doesn't instantly lock onto "T2"
  const [debouncedTableInput, setDebouncedTableInput] = useState<string>('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTableInput(tableInput), 400);
    return () => clearTimeout(timer);
  }, [tableInput]);

  const matchedTable = useMemo(() => {
    const inputToMatch = debouncedTableInput;
    if (!inputToMatch.trim()) return selectedTable || null;
    const clean = inputToMatch.trim().toUpperCase();
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
  }, [debouncedTableInput, tables, selectedTable]);

  // Table status booleans
  const isOccupied = matchedTable && (matchedTable.status === 'occupied' || matchedTable.status === 'bill_requested');
  const isOpenNoProduct = matchedTable && matchedTable.status === 'open';
  const isAvailable = matchedTable && matchedTable.status === 'available';
  const isNewTable = !matchedTable && Boolean(debouncedTableInput.trim());

  // Check if matched table is assigned to another user (creator lock)
  const isOwnedByOther = useMemo(() => {
    if (!matchedTable || !matchedTable.assigned_waiter) return false;
    const cleanWaiter = matchedTable.assigned_waiter.toLowerCase().trim();
    if (['cashier', 'staff', 'unassigned'].includes(cleanWaiter)) return false;
    const cleanCashier = (cashierName || '').toLowerCase().trim();
    if (isTableAdmin) return false;
    return cleanWaiter !== cleanCashier;
  }, [matchedTable, cashierName, isTableAdmin]);

  // In-place Seat Selection Mode: active when an available or new table is confirmed
  const isSelectingSeats = !isTransferMode && activeTab === 'action' && isTableConfirmed && (isAvailable || isNewTable);
  useEffect(() => { if (!isSelectingSeats) setSeatInput(''); }, [isSelectingSeats]);

  // Notify parent if matched table changes
  useEffect(() => {
    if (matchedTable && matchedTable.id !== selectedTable?.id) {
      isKeypadDrivenRef.current = true;
      onSelectTable(matchedTable);
    } else if (!matchedTable && !tableInput.trim() && selectedTable) {
      isKeypadDrivenRef.current = true;
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
        } else if (isSelectingSeats) {
          setSeatInput(prev => prev.length < 3 ? prev + e.key : prev);
        } else {
          setTableInput(prev => (prev.length < 8 ? prev + e.key : prev));
          setIsTableConfirmed(false);
        }
      } else if (e.key === 'Backspace') {
        if (isTransferMode) {
          setTransferTargetInput(prev => prev.slice(0, -1));
        } else if (isSelectingSeats) {
          setSeatInput(prev => prev.slice(0, -1));
        } else {
          setTableInput(prev => prev.slice(0, -1));
          setIsTableConfirmed(false);
        }
      } else if (e.key === 'Escape') {
        if (isTransferMode) {
          setIsTransferMode(false);
        } else if (isSelectingSeats) {
          setIsTableConfirmed(false);
        } else {
          handleClear();
        }
      } else if (e.key === 'Enter') {
        if (isTransferMode) {
          handleExecuteTransfer();
        } else if (isSelectingSeats) {
          const n = parseInt(seatInput, 10);
          if (n >= 1) {
            setGuestCount(n);
            setSeatInput('');
            if (isAvailable) handleOpenAvailableTable(n);
            else if (isNewTable) handleCreateAndOpenTable(n);
          } else if (guestCount) {
            if (isAvailable) handleOpenAvailableTable();
            else if (isNewTable) handleCreateAndOpenTable();
          }
        } else if (!isTableConfirmed && (matchedTable || tableInput.trim())) {
          setIsTableConfirmed(true);
        } else if (matchedTable) {
          if (matchedTable.status === 'open') {
            handleOpenOpenTable();
          } else {
            handleOpenOccupiedOrder();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTransferMode, tableInput, transferTargetInput, matchedTable, isSelectingSeats, seatInput, guestCount, isAvailable, isNewTable, isTableConfirmed]);

  // Keypad Handlers
  const handleDigit = (digit: string) => {
    if (isTransferMode) {
      if (transferTargetInput.length >= 8) return;
      setTransferTargetInput(prev => prev + digit);
    } else {
      if (tableInput.length >= 8) return;
      setTableInput(prev => prev + digit);
      setIsTableConfirmed(false);
      setGuestCount(null);
    }
  };

  const handleClear = () => {
    if (isTransferMode) {
      setTransferTargetInput('');
    } else {
      setTableInput('');
      setDebouncedTableInput('');
      setIsTableConfirmed(false);
      setGuestCount(null);
      onSelectTable(null);
      setActiveTab('action');
    }
  };

  const handleChangeTable = () => {
    setIsTableConfirmed(false);
    setGuestCount(null);
    setSeatInput('');
    setTableInput('');
    setDebouncedTableInput('');
    onSelectTable(null);
  };

  const handleCancelOperation = () => {
    handleClear();
    setSeatInput('');
    setFeedbackMessage(null);
  };

  // Seat keypad handlers (mirror of table keypad logic)
  const handleSeatDigit = (d: string) => { setSeatInput(prev => prev.length < 3 ? prev + d : prev); };
  const handleSeatClear = () => {
    if (!seatInput) {
      handleChangeTable();
    } else {
      setSeatInput('');
      setGuestCount(null);
    }
  };
  const handleSeatBackspace = () => { setSeatInput(prev => prev.slice(0, -1)); };
  const handleSeatConfirm = () => {
    const n = parseInt(seatInput, 10);
    if (n >= 1) {
      setGuestCount(n);
      setSeatInput('');
      // Open immediately — no need to press "Open Table" button
      if (isAvailable) handleOpenAvailableTable(n);
      else if (isNewTable) handleCreateAndOpenTable(n);
    }
  };

  const handleBackspace = () => {
    if (isTransferMode) {
      setTransferTargetInput(prev => prev.slice(0, -1));
    } else {
      setTableInput(prev => prev.slice(0, -1));
      setIsTableConfirmed(false);
      setGuestCount(null);
    }
  };

  // 1. Open Available Table & Start Order
  const handleOpenAvailableTable = async (countOverride?: number) => {
    if (!canOpenNewTables) { setFeedbackMessage({ type: 'error', text: 'Resolve the previous shift and open your shift before opening new tables.' }); return; }
    if (!matchedTable || isSubmitting) return;
    const count = countOverride ?? guestCount;
    if (!count) {
      setFeedbackMessage({ type: 'error', text: 'Select the Seats is required to open table.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await openTableSession({
        tableId: matchedTable.id,
        tableCode: matchedTable.table_code,
        branchId,
        restaurantId,
        externalBranchId,
        guestCount: count,
        waiterName: waiterName || cashierName,
        operatorName: cashierName
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to open table session');
      }

      // Refresh table state in background without blocking screen transition
      if (onTableStateChange) {
        onTableStateChange().catch(() => {});
      }

      if (onOpenOrderInCart) {
        onOpenOrderInCart(
          res.orderId || null,
          matchedTable.table_code,
          res.sessionId,
          count,
          waiterName || cashierName,
          matchedTable.id,
          false
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
    if (isOwnedByOther) {
      setFeedbackMessage({
        type: 'error',
        text: `🔒 Table ${matchedTable.table_code} belongs to ${matchedTable.assigned_waiter}. You can only edit tables you created.`
      });
      return;
    }
    onOpenOrderInCart(
      matchedTable.commerce_order_id || null,
      matchedTable.table_code,
      matchedTable.current_session_id || undefined,
      matchedTable.guest_count || undefined,
      matchedTable.assigned_waiter || undefined,
      matchedTable.id,
      false
    );
  };

  // 2b. Open / Add Products to Open Table (no products ordered yet)
  const handleOpenOpenTable = () => {
    if (!matchedTable || !onOpenOrderInCart) return;
    if (isOwnedByOther) {
      setFeedbackMessage({
        type: 'error',
        text: `🔒 Table ${matchedTable.table_code} belongs to ${matchedTable.assigned_waiter}. You can only edit tables you created.`
      });
      return;
    }
    onOpenOrderInCart(
      null,
      matchedTable.table_code,
      matchedTable.current_session_id || undefined,
      matchedTable.guest_count || undefined,
      matchedTable.assigned_waiter || undefined,
      matchedTable.id,
      false
    );
  };

  // 3. Create Table & Open Order (on-the-fly)
  const handleCreateAndOpenTable = async (countOverride?: number) => {
    if (!canOpenNewTables) { setFeedbackMessage({ type: 'error', text: 'Resolve the previous shift and open your shift before opening new tables.' }); return; }
    const raw = tableInput.trim();
    if (!raw || isSubmitting) return;
    const count = countOverride ?? guestCount;
    if (!count) {
      setFeedbackMessage({ type: 'error', text: 'Select the Seats is required to create and open table.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const targetAreaId = editAreaId || (areas.length > 0 ? areas[0].id : '');
      const res = await getOrCreateTableAndSession({
        tableCodeInput: raw,
        floorAreaId: targetAreaId,
        branchId,
        restaurantId,
        externalBranchId,
        guestCount: count,
        operatorName: cashierName,
        waiterName: waiterName || cashierName
      });

      if (!res.success || !res.table) {
        throw new Error(res.error || 'Failed to create and open table.');
      }

      // Refresh table state in background without blocking screen transition
      if (onTableStateChange) {
        onTableStateChange().catch(() => {});
      }

      if (onOpenOrderInCart) {
        onOpenOrderInCart(
          res.orderId || null,
          res.table.table_code,
          res.sessionId,
          res.guestCount,
          res.waiterName,
          res.table.id,
          res.isNewlyCreated
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
    if (isOwnedByOther) {
      setFeedbackMessage({
        type: 'error',
        text: `🔒 Cannot transfer Table ${matchedTable.table_code}: assigned to ${matchedTable.assigned_waiter}.`
      });
      return;
    }
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

  return (
    <div className="h-full flex flex-col bg-white text-[#242B28] select-none overflow-hidden">
      {/* PANEL HEADER */}
      <div className="p-3.5 bg-white border-b border-[#E0E3DF] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 shadow-sm border"
            style={{ backgroundColor: '#E9F4ED', color: primaryColor, borderColor: `${primaryColor}40` }}
          >
            🪑
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-[#242B28] tracking-wide truncate">
              {isTransferMode ? 'Transfer Table' : isSelectingSeats ? 'Choose Table Seats' : 'Table Keypad & Control'}
            </h3>
            <p className="text-[10px] text-[#5E6964] truncate">
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

      </div>

      {/* FEEDBACK TOAST BANNER */}
      {feedbackMessage && (
        <div className={`px-3 py-2 text-xs font-bold flex items-center gap-2 border-b flex-shrink-0 animate-fadeIn ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
          <span className="truncate">{feedbackMessage.text}</span>
        </div>
      )}

      {/* SHIFT CLOSED WARNING BANNER */}
      {!isShiftOpen && (
        <div className="px-3 py-2 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-1 flex-shrink-0 animate-pulse">
          <div className="flex items-center gap-1.5 text-xs font-black text-rose-800">
            <span>🔒</span>
            <span className="text-[11px] leading-tight">Shift Closed — Controls Disabled</span>
          </div>
          {onOpenShift && (
            <button
              type="button"
              onClick={onOpenShift}
              className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black transition active:scale-95 cursor-pointer whitespace-nowrap shadow"
            >
              Open Shift
            </button>
          )}
        </div>
      )}

      {/* SCROLLABLE WORKSPACE */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {/* CASE 1: SEAT SELECTION KEYBOARD (In-place morph when table number is selected) */}
        {isSelectingSeats ? (
          <div className="space-y-2.5 animate-fadeIn">
            {/* SEAT KEYBOARD HEADER */}
            <div className="bg-[#F5F6F4] rounded-2xl p-3 border border-[#E0E3DF] shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                  <div className="font-mono font-black text-xl text-[#242B28] flex items-center gap-1.5">
                    <span className="text-base" style={{ color: primaryColor }}>🪑</span>
                    <span>Table {matchedTable ? matchedTable.table_code.replace(/^T/i, '') : tableInput.trim()}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg border"
                    style={{ backgroundColor: '#E9F4ED', color: primaryColor, borderColor: `${primaryColor}40` }}
                  >
                    {isAvailable ? 'Available' : 'New Table'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleChangeTable}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-[#E0E3DF] text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Change Table Number"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                    <span>Change</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelOperation}
                    className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition active:scale-95 cursor-pointer flex items-center justify-center shadow-2xs"
                    title="Cancel Operation"
                  >
                    <X className="w-4 h-4 text-rose-600" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E0E3DF]">
                <div className="flex-1 font-mono font-black text-2xl tracking-wider text-[#242B28] flex items-center gap-1.5">
                  <span className="text-lg" style={{ color: primaryColor }}><Users className="w-4 h-4 inline" /></span>
                  <span>{seatInput ? seatInput : guestCount ? `${guestCount}` : <span className="text-slate-400 font-bold text-lg">—</span>}</span>
                  {(seatInput || guestCount) && <span className="text-[#5E6964] text-base font-semibold">{Number(seatInput || guestCount) === 1 ? ' seat' : ' seats'}</span>}
                </div>
                <div className="flex items-center gap-1">
                  {guestCount && !seatInput ? (
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-lg border"
                      style={{ backgroundColor: '#E9F4ED', color: primaryColor, borderColor: `${primaryColor}40` }}
                    >
                      ✓ {guestCount}
                    </span>
                  ) : !seatInput ? (
                    <span className="text-[11px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-300 animate-pulse">Required *</span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* 3x4 SEATS TOUCH KEYBOARD — same logic as table keypad */}
            <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-1.5">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button
                  key={d}
                  type="button"
                  disabled={!isShiftOpen}
                  onClick={() => handleSeatDigit(d)}
                  className={`w-[68px] h-[52px] rounded-xl font-black text-base border border-[#E0E3DF] transition-all flex items-center justify-center shadow-sm select-none ${
                    !isShiftOpen
                      ? "bg-[#F5F6F4] text-slate-400 opacity-40 cursor-not-allowed"
                      : "bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] cursor-pointer active:scale-95"
                  }`}
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                disabled={!isShiftOpen}
                onClick={handleSeatClear}
                className={`w-[68px] h-[52px] rounded-xl font-black text-xs border border-rose-200 transition-all flex items-center justify-center shadow-sm select-none uppercase ${
                  !isShiftOpen
                    ? "bg-rose-50 text-slate-400 opacity-40 cursor-not-allowed"
                    : "bg-rose-50 hover:bg-rose-100 active:bg-rose-600 active:text-white text-rose-600 cursor-pointer active:scale-95"
                }`}
              >
                CLEAR
              </button>
              <button
                type="button"
                disabled={!isShiftOpen}
                onClick={() => handleSeatDigit('0')}
                className={`w-[68px] h-[52px] rounded-xl font-black text-base border border-[#E0E3DF] transition-all flex items-center justify-center shadow-sm select-none ${
                  !isShiftOpen
                    ? "bg-[#F5F6F4] text-slate-400 opacity-40 cursor-not-allowed"
                    : "bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] cursor-pointer active:scale-95"
                }`}
              >
                0
              </button>
              {seatInput.trim() ? (
                <button
                  type="button"
                  disabled={!isShiftOpen}
                  onClick={handleSeatConfirm}
                  style={isShiftOpen ? { backgroundColor: primaryColor, color: primaryText } : undefined}
                  className={`w-[68px] h-[52px] rounded-xl font-black text-sm border border-transparent transition-all flex items-center justify-center shadow-sm select-none ${
                    !isShiftOpen
                      ? "bg-slate-200 text-slate-400 opacity-40 cursor-not-allowed"
                      : "cursor-pointer active:scale-95 hover:opacity-90"
                  }`}
                >
                  OK
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isShiftOpen}
                  onClick={handleSeatBackspace}
                  className={`w-[68px] h-[52px] rounded-xl font-black text-base border border-[#E0E3DF] transition-all flex items-center justify-center shadow-sm select-none ${
                    !isShiftOpen
                      ? "bg-[#F5F6F4] text-slate-400 opacity-40 cursor-not-allowed"
                      : "bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] cursor-pointer active:scale-95"
                  }`}
                  title="Backspace"
                >
                  ⌫
                </button>
              )}
            </div>
            </div>

            {/* ACTION ROW: CHANGE TABLE NUMBER OR CANCEL OPERATION */}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#E0E3DF]">
              <button
                type="button"
                onClick={handleChangeTable}
                className="py-2.5 px-2 rounded-xl border border-[#E0E3DF] bg-white hover:bg-slate-100 text-[#242B28] font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
                title="Change Table Number"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Table #</span>
              </button>
              <button
                type="button"
                onClick={handleCancelOperation}
                className="py-2.5 px-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
                title="Cancel Operation and Return to Tables"
              >
                <X className="w-3.5 h-3.5 text-rose-600" />
                <span>Cancel</span>
              </button>
            </div>

          </div>
        ) : !isTransferMode && activeTab === 'action' && matchedTable && (isOccupied || isOpenNoProduct) && isTableConfirmed ? null : (
          /* CASE 2: TABLE NUMBER ENTRY KEYPAD */
          <>
            {/* TABLE CODE DISPLAY & STATUS BADGE */}
            <div className="bg-[#F5F6F4] rounded-2xl p-3 border border-[#E0E3DF] shadow-sm">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#5E6964] mb-1">
                <span>{isTransferMode ? 'Target Table #' : 'Active Table #'}</span>
                <span>
                  {isTransferMode ? (
                    matchedTransferTarget ? (
                      matchedTransferTarget.status === 'available' ? (
                        <span className="text-emerald-700 font-black">● Target Free</span>
                      ) : (
                        <span className="text-rose-600 font-black">● Target Busy</span>
                      )
                    ) : (
                      <span className="text-slate-400">Awaiting Target</span>
                    )
                  ) : isOccupied ? (
                    <span className="text-rose-600 font-black">● Occupied</span>
                  ) : isOpenNoProduct ? (
                    <span className="text-sky-700 font-black">● Open (No Order)</span>
                  ) : isAvailable ? (
                    <span className="text-emerald-700 font-black">● Available</span>
                  ) : isNewTable ? (
                    <span className="text-amber-700 font-black">✨ New Table</span>
                  ) : (
                    <span className="text-slate-400">Ready</span>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 font-mono font-black text-2xl tracking-wider text-[#242B28] truncate flex items-center gap-1.5">
                  <span className="text-lg" style={{ color: primaryColor }}>🪑</span>
                  <span>
                    {isTransferMode
                      ? (transferTargetInput ? transferTargetInput : '—')
                      : (tableInput ? tableInput : '—')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!isShiftOpen}
                    onClick={handleBackspace}
                    className={`w-10 h-9 rounded-xl font-bold text-sm transition shadow-sm border border-[#E0E3DF] flex items-center justify-center ${
                      !isShiftOpen
                        ? "bg-[#F5F6F4] text-slate-400 opacity-40 cursor-not-allowed"
                        : "bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] cursor-pointer active:scale-95"
                    }`}
                    title="Backspace"
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    disabled={!isShiftOpen}
                    onClick={handleClear}
                    className={`w-10 h-9 rounded-xl font-bold text-xs transition shadow-sm border border-[#E0E3DF] flex items-center justify-center ${
                      !isShiftOpen
                        ? "bg-[#F5F6F4] text-slate-400 opacity-40 cursor-not-allowed"
                        : "bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] cursor-pointer active:scale-95"
                    }`}
                    title="Clear"
                  >
                    C
                  </button>
                </div>
              </div>
            </div>



            {/* TOUCH NUMERIC KEYPAD */}
            <div className="flex justify-center">
            <div className="grid grid-cols-3 gap-1.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                <button
                  key={digit}
                  type="button"
                  disabled={!isShiftOpen}
                  onClick={() => handleDigit(digit)}
                  className={`w-[68px] h-[52px] rounded-xl font-black text-base border border-[#E0E3DF] transition-all flex items-center justify-center shadow-sm select-none ${
                    !isShiftOpen
                      ? "bg-[#F5F6F4] text-slate-400 opacity-40 cursor-not-allowed"
                      : "bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] cursor-pointer active:scale-95"
                  }`}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                disabled={!isShiftOpen}
                onClick={handleClear}
                className={`w-[68px] h-[52px] rounded-xl font-black text-xs border border-rose-200 transition-all flex items-center justify-center shadow-sm select-none uppercase ${
                  !isShiftOpen
                    ? "bg-rose-50 text-slate-400 opacity-40 cursor-not-allowed"
                    : "bg-rose-50 hover:bg-rose-100 active:bg-rose-600 active:text-white text-rose-600 cursor-pointer active:scale-95"
                }`}
              >
                CLEAR
              </button>
              <button
                type="button"
                disabled={!isShiftOpen}
                onClick={() => handleDigit('0')}
                className={`w-[68px] h-[52px] rounded-xl font-black text-base border border-[#E0E3DF] transition-all flex items-center justify-center shadow-sm select-none ${
                  !isShiftOpen
                    ? "bg-[#F5F6F4] text-slate-400 opacity-40 cursor-not-allowed"
                    : "bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] cursor-pointer active:scale-95"
                }`}
              >
                0
              </button>
              {tableInput.trim() && !isTransferMode ? (
                <button
                  type="button"
                  disabled={!isShiftOpen}
                  onClick={() => setIsTableConfirmed(true)}
                  style={isShiftOpen ? { backgroundColor: primaryColor, color: primaryText } : undefined}
                  className={`w-[68px] h-[52px] rounded-xl font-black text-sm border border-transparent transition-all flex flex-col items-center justify-center shadow-sm select-none ${
                    !isShiftOpen
                      ? "bg-slate-200 text-slate-400 opacity-40 cursor-not-allowed"
                      : "cursor-pointer active:scale-95 hover:opacity-90"
                  }`}
                  title="Confirm table"
                >
                  OK
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!isShiftOpen}
                  onClick={handleBackspace}
                  className={`w-[68px] h-[52px] rounded-xl font-black text-base border border-[#E0E3DF] transition-all flex items-center justify-center shadow-sm select-none ${
                    !isShiftOpen
                      ? "bg-[#F5F6F4] text-slate-400 opacity-40 cursor-not-allowed"
                      : "bg-[#F5F6F4] hover:bg-slate-200 text-[#242B28] cursor-pointer active:scale-95"
                  }`}
                  title="Backspace"
                >
                  ⌫
                </button>
              )}
            </div>
            </div>
          </>
        )}

        {/* SUB-MODE: TRANSFER TABLE */}
        {isTransferMode && matchedTable && (
          <div className="bg-[#F5F6F4] rounded-2xl p-3 border border-[#E0E3DF] space-y-3">
            <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              <span>Transfer Table {matchedTable.table_code}</span>
            </div>

            <p className="text-[11px] text-[#5E6964]">
              Punch destination table number on the keypad above.
            </p>

            {matchedTransferTarget ? (
              <div className={`p-2.5 rounded-xl border text-xs font-bold ${
                matchedTransferTarget.status === 'available'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                Destination: <strong>Table {matchedTransferTarget.table_code}</strong> ({matchedTransferTarget.status})
              </div>
            ) : transferTargetInput ? (
              <div className="p-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold">
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
                className="px-3 h-11 bg-white hover:bg-slate-100 text-[#242B28] border border-[#E0E3DF] font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: ACTIONS (OPEN TABLE WITHOUT PRODUCTS YET) */}
        {!isTransferMode && activeTab === 'action' && isOpenNoProduct && matchedTable && (
          <div className="bg-[#F5F6F4] rounded-2xl p-3.5 border border-[#E0E3DF] space-y-3 shadow-sm">
            {/* OPEN STATUS & INFO */}
            <div className="flex items-center justify-between border-b border-[#E0E3DF] pb-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
                  <span className="text-xs font-black text-[#242B28]">Table {matchedTable.table_code} is Open</span>
                </div>
                <div className="text-[10px] text-[#5E6964] mt-0.5">
                  Server: <strong className="text-[#242B28]">{matchedTable.assigned_waiter || cashierName}</strong>
                </div>
              </div>
              <div className="text-right">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg border"
                  style={{ backgroundColor: '#E9F4ED', color: primaryColor, borderColor: `${primaryColor}40` }}
                >
                  No Products Yet
                </span>
              </div>
            </div>

            {/* QUICK STATS PILLS */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-white border border-[#E0E3DF] flex items-center justify-between">
                <span className="text-[#5E6964] text-[10px]">Guests</span>
                <span className="font-black text-[#242B28]">{matchedTable.guest_count || 1}</span>
              </div>

              <div className="p-2 rounded-xl bg-white border border-[#E0E3DF] flex items-center justify-between">
                <span className="font-black text-sky-700 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-sky-600" />
                  {formatElapsedDuration(matchedTable.elapsed_minutes)}
                </span>
              </div>
            </div>

            {isOwnedByOther && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Assigned to {matchedTable.assigned_waiter}. Only creator can edit.</span>
              </div>
            )}

            {/* PRIMARY BUTTON: ADD PRODUCTS / START ORDER */}
            <button
              type="button"
              disabled={!isShiftOpen || isOwnedByOther}
              onClick={() => {
                if (!isShiftOpen) {
                  onOpenShift?.();
                  return;
                }
                handleOpenOpenTable();
              }}
              style={isShiftOpen && !isOwnedByOther ? { backgroundColor: primaryColor, color: primaryText } : undefined}
              className={`w-full h-10 font-black text-xs md:text-sm rounded-xl transition shadow flex items-center justify-center gap-2 ${
                !isShiftOpen || isOwnedByOther
                  ? "bg-slate-200 text-slate-500 opacity-60 cursor-not-allowed"
                  : "hover:opacity-90 active:scale-95 cursor-pointer"
              }`}
            >
              {isOwnedByOther ? (
                <>
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>🔒 Locked ({matchedTable.assigned_waiter})</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Add Products to Table {matchedTable.table_code}</span>
                </>
              )}
            </button>

            {/* SECONDARY ACTIONS: TRANSFER TABLE & CANCEL / CLEAR TABLE */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E0E3DF]">
              <button
                type="button"
                disabled={!isShiftOpen}
                onClick={() => {
                  if (!isShiftOpen) {
                    onOpenShift?.();
                    return;
                  }
                  setIsTransferMode(true);
                  setTransferTargetInput('');
                }}
                className={`h-9 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                  !isShiftOpen
                    ? "bg-[#F5F6F4] text-slate-400 border-[#E0E3DF] opacity-40 cursor-not-allowed"
                    : "bg-white hover:bg-slate-100 active:scale-95 text-[#242B28] border-[#E0E3DF] cursor-pointer"
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-sky-600" />
                <span>Transfer</span>
              </button>

              <button
                type="button"
                disabled={!isShiftOpen}
                onClick={() => {
                  if (!isShiftOpen) {
                    onOpenShift?.();
                    return;
                  }
                  handleCloseSession();
                }}
                className={`h-9 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                  !isShiftOpen
                    ? "bg-rose-50 text-slate-400 border-rose-200 opacity-40 cursor-not-allowed"
                    : "bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 border-rose-200 cursor-pointer"
                }`}
                title="Cancel table if guests left without ordering"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear Table</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: ACTIONS (OCCUPIED TABLE) */}
        {!isTransferMode && activeTab === 'action' && isOccupied && matchedTable && (() => {
          const occOrder = orders.find(order => String(order.id) === String(matchedTable.commerce_order_id));
          const fireState = occOrder ? getFireState?.(occOrder) : undefined;
          return (
          <div className="bg-[#F5F6F4] rounded-2xl p-2.5 border border-[#E0E3DF] space-y-2 shadow-sm">
            {/* OCCUPIED STATUS & FINANCIALS */}
            <div className="flex items-center justify-between border-b border-[#E0E3DF] pb-1.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xl font-black text-[#242B28]">Table {matchedTable.table_code.replace(/^T/i, '')}</span>
                </div>
                <div className="text-[10px] text-[#5E6964]">
                  Server: <strong className="text-[#242B28]">{matchedTable.assigned_waiter || cashierName}</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-base font-black text-[#242B28]" style={{ color: primaryColor }}>
                    ${(matchedTable.current_bill || 0).toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelOperation}
                  className="p-1 rounded-lg bg-white hover:bg-slate-200 text-slate-500 border border-[#E0E3DF] transition active:scale-95 cursor-pointer ml-1"
                  title="Deselect Table / Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* QUICK STATS: read-only guests + elapsed */}
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="py-1 px-2 rounded-xl bg-white border border-[#E0E3DF] flex items-center justify-between">
                <span className="text-[#5E6964] text-[10px]">Guests</span>
                <span className="font-black text-[#242B28]">{matchedTable.guest_count || 1}</span>
              </div>

              <div className="py-1 px-2 rounded-xl bg-white border border-[#E0E3DF] flex items-center justify-between">
                <span className="font-black text-amber-700 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-600" />
                  {formatElapsedDuration(matchedTable.elapsed_minutes)}
                </span>
              </div>
            </div>

            {/* SECONDARY ACTION BUTTONS: Transfer + Print Bill */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={!isShiftOpen}
                onClick={() => {
                  if (!isShiftOpen) {
                    onOpenShift?.();
                    return;
                  }
                  setIsTransferMode(true);
                  setTransferTargetInput('');
                }}
                className={`h-9 rounded-xl border font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 ${
                  !isShiftOpen
                    ? "bg-[#F5F6F4] text-slate-400 border-[#E0E3DF] opacity-40 cursor-not-allowed"
                    : "bg-white hover:bg-slate-100 text-[#242B28] border-[#E0E3DF] cursor-pointer"
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                <span>Transfer Table</span>
              </button>

              <button
                type="button"
                disabled={!isShiftOpen}
                onClick={() => {
                  if (!isShiftOpen) {
                    onOpenShift?.();
                    return;
                  }
                  if (onPrintPreCheckDoc) onPrintPreCheckDoc(matchedTable);
                }}
                className={`h-9 rounded-xl border font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 ${
                  !isShiftOpen
                    ? "bg-[#F5F6F4] text-slate-400 border-[#E0E3DF] opacity-40 cursor-not-allowed"
                    : "bg-white hover:bg-slate-100 text-[#242B28] border-[#E0E3DF] cursor-pointer"
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-amber-600" />
                <span>Print Bill</span>
              </button>
            </div>

            {/* FIRE BUTTON — only when unfired holds exist */}
            {(
              <button
                type="button"
                disabled={!occOrder || !fireState?.canFire || !onFireOrder || !isShiftOpen}
                onClick={() => {
                  if (!isShiftOpen) {
                    onOpenShift?.();
                    return;
                  }
                  if (occOrder) onFireOrder?.(occOrder);
                }}
                className="w-full h-9 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <span>{fireState?.busy ? 'Firing…' : !fireState?.holds ? 'Fire — No held courses' : fireState.fired >= fireState.holds ? '✓ Fired' : `🔥 Fire — ${fireState.holds - fireState.fired} held`}</span>
              </button>
            )}

            {isOwnedByOther && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Assigned to {matchedTable.assigned_waiter}. Only creator can edit.</span>
              </div>
            )}

            {/* PRIMARY BUTTON at bottom: OPEN / EDIT ORDER IN POS */}
            <button
              type="button"
              disabled={!isShiftOpen || isOwnedByOther}
              onClick={() => {
                if (!isShiftOpen) {
                  onOpenShift?.();
                  return;
                }
                handleOpenOccupiedOrder();
              }}
              style={isShiftOpen && !isOwnedByOther ? { backgroundColor: primaryColor, color: primaryText } : undefined}
              className={`w-full h-10 font-black text-xs sm:text-sm rounded-xl transition-all shadow flex items-center justify-center gap-2 ${
                !isShiftOpen || isOwnedByOther
                  ? "bg-slate-200 text-slate-500 opacity-60 cursor-not-allowed"
                  : "hover:opacity-90 active:scale-95 cursor-pointer"
              }`}
            >
              {isOwnedByOther ? (
                <>
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>🔒 Locked ({matchedTable.assigned_waiter})</span>
                </>
              ) : (
                <span>📝 Open / Edit Order in POS</span>
              )}
            </button>
            <button
              type="button"
              disabled={!isShiftOpen}
              onClick={() => {
                if (!isShiftOpen) {
                  onOpenShift?.();
                  return;
                }
                handleClear();
              }}
              className={`w-full h-9 rounded-xl text-[#242B28] font-black text-xs border border-[#E0E3DF] bg-white hover:bg-slate-100 transition active:scale-95 ${
                !isShiftOpen
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
            >
              Open New Table
            </button>
          </div>
          );
        })()}

        {/* TAB 2: EDIT TABLE CONFIGURATION (Admins Only) */}
        {!isTransferMode && isAllowedToEditTable && activeTab === 'edit' && matchedTable && (
          <div className="bg-[#F5F6F4] rounded-2xl p-3.5 border border-[#E0E3DF] space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E0E3DF] pb-2">
              <span className="text-xs font-black text-[#242B28]">Edit Table {matchedTable.table_code}</span>
              <button
                type="button"
                onClick={() => setActiveTab('action')}
                className="text-[11px] font-bold hover:underline"
                style={{ color: primaryColor }}
              >
                ← Back to Operations
              </button>
            </div>

            {/* Table Code */}
            <div>
              <label className="text-[10px] font-bold text-[#5E6964] uppercase tracking-wider block mb-1">
                Table Code / Label
              </label>
              <input
                type="text"
                value={editTableCode}
                onChange={e => setEditTableCode(e.target.value)}
                className="w-full h-9 bg-white border border-[#E0E3DF] rounded-xl px-3 text-xs font-bold text-[#242B28] focus:outline-none"
              />
            </div>

            {/* Display Name */}
            <div>
              <label className="text-[10px] font-bold text-[#5E6964] uppercase tracking-wider block mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={e => setEditDisplayName(e.target.value)}
                className="w-full h-9 bg-white border border-[#E0E3DF] rounded-xl px-3 text-xs font-bold text-[#242B28] focus:outline-none"
              />
            </div>

            {/* Capacity */}
            <div>
              <label className="text-[10px] font-bold text-[#5E6964] uppercase tracking-wider block mb-1">
                Seating Capacity: {editCapacity} seats
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditCapacity(prev => Math.max(1, prev - 1))}
                  className="w-10 h-8 rounded-lg bg-white border border-[#E0E3DF] text-[#242B28] font-bold"
                >
                  -
                </button>
                <div className="flex-1 h-8 bg-white rounded-lg border border-[#E0E3DF] flex items-center justify-center font-bold text-xs text-[#242B28]">
                  {editCapacity} Seats
                </div>
                <button
                  type="button"
                  onClick={() => setEditCapacity(prev => prev + 1)}
                  className="w-10 h-8 rounded-lg bg-white border border-[#E0E3DF] text-[#242B28] font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* Floor Area */}
            <div>
              <label className="text-[10px] font-bold text-[#5E6964] uppercase tracking-wider block mb-1">
                Floor Area
              </label>
              <select
                value={editAreaId}
                onChange={e => setEditAreaId(e.target.value)}
                className="w-full h-9 bg-white border border-[#E0E3DF] rounded-xl px-2.5 text-xs font-bold text-[#242B28] focus:outline-none"
              >
                {areas.map(a => (
                  <option key={a.id} value={a.id} className="bg-white text-[#242B28]">
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shape */}
            <div>
              <label className="text-[10px] font-bold text-[#5E6964] uppercase tracking-wider block mb-1">
                Shape
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['square', 'round', 'rectangle'] as TableShape[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditShape(s)}
                    style={editShape === s ? { backgroundColor: primaryColor, color: primaryText } : undefined}
                    className={`py-1 rounded-lg text-xs font-bold capitalize transition border ${
                      editShape === s
                        ? 'border-transparent font-black shadow-sm'
                        : 'bg-white text-[#242B28] border-[#E0E3DF]'
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
                style={{ backgroundColor: primaryColor, color: primaryText }}
                className="w-full h-10 hover:opacity-90 active:scale-95 font-black text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>

              {matchedTable.status === 'available' && (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleDeleteTable}
                  className="w-full py-1.5 text-rose-600 hover:text-rose-700 text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Table from Floor</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
