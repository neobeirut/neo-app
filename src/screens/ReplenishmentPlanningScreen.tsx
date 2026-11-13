import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import {
  replenishmentApi,
  type ReplenishmentPlanningSummary,
  type ReplenishmentRecommendationItem,
  type ReplenishmentBatchSnapshot,
  type ProductionBomConsolidationPreview,
} from '../api/replenishmentApi';
import {
  replenishmentIntelligenceService,
  type ReplenishmentAiSummary,
} from '../services/replenishmentIntelligenceService';
import {
  TrendingUp,
  Package,
  Calendar,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  Filter,
  Search,
  ShoppingCart,
  Clock,
  Building,
  Check,
  X,
  Edit2,
  ShieldAlert,
  Flame,
  FileText,
  AlertCircle,
  Sparkles,
  ChefHat,
  Layers,
  History,
  UserCheck,
  Info,
} from 'lucide-react';

interface Props {
  user: any;
  permissions?: any;
}

export default function ReplenishmentPlanningScreen({ user, permissions }: Props) {
  const [branches, setBranches] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Phase 2 Report Generator Filters
  const [horizonDays, setHorizonDays] = useState<number>(14);
  const [lookbackDays, setLookbackDays] = useState<number>(30);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Report Snapshot State
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(undefined);
  const [batchesHistory, setBatchesHistory] = useState<ReplenishmentBatchSnapshot[]>([]);
  const [summary, setSummary] = useState<ReplenishmentPlanningSummary | null>(null);
  const [items, setItems] = useState<ReplenishmentRecommendationItem[]>([]);
  const [aiSummary, setAiSummary] = useState<ReplenishmentAiSummary | null>(null);

  // Loading & Action States
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [analyzingAi, setAnalyzingAi] = useState<boolean>(false);
  const [convertingPo, setConvertingPo] = useState<boolean>(false);
  const [convertingProd, setConvertingProd] = useState<boolean>(false);
  const [creatingShortagePo, setCreatingShortagePo] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Selection State (Phase 5, 6, 7)
  const [selectedRecIds, setSelectedRecIds] = useState<Set<string>>(new Set());

  // Edit / Override Modal State (Phase 7)
  const [editingItem, setEditingItem] = useState<ReplenishmentRecommendationItem | null>(null);
  const [overrideQty, setOverrideQty] = useState<string>('');
  const [overrideSupplierId, setOverrideSupplierId] = useState<string>('');
  const [overridePriority, setOverridePriority] = useState<'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'>('NORMAL');
  const [overrideAssignedUser, setOverrideAssignedUser] = useState<string>('');
  const [overrideRequiredDate, setOverrideRequiredDate] = useState<string>('');
  const [overrideNotes, setOverrideNotes] = useState<string>('');

  // Purchasing Integration Modal (Phase 5)
  const [showConvertPoModal, setShowConvertPoModal] = useState<boolean>(false);

  // Production Integration & BOM Consolidation Modal (Phase 6)
  const [showProductionModal, setShowProductionModal] = useState<boolean>(false);
  const [bomPreview, setBomPreview] = useState<ProductionBomConsolidationPreview | null>(null);
  const [loadingBomPreview, setLoadingBomPreview] = useState<boolean>(false);
  const [prodResponsibleName, setProdResponsibleName] = useState<string>(user?.name || 'Kitchen Lead');

  // Decision History Modal
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  // Permissions check
  const isSuperOrAdmin = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    return role.includes('superadmin') || role.includes('admin') || role === 'owner';
  }, [user]);

  const canManagePurchasing = useMemo(() => {
    return (
      isSuperOrAdmin ||
      permissions?.can_manage_purchasing === true ||
      permissions?.purchasing === true ||
      user?.admin_permissions?.purchasing === true
    );
  }, [isSuperOrAdmin, permissions, user]);

  const canEditReplenishment = useMemo(() => {
    return (
      canManagePurchasing ||
      permissions?.can_manage_inventory === true ||
      permissions?.can_edit_replenishment === true ||
      permissions?.inventory_reporting === true
    );
  }, [canManagePurchasing, permissions]);

  // Load branches & suppliers on mount
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [branchRes, suppRes, usersRes] = await Promise.all([
          api.getBranches(),
          api.getSuppliers ? api.getSuppliers() : Promise.resolve({ success: true, data: [] }),
          api.getUsers ? api.getUsers() : Promise.resolve({ success: true, data: [] }),
        ]);
        if (branchRes.success && branchRes.data && branchRes.data.length > 0) {
          setBranches(branchRes.data);
          setSelectedBranchId(branchRes.data[0].id);
        }
        if (suppRes.success && Array.isArray(suppRes.data)) {
          setSuppliers(suppRes.data);
        }
        if (usersRes.success && Array.isArray(usersRes.data)) {
          setStaffUsers(usersRes.data);
        }
      } catch (err) {
        console.error('Failed to load initial metadata:', err);
      }
    };
    fetchInitial();
  }, []);

  // Load replenishment data when branch or selected snapshot changes
  useEffect(() => {
    if (selectedBranchId) {
      loadData(selectedBranchId, selectedBatchId);
    }
  }, [selectedBranchId, selectedBatchId]);

  const loadData = async (branchId: string, batchId?: string) => {
    setLoading(true);
    try {
      const [sumRes, listRes, histRes] = await Promise.all([
        replenishmentApi.getSummary(branchId, batchId),
        replenishmentApi.getList(branchId, batchId),
        replenishmentApi.getBatchesHistory(branchId, 20),
      ]);

      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
        if (sumRes.data.ai_summary_insights) {
          setAiSummary(sumRes.data.ai_summary_insights);
        } else {
          setAiSummary(null);
        }
      }
      if (listRes.success && Array.isArray(listRes.data)) {
        setItems(listRes.data);
        // Auto-select pending actionable items
        const defaultSelected = new Set<string>();
        listRes.data.forEach((it) => {
          if (
            it.conversion_status === 'PENDING' &&
            it.manager_action !== 'REJECTED' &&
            ['REORDER_RECOMMENDED', 'BRIDGE_ORDER_RECOMMENDED', 'PRODUCTION_RECOMMENDED'].includes(it.action_status)
          ) {
            defaultSelected.add(it.item_rec_id);
          }
        });
        setSelectedRecIds(defaultSelected);
      }
      if (histRes.success && Array.isArray(histRes.data)) {
        setBatchesHistory(histRes.data);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load replenishment data' });
    } finally {
      setLoading(false);
    }
  };

  // Generate on-demand report snapshot + run AI Demand Intelligence
  const handleGenerate = async () => {
    if (!selectedBranchId) return;
    setGenerating(true);
    setMessage(null);
    try {
      const res = await replenishmentApi.generateRecommendations(selectedBranchId, horizonDays, {
        lookbackDays,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        department: departmentFilter !== 'ALL' ? departmentFilter : undefined,
        supplierId: supplierFilter || undefined,
        stockFilter: stockFilter !== 'ALL' ? stockFilter : undefined,
      });

      if (res.success && res.data?.batch_id) {
        const newBatchId = res.data.batch_id;
        setSelectedBatchId(newBatchId);

        // Fetch generated items and run AI Demand Intelligence layer
        const listRes = await replenishmentApi.getList(selectedBranchId, newBatchId);
        if (listRes.success && Array.isArray(listRes.data)) {
          const aiRes = await replenishmentIntelligenceService.analyzeAndPersistBatchInsights({
            batchId: newBatchId,
            items: listRes.data,
            horizonDays,
            lookbackDays,
          });
          setAiSummary(aiRes.summary);
        }

        await loadData(selectedBranchId, newBatchId);
        setMessage({
          type: 'success',
          text: `Report ${res.data.batch_number} generated (${res.data.total_reorders_recommended || 0} purchasing, ${res.data.total_production_recommended || 0} production recommendations).`,
        });
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to generate replenishment report' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error generating report' });
    } finally {
      setGenerating(false);
    }
  };

  const handleRunAiIntelligence = async () => {
    if (!summary?.batch_id || items.length === 0) return;
    setAnalyzingAi(true);
    try {
      const aiRes = await replenishmentIntelligenceService.analyzeAndPersistBatchInsights({
        batchId: summary.batch_id,
        items,
        horizonDays: summary.display_horizon_days || horizonDays,
        lookbackDays: summary.lookback_days || lookbackDays,
      });
      setAiSummary(aiRes.summary);
      await loadData(selectedBranchId, summary.batch_id);
      setMessage({ type: 'success', text: 'AI Demand Intelligence analysis updated.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to run AI Demand Intelligence' });
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Filtered items displayed in table
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter !== 'ALL' && item.item_category !== categoryFilter) return false;
      if (
        departmentFilter !== 'ALL' &&
        (item.normalized_department || item.department || '').toLowerCase() !== departmentFilter.toLowerCase()
      ) {
        return false;
      }
      if (supplierFilter) {
        const effSupp = item.override_supplier_id || item.recommended_supplier_id;
        if (effSupp !== supplierFilter) return false;
      }
      if (stockFilter === 'CRITICAL_STOCK') {
        const effPrio = item.override_priority || item.priority;
        if (effPrio !== 'CRITICAL' && !['ALREADY_NEGATIVE', 'CRITICAL_STOCKOUT_IMMINENT'].includes(item.risk_level)) {
          return false;
        }
      } else if (stockFilter === 'LOW_STOCK') {
        const effPrio = item.override_priority || item.priority;
        if (
          !['CRITICAL', 'HIGH'].includes(effPrio) &&
          !['REORDER_RECOMMENDED', 'BRIDGE_ORDER_RECOMMENDED', 'PRODUCTION_RECOMMENDED'].includes(item.action_status)
        ) {
          return false;
        }
      }
      if (statusFilter !== 'ALL' && item.action_status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !item.item_name?.toLowerCase().includes(q) &&
          !item.item_code?.toLowerCase().includes(q) &&
          !item.department?.toLowerCase().includes(q) &&
          !item.supplier_name?.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [items, categoryFilter, departmentFilter, supplierFilter, stockFilter, statusFilter, searchQuery]);

  // Selected Purchasing vs Production items (only PENDING conversion_status)
  const selectedPurchaseItems = useMemo(() => {
    return items.filter(
      (i) =>
        selectedRecIds.has(i.item_rec_id) &&
        i.conversion_status === 'PENDING' &&
        i.sourcing_type !== 'PRODUCTION' &&
        (i.override_quantity ?? i.recommended_order_quantity) > 0
    );
  }, [items, selectedRecIds]);

  const selectedProductionItems = useMemo(() => {
    return items.filter(
      (i) =>
        selectedRecIds.has(i.item_rec_id) &&
        i.conversion_status === 'PENDING' &&
        i.sourcing_type === 'PRODUCTION' &&
        (i.override_quantity ?? i.recommended_order_quantity) > 0
    );
  }, [items, selectedRecIds]);

  // Group selected purchase items by supplier for Phase 5 Purchasing Modal
  const purchaseGroupsBySupplier = useMemo(() => {
    const groups: Record<
      string,
      {
        supplierId: string;
        supplierName: string;
        items: ReplenishmentRecommendationItem[];
        totalCost: number;
      }
    > = {};

    selectedPurchaseItems.forEach((item) => {
      const suppId = item.override_supplier_id || item.recommended_supplier_id || 'UNASSIGNED';
      const suppName = item.supplier_name || 'Unassigned Supplier';
      if (!groups[suppId]) {
        groups[suppId] = { supplierId: suppId, supplierName: suppName, items: [], totalCost: 0 };
      }
      const qty = Number(item.override_quantity ?? item.recommended_order_quantity ?? 0);
      const packSize = Math.max(0.0001, Number(item.pack_size || 1));
      const packs = Math.ceil(qty / packSize);
      const roundedQty = packs * packSize;
      const cost = roundedQty * Number(item.unit_cost_usd || 0);
      groups[suppId].items.push(item);
      groups[suppId].totalCost += cost;
    });

    return Object.values(groups);
  }, [selectedPurchaseItems]);

  // Toggle selection helpers
  const toggleSelectItem = (itemRecId: string) => {
    setSelectedRecIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemRecId)) next.delete(itemRecId);
      else next.add(itemRecId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const selectable = filteredItems.filter((i) => i.conversion_status === 'PENDING');
    const allSelected = selectable.length > 0 && selectable.every((i) => selectedRecIds.has(i.item_rec_id));
    setSelectedRecIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        selectable.forEach((i) => next.delete(i.item_rec_id));
      } else {
        selectable.forEach((i) => next.add(i.item_rec_id));
      }
      return next;
    });
  };

  // Open Override Modal
  const openEditModal = (item: ReplenishmentRecommendationItem) => {
    setEditingItem(item);
    setOverrideQty(String(item.override_quantity ?? item.recommended_order_quantity ?? 0));
    setOverrideSupplierId(item.override_supplier_id || item.recommended_supplier_id || '');
    setOverridePriority((item.override_priority || item.priority || 'NORMAL') as any);
    setOverrideAssignedUser(item.assigned_to_user_name || user?.name || '');
    setOverrideRequiredDate(
      item.required_by_date || item.suggested_order_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    );
    setOverrideNotes(item.override_notes || '');
  };

  const handleSaveOverride = async () => {
    if (!editingItem) return;
    try {
      const qtyNum = overrideQty !== '' ? parseFloat(overrideQty) : undefined;
      const res = await replenishmentApi.overrideItem({
        itemRecId: editingItem.item_rec_id,
        action: 'MODIFIED',
        overrideQty: qtyNum,
        overrideSupplierId: overrideSupplierId || undefined,
        overridePriority,
        assignedToUserName: overrideAssignedUser || undefined,
        requiredByDate: overrideRequiredDate || undefined,
        notes: overrideNotes || undefined,
      });

      if (res.success) {
        setMessage({ type: 'success', text: `Saved override for ${editingItem.item_name}.` });
        setEditingItem(null);
        await loadData(selectedBranchId, summary?.batch_id);
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
        action,
      });
      if (res.success) {
        setMessage({ type: 'success', text: `${item.item_name} marked as ${action}.` });
        await loadData(selectedBranchId, summary?.batch_id);
      } else {
        setMessage({ type: 'error', text: res.error || `Failed to mark ${action}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error updating item' });
    }
  };

  // Phase 5: Convert selected items to Draft Purchase Orders
  const handleConvertToPOs = async () => {
    if (!summary?.batch_id) return;
    const eligibleIds = selectedPurchaseItems
      .filter((i) => i.override_supplier_id || i.recommended_supplier_id)
      .map((i) => i.item_rec_id);

    if (eligibleIds.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one raw-material or retail item with an assigned supplier.' });
      return;
    }

    setConvertingPo(true);
    try {
      const res = await replenishmentApi.convertToPurchaseOrders(summary.batch_id, undefined, eligibleIds);
      if (res.success) {
        const poCount = res.data?.purchase_orders?.length || 0;
        setMessage({
          type: 'success',
          text: `Created ${poCount} Draft Purchase Order(s) (${res.data?.lines_converted || 0} line items). Physical stock remains untouched until authorized receiving.`,
        });
        setShowConvertPoModal(false);
        await loadData(selectedBranchId, summary.batch_id);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to create draft purchase orders' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error creating draft purchase orders' });
    } finally {
      setConvertingPo(false);
    }
  };

  // Phase 6: Open Production Modal & Preview Multi-Level BOM Ingredient Availability
  const handleOpenProductionModal = async () => {
    if (selectedProductionItems.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one Preparation item to generate a Production List.' });
      return;
    }
    setShowProductionModal(true);
    setLoadingBomPreview(true);
    try {
      const payload = selectedProductionItems.map((it) => ({
        item_id: it.item_id,
        recipe_id: it.production_recipe_id || undefined,
        quantity: Number(it.override_quantity ?? it.recommended_order_quantity ?? 0),
      }));
      const res = await replenishmentApi.previewProductionBomConsolidation(selectedBranchId, payload);
      if (res.success && res.data) {
        setBomPreview(res.data);
      }
    } catch (err: any) {
      console.error('Failed to preview BOM consolidation:', err);
    } finally {
      setLoadingBomPreview(false);
    }
  };

  // Phase 6: Generate Draft Purchase Orders for Missing Raw Materials in Production Modal
  const handleCreateShortagePOs = async () => {
    if (!bomPreview) return;
    const shortages = bomPreview.consolidated_ingredients.filter(
      (ing) => ing.has_shortage && ing.recommended_supplier_id && ing.recommended_order_qty > 0
    );
    if (shortages.length === 0) {
      setMessage({
        type: 'error',
        text: 'No shortage items with an active supplier found for automatic Draft PO generation.',
      });
      return;
    }

    setCreatingShortagePo(true);
    try {
      const res = await replenishmentApi.createShortageDraftPurchaseOrders({
        branchId: selectedBranchId,
        batchId: summary?.batch_id,
        shortageItems: shortages.map((s) => ({
          item_id: s.item_id,
          supplier_id: s.recommended_supplier_id!,
          quantity: s.recommended_order_qty,
          pack_size: s.pack_size,
          purchase_unit: s.purchase_unit,
          unit_cost_usd: s.unit_cost_usd,
        })),
      });
      if (res.success) {
        const createdCount = res.data?.purchase_orders?.length || 0;
        setMessage({
          type: 'success',
          text: `Generated ${createdCount} Draft Purchase Order(s) for missing raw materials!`,
        });
        await loadData(selectedBranchId, summary?.batch_id);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to generate shortage Draft POs' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error creating shortage Draft POs' });
    } finally {
      setCreatingShortagePo(false);
    }
  };

  // Phase 6: Confirm & Create Draft Production Batches + Department Tasks
  const handleConvertToProductionBatches = async () => {
    if (!summary?.batch_id || selectedProductionItems.length === 0) return;
    setConvertingProd(true);
    try {
      const payloadItems = selectedProductionItems.map((it) => ({
        item_rec_id: it.item_rec_id,
        recipe_id: it.production_recipe_id || undefined,
        quantity: Number(it.override_quantity ?? it.recommended_order_quantity ?? 0),
        priority: it.override_priority || it.priority || 'NORMAL',
        required_by_date:
          it.required_by_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        suggested_production_date:
          it.suggested_production_date || new Date().toISOString().slice(0, 10),
        department: it.normalized_department || it.department || 'Kitchen',
        assigned_to_user_name: it.assigned_to_user_name || prodResponsibleName || user?.name || 'Kitchen Team',
      }));

      const res = await replenishmentApi.convertToProductionBatches({
        batchId: summary.batch_id,
        items: payloadItems,
        userId: user?.id,
        userName: user?.name || 'Admin',
      });

      if (res.success) {
        const count = res.data?.production_batches?.length || 0;
        setMessage({
          type: 'success',
          text: `Created ${count} Draft Production Batch(es) and assigned workstation Tasks. Stock movements will only post when batches are started/completed through the Production workflow.`,
        });
        setShowProductionModal(false);
        await loadData(selectedBranchId, summary.batch_id);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to create draft production batches' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error creating production batches' });
    } finally {
      setConvertingProd(false);
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
    } catch (err) {
      console.error('Failed to load decision history:', err);
    }
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <Flame className="w-3 h-3" /> Critical
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3" /> High
          </span>
        );
      case 'NORMAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Normal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            Low
          </span>
        );
    }
  };

  const getConfidenceBadge = (conf: string, activeDays: number) => {
    if (conf === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          High ({activeDays}d)
        </span>
      );
    }
    if (conf === 'MEDIUM') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          Medium ({activeDays}d)
        </span>
      );
    }
    return (
      <span
        title="Insufficient sales/consumption history; deterministic Par-Level fallback applied."
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200"
      >
        Low / Par Fallback ({activeDays}d)
      </span>
    );
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'PREPARATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
            <ChefHat className="w-3 h-3" /> Prep / Semi-Finished
          </span>
        );
      case 'RETAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
            <ShoppingCart className="w-3 h-3" /> Retail Product
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
            <Layers className="w-3 h-3" /> Raw Material
          </span>
        );
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header & Action Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-indigo-600" />
            Smart Replenishment &amp; AI Production Planning
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Unified FEFO stock, Par levels, POS sales velocity, multi-level BOM explosion, supplier lead times &amp; AI demand intelligence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Snapshot History Selector */}
          {batchesHistory.length > 0 && (
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              <History className="w-4 h-4 text-gray-500" />
              <select
                value={selectedBatchId || summary?.batch_id || ''}
                onChange={(e) => setSelectedBatchId(e.target.value || undefined)}
                className="bg-transparent text-xs font-medium text-gray-800 focus:outline-none"
                title="Switch between persisted report snapshots"
              >
                {batchesHistory.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    {b.batch_number} ({new Date(b.created_at).toLocaleDateString()} • {b.display_horizon_days}dH / {b.lookback_days}dL • {b.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Generate Report Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedBranchId}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Analyzing Inventory & BOMs...' : 'Generate Report'}
          </button>

          {/* AI Demand Analysis Button */}
          {summary?.has_data && (
            <button
              onClick={handleRunAiIntelligence}
              disabled={analyzingAi}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-sm font-medium rounded-lg transition disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${analyzingAi ? 'animate-spin' : ''}`} />
              {analyzingAi ? 'Analyzing...' : 'AI Insights'}
            </button>
          )}

          {/* Phase 5: Draft Purchase Orders Action */}
          {summary?.has_data && canManagePurchasing && (
            <button
              onClick={() => setShowConvertPoModal(true)}
              disabled={selectedPurchaseItems.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-40"
            >
              <ShoppingCart className="w-4 h-4" />
              Draft Purchase Orders ({selectedPurchaseItems.length})
            </button>
          )}

          {/* Phase 6: Draft Production Lists & BOM Preview Action */}
          {summary?.has_data && canEditReplenishment && (
            <button
              onClick={handleOpenProductionModal}
              disabled={selectedProductionItems.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-40"
            >
              <ChefHat className="w-4 h-4" />
              Draft Production List ({selectedProductionItems.length})
            </button>
          )}

          {/* Audit History Button */}
          {summary?.has_data && (
            <button
              onClick={handleViewHistory}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition"
            >
              <FileText className="w-4 h-4" />
              Audit Log
            </button>
          )}
        </div>
      </div>

      {/* Phase 2 Report Generator Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Branch</label>
          <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
            <Building className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setSelectedBatchId(undefined);
              }}
              className="bg-transparent text-sm font-medium text-gray-800 w-full focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Item Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="RAW_MATERIAL">Raw Materials</option>
            <option value="PREPARATION">Preparations / Semi-Finished</option>
            <option value="RETAIL">Retail Products</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Department</label>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none"
          >
            <option value="ALL">All Departments</option>
            <option value="Kitchen">Kitchen</option>
            <option value="Bakery">Bakery</option>
            <option value="Pastry">Pastry</option>
            <option value="Bar">Bar</option>
            <option value="Store">Store</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Planning Horizon</label>
          <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={horizonDays}
              onChange={(e) => setHorizonDays(Number(e.target.value))}
              className="bg-transparent text-sm font-medium text-gray-800 w-full focus:outline-none"
            >
              <option value={1}>1 Day</option>
              <option value={3}>3 Days</option>
              <option value={7}>7 Days</option>
              <option value={14}>14 Days</option>
              <option value={30}>30 Days</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Lookback Window</label>
          <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={lookbackDays}
              onChange={(e) => setLookbackDays(Number(e.target.value))}
              className="bg-transparent text-sm font-medium text-gray-800 w-full focus:outline-none"
            >
              <option value={7}>7 Days History</option>
              <option value={14}>14 Days History</option>
              <option value={30}>30 Days History</option>
              <option value={60}>60 Days History</option>
              <option value={90}>90 Days History</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Supplier</label>
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-full bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Stock Severity</label>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="w-full bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-800 focus:outline-none"
          >
            <option value="ALL">All Items</option>
            <option value="LOW_STOCK">Low Stock / Actionable</option>
            <option value="CRITICAL_STOCK">Critical Stock Only</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Name, code, supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {message && (
        <div
          className={`p-4 rounded-lg border flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary?.has_data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <span className="text-xs font-semibold text-gray-400 uppercase">Snapshot &amp; Creator</span>
            <div className="text-lg font-bold text-gray-900 mt-1">{summary.batch_number}</div>
            <div className="text-xs text-gray-500 mt-1">
              By {summary.created_by_name || 'Admin'} • {summary.display_horizon_days}d horizon / {summary.lookback_days || 30}d lookback
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <span className="text-xs font-semibold text-gray-400 uppercase">Purchase Reorders</span>
            <div className="text-2xl font-bold text-indigo-600 mt-1">{summary.total_reorders_recommended || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Raw materials &amp; retail items</div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <span className="text-xs font-semibold text-gray-400 uppercase">Production Batches</span>
            <div className="text-2xl font-bold text-purple-600 mt-1">{summary.total_production_recommended || 0}</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.total_production_drafts_created || 0} converted to drafts
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <span className="text-xs font-semibold text-gray-400 uppercase">Est. Purchasing Cost</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              ${Number(summary.total_estimated_cost_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">Pack-rounded PO estimate</div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <span className="text-xs font-semibold text-gray-400 uppercase">Imminent Stockouts</span>
            <div className="text-2xl font-bold text-red-600 mt-1">{summary.imminent_stockouts_count || 0}</div>
            <div className="text-xs text-gray-500 mt-1">{summary.timing_gaps_count || 0} lead-time timing gaps</div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <span className="text-xs font-semibold text-gray-400 uppercase">Data Confidence</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">{summary.low_confidence_count || 0}</div>
            <div className="text-xs text-gray-500 mt-1">Items using Par-Level fallback</div>
          </div>
        </div>
      )}

      {/* Phase 4 AI Demand Intelligence Banner */}
      {summary?.has_data && aiSummary && (
        <div className="bg-gradient-to-r from-violet-50 via-indigo-50 to-slate-50 p-5 rounded-xl border border-indigo-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              <h2 className="text-sm font-bold text-gray-900">
                AI Demand Intelligence &amp; Pattern Analysis
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-violet-100 text-violet-800">
                {aiSummary.engine_mode === 'GEMINI_2_5_FLASH_ASSISTED'
                  ? 'Backend Gemini 2.5 Flash + Deterministic Engine'
                  : 'Deterministic Statistical Intelligence'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                Surges: <strong>{aiSummary.metrics?.demand_surges || 0}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                Weekend Patterns: <strong>{aiSummary.metrics?.weekend_patterns || 0}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                Par Fallbacks: <strong>{aiSummary.metrics?.par_fallbacks || 0}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                Slow/Dead Stock: <strong>{(aiSummary.metrics?.slow_moving || 0) + (aiSummary.metrics?.dead_stock || 0)}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                Waste Alerts: <strong>{aiSummary.metrics?.high_waste_alerts || 0}</strong>
              </span>
            </div>
          </div>
          <p className="text-sm font-medium text-gray-800">{aiSummary.headline}</p>
          {Array.isArray(aiSummary.highlights) && aiSummary.highlights.length > 0 && (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-gray-600">
              {aiSummary.highlights.map((h, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Main 15-Column Interactive Report Table */}
      {!summary?.has_data ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center space-y-4">
          <Package className="w-12 h-12 text-indigo-400 mx-auto" />
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-gray-900">No Replenishment Report Generated</h3>
            <p className="text-sm text-gray-500 mt-1">
              Select your branch, planning horizon, and historical lookback window above, then click{' '}
              <strong>Generate Report</strong> to evaluate raw materials, preparations, and retail products.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-gray-50">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAllFiltered}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded bg-indigo-50 border border-indigo-200"
              >
                Toggle Select All Pending ({filteredItems.filter((i) => i.conversion_status === 'PENDING').length})
              </button>
              <span className="text-xs text-gray-500">
                Showing <strong>{filteredItems.length}</strong> of {items.length} evaluated items
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-medium text-gray-700"
              >
                <option value="ALL">All Recommendation Actions</option>
                <option value="REORDER_RECOMMENDED">Reorder Recommended (Purchase)</option>
                <option value="BRIDGE_ORDER_RECOMMENDED">Bridge Order (Timing Gap)</option>
                <option value="PRODUCTION_RECOMMENDED">Production Recommended (Prep)</option>
                <option value="DO_NOT_REORDER">Do Not Reorder / Suppressed</option>
                <option value="NO_ACTION_REQUIRED">Healthy / No Action Required</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-3 w-9">
                    <input
                      type="checkbox"
                      onChange={toggleSelectAllFiltered}
                      checked={
                        filteredItems.filter((i) => i.conversion_status === 'PENDING').length > 0 &&
                        filteredItems
                          .filter((i) => i.conversion_status === 'PENDING')
                          .every((i) => selectedRecIds.has(i.item_rec_id))
                      }
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="py-3 px-3">Item &amp; Code</th>
                  <th className="py-3 px-3">Category &amp; Dept</th>
                  <th className="py-3 px-3 text-right">Physical / Usable</th>
                  <th className="py-3 px-3 text-right">Par / Target</th>
                  <th className="py-3 px-3 text-right">Daily Demand &amp; Freq</th>
                  <th className="py-3 px-3 text-right">Coverage &amp; Horizon</th>
                  <th className="py-3 px-3 text-right">Confirmed Incoming</th>
                  <th className="py-3 px-3 text-right">Suggested Qty</th>
                  <th className="py-3 px-3">Est. Stockout</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Confidence</th>
                  <th className="py-3 px-3">Supplier / Recipe</th>
                  <th className="py-3 px-3 min-w-[280px]">Recommendation &amp; AI Explanation</th>
                  <th className="py-3 px-3 text-right">Review / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={15} className="py-12 text-center text-gray-500">
                      Loading replenishment recommendations...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-12 text-center text-gray-500">
                      No items match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const effQty = Number(item.override_quantity ?? item.recommended_order_quantity ?? 0);
                    const effPriority = item.override_priority || item.priority || 'NORMAL';
                    const isConverted = item.conversion_status === 'CONVERTED';
                    const isSelected = selectedRecIds.has(item.item_rec_id);

                    return (
                      <tr
                        key={item.item_rec_id}
                        className={`hover:bg-gray-50/80 transition ${
                          isConverted ? 'bg-emerald-50/30' : isSelected ? 'bg-indigo-50/20' : ''
                        }`}
                      >
                        <td className="py-3 px-3 align-top">
                          <input
                            type="checkbox"
                            disabled={isConverted}
                            checked={isSelected && !isConverted}
                            onChange={() => toggleSelectItem(item.item_rec_id)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                          />
                        </td>

                        {/* 1. Item Name & Code */}
                        <td className="py-3 px-3 align-top">
                          <div className="font-bold text-gray-900">{item.item_name}</div>
                          <div className="text-[11px] text-gray-400 font-mono">{item.item_code}</div>
                        </td>

                        {/* 2. Category & Department */}
                        <td className="py-3 px-3 align-top space-y-1">
                          <div>{getCategoryBadge(item.item_category)}</div>
                          <div className="text-[11px] font-semibold text-gray-600">
                            Dept: {item.normalized_department || item.department}
                          </div>
                        </td>

                        {/* 3. Physical vs Usable Stock */}
                        <td className="py-3 px-3 align-top text-right">
                          <div className="font-bold text-gray-900">
                            {Number(item.usable_stock || 0).toFixed(2)} {item.base_unit}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Physical: {Number(item.signed_ledger_stock || 0).toFixed(2)}
                          </div>
                          {Number(item.committed_production_reservation_qty || 0) > 0 && (
                            <div className="text-[11px] text-amber-700 font-medium">
                              Reserved: -{Number(item.committed_production_reservation_qty).toFixed(2)}
                            </div>
                          )}
                        </td>

                        {/* 4. Par Level & Target Stock */}
                        <td className="py-3 px-3 align-top text-right">
                          <div className="font-semibold text-gray-800">
                            Par: {Number(item.par_level || 0).toFixed(2)}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Target: {Number(item.target_stock || 0).toFixed(2)}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            ROP: {Number(item.reorder_point || 0).toFixed(2)}
                          </div>
                        </td>

                        {/* 5. Average Daily Consumption & Frequency */}
                        <td className="py-3 px-3 align-top text-right">
                          <div className="font-semibold text-gray-900">
                            {Number(item.daily_demand || 0).toFixed(2)} {item.base_unit}/d
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Freq: {Number(item.consumption_frequency_pct || 0).toFixed(0)}% ({item.active_consumption_days || 0}d)
                          </div>
                          {Number(item.dependent_bom_horizon_demand || 0) > 0 && (
                            <div
                              className="text-[10px] text-purple-700 font-medium"
                              title="Includes dependent BOM demand from planned preparations without double-counting historical production batches"
                            >
                              Direct: {Number(item.direct_menu_daily_demand || 0).toFixed(2)}/d + BOM:{' '}
                              {Number(item.dependent_bom_horizon_demand).toFixed(1)}
                            </div>
                          )}
                        </td>

                        {/* 6. Estimated Coverage & Horizon Forecast */}
                        <td className="py-3 px-3 align-top text-right">
                          <div className="font-bold text-gray-900">
                            {item.days_on_hand !== null && item.days_on_hand !== undefined
                              ? `${Number(item.days_on_hand).toFixed(1)} days`
                              : '∞ days'}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            Horizon: {Number(item.horizon_forecast_demand || 0).toFixed(2)} {item.base_unit}
                          </div>
                        </td>

                        {/* 7. Outstanding Incoming Supply (Strictly separating Approved vs Draft) */}
                        <td className="py-3 px-3 align-top text-right">
                          <div className="font-semibold text-emerald-700">
                            +
                            {(
                              Number(item.confirmed_incoming_po_qty || 0) +
                              Number(item.confirmed_incoming_production_qty || 0) +
                              Number(item.confirmed_incoming_transfer_qty || 0)
                            ).toFixed(2)}{' '}
                            {item.base_unit}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            PO: {Number(item.confirmed_incoming_po_qty || 0).toFixed(1)} | Prod:{' '}
                            {Number(item.confirmed_incoming_production_qty || 0).toFixed(1)} | Trf:{' '}
                            {Number(item.confirmed_incoming_transfer_qty || 0).toFixed(1)}
                          </div>
                          {Number(item.tentative_draft_production_qty || 0) > 0 && (
                            <div
                              className="text-[10px] text-amber-600 font-medium"
                              title="Tentative DRAFT production batches are excluded from confirmed supply to prevent under-ordering"
                            >
                              (Excl. Draft: {Number(item.tentative_draft_production_qty).toFixed(1)})
                            </div>
                          )}
                        </td>

                        {/* 8. Suggested Purchase or Production Quantity */}
                        <td className="py-3 px-3 align-top text-right">
                          <div className="font-bold text-indigo-700 text-sm">
                            {effQty.toFixed(2)} {item.base_unit}
                          </div>
                          {item.override_quantity !== null && item.override_quantity !== undefined && (
                            <div className="text-[10px] text-amber-700 font-semibold">
                              Overridden (Orig: {Number(item.recommended_order_quantity).toFixed(2)})
                            </div>
                          )}
                          {item.sourcing_type !== 'PRODUCTION' && effQty > 0 && (
                            <div className="text-[11px] text-gray-500">
                              {item.recommended_packs} × {item.pack_size} ({item.purchase_unit})
                            </div>
                          )}
                          {item.shelf_life_capped && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[10px] font-semibold">
                              Capped ({item.shelf_life_days}d shelf life)
                            </span>
                          )}
                        </td>

                        {/* 9. Estimated Stockout Date */}
                        <td className="py-3 px-3 align-top">
                          {item.projected_stockout_date ? (
                            <div>
                              <div className="font-bold text-red-600">{item.projected_stockout_date}</div>
                              <div className="text-[11px] text-red-500">
                                In {item.days_until_stockout ?? 0} day(s)
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">No stockout in horizon</span>
                          )}
                        </td>

                        {/* 10. Priority */}
                        <td className="py-3 px-3 align-top">{getPriorityBadge(effPriority)}</td>

                        {/* 11. Data Confidence */}
                        <td className="py-3 px-3 align-top">
                          {getConfidenceBadge(item.data_confidence || 'MEDIUM', item.active_consumption_days || 0)}
                        </td>

                        {/* 12. Supplier / Recipe & Cost */}
                        <td className="py-3 px-3 align-top">
                          {item.sourcing_type === 'PRODUCTION' ? (
                            <div>
                              <span className="font-semibold text-purple-700">In-House Recipe</span>
                              {item.required_by_date && (
                                <div className="text-[11px] text-gray-500">Req by: {item.required_by_date}</div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="font-semibold text-gray-800">
                                {item.supplier_name || 'No Active Supplier'}
                              </div>
                              <div className="text-[11px] text-emerald-700 font-semibold">
                                Est: ${Number(item.estimated_total_cost_usd || 0).toFixed(2)}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 13. Deterministic + AI Explanation & Signals */}
                        <td className="py-3 px-3 align-top max-w-sm space-y-1">
                          <div className="text-[11px] text-gray-700 leading-snug">
                            {item.recommendation_explanation}
                          </div>
                          {item.ai_explanation && (
                            <div className="text-[11px] text-violet-800 bg-violet-50/80 p-1.5 rounded border border-violet-100 leading-snug">
                              <Sparkles className="w-3 h-3 inline mr-1 text-violet-600" />
                              {item.ai_explanation}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {Array.isArray(item.ai_flags) &&
                              item.ai_flags.map((flag, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium"
                                >
                                  {flag}
                                </span>
                              ))}
                            {Array.isArray(item.exceptions) &&
                              item.exceptions.map((ex, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-medium"
                                >
                                  {ex}
                                </span>
                              ))}
                          </div>
                        </td>

                        {/* 14. Review Actions & Idempotent Conversion Status */}
                        <td className="py-3 px-3 align-top text-right">
                          {isConverted ? (
                            <div className="inline-flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Converted to Draft
                              </span>
                              {item.created_task_id && (
                                <span className="text-[10px] text-gray-500">Task: {item.created_task_id}</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {canEditReplenishment && (
                                <button
                                  onClick={() => openEditModal(item)}
                                  title="Override Quantity, Supplier, or Priority"
                                  className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canManagePurchasing && (
                                <>
                                  <button
                                    onClick={() => handleQuickAction(item, 'APPROVED')}
                                    title="Approve Recommendation"
                                    className={`p-1.5 rounded ${
                                      item.manager_action === 'APPROVED'
                                        ? 'bg-emerald-600 text-white'
                                        : 'hover:bg-emerald-100 text-emerald-700'
                                    }`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleQuickAction(item, 'REJECTED')}
                                    title="Reject Recommendation"
                                    className={`p-1.5 rounded ${
                                      item.manager_action === 'REJECTED'
                                        ? 'bg-red-600 text-white'
                                        : 'hover:bg-red-100 text-red-700'
                                    }`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
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
      )}

      {/* Phase 7: Override Quantity / Priority / Supplier Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Override Recommendation</h3>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-gray-700">{editingItem.item_name}</span>
                <span className="ml-2 text-xs text-gray-400">({editingItem.item_code})</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Override Quantity ({editingItem.base_unit})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={overrideQty}
                  onChange={(e) => setOverrideQty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Priority</label>
                <select
                  value={overridePriority}
                  onChange={(e) => setOverridePriority(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              {editingItem.sourcing_type !== 'PRODUCTION' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Supplier</label>
                  <select
                    value={overrideSupplierId}
                    onChange={(e) => setOverrideSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Required-By Date
                    </label>
                    <input
                      type="date"
                      value={overrideRequiredDate}
                      onChange={(e) => setOverrideRequiredDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Responsible User / Chef
                    </label>
                    <input
                      type="text"
                      value={overrideAssignedUser}
                      onChange={(e) => setOverrideAssignedUser(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Reason / Notes</label>
                <textarea
                  rows={2}
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="Document reason for override..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOverride}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 5: Purchasing Integration Modal (Grouped by Supplier) */}
      {showConvertPoModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  Confirm Draft Purchase Order Generation
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Creates persisted DRAFT Purchase Orders grouped by supplier. Physical stock is never modified until goods are received.
                </p>
              </div>
              <button onClick={() => setShowConvertPoModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {purchaseGroupsBySupplier.map((group) => (
                <div key={group.supplierId} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900">{group.supplierName}</span>
                    <span className="text-xs font-bold text-emerald-700">
                      Est. PO Subtotal: ${group.totalCost.toFixed(2)}
                    </span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3 text-right">Net Req</th>
                        <th className="py-2 px-3 text-right">Packs × Pack Size</th>
                        <th className="py-2 px-3 text-right">Est. Line Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.items.map((it) => {
                        const qty = Number(it.override_quantity ?? it.recommended_order_quantity ?? 0);
                        const packSize = Math.max(0.0001, Number(it.pack_size || 1));
                        const packs = Math.ceil(qty / packSize);
                        const rounded = packs * packSize;
                        return (
                          <tr key={it.item_rec_id}>
                            <td className="py-2 px-3 font-medium text-gray-900">{it.item_name}</td>
                            <td className="py-2 px-3 text-right">
                              {qty.toFixed(2)} {it.base_unit}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {packs} × {packSize} ({rounded.toFixed(2)} {it.base_unit})
                            </td>
                            <td className="py-2 px-3 text-right font-semibold">
                              ${(rounded * Number(it.unit_cost_usd || 0)).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setShowConvertPoModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToPOs}
                disabled={convertingPo}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                {convertingPo ? 'Creating Draft POs...' : 'Confirm & Create Draft POs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 6: Production Integration & Multi-Level BOM Consolidation Modal */}
      {showProductionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-purple-600" />
                  Production Planning &amp; Consolidated BOM Ingredient Availability
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Generates DRAFT Production Batches and Department Tasks for Kitchen, Bakery, Pastry &amp; Bar without prematurely deducting stock.
                </p>
              </div>
              <button onClick={() => setShowProductionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Preparations by Department */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-gray-500">
                  Selected Preparations ({selectedProductionItems.length})
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <UserCheck className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 font-medium">Default Responsible User:</span>
                  <input
                    type="text"
                    value={prodResponsibleName}
                    onChange={(e) => setProdResponsibleName(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
              </div>

              <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3">Preparation Item</th>
                    <th className="py-2 px-3">Workstation / Dept</th>
                    <th className="py-2 px-3 text-right">Planned Batch Qty</th>
                    <th className="py-2 px-3">Priority</th>
                    <th className="py-2 px-3">Suggested Prod Date</th>
                    <th className="py-2 px-3">Required-By Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedProductionItems.map((it) => (
                    <tr key={it.item_rec_id}>
                      <td className="py-2 px-3 font-bold text-gray-900">{it.item_name}</td>
                      <td className="py-2 px-3 font-medium text-purple-700">
                        {it.normalized_department || it.department}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        {Number(it.override_quantity ?? it.recommended_order_quantity ?? 0).toFixed(2)} {it.base_unit}
                      </td>
                      <td className="py-2 px-3">{getPriorityBadge(it.override_priority || it.priority)}</td>
                      <td className="py-2 px-3">{it.suggested_production_date || new Date().toISOString().slice(0, 10)}</td>
                      <td className="py-2 px-3">{it.required_by_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Consolidated BOM Raw Material Availability & Shortages */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-gray-500">
                  Consolidated BOM Raw-Material Requirements &amp; Shortages
                </h4>
                {bomPreview && bomPreview.shortages_count > 0 && canManagePurchasing && (
                  <button
                    onClick={handleCreateShortagePOs}
                    disabled={creatingShortagePo}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {creatingShortagePo
                      ? 'Generating Shortage Draft POs...'
                      : `Generate Draft PO for ${bomPreview.shortages_count} Missing Raw Material(s)`}
                  </button>
                )}
              </div>

              {loadingBomPreview ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  Exploding multi-level BOM recipes and checking branch usable stock...
                </div>
              ) : bomPreview && bomPreview.consolidated_ingredients.length > 0 ? (
                <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                    <tr>
                      <th className="py-2 px-3">Ingredient</th>
                      <th className="py-2 px-3 text-right">Consolidated Required</th>
                      <th className="py-2 px-3 text-right">Available for Prod</th>
                      <th className="py-2 px-3 text-right">Shortage</th>
                      <th className="py-2 px-3">Preferred Supplier &amp; Pack Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bomPreview.consolidated_ingredients.map((ing) => (
                      <tr key={ing.item_id} className={ing.has_shortage ? 'bg-red-50/50' : ''}>
                        <td className="py-2 px-3 font-medium text-gray-900">{ing.item_name}</td>
                        <td className="py-2 px-3 text-right font-semibold">
                          {Number(ing.required_base_qty).toFixed(2)} {ing.base_unit}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {Number(ing.available_for_production_qty).toFixed(2)} {ing.base_unit}
                        </td>
                        <td className="py-2 px-3 text-right font-bold">
                          {ing.has_shortage ? (
                            <span className="text-red-600">
                              -{Number(ing.shortage_base_qty).toFixed(2)} {ing.base_unit}
                            </span>
                          ) : (
                            <span className="text-emerald-600">Sufficient</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {ing.has_shortage ? (
                            <span>
                              {ing.recommended_supplier_name || 'No Supplier'} • Order {ing.recommended_packs} packs (
                              {Number(ing.recommended_order_qty).toFixed(2)} {ing.base_unit} • $
                              {Number(ing.estimated_shortage_po_cost_usd).toFixed(2)})
                            </span>
                          ) : (
                            <span className="text-gray-400">In Stock</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 bg-gray-50 rounded text-xs text-gray-500">
                  No BOM components found for the selected preparations.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                onClick={() => setShowProductionModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToProductionBatches}
                disabled={convertingProd}
                className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
              >
                {convertingProd ? 'Creating Draft Production Batches...' : 'Confirm & Create Draft Production List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Decision History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Replenishment Decision Audit History</h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {historyRecords.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">No overrides or conversions recorded yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-2 px-2">Time</th>
                    <th className="py-2 px-2">Action</th>
                    <th className="py-2 px-2">Prev Qty</th>
                    <th className="py-2 px-2">New Qty</th>
                    <th className="py-2 px-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historyRecords.map((rec: any, idx: number) => (
                    <tr key={rec.id || idx}>
                      <td className="py-2 px-2 text-gray-500">
                        {rec.created_at ? new Date(rec.created_at).toLocaleString() : ''}
                      </td>
                      <td className="py-2 px-2 font-semibold">{rec.action_type}</td>
                      <td className="py-2 px-2">{rec.previous_quantity ?? '-'}</td>
                      <td className="py-2 px-2 font-bold">{rec.new_quantity ?? '-'}</td>
                      <td className="py-2 px-2 text-gray-600">{rec.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
