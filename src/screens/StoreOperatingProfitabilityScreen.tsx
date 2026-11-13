import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, AlertTriangle, RefreshCw, 
  Lock, Unlock, Clock, Target, Sliders, CheckCircle2,
  Calendar, Layers, FileText, ChevronRight
} from 'lucide-react';
import { storeOperatingPnlApi } from '../api/storeOperatingPnlApi';
import type { StoreOperatingPnlReport, LiveProvisionalPnl, OperatingScenarioSimulation } from '../api/storeOperatingPnlApi';
import { api } from '../api/client';

export default function StoreOperatingProfitabilityScreen({ user, permissions }: { user: any; permissions: any }) {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'CLOSED' | 'LIVE'>('CLOSED');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [report, setReport] = useState<StoreOperatingPnlReport | null>(null);
  const [livePnl, setLivePnl] = useState<LiveProvisionalPnl | null>(null);

  // Scenario Simulator State
  const [simSales, setSimSales] = useState<number>(0);
  const [simFood, setSimFood] = useState<number>(0);
  const [simLabor, setSimLabor] = useState<number>(0);
  const [simCtrl, setSimCtrl] = useState<number>(0);
  const [simulation, setSimulation] = useState<OperatingScenarioSimulation | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  // Reopen Modal
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');

  const restaurantId = user?.restaurant_id || user?.restaurants?.id || 'rest-brime-01';

  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await api.getBranches();
        const bList = Array.isArray(res) ? res : (res?.data || []);
        setBranches(bList);
        if (bList && bList.length > 0) {
          const defaultB = user?.branch_id || bList[0].id;
          setSelectedBranch(defaultB);
        } else {
          setSelectedBranch('badaro-central');
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
        setSelectedBranch('badaro-central');
      }
    }
    loadBranches();
  }, [user]);

  const loadData = async () => {
    const activeRestId = restaurantId || 'rest-brime-01';
    const activeBranchId = selectedBranch || 'badaro-central';
    setLoading(true);
    try {
      if (viewMode === 'CLOSED') {
        const pnl = await storeOperatingPnlApi.getPnlReport(activeRestId, activeBranchId, selectedDate, selectedDate);
        setReport(pnl);
      } else {
        const live = await storeOperatingPnlApi.getLiveProvisionalPnl(activeRestId, activeBranchId, selectedDate);
        setLivePnl(live);
      }
    } catch (err) {
      console.error('Failed to load P&L data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [restaurantId, selectedBranch, selectedDate, viewMode]);

  const handleRebuild = async () => {
    if (!restaurantId || !selectedBranch) return;
    setActionLoading(true);
    try {
      await storeOperatingPnlApi.rebuildDailySnapshot(restaurantId, selectedBranch, selectedDate);
      await loadData();
    } catch (err) {
      alert('Rebuild failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClosePeriod = async () => {
    if (!restaurantId || !selectedBranch) return;
    setActionLoading(true);
    try {
      await storeOperatingPnlApi.managePeriodClose(
        restaurantId, selectedBranch, 'DAILY', selectedDate, selectedDate, 'CLOSE'
      );
      await loadData();
    } catch (err) {
      alert('Close period failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenPeriod = async () => {
    if (!restaurantId || !selectedBranch || !reopenReason.trim()) return;
    setActionLoading(true);
    try {
      await storeOperatingPnlApi.managePeriodClose(
        restaurantId, selectedBranch, 'DAILY', selectedDate, selectedDate, 'REOPEN', reopenReason
      );
      setShowReopenModal(false);
      setReopenReason('');
      await loadData();
    } catch (err) {
      alert('Reopen failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunSimulation = async () => {
    if (!restaurantId || !selectedBranch) return;
    setSimLoading(true);
    try {
      const res = await storeOperatingPnlApi.simulateScenario(
        restaurantId, selectedBranch, selectedDate,
        simSales / 100, simFood / 100, simLabor / 100, simCtrl / 100
      );
      setSimulation(res);
    } catch (err) {
      alert('Simulation failed: ' + (err as Error).message);
    } finally {
      setSimLoading(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return '$' + Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPct = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return (Number(val) * 100).toFixed(1) + '%';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Prime Cost & Store Operating P&L</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
              Management P&L
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Authoritative store operating profitability, labor productivity, and commercial margin waterfall.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={selectedBranch} 
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium shadow-sm focus:ring-2 focus:ring-emerald-500"
          >
            {Array.isArray(branches) && branches.map(b => (
              <option key={b.id} value={b.id}>{b.name || b.id}</option>
            ))}
          </select>

          <input 
            type="date" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium shadow-sm focus:ring-2 focus:ring-emerald-500"
          />

          {/* Mode Switcher */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
            <button
              onClick={() => setViewMode('CLOSED')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'CLOSED' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Authoritative Closed
            </button>
            <button
              onClick={() => setViewMode('LIVE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'LIVE' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Live Provisional
            </button>
          </div>

          <button
            onClick={handleRebuild}
            disabled={actionLoading}
            className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
            Rebuild
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {viewMode === 'CLOSED' && report && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-500 font-medium">Calculation Lifecycle:</span>
              <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                report.calculation_lifecycle === 'COMPLETE' ? 'bg-emerald-100 text-emerald-800' :
                report.calculation_lifecycle === 'STALE' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {report.calculation_lifecycle}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 font-medium">Management Status:</span>
              <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                report.management_close_status === 'CLOSED' ? 'bg-blue-100 text-blue-800' :
                report.management_close_status === 'REOPENED' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {report.management_close_status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report.management_close_status !== 'CLOSED' ? (
              <button
                onClick={handleClosePeriod}
                disabled={actionLoading}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition shadow-sm"
              >
                <Lock className="w-3.5 h-3.5" />
                Close Period
              </button>
            ) : (
              <button
                onClick={() => setShowReopenModal(true)}
                disabled={actionLoading}
                className="flex items-center gap-1.5 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-700 transition shadow-sm"
              >
                <Unlock className="w-3.5 h-3.5" />
                Reopen Period
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Provisional Badges */}
      {viewMode === 'LIVE' && livePnl && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-semibold text-amber-900">
              Live Provisional View — Subject to unapproved attendance punches and unposted shift cash.
            </span>
          </div>
          <div className="flex gap-2">
            {livePnl.completeness_flags.map((f, i) => (
              <span key={i} className="bg-amber-200 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Net Sales Revenue</span>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(viewMode === 'CLOSED' ? report?.net_sales_revenue : livePnl?.net_sales_revenue)}
          </div>
          <div className="text-xs text-gray-500 mt-1">100.0% of Topline</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Prime Cost</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {formatCurrency(viewMode === 'CLOSED' ? report?.prime_cost : livePnl?.prime_cost)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {viewMode === 'CLOSED' ? formatPct(report?.prime_cost_percentage) : '—'} (Target: {formatPct(report?.target_prime_cost_pct || 0.58)})
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Store Operating Profit</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {formatCurrency(viewMode === 'CLOSED' ? report?.store_operating_profit : livePnl?.store_operating_profit)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {viewMode === 'CLOSED' ? formatPct(report?.store_operating_margin_percentage) : '—'} (Target: {formatPct(report?.target_operating_margin_pct || 0.18)})
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Break-Even Volume</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {formatCurrency(report?.break_even_sales_volume)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Daily Fixed Cost Burden / CMR</div>
        </div>
      </div>

      {/* Core Waterfall Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="text-base font-bold text-gray-900">Flow Operational Store P&L Waterfall</h2>
          <span className="text-xs text-gray-500">Excludes statutory depreciation, interest & corporate taxes</span>
        </div>

        <div className="divide-y divide-gray-100 font-mono text-sm">
          <div className="px-6 py-3 flex justify-between items-center bg-gray-50 font-bold text-gray-900">
            <span>Net Sales Revenue</span>
            <span>{formatCurrency(viewMode === 'CLOSED' ? report?.net_sales_revenue : livePnl?.net_sales_revenue)}</span>
          </div>

          <div className="px-6 py-2.5 flex justify-between items-center text-gray-700 pl-10">
            <span>− Realized Food Cost (Phase 8 Movement Ledger)</span>
            <span className="text-rose-600">{formatCurrency(viewMode === 'CLOSED' ? report?.realized_food_cost : livePnl?.realized_food_cost)}</span>
          </div>

          <div className="px-6 py-2.5 flex justify-between items-center text-gray-700 pl-10">
            <span>− Modeled Packaging Cost (Phase 8 Packaging Spec)</span>
            <span className="text-rose-600">{formatCurrency(viewMode === 'CLOSED' ? report?.modeled_packaging_cost : livePnl?.modeled_packaging_cost)}</span>
          </div>

          <div className="px-6 py-3 flex justify-between items-center bg-emerald-50/50 font-semibold text-gray-900 pl-6">
            <span>= Product Contribution Margin</span>
            <span className="text-emerald-700">{formatCurrency(report?.product_contribution_margin)}</span>
          </div>

          <div className="px-6 py-2.5 flex justify-between items-center text-gray-700 pl-10">
            <span>− Delivery Aggregator Commissions (sales_channel_cost_agreements)</span>
            <span className="text-rose-600">{formatCurrency(report?.channel_commissions)}</span>
          </div>

          <div className="px-6 py-2.5 flex justify-between items-center text-gray-700 pl-10">
            <span>− Merchant Payment Processing Fees (payment_processing_cost_agreements)</span>
            <span className="text-rose-600">{formatCurrency(report?.payment_processing_fees)}</span>
          </div>

          <div className="px-6 py-2.5 flex justify-between items-center text-gray-700 pl-10">
            <span>− Direct Variable Selling Costs (store_operating_expenses)</span>
            <span className="text-rose-600">{formatCurrency(report?.direct_variable_selling_costs)}</span>
          </div>

          <div className="px-6 py-3 flex justify-between items-center bg-emerald-50/50 font-semibold text-gray-900 pl-6">
            <span>= Contribution after Channel Costs</span>
            <span className="text-emerald-700">{formatCurrency(report?.contribution_after_channel_costs)}</span>
          </div>

          <div className="px-6 py-2.5 flex justify-between items-center text-gray-700 pl-10">
            <span>− Direct Operating Labor (Kitchen, Service & Bar Hours)</span>
            <span className="text-rose-600">{formatCurrency(viewMode === 'CLOSED' ? report?.direct_operating_labor_cost : livePnl?.direct_operating_labor_cost)}</span>
          </div>

          <div className="px-6 py-3 flex justify-between items-center bg-amber-50/60 font-bold text-gray-900 pl-6">
            <span>= Store Prime Contribution</span>
            <span className="text-amber-800">{formatCurrency(report?.store_prime_contribution)}</span>
          </div>

          <div className="px-6 py-2.5 flex justify-between items-center text-gray-700 pl-10">
            <span>− Controllable Operating Expenses (Utilities, Cleaning, Repairs)</span>
            <span className="text-rose-600">{formatCurrency(viewMode === 'CLOSED' ? report?.controllable_operating_expenses : livePnl?.controllable_operating_expenses)}</span>
          </div>

          <div className="px-6 py-3 flex justify-between items-center bg-emerald-50/50 font-semibold text-gray-900 pl-6">
            <span>= Controllable Operating Profit</span>
            <span className="text-emerald-700">{formatCurrency(report?.controllable_operating_profit)}</span>
          </div>

          <div className="px-6 py-2.5 flex justify-between items-center text-gray-700 pl-10">
            <span>− Fixed Store Operating Expenses (Facility Rent, Subscriptions)</span>
            <span className="text-rose-600">{formatCurrency(viewMode === 'CLOSED' ? report?.fixed_store_operating_expenses : livePnl?.fixed_store_operating_expenses)}</span>
          </div>

          <div className="px-6 py-2.5 flex justify-between items-center text-gray-700 pl-10">
            <span>− Store Management Overhead Labor (GM & AGM Salaries)</span>
            <span className="text-rose-600">{formatCurrency(viewMode === 'CLOSED' ? report?.store_management_overhead_labor : livePnl?.store_management_overhead_labor)}</span>
          </div>

          <div className="px-6 py-4 flex justify-between items-center bg-emerald-100 font-extrabold text-base text-gray-900">
            <span>= Store Operating Profit</span>
            <span className="text-emerald-900">{formatCurrency(viewMode === 'CLOSED' ? report?.store_operating_profit : livePnl?.store_operating_profit)}</span>
          </div>
        </div>
      </div>

      {/* Scenario Simulator Panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-gray-900">Zero-Mutation Scenario Simulator</h3>
        </div>
        <p className="text-xs text-gray-500">
          Simulate commercial levers (volume shifts, inflation, wage revisions) on Store Operating Profit with 0 database writes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-gray-600">Sales Volume Δ (%)</label>
            <input 
              type="number" 
              value={simSales} 
              onChange={(e) => setSimSales(Number(e.target.value))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              placeholder="+10%"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Food Cost Δ (%)</label>
            <input 
              type="number" 
              value={simFood} 
              onChange={(e) => setSimFood(Number(e.target.value))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              placeholder="-5%"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Labor Rate Δ (%)</label>
            <input 
              type="number" 
              value={simLabor} 
              onChange={(e) => setSimLabor(Number(e.target.value))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              placeholder="+5%"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Controllable Δ (%)</label>
            <input 
              type="number" 
              value={simCtrl} 
              onChange={(e) => setSimCtrl(Number(e.target.value))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              placeholder="-10%"
            />
          </div>
        </div>

        <button
          onClick={handleRunSimulation}
          disabled={simLoading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          {simLoading ? 'Simulating...' : 'Run Simulation'}
        </button>

        {simulation && (
          <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-indigo-700 font-medium">Simulated Net Sales</span>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(simulation.simulated_net_sales)}</div>
            </div>
            <div>
              <span className="text-xs text-indigo-700 font-medium">Simulated Prime Cost</span>
              <div className="text-lg font-bold text-amber-700">{formatCurrency(simulation.simulated_prime_cost)} ({formatPct(simulation.simulated_prime_cost_percentage)})</div>
            </div>
            <div>
              <span className="text-xs text-indigo-700 font-medium">Simulated Store Operating Profit</span>
              <div className="text-lg font-bold text-emerald-700">{formatCurrency(simulation.simulated_store_operating_profit)} ({formatPct(simulation.simulated_store_operating_margin_percentage)})</div>
            </div>
            <div>
              <span className="text-xs text-indigo-700 font-medium">Profit Delta</span>
              <div className={`text-lg font-bold ${simulation.delta_operating_profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {simulation.delta_operating_profit >= 0 ? '+' : ''}{formatCurrency(simulation.delta_operating_profit)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reopen Audit Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Reopen Closed Period</h3>
            <p className="text-sm text-gray-500">
              A mandatory audit reason is required to unlock an audited, closed store period.
            </p>
            <textarea
              rows={3}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="e.g. Retroactive overtime payout approved by Operations Director..."
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReopenPeriod}
                disabled={!reopenReason.trim() || actionLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
