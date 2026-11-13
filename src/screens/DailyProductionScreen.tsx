import React, { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame,
  ChefHat,
  Plus,
  Search,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  RotateCcw,
  Clock,
  ArrowRight,
  TrendingUp,
  Package,
  Eye,
  Filter,
  Play,
  Check,
  Ban,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { api } from '../api/client';
import SearchableSelect from '../components/SearchableSelect';

const card: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
};

const input: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: '#fff',
  font: 'inherit',
  fontSize: 14,
  boxSizing: 'border-box'
};

const label: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-main)'
};

const button: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '9px 16px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: '#fff',
  color: 'inherit',
  cursor: 'pointer',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: 13,
  transition: 'all 0.15s ease'
};

const primary: CSSProperties = {
  ...button,
  background: 'var(--primary)',
  borderColor: 'var(--primary)',
  color: '#fff'
};

interface ProductionBatch {
  id: string;
  batch_number: string;
  production_recipe_id: string;
  branch_id: string;
  location_id: string;
  destination_location_id: string;
  output_item_id: string;
  output_lot_id?: string;
  planned_yield_quantity: number;
  planned_yield_unit: string;
  actual_yield_quantity?: number;
  actual_yield_unit?: string;
  yield_variance_base_quantity?: number;
  yield_variance_percentage?: number;
  yield_variance_reason?: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'REVERSED';
  total_input_cost?: number;
  produced_unit_cost?: number;
  batch_date: string;
  started_at?: string;
  completed_at?: string;
  created_by_name?: string;
  produced_by_name?: string;
  cancelled_by_name?: string;
  cancellation_reason?: string;
  notes?: string;
  created_at: string;
  recipe?: {
    id: string;
    name: string;
    recipe_code: string;
  };
  output_item?: {
    id: string;
    name: string;
    unit?: string;
    base_unit?: string;
  };
  source_location?: {
    id: string;
    name: string;
  };
  destination_location?: {
    id: string;
    name: string;
  };
  items?: Array<{
    id: string;
    item_id: string;
    item_name?: string;
    planned_quantity: number;
    planned_unit: string;
    actual_quantity?: number;
    actual_unit?: string;
    unit_cost?: number;
    total_cost?: number;
  }>;
}

export default function DailyProductionScreen({
  user,
  permissions,
  canEdit = true
}: {
  user?: any;
  permissions?: any;
  canEdit?: boolean;
}) {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('7days');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [completeModalBatch, setCompleteModalBatch] = useState<ProductionBatch | null>(null);
  const [detailsModalBatch, setDetailsModalBatch] = useState<ProductionBatch | null>(null);
  const [cancelModalBatch, setCancelModalBatch] = useState<ProductionBatch | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // New Batch Form State
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>('1');
  const [customBatches, setCustomBatches] = useState<string>('');
  const [formBranchId, setFormBranchId] = useState('');
  const [formSourceLocId, setFormSourceLocId] = useState('');
  const [formDestLocId, setFormDestLocId] = useState('');
  const [formPlannedYield, setFormPlannedYield] = useState<string>('');
  const [formBatchDate, setFormBatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [directComplete, setDirectComplete] = useState(true);
  const [formActualYield, setFormActualYield] = useState<string>('');
  const [formVarianceReason, setFormVarianceReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Complete Batch Form State
  const [completeActualYield, setCompleteActualYield] = useState<string>('');
  const [completeVarianceReason, setCompleteVarianceReason] = useState('');
  const [completing, setCompleting] = useState(false);

  // Recipe Search & Dept Filter for creation modal
  const [recipeDeptFilter, setRecipeDeptFilter] = useState('All');
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');

  const availableDepts = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach(r => {
      const dept = r.output_item?.department || r.department;
      if (dept) set.add(dept);
    });
    return ['All', ...Array.from(set).sort()];
  }, [recipes]);

  const filteredRecipesForModal = useMemo(() => {
    return recipes.filter(r => {
      const dept = r.output_item?.department || r.department || '';
      if (recipeDeptFilter !== 'All' && dept.toLowerCase() !== recipeDeptFilter.toLowerCase()) {
        return false;
      }
      if (recipeSearchQuery.trim()) {
        const q = recipeSearchQuery.toLowerCase();
        const name = (r.name || '').toLowerCase();
        const code = (r.recipe_code || '').toLowerCase();
        const outName = (r.output_item?.name || '').toLowerCase();
        const d = dept.toLowerCase();
        return name.includes(q) || code.includes(q) || outName.includes(q) || d.includes(q);
      }
      return true;
    });
  }, [recipes, recipeDeptFilter, recipeSearchQuery]);

  const activeRecipe = useMemo(() => {
    return recipes.find(r => r.id === selectedRecipeId) || null;
  }, [recipes, selectedRecipeId]);

  const handlePresetSelect = (p: string) => {
    setSelectedPreset(p);
    setCustomBatches('');
    if (activeRecipe) {
      const baseYield = Number(activeRecipe.target_yield_quantity || (activeRecipe as any).yield_quantity) || 1;
      const mult = parseFloat(p) || 1;
      const planned = baseYield * mult;
      const formatted = planned % 1 === 0 ? String(planned) : planned.toFixed(2);
      setFormPlannedYield(formatted);
      setFormActualYield(formatted);
    }
  };

  const handleCustomBatchesChange = (val: string) => {
    const sanitized = val.replace(/[^0-9.]/g, '');
    setCustomBatches(sanitized);
    setSelectedPreset(null);
    if (activeRecipe && sanitized && parseFloat(sanitized) > 0) {
      const baseYield = Number(activeRecipe.target_yield_quantity || (activeRecipe as any).yield_quantity) || 1;
      const mult = parseFloat(sanitized);
      const planned = baseYield * mult;
      const formatted = planned % 1 === 0 ? String(planned) : planned.toFixed(2);
      setFormPlannedYield(formatted);
      setFormActualYield(formatted);
    }
  };

  useEffect(() => {
    if (activeRecipe) {
      const baseYield = Number(activeRecipe.target_yield_quantity || (activeRecipe as any).yield_quantity) || 1;
      const mult = selectedPreset ? (parseFloat(selectedPreset) || 1) : (parseFloat(customBatches) || 1);
      const planned = baseYield * mult;
      const formatted = planned % 1 === 0 ? String(planned) : planned.toFixed(2);
      setFormPlannedYield(formatted);
      setFormActualYield(formatted);

      if (activeRecipe.default_location_id) {
        setFormDestLocId(activeRecipe.default_location_id);
      }
      if (!formSourceLocId && locations.length > 0) {
        const kitchenLoc = locations.find(l => l.name?.toLowerCase().includes('kitchen')) || locations[0];
        setFormSourceLocId(kitchenLoc.id);
      }
    }
  }, [selectedRecipeId]);

  // Scaled ingredients calculation
  const scaledIngredients = useMemo(() => {
    if (!activeRecipe || !activeRecipe.production_recipe_items) return [];
    const baseYield = Number(activeRecipe.target_yield_quantity) || 1;
    const planned = Number(formPlannedYield) || 0;
    const factor = planned > 0 ? planned / baseYield : 1;

    return activeRecipe.production_recipe_items.map((it: any) => {
      const baseQty = Number(it.quantity) || 0;
      const scaledQty = +(baseQty * factor).toFixed(4);
      const itemName = it.items?.name || items.find(i => i.id === it.item_id)?.name || it.item_id;
      return {
        ...it,
        itemName,
        baseQty,
        scaledQty,
        unit: it.unit
      };
    });
  }, [activeRecipe, formPlannedYield, items]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [batchesRes, recipesRes, locsRes, branchesRes, itemsRes] = await Promise.all([
        api.getProductionBatches(),
        api.getProductionRecipeCatalog(),
        api.getInventoryLocationsSimpleList(),
        api.getBranchesList ? api.getBranchesList() : api.getBranches(),
        api.getInventoryItemsSimpleList()
      ]);

      if (!batchesRes.success) {
        throw new Error(batchesRes.error || 'Failed to load production batches.');
      }
      setBatches(batchesRes.data || []);
      if (recipesRes.success) setRecipes(recipesRes.data || []);
      if (locsRes.success) setLocations(locsRes.data || []);
      const branchList = branchesRes.data || [];
      if (branchesRes.success) setBranches(branchList);
      if (itemsRes.success) setItems(itemsRes.data || []);

      // Default branch for creation modal: match user.branch name or ID, or fallback to first branch
      const userBranchName = user?.branch;
      const matchedBranch = branchList.find((b: any) =>
        userBranchName && userBranchName !== 'All' &&
        (b.id === userBranchName || b.name?.trim().toLowerCase() === userBranchName.trim().toLowerCase())
      );
      const defaultBranchId = matchedBranch?.id || branchList[0]?.id || '';
      setFormBranchId(defaultBranchId);
    } catch (err: any) {
      setError(err.message || 'Error loading daily production data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);



  // Compute stats
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBatches = batches.filter(b => b.batch_date === todayStr);
    const completedToday = todayBatches.filter(b => b.status === 'COMPLETED');
    const inProgressCount = batches.filter(b => b.status === 'IN_PROGRESS').length;
    
    // Average variance of completed batches
    const completedWithVariance = batches.filter(b => b.status === 'COMPLETED' && b.yield_variance_percentage != null);
    const avgVariance = completedWithVariance.length > 0
      ? (completedWithVariance.reduce((acc, b) => acc + Number(b.yield_variance_percentage || 0), 0) / completedWithVariance.length).toFixed(1)
      : '0.0';

    return {
      todayCount: todayBatches.length,
      completedTodayCount: completedToday.length,
      inProgressCount,
      avgVariance
    };
  }, [batches]);

  // Filter batches
  const filteredBatches = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return batches.filter(b => {
      // Search
      const text = `${b.batch_number} ${b.recipe?.name || ''} ${b.recipe?.recipe_code || ''} ${b.output_item?.name || ''}`.toLowerCase();
      if (search.trim() && !text.includes(search.toLowerCase())) return false;

      // Branch
      if (selectedBranch !== 'All') {
        const branchObj = branches.find(br => br.id === selectedBranch || br.name === selectedBranch);
        const matchId = b.branch_id === selectedBranch;
        const matchName = branchObj && (b.branch_id === branchObj.name || b.branch_id === branchObj.id);
        if (!matchId && !matchName) return false;
      }

      // Status
      if (selectedStatus !== 'All' && b.status !== selectedStatus) return false;

      // Date range
      if (dateFilter !== 'all') {
        const batchDate = new Date(b.batch_date);
        batchDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - batchDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dateFilter === 'today' && diffDays !== 0) return false;
        if (dateFilter === '7days' && diffDays > 7) return false;
        if (dateFilter === 'month' && diffDays > 30) return false;
      }

      return true;
    });
  }, [batches, search, selectedBranch, selectedStatus, dateFilter]);

  // Handle Create / Record Production
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeId) {
      alert('Please select a production recipe.');
      return;
    }
    const plannedQty = Number(formPlannedYield);
    if (!Number.isFinite(plannedQty) || plannedQty <= 0) {
      alert('Planned yield quantity must be greater than zero.');
      return;
    }
    if (!formSourceLocId || !formDestLocId) {
      alert('Please specify both source kitchen location and destination storage location.');
      return;
    }

    setSubmitting(true);
    try {
      const userName = user?.name || user?.email || 'Admin';
      const userId = user?.id || null;

      // 1. Create production batch
      const createRes = await api.createProductionBatch({
        recipe_id: selectedRecipeId,
        branch_id: formBranchId,
        location_id: formSourceLocId,
        destination_location_id: formDestLocId,
        planned_yield_quantity: plannedQty,
        planned_yield_unit: activeRecipe.yield_unit,
        batch_date: formBatchDate,
        user_id: userId,
        user_name: userName,
        notes: formNotes.trim() || undefined
      });

      if (!createRes || createRes.success === false) {
        throw new Error(createRes?.error || 'Failed to create production batch.');
      }

      const batchId = createRes.batch_id;

      // 2. If direct completion was chosen: Start then Complete immediately
      if (directComplete) {
        await api.startProductionBatch(batchId, userId, userName);

        const actualQty = Number(formActualYield) || plannedQty;
        const completeRes = await api.completeProductionBatch({
          batch_id: batchId,
          actual_yield_quantity: actualQty,
          actual_yield_unit: activeRecipe.yield_unit,
          yield_variance_reason: formVarianceReason.trim() || undefined,
          user_id: userId,
          user_name: userName
        });

        if (!completeRes || completeRes.success === false) {
          throw new Error(completeRes?.error || 'Batch created but could not be completed.');
        }

        setSuccessToast(`Daily production for "${activeRecipe.name}" successfully recorded and completed! Finished prep lot added to stock.`);
      } else {
        // Start as work order in progress
        await api.startProductionBatch(batchId, userId, userName);
        setSuccessToast(`Production work order "${createRes.batch_number || activeRecipe.name}" started in progress.`);
      }

      setCreateModalOpen(false);
      resetCreateForm();
      await loadData();
    } catch (err: any) {
      alert(`Error saving production batch: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedRecipeId('');
    setFormPlannedYield('');
    setFormActualYield('');
    setFormVarianceReason('');
    setFormNotes('');
  };

  // Handle Complete In-Progress Batch
  const handleCompleteBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModalBatch) return;

    const actualQty = Number(completeActualYield);
    if (!Number.isFinite(actualQty) || actualQty <= 0) {
      alert('Actual yield quantity must be greater than zero.');
      return;
    }

    setCompleting(true);
    try {
      const userName = user?.name || user?.email || 'Admin';
      const userId = user?.id || null;

      const res = await api.completeProductionBatch({
        batch_id: completeModalBatch.id,
        actual_yield_quantity: actualQty,
        actual_yield_unit: completeModalBatch.planned_yield_unit,
        yield_variance_reason: completeVarianceReason.trim() || undefined,
        user_id: userId,
        user_name: userName
      });

      if (!res || res.success === false) {
        throw new Error(res?.error || 'Failed to complete batch.');
      }

      setSuccessToast(`Batch "${completeModalBatch.batch_number}" marked completed. Output inventory lot added.`);
      setCompleteModalBatch(null);
      setCompleteActualYield('');
      setCompleteVarianceReason('');
      await loadData();
    } catch (err: any) {
      alert(`Error completing batch: ${err.message}`);
    } finally {
      setCompleting(false);
    }
  };

  // Handle Cancel Batch
  const handleCancelBatchSubmit = async () => {
    if (!cancelModalBatch) return;
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancelling this production batch.');
      return;
    }

    try {
      const userName = user?.name || user?.email || 'Admin';
      const userId = user?.id || null;
      const res = await api.cancelProductionBatch(cancelModalBatch.id, cancelReason.trim(), userId, userName);
      if (!res || res.success === false) {
        throw new Error(res?.error || 'Failed to cancel batch.');
      }

      setSuccessToast(`Batch "${cancelModalBatch.batch_number}" has been cancelled.`);
      setCancelModalBatch(null);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      alert(`Error cancelling batch: ${err.message}`);
    }
  };

  // Handle Reverse Completed Batch
  const handleReverseBatch = async (b: ProductionBatch) => {
    const reason = window.prompt(`Are you sure you want to REVERSE completed batch ${b.batch_number}? Please enter reversal reason:`);
    if (!reason || !reason.trim()) return;

    try {
      const userName = user?.name || user?.email || 'Admin';
      const userId = user?.id || null;
      const res = await api.reverseCompletedProductionBatch(b.id, reason.trim(), userId, userName);
      if (!res || res.success === false) {
        throw new Error(res?.error || 'Failed to reverse batch.');
      }

      setSuccessToast(`Batch "${b.batch_number}" reversed. Raw ingredient stock has been returned.`);
      await loadData();
    } catch (err: any) {
      alert(`Error reversing batch: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 60 }}>
      {/* HEADER */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 24 }}>
            <Flame color="#ea580c" /> Daily Kitchen Production
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Log and track daily sub-recipes, batch cooking, scaled ingredient usage, and output lot numbers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/production-recipes" style={button} title="Inspect and configure recipe formulas and yields">
            <ChefHat size={17} /> Recipe Formulas
          </Link>
          <Link to="/cost-control" style={button} title="View yield variance snapshots & prime costs">
            <TrendingUp size={17} /> Yield Analytics
          </Link>
          {canEdit && (
            <button
              type="button"
              style={primary}
              onClick={() => {
                resetCreateForm();
                setCreateModalOpen(true);
              }}
            >
              <Plus size={18} /> Record Daily Production
            </button>
          )}
        </div>
      </header>

      {/* SUCCESS TOAST */}
      {successToast && (
        <div
          role="status"
          style={{
            ...card,
            background: '#ecfdf5',
            borderColor: '#a7f3d0',
            color: '#065f46',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
            <CheckCircle2 size={18} /> {successToast}
          </span>
          <button
            type="button"
            onClick={() => setSuccessToast('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 16
        }}
      >
        <div style={{ ...card, padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Today's Batches</div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 2px', color: 'var(--text-main)' }}>
            {stats.todayCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {stats.completedTodayCount} completed, {stats.todayCount - stats.completedTodayCount} pending
          </div>
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>In-Progress Cooking</div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 2px', color: '#ea580c' }}>
            {stats.inProgressCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Work orders currently on the stove/prep table</div>
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Avg Yield Variance</div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              margin: '6px 0 2px',
              color: Number(stats.avgVariance) > 3 ? '#b91c1c' : '#16a34a'
            }}
          >
            {Number(stats.avgVariance) > 0 ? `+${stats.avgVariance}%` : `${stats.avgVariance}%`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Actual yield vs standard recipe yield</div>
        </div>

        <div style={{ ...card, padding: 18 }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>Active Recipes</div>
          <div style={{ fontSize: 28, fontWeight: 700, margin: '6px 0 2px', color: 'var(--text-main)' }}>
            {recipes.length}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Approved standard formulas configured</div>
        </div>
      </div>

      {/* FILTERS TOOLBAR */}
      <div
        style={{
          ...card,
          padding: 16,
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260, alignItems: 'center' }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            style={{ ...input, border: 'none', padding: '6px 0', outline: 'none' }}
            placeholder="Search by recipe, batch number (e.g. BATCH-019), or output item…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Branch Filter */}
          <select
            style={{ ...input, width: 'auto', padding: '8px 12px' }}
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
          >
            <option value="All">All Branches</option>
            {branches.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            style={{ ...input, width: 'auto', padding: '8px 12px' }}
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REVERSED">Reversed</option>
          </select>

          {/* Date Filter */}
          <div style={{ display: 'flex', background: 'var(--surface-hover, #f1f5f9)', borderRadius: 6, padding: 3 }}>
            {(['today', '7days', 'month', 'all'] as const).map(df => (
              <button
                key={df}
                type="button"
                onClick={() => setDateFilter(df)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 5,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: dateFilter === df ? 700 : 500,
                  background: dateFilter === df ? '#fff' : 'transparent',
                  color: dateFilter === df ? 'var(--text-main)' : 'var(--text-muted)',
                  boxShadow: dateFilter === df ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {df === 'today' ? 'Today' : df === '7days' ? 'Last 7d' : df === 'month' ? 'This Month' : 'All'}
              </button>
            ))}
          </div>

          <button type="button" style={button} onClick={loadData} title="Refresh batches">
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div role="alert" style={{ ...card, borderColor: '#fca5a5', background: '#fef2f2', color: '#991b1b' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 600 }}>{error}</p>
          <button style={button} onClick={loadData}>
            Retry
          </button>
        </div>
      )}

      {/* BATCHES TABLE */}
      {loading ? (
        <div style={{ ...card, textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <Loader2 className="spin" size={24} style={{ margin: '0 auto 12px' }} />
          Loading daily production batches…
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface-hover, #f8fafc)', borderBottom: '1px solid var(--border)' }}>
                {['Batch # & Date', 'Recipe / Sub-Recipe', 'Locations', 'Planned Yield', 'Actual Yield & Variance', 'Status', 'Logged By', 'Actions'].map((h, i) => (
                  <th key={i} style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map(b => {
                const variance = b.yield_variance_percentage != null ? Number(b.yield_variance_percentage) : null;
                const isCompleted = b.status === 'COMPLETED';
                const isInProgress = b.status === 'IN_PROGRESS';
                const isDraft = b.status === 'DRAFT';

                let varianceColor = '#16a34a';
                if (variance !== null && Math.abs(variance) > 5) varianceColor = '#dc2626';
                else if (variance !== null && Math.abs(variance) > 2) varianceColor = '#d97706';

                return (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Batch Number & Date */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-main)' }}>
                        {b.batch_number}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {b.batch_date}
                      </div>
                    </td>

                    {/* Recipe */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{b.recipe?.name || 'Recipe unavailable'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {b.recipe?.recipe_code} &bull; Output: {b.output_item?.name || 'Prep Item'}
                      </div>
                    </td>

                    {/* Locations */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span>{b.source_location?.name || 'Kitchen'}</span>
                        <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                        <strong>{b.destination_location?.name || 'Storage'}</strong>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        Branch: {branches.find(br => br.id === b.branch_id || br.name === b.branch_id)?.name || b.branch_id || 'Main'}
                      </div>
                    </td>

                    {/* Planned Yield */}
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                      {b.planned_yield_quantity} {b.planned_yield_unit}
                    </td>

                    {/* Actual Yield & Variance */}
                    <td style={{ padding: '14px 16px' }}>
                      {isCompleted ? (
                        <div>
                          <strong>
                            {b.actual_yield_quantity} {b.actual_yield_unit}
                          </strong>
                          {variance !== null && (
                            <div style={{ color: varianceColor, fontSize: 12, fontWeight: 600 }}>
                              {variance >= 0 ? `+${variance.toFixed(1)}%` : `${variance.toFixed(1)}%`}
                              {b.yield_variance_reason && ` (${b.yield_variance_reason})`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending completion</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 9px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background:
                            isCompleted ? '#dcfce7' :
                            isInProgress ? '#ffedd5' :
                            isDraft ? '#e0f2fe' : '#fee2e2',
                          color:
                            isCompleted ? '#166534' :
                            isInProgress ? '#9a3412' :
                            isDraft ? '#0369a1' : '#991b1b'
                        }}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>

                    {/* User */}
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {b.produced_by_name || b.created_by_name || 'Admin'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* View Details */}
                        <button
                          type="button"
                          style={{ ...button, padding: '6px 10px' }}
                          title="View batch breakdown & lots"
                          onClick={() => setDetailsModalBatch(b)}
                        >
                          <Eye size={14} />
                        </button>

                        {/* Complete button for in-progress batches */}
                        {isInProgress && canEdit && (
                          <button
                            type="button"
                            style={{ ...primary, padding: '6px 12px', background: '#16a34a', borderColor: '#16a34a' }}
                            title="Complete this batch and record actual yield"
                            onClick={() => {
                              setCompleteModalBatch(b);
                              setCompleteActualYield(String(b.planned_yield_quantity));
                              setCompleteVarianceReason('');
                            }}
                          >
                            <Check size={14} /> Complete
                          </button>
                        )}

                        {/* Cancel button for draft/in-progress */}
                        {(isDraft || isInProgress) && canEdit && (
                          <button
                            type="button"
                            style={{ ...button, padding: '6px 10px', color: '#dc2626' }}
                            title="Cancel batch"
                            onClick={() => setCancelModalBatch(b)}
                          >
                            <Ban size={14} />
                          </button>
                        )}

                        {/* Reverse button for completed batches */}
                        {isCompleted && canEdit && (
                          <button
                            type="button"
                            style={{ ...button, padding: '6px 10px', color: 'var(--text-muted)' }}
                            title="Reverse completed batch and return stock"
                            onClick={() => handleReverseBatch(b)}
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredBatches.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No daily production batches found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD NEW DAILY PRODUCTION */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 720,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Flame color="#ea580c" /> Record Daily Production
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  Select the recipe and enter how much was prepped. Supports Kitchen, Bar, Retail, and all production departments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Recipe Selector with Search & Department Filters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={label}>Select Production Recipe *</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Showing {filteredRecipesForModal.length} of {recipes.length} recipes
                  </span>
                </div>

                {/* Search Recipe Input */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      style={{ ...input, paddingLeft: 34 }}
                      placeholder="Search recipe by name, code, or output item..."
                      value={recipeSearchQuery}
                      onChange={e => setRecipeSearchQuery(e.target.value)}
                    />
                  </div>
                  {recipeSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRecipeSearchQuery('')}
                      style={{ ...button, padding: '0 12px', fontSize: 12 }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Department Filter Pills */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  {availableDepts.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRecipeDeptFilter(d)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 14,
                        border: recipeDeptFilter === d ? '1px solid #ea580c' : '1px solid var(--border)',
                        background: recipeDeptFilter === d ? '#ffedd5' : '#f8fafc',
                        color: recipeDeptFilter === d ? '#c2410c' : 'var(--text-muted)',
                        fontWeight: recipeDeptFilter === d ? 700 : 500,
                        fontSize: 11,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <select
                  style={{ ...input, fontWeight: selectedRecipeId ? 600 : 400 }}
                  value={selectedRecipeId}
                  onChange={e => setSelectedRecipeId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Recipe to Prep ({filteredRecipesForModal.length} available) --</option>
                  {filteredRecipesForModal.map(r => {
                    const dept = r.output_item?.department || r.department || 'Kitchen';
                    return (
                      <option key={r.id} value={r.id}>
                        [{dept}] {r.name} {r.recipe_code ? `(${r.recipe_code})` : ''} &mdash; Base Yield: {r.target_yield_quantity} {r.yield_unit}
                      </option>
                    );
                  })}
                </select>
              </div>

              {activeRecipe && (
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <span>
                      <strong>Output Inventory Item:</strong> {activeRecipe.output_item?.name || 'Output item'}
                    </span>
                    <span>
                      <strong>Standard Batch:</strong> {activeRecipe.target_yield_quantity} {activeRecipe.yield_unit}
                    </span>
                  </div>
                  {activeRecipe.instructions && (
                    <div style={{ marginTop: 8, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Instructions: {activeRecipe.instructions}
                    </div>
                  )}
                </div>
              )}

              {/* Yield & Date Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <label style={label}>
                  Batch Date
                  <input
                    type="date"
                    style={input}
                    value={formBatchDate}
                    onChange={e => setFormBatchDate(e.target.value)}
                    required
                  />
                </label>

                <label style={label}>
                  Branch
                  <select
                    style={input}
                    value={formBranchId}
                    onChange={e => setFormBranchId(e.target.value)}
                    required
                  >
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={label}>
                  Planned Yield to Produce *
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      style={input}
                      placeholder="e.g. 10"
                      value={formPlannedYield}
                      onChange={e => {
                        setFormPlannedYield(e.target.value);
                        if (directComplete) setFormActualYield(e.target.value);
                      }}
                      required
                    />
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f1f5f9', borderRadius: 6, fontWeight: 600 }}>
                      {activeRecipe?.yield_unit || 'units'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Batch Multiplier / Scale Selector */}
              {activeRecipe && (
                <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>Batch Multiplier / Scale</span>
                    {formPlannedYield && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', background: '#fff7ed', padding: '2px 8px', borderRadius: 4, border: '1px solid #fed7aa' }}>
                        {((Number(formPlannedYield) || 0) / (Number(activeRecipe.target_yield_quantity) || 1)).toFixed(2)}x batches (Base: {activeRecipe.target_yield_quantity} {activeRecipe.yield_unit || 'units'})
                      </span>
                    )}
                  </div>

                  {/* Preset Choices: 0.5, 1, 2, 3, 5x */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { key: '0.5', label: '0.5x' },
                      { key: '1', label: '1x' },
                      { key: '2', label: '2x' },
                      { key: '3', label: '3x' },
                      { key: '5', label: '5x' }
                    ].map(m => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => handlePresetSelect(m.key)}
                        style={{
                          flex: 1,
                          padding: '7px 0',
                          borderRadius: 6,
                          border: selectedPreset === m.key ? '1px solid #c2410c' : '1px solid var(--border)',
                          background: selectedPreset === m.key ? '#ea580c' : '#ffffff',
                          color: selectedPreset === m.key ? '#fff' : 'inherit',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Empty field to enter number of batches */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Or enter number of batches:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      style={{ ...input, padding: '4px 8px', height: 30, fontSize: 13, flex: 1 }}
                      placeholder="Enter number of batches (e.g. 4, 10, 1.5)"
                      value={customBatches}
                      onChange={e => handleCustomBatchesChange(e.target.value)}
                    />
                    {customBatches && (
                      <button
                        type="button"
                        onClick={() => handlePresetSelect('1')}
                        style={{ padding: '4px 8px', fontSize: 11, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Locations Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                <label style={label}>
                  Source Prep Location (Where raw items are taken) *
                  <select
                    style={input}
                    value={formSourceLocId}
                    onChange={e => setFormSourceLocId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Prep Location --</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={label}>
                  Destination Storage Location (Where prep is stored) *
                  <select
                    style={input}
                    value={formDestLocId}
                    onChange={e => setFormDestLocId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Storage Location --</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Scaled Ingredients Preview */}
              {scaledIngredients.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Scaled Raw Ingredients Required ({scaledIngredients.length})</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                      Scale factor: {((Number(formPlannedYield) || 0) / (Number(activeRecipe?.target_yield_quantity) || 1)).toFixed(2)}x
                    </span>
                  </div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Ingredient</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Standard Recipe Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Scaled Quantity Needed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scaledIngredients.map((ing, i) => (
                          <tr key={i} style={{ borderBottom: i < scaledIngredients.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <strong>{ing.itemName}</strong>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                              {ing.baseQty} {ing.unit}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0284c7' }}>
                              {ing.scaledQty} {ing.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Execution Mode Radio / Direct Complete */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', gap: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="execMode"
                      checked={directComplete}
                      onChange={() => setDirectComplete(true)}
                    />
                    Record & Complete Now (1-Step Fast Entry)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="execMode"
                      checked={!directComplete}
                      onChange={() => setDirectComplete(false)}
                    />
                    Start as Work Order (Complete Later)
                  </label>
                </div>

                {directComplete && (
                  <div style={{ marginTop: 14, background: '#f0fdf4', padding: 14, borderRadius: 8, border: '1px solid #bbf7d0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                    <label style={label}>
                      Actual Yield Produced
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          step="any"
                          style={input}
                          value={formActualYield}
                          onChange={e => setFormActualYield(e.target.value)}
                          required={directComplete}
                        />
                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 10px', background: '#dcfce7', borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                          {activeRecipe?.yield_unit || ''}
                        </span>
                      </div>
                    </label>

                    <label style={label}>
                      Variance Reason (Optional)
                      <input
                        style={input}
                        placeholder="e.g. slight spillage, extra moisture reduction"
                        value={formVarianceReason}
                        onChange={e => setFormVarianceReason(e.target.value)}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Notes */}
              <label style={label}>
                Batch Notes
                <input
                  style={input}
                  placeholder="Optional notes, batch code notes, or kitchen comments"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                />
              </label>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  style={button}
                  disabled={submitting}
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={primary}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="spin" size={16} /> Recording Batch…
                    </>
                  ) : directComplete ? (
                    <>
                      <Check size={16} /> Record & Complete Batch
                    </>
                  ) : (
                    <>
                      <Play size={16} /> Start Work Order
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: COMPLETE IN-PROGRESS BATCH */}
      {/* ========================================================================= */}
      {completeModalBatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}
          >
            <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Complete Production Batch</h2>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              Batch: <strong>{completeModalBatch.batch_number}</strong> &bull; {completeModalBatch.recipe?.name}
            </p>

            <form onSubmit={handleCompleteBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 13 }}>
                Planned yield was: <strong>{completeModalBatch.planned_yield_quantity} {completeModalBatch.planned_yield_unit}</strong>
              </div>

              <label style={label}>
                Actual Yield Quantity Produced *
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    style={input}
                    value={completeActualYield}
                    onChange={e => setCompleteActualYield(e.target.value)}
                    required
                  />
                  <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: '#f1f5f9', borderRadius: 6, fontWeight: 600 }}>
                    {completeModalBatch.planned_yield_unit}
                  </span>
                </div>
              </label>

              <label style={label}>
                Yield Variance Reason
                <input
                  style={input}
                  placeholder="e.g. Moisture loss, trimmed edges, spilled portion"
                  value={completeVarianceReason}
                  onChange={e => setCompleteVarianceReason(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  style={button}
                  disabled={completing}
                  onClick={() => setCompleteModalBatch(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ ...primary, background: '#16a34a', borderColor: '#16a34a' }}
                  disabled={completing}
                >
                  {completing ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Complete & Move Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CANCEL WORK ORDER */}
      {/* ========================================================================= */}
      {cancelModalBatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 440,
              width: '100%',
              padding: 24
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#dc2626' }}>Cancel Production Work Order</h2>
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13 }}>
              Are you sure you want to cancel batch <strong>{cancelModalBatch.batch_number}</strong>? Since it has not been completed, no inventory has been deducted.
            </p>

            <label style={label}>
              Cancellation Reason *
              <textarea
                style={{ ...input, minHeight: 80 }}
                placeholder="e.g. Equipment breakdown, prep schedule adjusted"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                required
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" style={button} onClick={() => setCancelModalBatch(null)}>
                Keep Batch
              </button>
              <button
                type="button"
                style={{ ...primary, background: '#dc2626', borderColor: '#dc2626' }}
                onClick={handleCancelBatchSubmit}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: BATCH DETAILS VIEW */}
      {/* ========================================================================= */}
      {detailsModalBatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 680,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Production Batch Details</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Batch #: <strong>{detailsModalBatch.batch_number}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModalBatch(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Recipe:</span>
                <div><strong>{detailsModalBatch.recipe?.name}</strong> ({detailsModalBatch.recipe?.recipe_code})</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Output Item:</span>
                <div><strong>{detailsModalBatch.output_item?.name || 'Prep Item'}</strong></div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Batch Date:</span>
                <div>{detailsModalBatch.batch_date}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Locations:</span>
                <div>{detailsModalBatch.source_location?.name || 'Kitchen'} &rarr; {detailsModalBatch.destination_location?.name || 'Storage'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Branch:</span>
                <div><strong>{branches.find(br => br.id === detailsModalBatch.branch_id || br.name === detailsModalBatch.branch_id)?.name || detailsModalBatch.branch_id || 'Main'}</strong></div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Planned Yield:</span>
                <div>{detailsModalBatch.planned_yield_quantity} {detailsModalBatch.planned_yield_unit}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Actual Yield:</span>
                <div>{detailsModalBatch.actual_yield_quantity != null ? `${detailsModalBatch.actual_yield_quantity} ${detailsModalBatch.actual_yield_unit}` : 'N/A'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Yield Variance:</span>
                <div style={{ fontWeight: 600 }}>
                  {detailsModalBatch.yield_variance_percentage != null ? `${detailsModalBatch.yield_variance_percentage}%` : 'N/A'}
                  {detailsModalBatch.yield_variance_reason && ` (${detailsModalBatch.yield_variance_reason})`}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <div><strong>{detailsModalBatch.status}</strong></div>
              </div>
              {detailsModalBatch.total_input_cost != null && (
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Total Cost:</span>
                  <div><strong>${Number(detailsModalBatch.total_input_cost).toFixed(2)}</strong> (${Number(detailsModalBatch.produced_unit_cost || 0).toFixed(4)}/unit)</div>
                </div>
              )}
            </div>

            {/* Ingredients Consumed */}
            {detailsModalBatch.items && detailsModalBatch.items.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 14, margin: '0 0 10px' }}>Ingredients Consumed ({detailsModalBatch.items.length})</h3>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Planned</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actual Consumed</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsModalBatch.items.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px' }}>{it.item_name || it.item_id}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>{it.planned_quantity} {it.planned_unit}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                            {it.actual_quantity != null ? `${it.actual_quantity} ${it.actual_unit || it.planned_unit}` : `${it.planned_quantity} ${it.planned_unit}`}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            {it.total_cost != null ? `$${Number(it.total_cost).toFixed(2)}` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detailsModalBatch.notes && (
              <div style={{ marginTop: 16, background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 13 }}>
                <strong>Notes:</strong> {detailsModalBatch.notes}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button type="button" style={button} onClick={() => setDetailsModalBatch(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
