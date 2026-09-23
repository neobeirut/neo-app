import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { replenishmentApi, type ReplenishmentPlanningSummary, type ReplenishmentRecommendationItem } from '../api/replenishmentApi';
import {
  TrendingUp,
  Package,
  Calendar,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  ChevronRight,
  Filter,
  Search,
  ShoppingCart,
  Clock,
  Building,
  Check,
  X,
  Edit2,
  ArrowRight,
  ShieldAlert,
  Flame,
  FileText,
  AlertCircle
} from 'lucide-react';

interface Props {
  user: any;
  permissions?: any;
}

export default function ReplenishmentPlanningScreen({ user, permissions }: Props) {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [horizonDays, setHorizonDays] = useState<number>(14);
  const [summary, setSummary] = useState<ReplenishmentPlanningSummary | null>(null);
  const [items, setItems] = useState<ReplenishmentRecommendationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [converting, setConverting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit / Override modal state
  const [editingItem, setEditingItem] = useState<ReplenishmentRecommendationItem | null>(null);
  const [overrideQty, setOverrideQty] = useState<string>('');
  const [overrideNotes, setOverrideNotes] = useState<string>('');

  // Conversion modal
  const [showConvertModal, setShowConvertModal] = useState<boolean>(false);

  // Decision history modal
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  // Permissions check
  const isSuperOrAdmin = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    return role.includes('superadmin') || role.includes('admin') || role === 'owner';
  }, [user]);

  const canManagePurchasing = useMemo(() => {
    return isSuperOrAdmin || permissions?.can_manage_purchasing === true;
  }, [isSuperOrAdmin, permissions]);

  const canEditReplenishment = useMemo(() => {
    return canManagePurchasing || permissions?.can_manage_inventory === true || permissions?.can_edit_replenishment === true;
  }, [canManagePurchasing, permissions]);

  // Load branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.getBranches();
        if (res.success && res.data && res.data.length > 0) {
          setBranches(res.data);
          setSelectedBranchId(res.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      }
    };
    fetchBranches();
  }, []);

  // Load replenishment data when branch changes
  useEffect(() => {
    if (selectedBranchId) {
      loadData(selectedBranchId);
    }
  }, [selectedBranchId]);

  const loadData = async (branchId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const [sumRes, listRes] = await Promise.all([
        replenishmentApi.getSummary(branchId),
        replenishmentApi.getList(branchId)
      ]);

      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
      if (listRes.success && listRes.data) {
        setItems(listRes.data);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load replenishment data' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedBranchId) return;
    setGenerating(true);
    setMessage(null);
    try {
      const res = await replenishmentApi.generateRecommendations(selectedBranchId, horizonDays);
      if (res.success) {
        setMessage({ type: 'success', text: `Recommendations generated successfully (${res.data?.total_reorders_recommended || 0} reorders recommended).` });
        await loadData(selectedBranchId);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to generate recommendations' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error generating recommendations' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!editingItem) return;
    try {
      const qtyNum = overrideQty !== '' ? parseFloat(overrideQty) : undefined;
      const res = await replenishmentApi.overrideItem({
        itemRecId: editingItem.item_rec_id,
        action: 'MODIFIED',
        overrideQty: qtyNum,
        notes: overrideNotes
      });

      if (res.success) {
        setMessage({ type: 'success', text: 'Item override saved successfully.' });
        setEditingItem(null);
        await loadData(selectedBranchId);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to save override' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error saving override' });
    }
  };

  const handleQuickAction = async (item: ReplenishmentRecommendationItem, action: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await replenishmentApi.overrideItem({
        itemRecId: item.item_rec_id,
        action: action
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Item marked as ${action}.` });
        await loadData(selectedBranchId);
      } else {
        setMessage({ type: 'error', text: res.error || `Failed to set status to ${action}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error updating item' });
    }
  };

  const handleConvertToPOs = async () => {
    if (!summary?.batch_id) return;
    setConverting(true);
    try {
      const res = await replenishmentApi.convertToPurchaseOrders(summary.batch_id);
      if (res.success) {
        const poCount = res.data?.purchase_orders?.length || 0;
        setMessage({ type: 'success', text: `Successfully generated ${poCount} Purchase Orders from batch!` });
        setShowConvertModal(false);
        await loadData(selectedBranchId);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to convert to purchase orders' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error converting batch' });
    } finally {
      setConverting(false);
    }
  };

  const handleViewHistory = async () => {
    if (!summary?.batch_id) return;
    try {
      const res = await replenishmentApi.getDecisionHistory(summary.batch_id);
      if (res.success && res.data) {
        setHistoryRecords(res.data);
        setShowHistoryModal(true);
      }
    } catch (err: any) {
      console.error('Failed to load history:', err);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.department && item.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.supplier_name && item.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'REORDER') return item.action_status === 'REORDER_RECOMMENDED';
      if (statusFilter === 'BRIDGE') return item.action_status === 'BRIDGE_ORDER_RECOMMENDED';
      if (statusFilter === 'DO_NOT_REORDER') return item.action_status === 'DO_NOT_REORDER';
      if (statusFilter === 'PRODUCTION') return item.sourcing_type === 'PRODUCTION';
      if (statusFilter === 'CRITICAL') return item.risk_level === 'CRITICAL_STOCKOUT_IMMINENT' || item.risk_level === 'ALREADY_NEGATIVE';
      return true;
    });
  }, [items, searchQuery, statusFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-600" />
            Demand Forecasting & Smart Replenishment
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Time-phased predictive reordering, lead-time deficit analysis, and PO automation.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Select */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-300 rounded-lg shadow-sm">
            <Building className="w-4 h-4 text-gray-500" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="text-sm font-medium text-gray-700 bg-transparent focus:outline-none"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Horizon Selector */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-semibold">
            {[7, 14, 30].map(h => (
              <button
                key={h}
                onClick={() => setHorizonDays(h)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  horizonDays === h ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {h} Days
              </button>
            ))}
          </div>

          {/* Generate Button */}
          {canEditReplenishment && (
            <button
              onClick={handleGenerate}
              disabled={generating || loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Calculating...' : 'Run Forecast & Planning'}
            </button>
          )}

          {/* Decision History Audit Button */}
          {summary?.batch_id && (
            <button
              onClick={handleViewHistory}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium shadow-sm"
            >
              <FileText className="w-4 h-4 text-gray-500" />
              Audit Log
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center justify-between text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && summary.has_data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Critical Stockouts */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Imminent Stockouts</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{summary.imminent_stockouts_count || 0}</h3>
              <p className="text-xs text-gray-500 mt-1">Requires emergency ordering</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg text-red-600">
              <ShieldAlert className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Timing Gaps / Bridge Orders */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Timing Gaps / Bridge</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">{summary.timing_gaps_count || 0}</h3>
              <p className="text-xs text-gray-500 mt-1">Stockout before PO arrival</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Recommended Orders */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Reorders Suggested</p>
              <h3 className="text-2xl font-bold text-indigo-600 mt-1">{summary.total_reorders_recommended || 0}</h3>
              <p className="text-xs text-gray-500 mt-1">{summary.total_items_evaluated} items analyzed</p>
            </div>
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
              <ShoppingCart className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Estimated Procurement Cost */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Estimated Capital</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">${(summary.total_estimated_cost_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">{summary.status}</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Main Table Controls & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'ALL', label: 'All Items' },
              { id: 'CRITICAL', label: 'Critical / Negative' },
              { id: 'BRIDGE', label: 'Bridge Orders' },
              { id: 'REORDER', label: 'Standard Reorder' },
              { id: 'PRODUCTION', label: 'Production Prep' },
              { id: 'DO_NOT_REORDER', label: 'Do Not Buy' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search items or suppliers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {canManagePurchasing && summary?.batch_id && (
              <button
                onClick={() => setShowConvertModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Convert Approved to PO
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Item & Department</th>
                <th className="py-3 px-3">Usable / Inv Pos</th>
                <th className="py-3 px-3">Daily Demand</th>
                <th className="py-3 px-3">Risk Level</th>
                <th className="py-3 px-3">Action Status</th>
                <th className="py-3 px-3">Order Qty</th>
                <th className="py-3 px-3">Vendor & Unit Price</th>
                <th className="py-3 px-3">Suggested Order Date</th>
                <th className="py-3 px-3">Manager Action</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    No items found matching the selected filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isConverted = item.conversion_status === 'CONVERTED';
                  const isApproved = item.manager_action === 'APPROVED';
                  const isRejected = item.manager_action === 'REJECTED';

                  return (
                    <tr key={item.item_rec_id} className={`hover:bg-gray-50/75 transition-colors ${
                      item.risk_level === 'ALREADY_NEGATIVE' || item.risk_level === 'CRITICAL_STOCKOUT_IMMINENT'
                        ? 'bg-red-50/30'
                        : item.timing_gap_detected
                        ? 'bg-amber-50/30'
                        : ''
                    }`}>
                      {/* Item & Department */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{item.item_name}</div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                          <span>{item.department || 'General'}</span>
                          <span>•</span>
                          <span className="font-medium text-indigo-600">{item.sourcing_type}</span>
                        </div>
                      </td>

                      {/* Usable / Inv Pos */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-gray-900">{item.usable_stock} {item.base_unit}</div>
                        <div className="text-[10px] text-gray-500">Pos: {item.inventory_position}</div>
                      </td>

                      {/* Daily Demand */}
                      <td className="py-3 px-3 font-medium text-gray-700">
                        {item.daily_demand} {item.base_unit}/d
                        {item.days_on_hand !== null && (
                          <div className="text-[10px] text-gray-400">{item.days_on_hand} DOH</div>
                        )}
                      </td>

                      {/* Risk Level */}
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.risk_level === 'ALREADY_NEGATIVE' || item.risk_level === 'CRITICAL_STOCKOUT_IMMINENT'
                            ? 'bg-red-100 text-red-800'
                            : item.risk_level === 'URGENT_REORDER_REQUIRED'
                            ? 'bg-amber-100 text-amber-800'
                            : item.risk_level === 'REORDER_SOON'
                            ? 'bg-blue-100 text-blue-800'
                            : item.risk_level === 'OVERSTOCKED'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {item.risk_level.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Action Status */}
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.action_status === 'BRIDGE_ORDER_RECOMMENDED'
                            ? 'bg-amber-100 text-amber-900 font-semibold'
                            : item.action_status === 'REORDER_RECOMMENDED'
                            ? 'bg-indigo-100 text-indigo-800'
                            : item.action_status === 'PRODUCTION_RECOMMENDED'
                            ? 'bg-teal-100 text-teal-800'
                            : item.action_status === 'DO_NOT_REORDER'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-gray-50 text-gray-400'
                        }`}>
                          {item.action_status.replace(/_/g, ' ')}
                        </span>
                        {item.timing_gap_detected && (
                          <div className="text-[9px] text-amber-700 font-bold mt-0.5 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> Timing Gap ({item.bridge_deficit} {item.base_unit})
                          </div>
                        )}
                      </td>

                      {/* Order Qty */}
                      <td className="py-3 px-3 font-semibold text-gray-900">
                        {item.override_quantity !== null && item.override_quantity !== undefined ? (
                          <span className="text-indigo-600">{item.override_quantity} {item.base_unit} (Edited)</span>
                        ) : item.recommended_order_quantity > 0 ? (
                          <span>
                            {item.recommended_order_quantity} {item.base_unit}
                            {item.recommended_packs > 0 && item.purchase_unit && (
                              <span className="text-[10px] text-gray-500 block font-normal">
                                ({item.recommended_packs} {item.purchase_unit})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-normal">-</span>
                        )}
                      </td>

                      {/* Vendor & Unit Price */}
                      <td className="py-3 px-3">
                        {item.supplier_name ? (
                          <>
                            <div className="font-medium text-gray-800">{item.supplier_name}</div>
                            <div className="text-[10px] text-gray-500">${item.unit_cost_usd}/{item.base_unit}</div>
                          </>
                        ) : (
                          <span className="text-gray-400 text-[10px]">No vendor</span>
                        )}
                      </td>

                      {/* Suggested Order Date */}
                      <td className="py-3 px-3 text-gray-600 font-medium">
                        {item.suggested_order_date || '-'}
                      </td>

                      {/* Manager Action & Conversion Status */}
                      <td className="py-3 px-3">
                        {isConverted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> PO Created
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                            <Check className="w-3 h-3" /> Approved
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            <X className="w-3 h-3" /> Rejected
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium">Pending Review</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {!isConverted ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {canEditReplenishment && (
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setOverrideQty(item.override_quantity?.toString() || item.recommended_order_quantity.toString());
                                  setOverrideNotes('');
                                }}
                                title="Edit Quantity / Vendor"
                                className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-indigo-600"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canManagePurchasing && (
                              <>
                                <button
                                  onClick={() => handleQuickAction(item, 'APPROVED')}
                                  title="Approve Reorder"
                                  className="p-1 hover:bg-emerald-50 rounded text-gray-400 hover:text-emerald-600"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleQuickAction(item, 'REJECTED')}
                                  title="Reject Reorder"
                                  className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-600"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-mono">PO Linked</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Quantity Override Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base">Adjust Reorder: {editingItem.item_name}</h3>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Recommended Order Quantity ({editingItem.base_unit})</label>
                <input
                  type="number"
                  step="any"
                  value={overrideQty}
                  onChange={(e) => setOverrideQty(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Original formula recommendation: {editingItem.recommended_order_quantity} {editingItem.base_unit}
                </span>
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Reason / Notes for Override</label>
                <textarea
                  rows={2}
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="e.g. Expected catering surge or vendor MOQ adjustment..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
              >
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Purchase Orders Modal */}
      {showConvertModal && summary && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base">Convert Approved Items to Purchase Orders</h3>
              <button onClick={() => setShowConvertModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              The replenishment engine will consolidate all items marked <strong>APPROVED</strong> or <strong>MODIFIED</strong> into Phase 5 Purchase Orders grouped by designated supplier.
            </p>

            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Batch Number:</span>
                <span className="font-mono font-semibold text-gray-800">{summary.batch_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Approved Lines:</span>
                <span className="font-semibold text-gray-800">
                  {items.filter(i => (i.manager_action === 'APPROVED' || i.manager_action === 'MODIFIED') && i.conversion_status === 'PENDING').length} lines
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">PO Status:</span>
                <span className="font-semibold text-indigo-600">DRAFT (Pending Requisition Approval)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setShowConvertModal(false)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToPOs}
                disabled={converting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5"
              >
                {converting ? 'Converting...' : 'Generate Purchase Orders'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision History Audit Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base">Immutable Replenishment Decision History</h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y text-xs">
              {historyRecords.length === 0 ? (
                <div className="py-8 text-center text-gray-400">No manager override or conversion events recorded yet.</div>
              ) : (
                historyRecords.map(rec => (
                  <div key={rec.history_id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{rec.item_name}</span>
                      <span className="text-[10px] text-gray-400">{new Date(rec.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-[10px] font-semibold text-indigo-700">
                        {rec.action_type}
                      </span>
                      {rec.previous_quantity !== null && (
                        <span className="text-gray-500">
                          {rec.previous_quantity} &rarr; <span className="font-semibold text-gray-900">{rec.new_quantity}</span>
                        </span>
                      )}
                    </div>
                    {rec.notes && <p className="text-gray-600 italic mt-0.5">"{rec.notes}"</p>}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t text-right">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
