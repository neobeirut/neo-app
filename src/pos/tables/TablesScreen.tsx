import React, { useState, useEffect } from 'react';
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
  type PendingTableSync
} from './tableService';
import { FloorPlan } from './FloorPlan';
import { FloorPlanEditor } from './FloorPlanEditor';
import { TableDetailsPanel } from './TableDetailsPanel';
import { OpenTableModal } from './OpenTableModal';
import { SplitBillModal } from './SplitBillModal';
import { PaymentModal } from '../payments';
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
  onOpenOrderInCart?: (
    orderId: number | null,
    tableCode: string,
    sessionId?: string,
    guestCount?: number,
    waiterName?: string
  ) => void;
  onPrintPreCheckDoc?: (table: PosTable) => void;
}

export const TablesScreen: React.FC<TablesScreenProps> = ({
  branchId,
  branchName,
  restaurantId,
  externalBranchId = '1',
  cashierName,
  onOpenOrderInCart,
  onPrintPreCheckDoc
}) => {
  const [areas, setAreas] = useState<FloorArea[]>([]);
  const [tables, setTables] = useState<PosTable[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'canvas'>('grid');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals & Panels
  const [selectedTableForOpen, setSelectedTableForOpen] = useState<PosTable | null>(null);
  const [activeTableForDetails, setActiveTableForDetails] = useState<PosTable | null>(null);
  const [tableForSplit, setTableForSplit] = useState<PosTable | null>(null);
  const [activePaymentOrder, setActivePaymentOrder] = useState<any | null>(null);

  // Table Reconciliation State (Rule 11)
  const [pendingSyncs, setPendingSyncs] = useState<PendingTableSync[]>([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [retryingSessionId, setRetryingSessionId] = useState<string | null>(null);

  const fetchState = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await loadFloorState(branchId);
    if (res.success) {
      setAreas(res.areas);
      setTables(res.tables);
      if (!activeAreaId && res.areas.length > 0) {
        setActiveAreaId(res.areas[0].id);
      }
    } else {
      setErrorMsg(res.error || 'Failed to load floor layout');
    }

    // Load out-of-sync table sessions
    try {
      const syncs = await loadPendingTableSyncs(branchId);
      setPendingSyncs(syncs);
    } catch {}

    setLoading(false);
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 8000); // 8s live polling for table statuses & balances
    return () => clearInterval(interval);
  }, [branchId]);

  const handleTableClick = (table: PosTable) => {
    if (table.status === 'available') {
      setSelectedTableForOpen(table);
    } else {
      setActiveTableForDetails(table);
    }
  };

  const handleOpenTableConfirm = async ({ guestCount, waiterName }: { guestCount: number; waiterName: string }) => {
    if (!selectedTableForOpen) return;
    const res = await openTableSession({
      tableId: selectedTableForOpen.id,
      tableCode: selectedTableForOpen.table_code,
      branchId,
      restaurantId,
      externalBranchId,
      guestCount,
      waiterName,
      operatorName: cashierName
    });

    if (!res.success) {
      throw new Error(res.error);
    }

    await fetchState();
    if (onOpenOrderInCart) {
      onOpenOrderInCart(
        res.orderId || null,
        selectedTableForOpen.table_code,
        res.sessionId,
        guestCount,
        waiterName
      );
    }
  };

  const handleCloseTable = async (table: PosTable) => {
    if (!table.current_session_id) return;
    const res = await closeTableSession(table.current_session_id, table.commerce_order_id);
    if (!res.success) {
      alert(res.error);
      return;
    }
    setActiveTableForDetails(null);
    await fetchState();
  };

  const filteredTables = activeAreaId 
    ? tables.filter(t => t.floor_area_id === activeAreaId)
    : tables;

  // Operational metrics summary
  const availableCount = tables.filter(t => t.status === 'available').length;
  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  const billCount = tables.filter(t => t.status === 'bill_requested').length;
  const totalGuests = tables.reduce((sum, t) => sum + (t.status !== 'available' ? (t.guest_count || 0) : 0), 0);
  const totalDue = tables.reduce((sum, t) => sum + (t.amount_remaining || 0), 0);

  return (
    <div className="h-full flex flex-col bg-[#0F1115] text-white select-none overflow-hidden relative">
      {/* Subheader Toolbar */}
      <div className="px-6 py-2.5 bg-[#181C24] border-b border-[#262D3D] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>{branchName}</span>
          </div>

          {/* Floor Area Tabs */}
          <div className="flex items-center gap-1.5 ml-4">
            {areas.map(area => (
              <button
                key={area.id}
                type="button"
                onClick={() => setActiveAreaId(area.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeAreaId === area.id
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                {area.name}
              </button>
            ))}
          </div>
        </div>

        {/* Operational Indicators & Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Metrics Pills */}
          <div className="hidden md:flex items-center gap-2 text-[11px] font-bold bg-[#10131A] px-2.5 py-1 rounded-xl border border-[#262D3D]">
            <span className="text-emerald-400 font-black">{availableCount} Free</span>
            <span className="text-slate-600">•</span>
            <span className="text-rose-400 font-black">{occupiedCount} Seated</span>
            {billCount > 0 && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400 font-black animate-pulse">{billCount} Bill</span>
              </>
            )}
            <span className="text-slate-600">•</span>
            <span className="text-slate-300 font-semibold">{totalGuests} Guests</span>
            {totalDue > 0 && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400 font-black">$${totalDue.toFixed(2)} Due</span>
              </>
            )}
          </div>

          {/* View Mode Switcher: Canvas vs Grid */}
          <div className="flex items-center bg-[#10131A] p-0.5 rounded-xl border border-[#262D3D]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'grid' ? 'bg-[#262D3D] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                viewMode === 'canvas' ? 'bg-[#262D3D] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="2D Floor Layout View"
            >
              <MapIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Manager Table Sync Reconciliation Alert (Rule 11) */}
          {pendingSyncs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSyncModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black transition flex items-center gap-1.5 animate-pulse"
              title="Review and reconcile out-of-sync table sessions"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>⚠️ {pendingSyncs.length} TABLE SYNCS PENDING</span>
            </button>
          )}

          {/* Manager Floor Plan Editor Toggle */}
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            title="Design Floor Plan (Manager)"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Edit Floor</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchState}
            disabled={loading}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh floor state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Floor Plan Canvas / Grid */}
      <div className="flex-1 overflow-y-auto">
        {errorMsg && (
          <div className="m-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm">
            {errorMsg}
          </div>
        )}

        <FloorPlan
          tables={filteredTables}
          viewMode={viewMode}
          onTableClick={handleTableClick}
        />
      </div>

      {/* Modals & Drawers */}
      <OpenTableModal
        isOpen={Boolean(selectedTableForOpen)}
        table={selectedTableForOpen}
        defaultWaiterName={cashierName}
        onClose={() => setSelectedTableForOpen(null)}
        onConfirm={handleOpenTableConfirm}
      />

      <TableDetailsPanel
        table={activeTableForDetails}
        isOpen={Boolean(activeTableForDetails)}
        onClose={() => setActiveTableForDetails(null)}
        onOpenInTicket={(t) => {
          if (onOpenOrderInCart) {
            onOpenOrderInCart(
              t.commerce_order_id || null,
              t.table_code,
              t.current_session_id || undefined,
              t.guest_count || undefined,
              t.assigned_waiter || undefined
            );
          }
          setActiveTableForDetails(null);
        }}
        onTransferTable={(t) => {
          const targetCode = prompt(`Move table ${t.table_code} to which table code? (e.g. T8)`);
          if (!targetCode) return;
          const dest = tables.find(tb => tb.table_code.toUpperCase() === targetCode.trim().toUpperCase() && tb.status === 'available');
          if (!dest) {
            alert(`Table "${targetCode}" not found or is currently occupied.`);
            return;
          }
          transferTable({
            sessionId: t.current_session_id!,
            commerceOrderId: t.commerce_order_id || null,
            fromTableId: t.id,
            toTableId: dest.id,
            toTableCode: dest.table_code,
            operatorName: cashierName
          }).then(res => {
            if (!res.success) alert(res.error);
            else {
              setActiveTableForDetails(null);
              fetchState();
            }
          });
        }}
        onMergeTable={(t) => {
          const secCode = prompt(`Merge which available table into ${t.table_code}? (e.g. T9)`);
          if (!secCode) return;
          const sec = tables.find(tb => tb.table_code.toUpperCase() === secCode.trim().toUpperCase() && tb.status === 'available');
          if (!sec) {
            alert(`Table "${secCode}" not found or is currently occupied.`);
            return;
          }
          mergeTables({
            sessionId: t.current_session_id!,
            commerceOrderId: t.commerce_order_id || null,
            primaryTableCode: t.table_code,
            secondaryTableId: sec.id,
            secondaryTableCode: sec.table_code,
            operatorName: cashierName
          }).then(res => {
            if (!res.success) alert(res.error);
            else {
              setActiveTableForDetails(null);
              fetchState();
            }
          });
        }}
        onChangeGuests={(t) => {
          const gStr = prompt('Enter new guest count:', String(t.guest_count || 1));
          if (!gStr) return;
          const g = parseInt(gStr, 10);
          if (isNaN(g) || g <= 0) return;
          changeGuestCount(t.current_session_id!, t.commerce_order_id || null, g).then(fetchState);
        }}
        onPrintPreCheck={(t) => {
          if (onPrintPreCheckDoc) onPrintPreCheckDoc(t);
        }}
        onSplitBill={(t) => {
          setTableForSplit(t);
        }}
        onTakePayment={(t) => {
          setActivePaymentOrder({
            id: t.commerce_order_id,
            totalAmount: t.current_bill || 0,
            tableCode: t.table_code
          });
        }}
        onCloseTable={handleCloseTable}
      />

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
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50"
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
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
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
