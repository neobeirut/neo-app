import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  CheckSquare,
  Square,
  Layers,
  MoveRight,
  X,
  AlertCircle,
  CheckCircle2,
  Table as TableIcon,
  ShieldAlert,
  Plus,
  Minus
} from 'lucide-react';
import {
  executeTransferEntireTable,
  executeTransferSelectedItems,
  type TransferItemSelection
} from '../services/tableTransferService';
import {
  hasPosPermission,
  type PosPermissionKey
} from '../services/posPermissionService';
import type { PosTable } from '../tables/types';
import type { SupervisorAuthRequest } from './PosSupervisorAuthModal';

interface TableTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTableCode: string;
  sourceOrderId?: string | number | null;
  sourceSessionId?: string | null;
  conceptId?: string | null;
  ticketItems: any[];
  availableTables: PosTable[];
  restaurantId: string;
  branchId: string;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
  onSuccess: (result: {
    mode: 'entire' | 'items';
    destTableCode: string;
    destOrderId?: string | number;
    remainingItems?: any[];
  }) => void;
  onRequestSupervisorAuth: (request: SupervisorAuthRequest) => void;
}

export function TableTransferModal({
  isOpen,
  onClose,
  sourceTableCode,
  sourceOrderId,
  sourceSessionId,
  conceptId,
  ticketItems,
  availableTables,
  restaurantId,
  branchId,
  currentUser,
  onSuccess,
  onRequestSupervisorAuth
}: TableTransferModalProps) {
  // Transfer Mode: 'entire' (whole table) | 'items' (selected items)
  const [transferMode, setTransferMode] = useState<'entire' | 'items'>('entire');

  // Destination Table Input
  const [destTableInput, setDestTableInput] = useState('');
  const [selectedDestTable, setSelectedDestTable] = useState<PosTable | null>(null);

  // Items to transfer selection map: line_item_id -> transferQty
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, number>>({});

  // Loading & error state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Eligible transferrable items (exclude HOLD lines)
  const eligibleItems = useMemo(() => {
    return ticketItems.filter(item => !item.isHoldSeparator);
  }, [ticketItems]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setTransferMode('entire');
      setDestTableInput('');
      setSelectedDestTable(null);
      setErrorMsg('');
      setSubmitting(false);

      // Default: select all items with their full quantity
      const initialMap: Record<string, number> = {};
      eligibleItems.forEach(item => {
        initialMap[item.line_item_id] = item.qty || 1;
      });
      setSelectedItemsMap(initialMap);
    }
  }, [isOpen, eligibleItems]);

  if (!isOpen) return null;

  const currentCleanCode = sourceTableCode.replace(/^T/i, '');

  // Filter available destination tables (exclude current table)
  const selectableTables = availableTables.filter(t => {
    const codeClean = t.table_code.replace(/^T/i, '');
    return codeClean !== currentCleanCode;
  });

  // Handle selecting a destination table tile
  const handleSelectTableTile = (tbl: PosTable) => {
    setSelectedDestTable(tbl);
    setDestTableInput(tbl.table_code);
    setErrorMsg('');
  };

  // Toggle item selection in Items Mode
  const toggleItemSelect = (lineId: string, maxQty: number) => {
    setSelectedItemsMap(prev => {
      const next = { ...prev };
      if (next[lineId] && next[lineId] > 0) {
        delete next[lineId];
      } else {
        next[lineId] = maxQty;
      }
      return next;
    });
  };

  // Adjust transfer quantity for a line
  const adjustTransferQty = (lineId: string, maxQty: number, delta: number) => {
    setSelectedItemsMap(prev => {
      const current = prev[lineId] || 0;
      const nextQty = Math.max(0, Math.min(maxQty, current + delta));
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[lineId];
      } else {
        next[lineId] = nextQty;
      }
      return next;
    });
  };

  // Select all / Deselect all
  const selectAllItems = () => {
    const next: Record<string, number> = {};
    eligibleItems.forEach(item => {
      next[item.line_item_id] = item.qty || 1;
    });
    setSelectedItemsMap(next);
  };

  const deselectAllItems = () => {
    setSelectedItemsMap({});
  };

  const selectedCount = Object.keys(selectedItemsMap).length;
  const totalUnitsToTransfer = Object.values(selectedItemsMap).reduce((a, b) => a + b, 0);

  // Submit Handler
  const handleConfirmTransfer = async () => {
    const rawDest = (destTableInput || selectedDestTable?.table_code || '').trim().toUpperCase();
    if (!rawDest) {
      setErrorMsg('Please select or enter a destination table.');
      return;
    }

    const cleanDest = rawDest.replace(/^T/i, '');
    if (cleanDest === currentCleanCode) {
      setErrorMsg('Destination table cannot be the same as current table.');
      return;
    }

    const destTableCode = rawDest.startsWith('T') ? rawDest : `T${rawDest}`;

    if (transferMode === 'entire') {
      // Entire Table Transfer
      const canTransfer =
        hasPosPermission(currentUser, 'transfer_table') ||
        hasPosPermission(currentUser, 'move_table');

      const executeEntire = async (authorizer?: any) => {
        setSubmitting(true);
        setErrorMsg('');
        const res = await executeTransferEntireTable({
          fromTableCode: sourceTableCode,
          toTableCode: destTableCode,
          fromOrderId: sourceOrderId,
          fromSessionId: sourceSessionId,
          branchId,
          restaurantId,
          staffUser: currentUser,
          authorizer
        });
        setSubmitting(false);

        if (!res.success) {
          setErrorMsg(res.error || 'Failed to transfer table');
          return;
        }

        onSuccess({
          mode: 'entire',
          destTableCode: res.targetTableCode
        });
        onClose();
      };

      if (canTransfer) {
        await executeEntire();
      } else {
        onRequestSupervisorAuth({
          actionKey: 'transfer_table',
          actionTitle: `Transfer Table ${sourceTableCode} -> Table ${destTableCode}`,
          tableNumber: sourceTableCode,
          orderId: sourceOrderId,
          onAuthorized: async auth => {
            await executeEntire(auth);
          }
        });
      }
    } else {
      // Selected Items Transfer
      if (selectedCount === 0 || totalUnitsToTransfer === 0) {
        setErrorMsg('Please select at least one item to transfer.');
        return;
      }

      const itemsPayload: TransferItemSelection[] = [];
      eligibleItems.forEach(item => {
        const transferQty = selectedItemsMap[item.line_item_id] || 0;
        if (transferQty > 0) {
          itemsPayload.push({
            line_item_id: item.line_item_id,
            order_item_id: item.order_item_id,
            product_id: item.product_id,
            name: item.name,
            unit_price: item.unit_price,
            transferQty,
            remainingQty: Math.max(0, item.qty - transferQty),
            selectedCustomizations: item.selectedCustomizations || [],
            note: item.note || '',
            isOrdered: item.isOrdered,
            item_added_by: item.item_added_by,
            item_added_by_id: item.item_added_by_id
          });
        }
      });

      const canSplit =
        hasPosPermission(currentUser, 'split_table_check') ||
        hasPosPermission(currentUser, 'transfer_table');

      const executeItems = async (authorizer?: any) => {
        setSubmitting(true);
        setErrorMsg('');
        const res = await executeTransferSelectedItems({
          fromTableCode: sourceTableCode,
          toTableCode: destTableCode,
          fromOrderId: sourceOrderId,
          fromSessionId: sourceSessionId,
          conceptId,
          branchId,
          restaurantId,
          selectedItems: itemsPayload,
          allTicketItems: ticketItems,
          staffUser: currentUser,
          authorizer
        });
        setSubmitting(false);

        if (!res.success) {
          setErrorMsg(res.error || 'Failed to transfer items');
          return;
        }

        onSuccess({
          mode: 'items',
          destTableCode: res.destTableCode,
          destOrderId: res.destOrderId,
          remainingItems: res.remainingTicketItems
        });
        onClose();
      };

      if (canSplit) {
        await executeItems();
      } else {
        onRequestSupervisorAuth({
          actionKey: 'split_table_check',
          actionTitle: `Transfer ${totalUnitsToTransfer} Items from Table ${sourceTableCode} to Table ${destTableCode}`,
          tableNumber: sourceTableCode,
          orderId: sourceOrderId,
          onAuthorized: async auth => {
            await executeItems(auth);
          }
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-[#1e5c4f] flex items-center justify-center border border-emerald-200 shadow-xs">
              <MoveRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Table Transfer Manager</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Current Table:{' '}
                <strong className="text-emerald-800 font-bold">Table {sourceTableCode}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Transfer Mode Switcher: Entire Table vs Selected Items */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setTransferMode('entire');
                setErrorMsg('');
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                transferMode === 'entire'
                  ? 'bg-[#1e5c4f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Entire Table</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTransferMode('items');
                setErrorMsg('');
              }}
              className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                transferMode === 'items'
                  ? 'bg-[#1e5c4f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Selected Items</span>
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error notice */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Choose Destination Table */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Destination Table
            </label>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={destTableInput}
                onChange={e => {
                  setDestTableInput(e.target.value);
                  setSelectedDestTable(null);
                  setErrorMsg('');
                }}
                placeholder="Enter table (e.g. 5, T5)..."
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#1e5c4f] uppercase shadow-xs"
              />
            </div>

            {/* Quick Destination Table Pills */}
            <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              {selectableTables.slice(0, 16).map(tbl => {
                const isSelected =
                  selectedDestTable?.id === tbl.id ||
                  destTableInput.trim().toUpperCase() === tbl.table_code.toUpperCase() ||
                  `T${destTableInput.trim().toUpperCase()}` === tbl.table_code.toUpperCase();
                const isOccupied = tbl.status === 'occupied' || tbl.status === 'bill_requested';

                return (
                  <button
                    key={tbl.id}
                    type="button"
                    onClick={() => handleSelectTableTile(tbl)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1 border ${
                      isSelected
                        ? 'bg-[#1e5c4f] text-white border-[#1e5c4f] shadow-xs'
                        : isOccupied
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                    }`}
                  >
                    <span>{tbl.table_code}</span>
                    {isOccupied && <span className="text-[9px] opacity-75 font-medium">(active)</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Mode Details */}
          {transferMode === 'entire' ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 shadow-2xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1e5c4f]" />
                <span>Move All Active Orders</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Table <strong className="text-emerald-800">{sourceTableCode}</strong> and its current
                orders ({eligibleItems.length} items) will be reassigned to{' '}
                <strong className="text-slate-900">
                  Table {destTableInput ? destTableInput.toUpperCase() : '...'}
                </strong>
                . Table {sourceTableCode} will immediately become available.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Items to Move ({selectedCount} of {eligibleItems.length})
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllItems}
                    className="text-[11px] font-bold text-[#1e5c4f] hover:underline transition cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={deselectAllItems}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {eligibleItems.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl">
                    No items on this table
                  </div>
                ) : (
                  eligibleItems.map(item => {
                    const isChecked = Boolean(selectedItemsMap[item.line_item_id]);
                    const transferQty = selectedItemsMap[item.line_item_id] || 0;

                    return (
                      <div
                        key={item.line_item_id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                          isChecked
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                            : 'bg-white border-slate-200 opacity-70'
                        }`}
                      >
                        {/* Checkbox & Item Name */}
                        <div
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                          onClick={() => toggleItemSelect(item.line_item_id, item.qty)}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#1e5c4f] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-bold text-xs text-slate-900 mr-1.5">
                              {item.name}
                            </span>
                            {item.note && (
                              <span className="text-[10px] text-amber-800 italic font-medium">
                                ({item.note})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Stepper (if item has qty > 1) */}
                        {isChecked && (
                          <div className="flex items-center gap-1 shrink-0 bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs">
                            {item.qty > 1 && (
                              <button
                                type="button"
                                onClick={() => adjustTransferQty(item.line_item_id, item.qty, -1)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs active:scale-90 cursor-pointer"
                              >
                                -
                              </button>
                            )}
                            <span className="text-xs font-black text-[#1e5c4f] px-1.5 select-none">
                              {transferQty} of {item.qty}
                            </span>
                            {item.qty > 1 && (
                              <button
                                type="button"
                                onClick={() => adjustTransferQty(item.line_item_id, item.qty, 1)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs active:scale-90 cursor-pointer"
                              >
                                +
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition border border-slate-300 cursor-pointer shadow-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirmTransfer}
            className="px-5 py-2.5 rounded-xl bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs transition active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            {submitting ? (
              <span>Transferring...</span>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>
                  {transferMode === 'entire'
                    ? 'Transfer Table'
                    : `Transfer (${totalUnitsToTransfer} Items)`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
