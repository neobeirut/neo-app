import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import {
  TrendingUp,
  BarChart2,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Layers,
  Calendar,
  MapPin,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Package,
  Activity,
  Trash2,
  Search,
  Filter,
  Flame,
  Check,
  Zap,
  Building,
  ChefHat
} from 'lucide-react';

export type VelocityClassification = 
  | 'ALL'
  | 'FAST_MOVING'
  | 'OPTIMAL'
  | 'SLOW_MOVING'
  | 'DEAD_STOCK'
  | 'ZERO_STOCK'
  | 'NEGATIVE_ANOMALY';

export const VELOCITY_FILTER_OPTIONS: { value: VelocityClassification; label: string }[] = [
  { value: 'ALL', label: 'All Classifications' },
  { value: 'FAST_MOVING', label: 'Fast Moving' },
  { value: 'OPTIMAL', label: 'Optimal' },
  { value: 'SLOW_MOVING', label: 'Slow Moving' },
  { value: 'DEAD_STOCK', label: 'Dead Stock' },
  { value: 'ZERO_STOCK', label: 'Zero Stock' },
  { value: 'NEGATIVE_ANOMALY', label: 'Negative Anomaly' }
];

interface Props {
  user: any;
  permissions?: any;
}

export default function InventoryIntelligenceDashboardScreen({ user, permissions }: Props) {
  // Navigation / Tab state
  const [activeTab, setActiveTab] = useState<
    'overview' | 'valuation' | 'cogs' | 'waste' | 'expiry' | 'turnover' | 'production' | 'ppv' | 'exceptions' | 'branches'
  >('overview');

  // Filter States
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [availableBranches, setAvailableBranches] = useState<{ id: string; name: string }[]>([]);
  const [datePreset, setDatePreset] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [expiryDaysThreshold, setExpiryDaysThreshold] = useState<number>(30);
  const [ppvMonths, setPpvMonths] = useState<number>(6);
  const [turnoverFilter, setTurnoverFilter] = useState<VelocityClassification>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Permission authorization for Snapshot Administration (separate from reporting)
  const canAdministerSnapshots = useMemo(() => {
    const role = (user?.role || '').toLowerCase();
    const isAdmin = role.includes('admin') || role === 'owner' || role === 'superadmin';
    const hasManageInventory = 
      permissions?.can_manage_inventory === true ||
      user?.permissions?.can_manage_inventory === true ||
      user?.admin_permissions?.can_manage_inventory === true;
    return isAdmin || hasManageInventory;
  }, [user, permissions]);

  // Loading & Action states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [recalculatingSnapshot, setRecalculatingSnapshot] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data States for all 9 Reports
  const [valuationData, setValuationData] = useState<any>(null);
  const [cogsData, setCogsData] = useState<any>(null);
  const [wasteData, setWasteData] = useState<any>(null);
  const [expiryData, setExpiryData] = useState<any>(null);
  const [turnoverData, setTurnoverData] = useState<any>(null);
  const [yieldData, setYieldData] = useState<any>(null);
  const [ppvData, setPpvData] = useState<any>(null);
  const [exceptionsData, setExceptionsData] = useState<any>(null);
  const [branchCompData, setBranchCompData] = useState<any>(null);

  // Handle Preset Date Change
  const handleDatePreset = (preset: '7d' | '30d' | '90d') => {
    setDatePreset(preset);
    const end = new Date();
    const start = new Date();
    if (preset === '7d') start.setDate(end.getDate() - 7);
    if (preset === '30d') start.setDate(end.getDate() - 30);
    if (preset === '90d') start.setDate(end.getDate() - 90);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Load Branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await api.branches.list();
        if (res.success && Array.isArray(res.data)) {
          // If user is branch-restricted, filter branches
          if (user?.branch && user.branch.toLowerCase() !== 'all' && user.role?.toLowerCase() !== 'admin' && user.role?.toLowerCase() !== 'superadmin' && user.role?.toLowerCase() !== 'owner') {
            const userBranch = res.data.filter((b: any) => b.name === user.branch || b.id === user.branch_id);
            setAvailableBranches(userBranch);
            if (userBranch.length > 0) setSelectedBranch(userBranch[0].id);
          } else {
            setAvailableBranches(res.data);
          }
        }
      } catch (err) {
        console.error('Error loading branches:', err);
      }
    }
    loadBranches();
  }, [user]);

  // Main Data Fetcher
  const loadDashboardData = async () => {
    setLoading(true);
    setActionMessage(null);
    const branchParam = selectedBranch === 'ALL' ? undefined : selectedBranch;

    try {
      const [
        valRes,
        cogsRes,
        wasteRes,
        expRes,
        turnRes,
        yieldRes,
        ppvRes,
        excepRes,
        compRes
      ] = await Promise.all([
        api.inventory.getInventoryValuationReport({ branch_id: branchParam }),
        api.inventory.getCogsAndVarianceReport({ branch_id: branchParam, start_date: startDate, end_date: endDate }),
        api.inventory.getWasteAnalyticsReport({ branch_id: branchParam, start_date: startDate, end_date: endDate }),
        api.inventory.getExpiryRiskReport({ branch_id: branchParam, days_threshold: expiryDaysThreshold }),
        api.inventory.getStockDaysAndTurnoverReport({ branch_id: branchParam, period_days: datePreset === '7d' ? 7 : datePreset === '90d' ? 90 : 30 }),
        api.inventory.getProductionYieldAnalyticsReport({ branch_id: branchParam, start_date: startDate, end_date: endDate }),
        api.inventory.getPurchasePriceTrendsReport({ months: ppvMonths }),
        api.inventory.getInventoryHealthAndExceptionsReport({ branch_id: branchParam }),
        api.inventory.getBranchComparisonDashboard({ start_date: startDate, end_date: endDate })
      ]);

      if (valRes.success) setValuationData(valRes.data);
      if (cogsRes.success) setCogsData(cogsRes.data);
      if (wasteRes.success) setWasteData(wasteRes.data);
      if (expRes.success) setExpiryData(expRes.data);
      if (turnRes.success) setTurnoverData(turnRes.data);
      if (yieldRes.success) setYieldData(yieldRes.data);
      if (ppvRes.success) setPpvData(ppvRes.data);
      if (excepRes.success) setExceptionsData(excepRes.data);
      if (compRes.success) setBranchCompData(compRes.data);

    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
      setActionMessage({ type: 'error', text: err.message || 'Error loading dashboard metrics' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [selectedBranch, startDate, endDate, expiryDaysThreshold, ppvMonths]);

  // Recalculate Snapshot Action
  const handleRecalculateSnapshot = async () => {
    if (!window.confirm('Trigger authoritative snapshot recalculation for yesterday?')) return;
    setRecalculatingSnapshot(true);
    setActionMessage(null);
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const res = await api.inventory.captureDailyInventorySnapshot({
        snapshot_date: yesterday.toISOString().split('T')[0],
        force_recalculate: true
      });
      if (res.success) {
        setActionMessage({ type: 'success', text: `Snapshot recalculated successfully (${res.data?.row_count || 0} rows captured).` });
        loadDashboardData();
      } else {
        setActionMessage({ type: 'error', text: `Recalculation failed: ${res.error}` });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `Recalculation error: ${err.message}` });
    } finally {
      setRecalculatingSnapshot(false);
    }
  };

  // Turnover / DOH Velocity Breakdown calculation
  const velocityCounts = useMemo(() => {
    const counts = {
      FAST_MOVING: 0,
      OPTIMAL: 0,
      SLOW_MOVING: 0,
      DEAD_STOCK: 0,
      ZERO_STOCK: 0,
      NEGATIVE_ANOMALY: 0
    };
    if (turnoverData?.items && Array.isArray(turnoverData.items)) {
      turnoverData.items.forEach((item: any) => {
        const cls = item.velocity_classification as keyof typeof counts;
        if (counts[cls] !== undefined) {
          counts[cls]++;
        }
      });
    }
    return counts;
  }, [turnoverData]);

  // Filtered Turnover items
  const filteredTurnoverItems = useMemo(() => {
    if (!turnoverData?.items) return [];
    return turnoverData.items.filter((item: any) => {
      const matchesSearch = !searchQuery || 
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.department.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = turnoverFilter === 'ALL' || item.velocity_classification === turnoverFilter;
      return matchesSearch && matchesFilter;
    });
  }, [turnoverData, turnoverFilter, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Inventory Intelligence & Cost Control</h1>
              <p className="text-sm text-slate-400">
                Authoritative food cost analysis, valuation, variance diagnostics & multi-branch KPI benchmarking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { setRefreshing(true); loadDashboardData(); }}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium border border-slate-700 transition"
            title="Refresh analytics data"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          {canAdministerSnapshots && (
            <button
              onClick={handleRecalculateSnapshot}
              disabled={recalculatingSnapshot || loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium shadow-sm transition"
              title="Trigger administrative EOD snapshot recalculation"
            >
              <Activity size={15} className={recalculatingSnapshot ? 'animate-spin' : ''} />
              {recalculatingSnapshot ? 'Calculating...' : 'Recalculate Snapshot'}
            </button>
          )}
        </div>
      </div>

      {/* Alert / Feedback message */}
      {actionMessage && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
          actionMessage.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' 
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Global Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Branch Scope Selector */}
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-slate-400" />
          <span className="text-xs uppercase font-semibold text-slate-400">Branch:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Authorized Branches</option>
            {availableBranches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Date Presets & Custom Range */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-xs uppercase font-semibold text-slate-400">Period:</span>
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => handleDatePreset('7d')}
              className={`px-3 py-1 rounded-md transition ${datePreset === '7d' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              7D
            </button>
            <button
              onClick={() => handleDatePreset('30d')}
              className={`px-3 py-1 rounded-md transition ${datePreset === '30d' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              30D
            </button>
            <button
              onClick={() => handleDatePreset('90d')}
              className={`px-3 py-1 rounded-md transition ${datePreset === '90d' ? 'bg-amber-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
            >
              90D
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setDatePreset('custom'); }}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 focus:outline-none"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setDatePreset('custom'); }}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* EXECUTIVE KPI AREA */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
        {/* Gross Valuation */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Gross Positive Value</span>
            <Package size={14} className="text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-400">
              ${(valuationData?.gross_positive_valuation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Physical stock asset valuation</div>
          </div>
        </div>

        {/* Negative Distortion */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Negative Distortion</span>
            <AlertTriangle size={14} className="text-rose-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-rose-400">
              ${(valuationData?.negative_stock_distortion ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Sub-zero ledger distortion</div>
          </div>
        </div>

        {/* Net Book Value */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Net Book Value</span>
            <DollarSign size={14} className="text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-cyan-400">
              ${(valuationData?.net_book_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Gross minus distortion</div>
          </div>
        </div>

        {/* Actual Food Usage */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Actual Food Usage</span>
            <Flame size={14} className="text-amber-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-400">
              ${(cogsData?.actual_food_usage ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {cogsData?.actual_food_cost_percentage !== null ? `${cogsData.actual_food_cost_percentage}% of sales` : 'Sales COGS + Losses'}
            </div>
          </div>
        </div>

        {/* Food Cost Variance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Food Cost Variance</span>
            <Activity size={14} className={(cogsData?.food_cost_variance_dollar || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'} />
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-bold ${(cogsData?.food_cost_variance_dollar || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              ${(cogsData?.food_cost_variance_dollar ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {cogsData?.food_cost_variance_percentage !== null ? `${cogsData.food_cost_variance_percentage}% of sales` : 'Operational loss impact'}
            </div>
          </div>
        </div>

        {/* Theoretical Sales COGS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Theoretical COGS</span>
            <BarChart2 size={14} className="text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-indigo-400">
              ${(cogsData?.theoretical_sales_cogs ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {cogsData?.theoretical_food_cost_percentage !== null ? `${cogsData.theoretical_food_cost_percentage}% ideal target` : 'BOM sales consumption'}
            </div>
          </div>
        </div>

        {/* Recorded Waste */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Recorded Waste</span>
            <Trash2 size={14} className="text-orange-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-orange-400">
              ${(wasteData?.total_waste_cost ?? cogsData?.recorded_waste_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Net of reversals</div>
          </div>
        </div>

        {/* Expiry Risk Value */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Expiry Risk ({expiryDaysThreshold}d)</span>
            <Clock size={14} className="text-yellow-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-yellow-400">
              ${(expiryData?.total_at_risk_value_usd ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{expiryData?.total_at_risk_lots_count ?? 0} lots at risk</div>
          </div>
        </div>

        {/* Net Sales Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Net Sales Revenue</span>
            <TrendingUp size={14} className="text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-blue-400">
              ${(cogsData?.net_sales_revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Completed minus refunds</div>
          </div>
        </div>

        {/* Shrinkage / Overage */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Shrinkage / Overage</span>
            <ScaleIcon size={14} className="text-purple-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-purple-400">
              ${(cogsData?.shrinkage_overage_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Signed stock adjustments</div>
          </div>
        </div>
      </div>

      {/* VELOCITY CLASSIFICATION TIERS (Canonical 6-Bucket Ribbon) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="text-xs uppercase font-semibold text-slate-400 mb-3 flex items-center gap-2">
          <Zap size={14} className="text-amber-400" />
          Inventory Velocity & Health Classifications
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => { setTurnoverFilter('FAST_MOVING'); setActiveTab('turnover'); }}
            className={`p-3 rounded-lg border text-left transition ${turnoverFilter === 'FAST_MOVING' && activeTab === 'turnover' ? 'bg-emerald-950/60 border-emerald-500' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}
          >
            <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Fast Moving</div>
            <div className="text-xl font-bold text-white mt-1">{velocityCounts.FAST_MOVING}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">DOH &lt; Fast threshold</div>
          </button>

          <button
            onClick={() => { setTurnoverFilter('OPTIMAL'); setActiveTab('turnover'); }}
            className={`p-3 rounded-lg border text-left transition ${turnoverFilter === 'OPTIMAL' && activeTab === 'turnover' ? 'bg-cyan-950/60 border-cyan-500' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}
          >
            <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">Optimal</div>
            <div className="text-xl font-bold text-white mt-1">{velocityCounts.OPTIMAL}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Balanced stock range</div>
          </button>

          <button
            onClick={() => { setTurnoverFilter('SLOW_MOVING'); setActiveTab('turnover'); }}
            className={`p-3 rounded-lg border text-left transition ${turnoverFilter === 'SLOW_MOVING' && activeTab === 'turnover' ? 'bg-yellow-950/60 border-yellow-500' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}
          >
            <div className="text-[11px] font-semibold text-yellow-400 uppercase tracking-wider">Slow Moving</div>
            <div className="text-xl font-bold text-white mt-1">{velocityCounts.SLOW_MOVING}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">DOH &gt; Slow threshold</div>
          </button>

          <button
            onClick={() => { setTurnoverFilter('DEAD_STOCK'); setActiveTab('turnover'); }}
            className={`p-3 rounded-lg border text-left transition ${turnoverFilter === 'DEAD_STOCK' && activeTab === 'turnover' ? 'bg-rose-950/60 border-rose-500' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}
          >
            <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Dead Stock</div>
            <div className="text-xl font-bold text-white mt-1">{velocityCounts.DEAD_STOCK}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Stock &gt; 0, 0 Consumption</div>
          </button>

          <button
            onClick={() => { setTurnoverFilter('ZERO_STOCK'); setActiveTab('turnover'); }}
            className={`p-3 rounded-lg border text-left transition ${turnoverFilter === 'ZERO_STOCK' && activeTab === 'turnover' ? 'bg-slate-800 border-slate-600' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}
          >
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Zero Stock</div>
            <div className="text-xl font-bold text-white mt-1">{velocityCounts.ZERO_STOCK}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Depleted inventory</div>
          </button>

          <button
            onClick={() => { setTurnoverFilter('NEGATIVE_ANOMALY'); setActiveTab('turnover'); }}
            className={`p-3 rounded-lg border text-left transition ${turnoverFilter === 'NEGATIVE_ANOMALY' && activeTab === 'turnover' ? 'bg-purple-950/60 border-purple-500' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}
          >
            <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Negative Anomaly</div>
            <div className="text-xl font-bold text-white mt-1">{velocityCounts.NEGATIVE_ANOMALY}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Sub-zero ledger position</div>
          </button>
        </div>
      </div>

      {/* DASHBOARD NAVIGATION TABS */}
      <div className="border-b border-slate-800 flex items-center gap-1 overflow-x-auto text-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'overview' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Executive Summary
        </button>
        <button
          onClick={() => setActiveTab('valuation')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'valuation' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Valuation & Categories
        </button>
        <button
          onClick={() => setActiveTab('cogs')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'cogs' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Food Cost & Variance
        </button>
        <button
          onClick={() => setActiveTab('waste')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'waste' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Waste & Shrinkage
        </button>
        <button
          onClick={() => setActiveTab('expiry')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'expiry' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Expiry Risks (FEFO)
        </button>
        <button
          onClick={() => setActiveTab('turnover')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'turnover' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          DOH & Turnover
        </button>
        <button
          onClick={() => setActiveTab('production')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'production' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Production Yield
        </button>
        <button
          onClick={() => setActiveTab('ppv')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'ppv' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          PPV & Price Trends
        </button>
        <button
          onClick={() => setActiveTab('exceptions')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'exceptions' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Exceptions & Alerts
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          className={`px-4 py-2.5 font-medium border-b-2 transition whitespace-nowrap ${activeTab === 'branches' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Branch Comparison
        </button>
      </div>

      {/* TAB CONTENT AREAS */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Food Cost Reconciliation Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <BarChart2 size={18} className="text-amber-400" />
                Food Cost Variance Diagnostics
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">Theoretical Sales COGS (BOM Standard):</span>
                  <span className="font-semibold text-indigo-400">
                    ${(cogsData?.theoretical_sales_cogs ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">+ Recorded Operational Waste:</span>
                  <span className="font-semibold text-orange-400">
                    ${(cogsData?.recorded_waste_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">+ Signed Stock Shrinkage / (Overage):</span>
                  <span className="font-semibold text-purple-400">
                    ${(cogsData?.shrinkage_overage_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 bg-slate-800/50 px-3 rounded-lg font-bold">
                  <span className="text-white">= Actual Food Usage (Restaurant Consumption):</span>
                  <span className="text-amber-400">
                    ${(cogsData?.actual_food_usage ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-slate-700/60 pt-3">
                  <span className="text-slate-300 font-medium">Food Cost Variance (Actual - Theoretical):</span>
                  <span className={`font-bold ${(cogsData?.food_cost_variance_dollar || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ${(cogsData?.food_cost_variance_dollar ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-xs text-slate-500 italic mt-2">
                  * Production transformation input (${(cogsData?.production_transformation_input_cost ?? 0).toLocaleString()}) is capitalized into finished prep inventory and excluded from immediate Restaurant COGS.
                </div>
              </div>
            </div>

            {/* Valuation Health & Distortion Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <ShieldAlert size={18} className="text-cyan-400" />
                Physical Inventory Integrity & Negative Distortion
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">Gross Physical Stock (Quantity &gt; 0):</span>
                  <span className="font-semibold text-emerald-400">
                    ${(valuationData?.gross_positive_valuation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">Negative Stock Distortion (Quantity &lt; 0):</span>
                  <span className="font-semibold text-rose-400">
                    -${(valuationData?.negative_stock_distortion ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 bg-slate-800/50 px-3 rounded-lg font-bold">
                  <span className="text-white">Net Financial Book Value:</span>
                  <span className="text-cyan-400">
                    ${(valuationData?.net_book_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-slate-700/60 pt-3">
                  <span className="text-slate-300 font-medium">Negative Stock Items Count:</span>
                  <span className="font-bold text-rose-400">{valuationData?.negative_items_count ?? 0} items</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400 text-xs">Active Physical Lots Valuation:</span>
                  <span className="text-xs text-slate-300">${(valuationData?.active_lots_valuation ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. VALUATION TAB */}
      {activeTab === 'valuation' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-white text-base">Category Valuation Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Department / Category</th>
                  <th className="py-3 px-4 text-right">Items Count</th>
                  <th className="py-3 px-4 text-right">Positive Valuation ($)</th>
                  <th className="py-3 px-4 text-right">Negative Distortion ($)</th>
                  <th className="py-3 px-4 text-right">Net Value ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {valuationData?.category_breakdown && valuationData.category_breakdown.length > 0 ? (
                  valuationData.category_breakdown.map((cat: any, idx: number) => {
                    const net = Number(cat.positive_valuation) - Number(cat.negative_distortion);
                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-medium text-white">{cat.category}</td>
                        <td className="py-3 px-4 text-right text-slate-300">{cat.item_count}</td>
                        <td className="py-3 px-4 text-right font-medium text-emerald-400">${Number(cat.positive_valuation).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right font-medium text-rose-400">
                          {Number(cat.negative_distortion) > 0 ? `-$${Number(cat.negative_distortion).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '$0.00'}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-cyan-400">${net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">No category valuation data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. COGS & FOOD COST TAB */}
      {activeTab === 'cogs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-white text-base">Theoretical vs Actual COGS Breakdown</h3>
            <span className="text-xs text-slate-400">Period: {cogsData?.start_date} to {cogsData?.end_date}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-semibold">Net Sales Revenue</span>
              <div className="text-xl font-bold text-blue-400 mt-1">${(cogsData?.net_sales_revenue ?? 0).toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-semibold">Theoretical Food Cost %</span>
              <div className="text-xl font-bold text-indigo-400 mt-1">{cogsData?.theoretical_food_cost_percentage ?? 0}%</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-semibold">Actual Food Cost %</span>
              <div className="text-xl font-bold text-amber-400 mt-1">{cogsData?.actual_food_cost_percentage ?? 0}%</div>
            </div>
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-semibold">Variance vs Theoretical</span>
              <div className={`text-xl font-bold mt-1 ${(cogsData?.variance_vs_theoretical_percentage || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {cogsData?.variance_vs_theoretical_percentage ?? 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. WASTE & SHRINKAGE TAB */}
      {activeTab === 'waste' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Waste by Type */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white">Waste by Reason Code</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Reason Code</th>
                      <th className="py-2.5 px-3 text-right">Cost ($)</th>
                      <th className="py-2.5 px-3 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {wasteData?.by_type && wasteData.by_type.length > 0 ? (
                      wasteData.by_type.map((t: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-medium text-slate-200">{t.reason_code}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-orange-400">${Number(t.cost).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right text-slate-400">{t.percentage}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={3} className="py-4 text-center text-slate-500">No waste recorded in period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Wasted Items */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white">Top Wasted Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Total Cost ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {wasteData?.top_items && wasteData.top_items.length > 0 ? (
                      wasteData.top_items.map((it: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-medium text-white">{it.name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{it.department}</td>
                          <td className="py-2.5 px-3 text-right text-slate-300">{it.quantity} {it.unit}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-orange-400">${Number(it.total_cost).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="py-4 text-center text-slate-500">No item waste records found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. EXPIRY RISK TAB */}
      {activeTab === 'expiry' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white text-base">FEFO Multi-Lot Expiry Risk Analytics</h3>
              <p className="text-xs text-slate-400">Allocates historical cumulative consumption against earlier lots before assessing later lot risk.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Threshold:</span>
              <select
                value={expiryDaysThreshold}
                onChange={(e) => setExpiryDaysThreshold(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Lot Number</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4 text-right">Days to Expiry</th>
                  <th className="py-3 px-4 text-right">ADC</th>
                  <th className="py-3 px-4 text-right">At-Risk Qty</th>
                  <th className="py-3 px-4 text-right">At-Risk Value ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {expiryData?.at_risk_lots && expiryData.at_risk_lots.length > 0 ? (
                  expiryData.at_risk_lots.map((lot: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-xs text-amber-400">{lot.lot_number}</td>
                      <td className="py-3 px-4 font-medium text-white">{lot.item_name}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{lot.days_until_expiry}d</td>
                      <td className="py-3 px-4 text-right text-slate-400">{lot.average_daily_consumption}</td>
                      <td className="py-3 px-4 text-right font-medium text-yellow-400">{lot.at_risk_quantity}</td>
                      <td className="py-3 px-4 text-right font-bold text-rose-400">${Number(lot.at_risk_value_usd).toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-500">No lots currently at risk within {expiryDaysThreshold} days.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TURNOVER & DOH TAB */}
      {activeTab === 'turnover' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-white text-base">Days on Hand (DOH) & Stock Turnover</h3>
              <p className="text-xs text-slate-400">Classifies inventory across 6 canonical velocity tiers (7 filter options including ALL).</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none"
                />
              </div>
              <select
                value={turnoverFilter}
                onChange={(e) => setTurnoverFilter(e.target.value as VelocityClassification)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5"
              >
                {VELOCITY_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Stock Value ($)</th>
                  <th className="py-3 px-4 text-right">ADC</th>
                  <th className="py-3 px-4 text-right">DOH (Days)</th>
                  <th className="py-3 px-4 text-right">Turnover Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredTurnoverItems.length > 0 ? (
                  filteredTurnoverItems.map((it: any, idx: number) => {
                    const badgeClass = 
                      it.velocity_classification === 'FAST_MOVING' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' :
                      it.velocity_classification === 'OPTIMAL' ? 'bg-cyan-950 text-cyan-300 border-cyan-800' :
                      it.velocity_classification === 'SLOW_MOVING' ? 'bg-yellow-950 text-yellow-300 border-yellow-800' :
                      it.velocity_classification === 'DEAD_STOCK' ? 'bg-rose-950 text-rose-300 border-rose-800' :
                      it.velocity_classification === 'NEGATIVE_ANOMALY' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                      'bg-slate-800 text-slate-400 border-slate-700';
                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-medium text-white">{it.item_name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded border ${badgeClass}`}>
                            {it.velocity_classification}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">{it.current_stock} {it.unit}</td>
                        <td className="py-3 px-4 text-right text-slate-400">${Number(it.unit_cost).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-medium text-white">${Number(it.stock_value).toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-slate-400">{it.average_daily_consumption}</td>
                        <td className="py-3 px-4 text-right font-semibold text-amber-400">{it.days_on_hand ?? 'N/A'}</td>
                        <td className="py-3 px-4 text-right text-slate-300">{it.inventory_turnover_ratio}x</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={8} className="py-6 text-center text-slate-500">No items match the current filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. PRODUCTION YIELD TAB */}
      {activeTab === 'production' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-white text-base">Production Prep Efficiency & Yield Analytics</h3>
              <p className="text-xs text-slate-400">Tracks prep work orders and batch variance without treating output as immediate COGS.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-slate-400">Avg Yield Variance: <strong className="text-indigo-400">{yieldData?.average_yield_variance_percentage ?? 0}%</strong></span>
              <span className="text-slate-400">Total Yield Loss: <strong className="text-rose-400">{yieldData?.total_yield_loss_quantity ?? 0} units</strong></span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Work Order #</th>
                  <th className="py-3 px-4">Target Prep Item</th>
                  <th className="py-3 px-4 text-right">Target Yield</th>
                  <th className="py-3 px-4 text-right">Actual Yield</th>
                  <th className="py-3 px-4 text-right">Yield Variance (%)</th>
                  <th className="py-3 px-4 text-right">Yield Loss Qty</th>
                  <th className="py-3 px-4 text-right">Unit Prep Cost ($)</th>
                  <th className="py-3 px-4 text-right">Completed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {yieldData?.batches && yieldData.batches.length > 0 ? (
                  yieldData.batches.map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-xs text-amber-400">{b.work_order_number}</td>
                      <td className="py-3 px-4 font-medium text-white">{b.target_prep_item}</td>
                      <td className="py-3 px-4 text-right text-slate-400">{b.target_yield_quantity} {b.yield_unit}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-200">{b.actual_yield_quantity} {b.yield_unit}</td>
                      <td className={`py-3 px-4 text-right font-semibold ${Number(b.yield_variance_percentage) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {b.yield_variance_percentage}%
                      </td>
                      <td className="py-3 px-4 text-right text-rose-400">{b.yield_loss_quantity}</td>
                      <td className="py-3 px-4 text-right font-medium text-cyan-400">${Number(b.unit_prep_cost).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-xs text-slate-400">{new Date(b.completed_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="py-6 text-center text-slate-500">No production batches completed in this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. PPV & PRICE TRENDS TAB */}
      {activeTab === 'ppv' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-white text-base">Purchase Price Variance (PPV) & Spike Trends</h3>
              <p className="text-xs text-slate-400">Variance evaluated against contract PO unit price at order creation time.</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Lookback:</span>
              <select
                value={ppvMonths}
                onChange={(e) => setPpvMonths(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2.5 py-1"
              >
                <option value={3}>3 Months</option>
                <option value={6}>6 Months</option>
                <option value={12}>12 Months</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Received Date</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Delivered Price</th>
                  <th className="py-3 px-4 text-right">Contract Price</th>
                  <th className="py-3 px-4 text-right">PPV ($)</th>
                  <th className="py-3 px-4 text-center">Spike Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ppvData?.trends && ppvData.trends.length > 0 ? (
                  ppvData.trends.map((t: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-xs text-amber-400">{t.receipt_number}</td>
                      <td className="py-3 px-4 text-xs text-slate-400">{new Date(t.received_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-medium text-white">{t.item_name}</td>
                      <td className="py-3 px-4 text-slate-300">{t.supplier_name}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{t.quantity_received} {t.unit}</td>
                      <td className="py-3 px-4 text-right text-slate-200">${Number(t.delivered_unit_price).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-slate-400">${Number(t.contract_unit_price).toFixed(2)}</td>
                      <td className={`py-3 px-4 text-right font-bold ${Number(t.purchase_price_variance_usd) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ${Number(t.purchase_price_variance_usd).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {t.is_price_spike ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                            SPIKE ≥15%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={9} className="py-6 text-center text-slate-500">No goods receipts posted in lookback period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. EXCEPTIONS & SIGNALS TAB */}
      {activeTab === 'exceptions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Negative Stock Exceptions */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-400" />
                Negative Stock Position Exceptions
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3">Branch</th>
                      <th className="py-2.5 px-3 text-right">Current Stock</th>
                      <th className="py-2.5 px-3 text-right">Distortion ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {exceptionsData?.negative_stock_exceptions && exceptionsData.negative_stock_exceptions.length > 0 ? (
                      exceptionsData.negative_stock_exceptions.map((ex: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-medium text-white">{ex.item_name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{ex.branch}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-rose-400">{ex.current_stock}</td>
                          <td className="py-2.5 px-3 text-right text-rose-400">${Number(ex.financial_distortion).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="py-4 text-center text-emerald-400 font-medium">No negative stock positions detected!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Exception Signals */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Zap size={18} className="text-amber-400" />
                Operational Signal Warnings
              </h3>
              <div className="space-y-3">
                {exceptionsData?.signals && exceptionsData.signals.length > 0 ? (
                  exceptionsData.signals.map((sig: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 flex items-start gap-3">
                      <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-white">{sig.signal_type}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{sig.message}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-500 text-sm">All operations running within safe signal thresholds.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. BRANCH COMPARISON TAB */}
      {activeTab === 'branches' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-white text-base">Multi-Branch Comparative Benchmarking</h3>
          <p className="text-xs text-slate-400">Strictly displays performance metrics for branches authorized under caller permissions.</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 uppercase bg-slate-800/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4 text-right">Net Sales ($)</th>
                  <th className="py-3 px-4 text-right">Theoretical COGS ($)</th>
                  <th className="py-3 px-4 text-right">Actual Usage ($)</th>
                  <th className="py-3 px-4 text-right">FC Variance ($)</th>
                  <th className="py-3 px-4 text-right">Actual FC %</th>
                  <th className="py-3 px-4 text-right">Waste Cost ($)</th>
                  <th className="py-3 px-4 text-right">Net Book Value ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {branchCompData?.branches && branchCompData.branches.length > 0 ? (
                  branchCompData.branches.map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                        <Building size={14} className="text-slate-400" />
                        {b.branch_name}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-400">${Number(b.net_sales_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right text-indigo-400">${Number(b.theoretical_sales_cogs || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right text-amber-400">${Number(b.actual_food_usage || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className={`py-3 px-4 text-right font-bold ${Number(b.food_cost_variance_dollar || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ${Number(b.food_cost_variance_dollar || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">{b.actual_food_cost_percentage ?? 0}%</td>
                      <td className="py-3 px-4 text-right text-orange-400">${Number(b.recorded_waste_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-right font-bold text-cyan-400">${Number(b.net_book_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="py-6 text-center text-slate-500">No branch comparison data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ScaleIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 16} 
      height={size || 16} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
      <path d="M7 21h10"/>
      <path d="M12 3v18"/>
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>
    </svg>
  );
}
