import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { FloorArea, PosTable, OrderCheck } from './types';
import { 
  loadFloorState, 
  openTableSession, 
  transferTable, 
  mergeTables, 
  changeGuestCount, 
  requestBill, 
  closeTableSession, 
  loadPendingTableSyncs, 
  retrySessionSync, 
  getOrCreateTableAndSession, 
  type PendingTableSync 
} from './tableService';
import { FloorPlan } from './FloorPlan';
import { FloorPlanEditor } from './FloorPlanEditor';
import { TableKeypadPanel } from './TableKeypadPanel';
import { SplitBillModal } from './SplitBillModal';
import { PaymentModal } from '../payments';
import { useOrders } from '../orders/useOrders';
import { isTableOrderOpen } from '../orders/orderStore';
import { OrderCard } from '../orders/OrderCard';
import type { FlowPosOrder } from '../orders/orderAdapter';
import { 
  RefreshCw, 
  MapPin, 
  LayoutGrid, 
  Map as MapIcon, 
  Sliders, 
  Users, 
  Receipt, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';

interface TablesScreenProps {
  branchId: string;
  branchName: string;
  restaurantId: string;
  externalBranchId?: string;
  cashierName: string;
  canOpenNewTables?: boolean;
  initialTableCode?: string | null;
  initialTables?: PosTable[];
  activeShift?: any;
  shiftCutoffTime?: string | null;
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
  onSettleTable?: (table: PosTable, order?: FlowPosOrder) => void;
  isTableAdmin?: boolean;
  getFireState?: (order: FlowPosOrder) => { holds: number; fired: number; busy: boolean; canFire: boolean };
  onFireOrder?: (order: FlowPosOrder) => Promise<void>;
  isShiftOpen?: boolean;
  onOpenShift?: () => void;
}

export const TablesScreen: React.FC<TablesScreenProps> = ({
  branchId,
  branchName,
  restaurantId,
  externalBranchId = '1',
  cashierName,
  canOpenNewTables = true,
  initialTableCode = null,
  initialTables = [],
  activeShift,
  shiftCutoffTime,
  onOpenOrderInCart,
  onPrintPreCheckDoc,
  onSettleTable,
  isTableAdmin, getFireState, onFireOrder,
  isShiftOpen,
  onOpenShift
}) => {
  const shiftOpen = typeof isShiftOpen === 'boolean' ? isShiftOpen : Boolean(activeShift);
  const [areas, setAreas] = useState<FloorArea[]>([]);
  const [tables, setTables] = useState<PosTable[]>(initialTables);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'canvas'>('canvas');
  const [mainTab, setMainTab] = useState<'open_tables' | 'floor_plan'>('open_tables');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(initialTables.length === 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Table Reconciliation State (Rule 11)
  const [pendingSyncs, setPendingSyncs] = useState<PendingTableSync[]>([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [retryingSessionId, setRetryingSessionId] = useState<string | null>(null);

  // Set of recently settled table codes & order IDs for 0ms instant optimistic dismissal
  const settledKeysRef = useRef<Set<string>>(new Set());
  const [settledKeys, setSettledKeys] = useState<Set<string>>(new Set());

  // Live query for orders to power the Open Tables view (identical to Orders Page Tables tab)
  const { orders, refreshOrders } = useOrders({
    restaurantId,
    branchId: externalBranchId,
    flowBranchId: branchId,
    branchName,
    activeShift,
    shiftCutoffTime
  });

  const fetchState = useCallback(async () => {
    setErrorMsg(null);
    try {
      const [res, syncs] = await Promise.all([
        loadFloorState(branchId),
        loadPendingTableSyncs(branchId).catch(() => [])
      ]);

      if (res.success) {
        setAreas(res.areas);
        const sanitized = res.tables.map(t => {
          const codeUpper = (t.table_code || '').toUpperCase();
          if (
            settledKeysRef.current.has(codeUpper) ||
            (t.commerce_order_id && settledKeysRef.current.has(`order-${t.commerce_order_id}`)) ||
            settledKeysRef.current.has(`table-${t.id}`)
          ) {
            return {
              ...t,
              status: 'available' as const,
              current_session_id: null,
              commerce_order_id: null,
              current_bill: 0,
              amount_paid: 0,
              amount_remaining: 0
            };
          }
          return t;
        });
        setTables(sanitized);
        if (!activeAreaId && res.areas.length > 0) {
          setActiveAreaId(res.areas[0].id);
        }
      } else {
        setErrorMsg(res.error || 'Failed to load floor layout');
      }

      setPendingSyncs((syncs as PendingTableSync[]) || []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load floor layout');
    } finally {
      setLoading(false);
    }
  }, [branchId, activeAreaId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 4000); // 4s live polling
    return () => clearInterval(interval);
  }, [fetchState]);

  // Listen to instant table settlement events across all POS components
  useEffect(() => {
    const handleTableSettled = (e: any) => {
      const { tableCode, tableId, orderId } = e.detail || {};
      const newKeys: string[] = [];
      if (tableCode) newKeys.push(String(tableCode).toUpperCase());
      if (orderId) newKeys.push(`order-${orderId}`);
      if (tableId) newKeys.push(`table-${tableId}`);

      if (newKeys.length > 0) {
        newKeys.forEach(k => settledKeysRef.current.add(k));
        setSettledKeys(new Set(settledKeysRef.current));

        // 0ms instant optimistic update: mark matching table as available
        setTables(prev => prev.map(t => {
          const codeUpper = (t.table_code || '').toUpperCase();
          if (
            (tableCode && codeUpper === String(tableCode).toUpperCase()) ||
            (tableId && t.id === tableId) ||
            (orderId && Number(t.commerce_order_id) === Number(orderId))
          ) {
            return {
              ...t,
              status: 'available',
              current_session_id: null,
              commerce_order_id: null,
              current_bill: 0,
              amount_paid: 0,
              amount_remaining: 0
            };
          }
          return t;
        }));
      }

      // Re-fetch backend state immediately without delay
      fetchState();
      refreshOrders();
    };

    window.addEventListener('flow:table_settled', handleTableSettled);
    return () => window.removeEventListener('flow:table_settled', handleTableSettled);
  }, [branchId, fetchState, refreshOrders]);

  const openTableOrders = useMemo(() => {
    return (orders || []).filter(isTableOrderOpen);
  }, [orders]);

  // Unified active open tables: combines table orders and any tables with active seated sessions
  // STRICT RULE: Empty tables (status === 'available') or settled tables must NEVER be included in Open Tables!
  const displayOpenTables = useMemo(() => {
    // Exclude any order that was recently settled or completed
    const list: FlowPosOrder[] = openTableOrders.filter(o => {
      if (!isTableOrderOpen(o)) return false;
      const codeUpper = (o.tableLabel || (o.customerName ? o.customerName.replace(/^Table\s*/i, '') : '')).toUpperCase();
      if (settledKeys.has(codeUpper) || settledKeys.has(`order-${o.id}`)) {
        return false;
      }
      return true;
    });

    const openTableCodes = new Set(
      list.map(o => (o.tableLabel || (o.customerName ? o.customerName.replace(/^Table\s*/i, '') : '')).toUpperCase())
    );

    tables.forEach(t => {
      // Empty or settled tables should not be displayed in Open Tables!
      if (t.status === 'available') return;

      const codeUpper = (t.table_code || '').toUpperCase();
      if (settledKeys.has(codeUpper) || (t.commerce_order_id && settledKeys.has(`order-${t.commerce_order_id}`)) || settledKeys.has(`table-${t.id}`)) {
        return;
      }

      if (!openTableCodes.has(codeUpper) && !list.some(o => Number(o.id) === Number(t.commerce_order_id))) {
        list.push({
          id: t.commerce_order_id ? String(t.commerce_order_id) : `table-${t.id}`,
          orderNumber: `Table ${t.table_code}`,
          displayId: t.commerce_order_id ? String(t.commerce_order_id) : String(t.id),
          channel: 'Tables' as const,
          rawChannel: 'Tables',
          orderType: 'dine_in' as const,
          statusGroup: (t.status === 'bill_requested' ? 'HELD' : 'CONFIRMED') as any,
          rawStatus: t.status,
          isTableOrder: true,
          tableLabel: t.table_code,
          customerName: `Table ${t.table_code}`,
          customerPhone: '',
          deliveryAddress: '',
          guestCount: t.guest_count || t.capacity || 2,
          waiterName: t.assigned_waiter || cashierName,
          isBillRequested: t.status === 'bill_requested',
          subtotalAmount: t.current_bill || 0,
          deliveryFee: 0,
          discountAmount: 0,
          totalAmount: t.current_bill || 0,
          paymentMethod: 'cash',
          paymentStatus: 'unpaid',
          amountPaid: t.amount_paid || 0,
          amountRefunded: 0,
          netPaid: t.amount_paid || 0,
          amountRemaining: t.amount_remaining || (t.current_bill || 0),
          specialInstructions: '',
          voidReason: null,
          createdAt: new Date(Date.now() - (t.elapsed_minutes || 0) * 60000),
          createdTimeFormatted: `${Math.max(0, t.elapsed_minutes || 0)}m ago`,
          elapsedMinutes: t.elapsed_minutes || 0,
          slaStatus: 'normal',
          cashier: t.assigned_waiter || cashierName,
          claimedBy: null,
          claimedTerminal: null,
          claimedAt: null,
          version: 1,
          clientOrderToken: null,
          items: [],
          rawOrder: {
            table_id: t.id,
            session_id: t.current_session_id,
            table_label: t.table_code,
            guest_count: t.guest_count
          }
        });
      }
    });

    return list;
  }, [openTableOrders, tables, cashierName, settledKeys]);

  const handleOpenOrderInCart = (order: FlowPosOrder) => {
    const isCancelled =
      order.statusGroup === 'CANCELLED' ||
      ['cancelled', 'canceled', 'voided'].includes(String(order.rawStatus || '').toLowerCase()) ||
      ['cancelled', 'canceled', 'voided'].includes(String(order.rawOrder?.status || '').toLowerCase());
    if (isCancelled) {
      alert("This table order is canceled and cannot be edited.");
      return;
    }
    const tableCode = order.tableLabel || (order.customerName ? order.customerName.replace(/^Table\s*/i, '') : '1');
    if (onOpenOrderInCart) {
      onOpenOrderInCart(
        Number(order.id),
        tableCode,
        order.rawOrder?.session_id || undefined,
        order.guestCount || 1,
        order.waiterName || cashierName,
        order.rawOrder?.table_id || undefined,
        false
      );
    }
  };

  const handlePrintBillForOrder = async (order: FlowPosOrder) => {
    if (!shiftOpen) {
      onOpenShift?.();
      return;
    }
    const tableCode = order.tableLabel || (order.customerName ? order.customerName.replace(/^Table\s*/i, '') : '1');
    const matched = tables.find(t => t.table_code === tableCode || t.commerce_order_id === Number(order.id));
    const tableObj: PosTable = matched || {
      id: String(order.rawOrder?.table_id || 'table-' + order.id),
      branch_id: branchId,
      floor_area_id: '',
      table_code: tableCode,
      display_name: `Table ${tableCode}`,
      capacity: order.guestCount || 2,
      position_x: 0,
      position_y: 0,
      width: 7,
      height: 7,
      shape: 'square',
      active: true,
      sort_order: 0,
      commerce_order_id: Number(order.id),
      current_session_id: order.rawOrder?.session_id || null,
      assigned_waiter: order.waiterName || cashierName,
      guest_count: order.guestCount || 1,
      status: 'bill_requested'
    };
    if (onPrintPreCheckDoc) {
      onPrintPreCheckDoc(tableObj);
    }
    refreshOrders();
    fetchState();
  };

  const handleSettleOrder = (order: FlowPosOrder) => {
    if (!shiftOpen) {
      onOpenShift?.();
      return;
    }
    const tableCode = order.tableLabel || (order.customerName ? order.customerName.replace(/^Table\s*/i, '') : '1');
    const matched = tables.find(t => t.table_code === tableCode || t.commerce_order_id === Number(order.id));
    const tableObj: PosTable = matched || {
      id: String(order.rawOrder?.table_id || 'table-' + order.id),
      branch_id: branchId,
      floor_area_id: '',
      table_code: tableCode,
      display_name: `Table ${tableCode}`,
      capacity: order.guestCount || 2,
      position_x: 0,
      position_y: 0,
      width: 7,
      height: 7,
      shape: 'square',
      active: true,
      sort_order: 0,
      commerce_order_id: Number(order.id),
      current_session_id: order.rawOrder?.session_id || null,
      assigned_waiter: order.waiterName || cashierName,
      guest_count: order.guestCount || 1,
      status: 'bill_requested'
    };
    if (onSettleTable) {
      onSettleTable(tableObj, order);
    } else {
      handleOpenOrderInCart(order);
    }
  };

  // Modals (Split & Payment)
  const [tableForSplit, setTableForSplit] = useState<PosTable | null>(null);
  const [activePaymentOrder, setActivePaymentOrder] = useState<any | null>(null);

  // Set initial selected table if provided
  useEffect(() => {
    if (initialTableCode && tables.length > 0) {
      const clean = initialTableCode.trim().toUpperCase();
      const match = tables.find(t => {
        const c = (t.table_code || '').toUpperCase();
        return c === clean || c === `T${clean}` || c.replace(/^T/, '') === clean;
      });
      if (match) setSelectedTableId(match.id);
    }
  }, [initialTableCode, tables]);

  // When a table is clicked on the Floor Map
  const handleTableClick = (table: PosTable) => {
    setSelectedTableId(table.id);
    if (!shiftOpen) return;
    if (table.status === 'occupied' || table.status === 'bill_requested' || table.status === 'open') {
      if (onOpenOrderInCart) {
        onOpenOrderInCart(
          table.commerce_order_id ? Number(table.commerce_order_id) : null,
          table.table_code,
          table.current_session_id || undefined,
          table.guest_count || 1,
          table.assigned_waiter || cashierName,
          table.id,
          false
        );
      }
    } else {
      // Available table: selecting it displays "Select the Seats" in TableKeypadPanel.
      // The user must explicitly Select the Seats before opening the table.
    }
  };

  const filteredTables = activeAreaId 
    ? tables.filter(t => t.floor_area_id === activeAreaId)
    : tables;

  // Operational metrics summary based on current view/area
  const activeMetricsTables = mainTab === 'floor_plan' && activeAreaId ? filteredTables : tables;
  const availableCount = activeMetricsTables.filter(t => t.status === 'available').length;
  const openCount = activeMetricsTables.filter(t => t.status === 'open').length;
  const occupiedCount = activeMetricsTables.filter(t => t.status === 'occupied' || t.status === 'bill_requested').length;
  const billCount = activeMetricsTables.filter(t => t.status === 'bill_requested').length;
  const totalGuests = activeMetricsTables.reduce((sum, t) => {
    if (t.status === 'available') return sum;
    const count = t.guest_count || t.capacity || 2;
    return sum + Number(count);
  }, 0);
  const totalDue = activeMetricsTables.reduce((sum, t) => {
    if (t.status === 'available') return sum;
    const bill = t.current_bill !== undefined && t.current_bill !== null ? t.current_bill : (t.amount_remaining || 0);
    return sum + Number(bill);
  }, 0);

  return (
    <div className="h-full flex flex-col bg-[#F5F6F4] text-slate-900 select-none overflow-hidden relative">
      {/* SHIFT CLOSED WARNING BANNER */}
      {!shiftOpen && (
        <div className="bg-rose-100 border-b border-rose-300 px-4 py-2 flex items-center justify-between z-30 flex-shrink-0 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <span className="text-xs font-black text-rose-800 tracking-wide uppercase">
              Shift is Closed — Table ordering, billing, and settlement are disabled until shift is opened.
            </span>
          </div>
          {onOpenShift && (
            <button
              type="button"
              onClick={onOpenShift}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shadow transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>🔑</span>
              <span>Open Shift</span>
            </button>
          )}
        </div>
      )}

      {/* Subheader Toolbar */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold">
            <MapPin className="w-4 h-4 text-amber-500" />
            <span>{branchName}</span>
          </div>

          {/* PRIMARY SWITCHER: OPEN TABLES vs FLOOR PLAN */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 ml-2">
            <button
              type="button"
              onClick={() => setMainTab('open_tables')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                mainTab === 'open_tables'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🪑</span>
              <span>Open Tables</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                mainTab === 'open_tables' ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-100 text-amber-800'
              }`}>
                {displayOpenTables.length}
              </span>
            </button>

            <button
              type="button"
              disabled={true}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 opacity-50 cursor-not-allowed flex items-center gap-1.5"
              title="Floor Plan is temporarily disabled"
            >
              <span>🗺️</span>
              <span>Floor Plan</span>
              <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-slate-200 text-slate-500 font-bold">Disabled</span>
            </button>
          </div>
        </div>

        {/* Operational Indicators & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Quick Metrics Pills */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] font-bold bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
            {openCount > 0 && (
              <>
                <span className="text-sky-700 font-black">{openCount} Open (No Order)</span>
                <span className="text-slate-300">•</span>
              </>
            )}
            <span className="text-rose-700 font-black">{occupiedCount} Seated</span>
            {billCount > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-amber-700 font-black animate-pulse">{billCount} Bill</span>
              </>
            )}
            <span className="text-slate-300">•</span>
            <span className="text-slate-700 font-semibold">{totalGuests} Guests</span>
            {totalDue > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-amber-700 font-black">${totalDue.toFixed(2)} Due</span>
              </>
            )}
          </div>

          {/* Manager Table Sync Reconciliation Alert (Rule 11) */}
          {pendingSyncs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              className="px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-black transition flex items-center gap-1.5 animate-pulse cursor-pointer shadow-xs"
              title="Review and reconcile out-of-sync table sessions"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{pendingSyncs.length} PENDING</span>
            </button>
          )}

          {/* Admin Floor Plan Editor Toggle */}
          {mainTab === 'floor_plan' && isTableAdmin && (
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 border border-slate-300 cursor-pointer shadow-xs"
              title="Design Floor Plan (Admin Only)"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-600" />
              <span>Edit Floor</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              fetchState();
              refreshOrders();
            }}
            disabled={loading}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 transition cursor-pointer shadow-xs"
            title="Refresh floor state and orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* DEDICATED PROMINENT FLOOR AREAS BAR (Displayed when in Floor Plan mode) */}
      {mainTab === 'floor_plan' && areas.length > 0 && (
        <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-black uppercase text-amber-700 mr-1 flex items-center gap-1.5 flex-shrink-0">
              <span className="text-sm">📍</span>
              <span>Floor Areas:</span>
            </span>
            {areas.map(area => {
              const areaTables = tables.filter(t => t.floor_area_id === area.id);
              const areaOccupied = areaTables.filter(t => t.status !== 'available').length;
              const isSelected = activeAreaId === area.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setActiveAreaId(area.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer flex-shrink-0 ${
                    isSelected
                      ? 'bg-pos-primary text-white shadow-xs ring-1 ring-pos-primary/30'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{area.name}</span>
                  {areaTables.length > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200'
                    }`}>
                      {areaOccupied > 0 ? `${areaOccupied}/${areaTables.length}` : `${areaTables.length} tables`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Canvas vs Grid toggle on the right side of the Areas bar */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex-shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-[11px]">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'canvas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="2D Floor Layout Canvas"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span className="text-[11px]">Layout</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN SPLIT: LEFT OPEN TABLES, RIGHT TABLE KEYPAD PANEL */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT COLUMN: OPEN TABLES (OR FLOOR PLAN IF EVER RE-ENABLED) */}
        <div className="flex-1 flex flex-col h-full bg-[#F5F6F4] overflow-y-auto p-2 sm:p-3 border-r border-slate-200">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {mainTab === 'floor_plan' ? (
            <FloorPlan
              tables={filteredTables}
              viewMode={viewMode}
              selectedTableId={selectedTableId}
              onTableClick={handleTableClick}
            />
          ) : (
            <div className="space-y-2.5 max-w-7xl mx-auto w-full flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900">🪑 Active Tables</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">{displayOpenTables.length} Open</span>
                </div>
                <button type="button" onClick={() => { refreshOrders(); fetchState(); }} className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 transition border border-slate-200 cursor-pointer shadow-xs" title="Refresh">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {displayOpenTables.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto my-auto">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl mb-3 shadow-xs">
                    🪑
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No Active Dining Tables</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    All tables are currently free. Use the panel on the right to enter a table number and seat guests.
                  </p>
                </div>
              ) : (
                <div className="grid gap-2.5" style={{gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))'}}>
                  {displayOpenTables.map(order => {
                    const tableCode = order.tableLabel || (order.customerName ? order.customerName.replace(/^Table\s*/i, '') : '1');
                    const matched = tables.find(t => t.table_code === tableCode || t.commerce_order_id === Number(order.id));
                    const fire = getFireState?.(order);
                    const isBillPrinted = order.isBillRequested || matched?.status === 'bill_requested';

                    return (
                      <div
                        key={order.id}
                        className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                          isBillPrinted
                            ? 'bg-sky-50/60 border-sky-300 ring-2 ring-sky-300/60'
                            : 'bg-white hover:border-slate-300 border-slate-200'
                        }`}
                      >
                        {/* Order Card matching Orders page */}
                        <div
                          className="p-2 flex-1 cursor-pointer"
                          onClick={() => {
                            if (matched) setSelectedTableId(matched.id);
                            if (!shiftOpen) {
                              onOpenShift?.();
                              return;
                            }
                            handleOpenOrderInCart(order);
                          }}
                        >
                          <OrderCard
                            order={order}
                            isSelected={selectedTableId === matched?.id}
                            variant="table"
                          />
                        </div>

                        {fire && fire.holds > 0 && fire.fired < fire.holds && (
                          <div className="px-2 py-1.5 flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50">
                            <span className="text-xs text-slate-600 font-medium" role="status">
                              {fire.holds - fire.fired} course{fire.holds - fire.fired !== 1 ? 's' : ''} held
                            </span>
                            <button
                              type="button"
                              disabled={!fire.canFire || !onFireOrder || !shiftOpen}
                              onClick={() => {
                                if (!shiftOpen) {
                                  onOpenShift?.();
                                  return;
                                }
                                onFireOrder?.(order);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition shadow-xs"
                            >
                              {fire.busy ? 'Firing…' : '🔥 Fire'}
                            </button>
                          </div>
                        )}
                        {/* Action Buttons Toolbar on Card: Print Bill & (Optional) Settle */}
                        <div className={`p-1.5 bg-slate-50 border-t border-slate-200 grid ${onSettleTable ? 'grid-cols-2' : 'grid-cols-1'} gap-1.5`}>
                          <button
                            type="button"
                            disabled={!shiftOpen}
                            onClick={() => {
                              if (!shiftOpen) {
                                onOpenShift?.();
                                return;
                              }
                              handlePrintBillForOrder(order);
                            }}
                            className={`py-1 rounded-lg font-black text-[10px] flex items-center justify-center gap-0.5 transition active:scale-95 ${
                              !shiftOpen
                                ? "bg-slate-100 text-slate-400 border border-slate-200 opacity-40 cursor-not-allowed"
                                : "bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 cursor-pointer shadow-xs"
                            }`}
                            title={!shiftOpen ? "Cannot bill while shift is closed" : "Print customer pre-check bill receipt"}
                          >
                            <span>🧾</span>
                            <span className="truncate">Bill</span>
                          </button>

                          {onSettleTable && (
                            <button
                              type="button"
                              disabled={!shiftOpen}
                              onClick={() => {
                                if (!shiftOpen) {
                                  onOpenShift?.();
                                  return;
                                }
                                handleSettleOrder(order);
                              }}
                              className={`py-1 rounded-lg font-black text-[10px] flex items-center justify-center gap-0.5 transition active:scale-95 ${
                                !shiftOpen
                                  ? "bg-slate-100 text-slate-400 border border-slate-200 opacity-40 cursor-not-allowed"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer shadow-xs"
                              }`}
                              title={!shiftOpen ? "Cannot settle while shift is closed" : "Collect payment and close table"}
                            >
                              <span>💳</span>
                              <span className="truncate">Settle</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: KEYPAD TO OPEN A TABLE */}
        <div className="w-[264px] flex flex-col h-full overflow-hidden bg-white border-l border-slate-200 flex-shrink-0">
          <TableKeypadPanel
            canOpenNewTables={canOpenNewTables && shiftOpen}
            isShiftOpen={shiftOpen}
            onOpenShift={onOpenShift}
            orders={displayOpenTables}
            tables={tables}
            areas={areas}
            activeAreaId={activeAreaId}
            branchId={branchId}
            restaurantId={restaurantId}
            externalBranchId={externalBranchId}
            cashierName={cashierName}
            selectedTable={tables.find(t => t.id === selectedTableId) || null}
            initialTableCode={initialTableCode}
            onSelectTable={(table) => {
              setSelectedTableId(table ? table.id : null);
            }}
            onTableStateChange={fetchState}
            onOpenOrderInCart={onOpenOrderInCart}
            onPrintPreCheckDoc={onPrintPreCheckDoc}
            isTableAdmin={isTableAdmin}
            onFireOrder={onFireOrder}
            getFireState={getFireState}
          />
        </div>
      </div>

      {/* Split Bill Modal (Only if cashier explicitly opens it) */}
      {tableForSplit && (
        <SplitBillModal
          isOpen={Boolean(tableForSplit)}
          table={tableForSplit}
          onClose={() => setTableForSplit(null)}
          onPayCheck={(chk) => {
            setActivePaymentOrder({
              id: chk.order_id,
              totalAmount: chk.total,
              checkId: chk.id,
              checkLabel: chk.label
            });
          }}
        />
      )}

      {/* Payment Modal */}
      {activePaymentOrder && (
        <PaymentModal
          isOpen={Boolean(activePaymentOrder)}
          orderId={activePaymentOrder.id}
          orderNumber={activePaymentOrder.checkLabel ? `${activePaymentOrder.id} (${activePaymentOrder.checkLabel})` : activePaymentOrder.id}
          orderTotal={activePaymentOrder.totalAmount}
          cashierName={cashierName}
          onClose={() => setActivePaymentOrder(null)}
          onPaymentComplete={async () => {
            setActivePaymentOrder(null);
            await fetchState();
          }}
        />
      )}

      {/* Manager Floor Plan Editor Overlay */}
      {isEditorOpen && (
        <FloorPlanEditor
          branchId={branchId}
          restaurantId={restaurantId}
          areas={areas}
          tables={tables}
          activeAreaId={activeAreaId}
          onSelectArea={(aId) => setActiveAreaId(aId)}
          onRefresh={fetchState}
          onClose={() => setIsEditorOpen(false)}
        />
      )}

      {/* Table Reconciliation Manager Modal (Rule 11) */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  Table Session Reconciliation Manager
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Active tables requiring synchronization between FLOW operations and OVRLOAD commerce.
                </p>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {pendingSyncs.length === 0 ? (
                <div className="text-center py-8 text-emerald-400 font-bold text-sm">
                  ✓ All table sessions are fully synchronized.
                </div>
              ) : (
                pendingSyncs.map((sync) => {
                  const isRetrying = retryingSessionId === sync.sessionId;
                  return (
                    <div
                      key={sync.sessionId}
                      className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-base">
                            Table {sync.tableCode}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold uppercase">
                            {sync.syncStatus}
                          </span>
                          <span className="text-xs text-slate-400">
                            ({sync.guestCount} guests)
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          Session: <code className="text-slate-300 font-mono text-[11px]">{sync.sessionId}</code>
                        </div>
                        {sync.commerceOrderId && (
                          <div className="text-xs text-slate-400">
                            Commerce Order: <span className="text-amber-300 font-bold">#{sync.commerceOrderId}</span>
                          </div>
                        )}
                        {sync.lastSyncError && (
                          <div className="text-xs text-rose-400 mt-1 font-mono">
                            Error: {sync.lastSyncError}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isRetrying}
                        onClick={async () => {
                          setRetryingSessionId(sync.sessionId);
                          await retrySessionSync(sync.sessionId);
                          await fetchState();
                          setRetryingSessionId(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isRetrying ? 'Retrying...' : '[ RETRY ]'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Auto-reconciliation runs on reconnect and floor load.
              </span>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
