import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, AlertTriangle, RefreshCw, 
  CheckCircle2, Shield, Calendar, Layers, FileText, 
  Activity, Scale, Eye, Award, CheckSquare, XCircle, Clock
} from 'lucide-react';
import { costControlApi } from '../api/costControlApi';
import type { CostControlDashboardSummary, PnlReconciliationCertificate } from '../api/costControlApi';
import { api } from '../api/client';

export default function CostControlScreen({ user, permissions }: { user: any; permissions: any }) {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [runMode, setRunMode] = useState<'AUTHORITATIVE' | 'PROVISIONAL'>('AUTHORITATIVE');

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [dashboard, setDashboard] = useState<CostControlDashboardSummary | null>(null);
  const [certificate, setCertificate] = useState<PnlReconciliationCertificate | null>(null);
  const [showCertModal, setShowCertModal] = useState<boolean>(false);

  // Alert Action Modal State
  const [activeAlertToAct, setActiveAlertToAct] = useState<any | null>(null);
  const [actionType, setActionType] = useState<string>('ACKNOWLEDGE');
  const [actionNotes, setActionNotes] = useState<string>('');

  const restaurantId = user?.restaurant_id;

  useEffect(() => {
    async function loadBranches() {
      try {
        const bList = await api.getBranches();
        setBranches(bList || []);
        if (bList && bList.length > 0) {
          const defaultB = user?.branch_id || bList[0].id;
          setSelectedBranch(defaultB);
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      }
    }
    loadBranches();
  }, [user]);

  const loadData = async () => {
    if (!restaurantId || !selectedBranch) return;
    setLoading(true);
    try {
      const summary = await costControlApi.getDashboardSummary(restaurantId, selectedBranch, selectedDate);
      setDashboard(summary);
      try {
        const cert = await costControlApi.getPnlReconciliationCertificate(restaurantId, selectedBranch, selectedDate);
        setCertificate(cert);
      } catch (certErr) {
        setCertificate(null);
      }
    } catch (err) {
      console.error('Failed to load cost control data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [restaurantId, selectedBranch, selectedDate]);

  const handleRebuild = async () => {
    if (!restaurantId || !selectedBranch) return;
    setActionLoading(true);
    try {
      await costControlApi.rebuildDailySnapshot(restaurantId, selectedBranch, selectedDate, runMode);
      await loadData();
    } catch (err) {
      alert('Snapshot rebuild failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleActionAlertSubmit = async () => {
    if (!restaurantId || !activeAlertToAct) return;
    setActionLoading(true);
    try {
      await costControlApi.actionAlert(restaurantId, activeAlertToAct.id, actionType, actionNotes);
      setActiveAlertToAct(null);
      setActionNotes('');
      await loadData();
    } catch (err) {
      alert('Action alert failed: ' + (err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  const run = dashboard?.snapshot_run;
  const items = dashboard?.item_variances || [];
  const wastes = dashboard?.waste_breakdowns || [];
  const yields = dashboard?.yield_variances || [];
  const alerts = dashboard?.active_alerts || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Context Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Scale size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Cost Control & Variance Intelligence</h1>
              <p className="text-slate-400 text-sm">Deterministic tracking of recipe usage, waste, batch yield & unexplained loss</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Selector */}
          <select 
            value={selectedBranch} 
            onChange={e => setSelectedBranch(e.target.value)}
            className="bg-slate-800 text-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Date Picker */}
          <input 
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-slate-800 text-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
          />

          {/* Mode Selector */}
          <select
            value={runMode}
            onChange={e => setRunMode(e.target.value as any)}
            className="bg-slate-800 text-slate-100 border border-slate-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
          >
            <option value="AUTHORITATIVE">Authoritative (Stocktake Gated)</option>
            <option value="PROVISIONAL">Provisional (Live Interim)</option>
          </select>

          {/* Rebuild Button */}
          <button
            onClick={handleRebuild}
            disabled={actionLoading || loading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <RefreshCw size={16} className={actionLoading ? 'animate-spin' : ''} />
            Rebuild Snapshot
          </button>

          {/* Phase 9 Certificate Button */}
          <button
            onClick={() => setShowCertModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20"
          >
            <Award size={16} />
            Phase 9 Certificate
          </button>
        </div>
      </div>

      {/* Snapshot Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Theoretical Sales Cost */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Theoretical Sales Cost</span>
            <FileText size={18} className="text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ${Number(run?.total_theoretical_sales_cost || 0).toFixed(2)}
          </div>
          <p className="text-xs text-slate-400 mt-1">POS Sales Frozen BOM Valuation</p>
        </div>

        {/* Card 2: Actual Productive Cost */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Actual Productive Depletion</span>
            <Activity size={18} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            ${Number(run?.total_actual_productive_cost || 0).toFixed(2)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Net recipe & prep sales movements</p>
        </div>

        {/* Card 3: Usage Variance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Total Usage Variance</span>
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">
            ${Number(run?.total_productive_usage_variance_cost || 0).toFixed(2)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Portion & preparation over-consumption</p>
        </div>

        {/* Card 4: Operational Loss (Waste + Yield + Shrinkage) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Operational Leakage</span>
            <Shield size={18} className="text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">
            ${(Number(run?.recorded_waste_cost || 0) + Number(run?.production_yield_loss_cost || 0) + Number(run?.total_unexplained_variance_cost || 0)).toFixed(2)}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Waste: ${Number(run?.recorded_waste_cost || 0).toFixed(1)}</span>
            <span>•</span>
            <span>Yield: ${Number(run?.production_yield_loss_cost || 0).toFixed(1)}</span>
            <span>•</span>
            <span>Count: ${Number(run?.total_unexplained_variance_cost || 0).toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* ACTIVE ALERTS BANNER (If Any) */}
      {alerts.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-rose-400 animate-pulse" size={20} />
              <h2 className="text-lg font-bold text-rose-200">Active Cost Control Alerts ({alerts.length})</h2>
            </div>
            <span className="text-xs px-2.5 py-1 bg-rose-500/20 text-rose-300 rounded-full font-bold">Investigation Required</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map(a => (
              <div key={a.id} className="bg-slate-900/90 border border-rose-900/50 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                      a.severity === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {a.severity}
                    </span>
                    <span className="text-xs font-bold text-rose-400">${Number(a.variance_amount_dollars).toFixed(2)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-200 mb-1">{a.message}</p>
                  <p className="text-xs text-slate-400">Type: {a.alert_type} • Status: {a.status}</p>
                  {a.linked_task_id && (
                    <p className="text-xs text-indigo-400 mt-1 font-mono">Task ID: {a.linked_task_id}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
                  <button
                    onClick={() => { setActiveAlertToAct(a); setActionType('ACKNOWLEDGE'); }}
                    className="flex-1 text-xs py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => { setActiveAlertToAct(a); setActionType('RESOLVE'); }}
                    className="flex-1 text-xs py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 1: THEORETICAL VS ACTUAL (TvA) USAGE MATRIX */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Item-Level Theoretical vs Actual (TvA) Matrix</h2>
              <p className="text-xs text-slate-400">Movement-level operational control net of linked reversals</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono">Items Tracked: {items.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Item & Category</th>
                <th className="py-3 px-4">Moving WAC</th>
                <th className="py-3 px-4 text-right">Theoretical Usage</th>
                <th className="py-3 px-4 text-right">Actual Depletion</th>
                <th className="py-3 px-4 text-right">Usage Variance</th>
                <th className="py-3 px-4 text-right">Variance %</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-sm">
                    No item movements or theoretical sales recorded for this date.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.item_id} className={`hover:bg-slate-800/40 transition ${item.is_anomaly ? 'bg-amber-950/10' : ''}`}>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div>{item.item_name}</div>
                      <div className="text-xs text-slate-400">{item.category} • {item.unit}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      ${Number(item.moving_wac).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      <div>${Number(item.theoretical_cost).toFixed(2)}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100">
                      <div>${Number(item.actual_cost).toFixed(2)}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      <span className={item.usage_variance_cost > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                        {item.usage_variance_cost > 0 ? '+' : ''}${Number(item.usage_variance_cost).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        item.usage_variance_pct > item.max_acceptable_pct 
                          ? 'bg-amber-500/20 text-amber-300' 
                          : 'text-slate-400'
                      }`}>
                        {Number(item.usage_variance_pct).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.is_anomaly ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                          <AlertTriangle size={12} /> Material
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full">
                          <CheckCircle2 size={12} /> Controlled
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: PRODUCTION YIELD & BATCH ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production Batch Yield Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <TrendingUp size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Production Batch Yield Analytics</h3>
                <p className="text-xs text-slate-400">Non-circular yield costing with mandatory guardrails</p>
              </div>
            </div>

            <div className="space-y-3">
              {yields.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No production batches completed on this date.</p>
              ) : (
                yields.map(y => (
                  <div key={y.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{y.recipe_name}</div>
                      <div className="text-xs text-slate-400">Batch: {y.batch_id.slice(0, 8)} • Scale: {y.base_scale_factor}x</div>
                      <div className="text-xs text-slate-300 mt-1">
                        Expected: {y.expected_good_output} kg → Actual: {y.actual_good_output} kg
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${y.yield_status === 'DEFICIT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {y.yield_loss_cost > 0 ? `-$${Number(y.yield_loss_cost).toFixed(2)}` : 'On Target'}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        y.yield_status === 'DEFICIT' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {y.yield_status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Waste Breakdown Analysis */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Recorded Waste Categorization</h3>
                <p className="text-xs text-slate-400">Loss classification by root cause and stage</p>
              </div>
            </div>

            <div className="space-y-3">
              {wastes.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No recorded waste logs for this date.</p>
              ) : (
                wastes.map(w => (
                  <div key={w.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-sm">{w.display_name}</div>
                      <div className="text-xs text-slate-400">Source: {w.waste_source} • {w.classification}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-rose-400">${Number(w.total_cost).toFixed(2)}</div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        w.is_avoidable ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {w.is_avoidable ? 'Avoidable' : 'Unavoidable'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PHASE 9 RECONCILIATION CERTIFICATE MODAL */}
      {showCertModal && certificate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <Award size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Store P&L Reconciliation Certificate</h3>
                  <p className="text-xs text-slate-400">Formal mathematical proof connecting Phase 10 with Phase 9</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCertModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle size={20} />
              </button>
            </div>

            {certificate.reconciliation_certificate ? (
              <div className="space-y-4 text-sm">
                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Phase 9 Benchmark Realized Food Cost:</span>
                    <span className="font-mono text-white font-bold">
                      ${Number(certificate.reconciliation_certificate.phase9_pnl_benchmark.phase9_realized_food_cost).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Phase 10 Sales Food Cost Coverage:</span>
                    <span className="font-mono text-white font-bold">
                      ${Number(certificate.reconciliation_certificate.phase10_sales_food_cost_coverage.actual_sales_productive_cost).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                    <span className="text-slate-400 font-semibold">Coverage Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      certificate.reconciliation_certificate.phase10_sales_food_cost_coverage.reconciliation_status === 'EXACT_MATCH'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}>
                      {certificate.reconciliation_certificate.phase10_sales_food_cost_coverage.reconciliation_status}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Additional Operational Leakage (Outside COGS)</h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Recorded Waste Cost:</span>
                    <span className="font-mono text-slate-200">${Number(certificate.reconciliation_certificate.phase10_additional_operational_leakage.recorded_waste_cost).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Production Yield Loss:</span>
                    <span className="font-mono text-slate-200">${Number(certificate.reconciliation_certificate.phase10_additional_operational_leakage.production_yield_loss_cost).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Unexplained Count Shrinkage:</span>
                    <span className="font-mono text-slate-200">${Number(certificate.reconciliation_certificate.phase10_additional_operational_leakage.unexplained_stocktake_shrinkage_cost).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold border-t border-slate-800 pt-2">
                    <span className="text-rose-400">Total Additional Operational Leakage:</span>
                    <span className="font-mono text-rose-400">${Number(certificate.reconciliation_certificate.phase10_additional_operational_leakage.total_additional_leakage).toFixed(2)}</span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-center">
                  <p className="text-xs text-emerald-300 font-semibold">
                    ✓ {certificate.reconciliation_certificate.audit_guarantee}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">{certificate.message || 'No reconciliation certificate available.'}</p>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowCertModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERT ACTION MODAL */}
      {activeAlertToAct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Action Cost Control Alert</h3>
            <p className="text-xs text-slate-400">{activeAlertToAct.message}</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Select Action</label>
                <select
                  value={actionType}
                  onChange={e => setActionType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="ACKNOWLEDGE">Acknowledge (Assign investigation)</option>
                  <option value="RESOLVE">Resolve (Corrective action confirmed)</option>
                  <option value="DISMISS">Dismiss (Authorized operational exception)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Operational Notes / Reason</label>
                <textarea
                  value={actionNotes}
                  onChange={e => setActionNotes(e.target.value)}
                  placeholder="Provide audit context for this resolution..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveAlertToAct(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleActionAlertSubmit}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold rounded-xl disabled:opacity-50"
              >
                Confirm Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
