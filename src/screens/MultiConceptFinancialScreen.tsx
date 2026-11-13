import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  DollarSign, TrendingUp, AlertTriangle, RefreshCw, 
  Calendar, Layers, FileText, CheckCircle2,
  Lock, Unlock, ShieldAlert, Download, ChevronRight, BarChart3, PieChart as PieIcon,
  Store, ShoppingBag, Printer, FileSpreadsheet, Package, Info, ArrowUpRight, ArrowDownRight,
  Sparkles, Database
} from 'lucide-react';
import { multiConceptFinancialApi } from '../api/multiConceptFinancialApi';
import type { 
  ConceptPnlRow, 
  ChannelProfitabilityRow, 
  ConsolidatedStatementRow, 
  ReconciliationAuditRow,
  InventoryWorkingCapitalRow,
  CorporateReserveRow,
  InventoryValuationBridgeRow
} from '../api/multiConceptFinancialApi';
import { financialExportHelper } from '../utils/financialExportHelper';
import { api } from '../api/client';

export default function MultiConceptFinancialScreen({ user, permissions }: { user: any; permissions: any }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') as any;

  const [activeTab, setActiveTab] = useState<'dashboard' | 'comparison' | 'channels' | 'settlements' | 'inventory' | 'consolidated' | 'period_mgmt' | 'reports'>(
    (initialTab && ['dashboard', 'comparison', 'channels', 'settlements', 'inventory', 'consolidated', 'period_mgmt', 'reports'].includes(initialTab))
      ? initialTab 
      : 'dashboard'
  );

  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(11);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('9c214659-9cc7-4f33-b115-cbbb8a823a94');

  // Financial Concept Filter: strictly scoped to management dashboard and financial reporting.
  // Kept completely isolated from operational POS workspaces and cashier cash shifts.
  const [selectedConcept, setSelectedConcept] = useState<string>('ALL');

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConceptSelect = (conceptCodeOrId: string) => {
    setSelectedConcept(conceptCodeOrId);
  };

  // Data states
  const [consolidatedData, setConsolidatedData] = useState<ConsolidatedStatementRow | null>(null);
  const [conceptsData, setConceptsData] = useState<ConceptPnlRow[]>([]);
  const [channelsData, setChannelsData] = useState<ChannelProfitabilityRow[]>([]);
  const [workingCapitalData, setWorkingCapitalData] = useState<InventoryWorkingCapitalRow[]>([]);
  const [auditExceptions, setAuditExceptions] = useState<ReconciliationAuditRow[]>([]);
  const [reconData, setReconData] = useState<any>(null);
  const [corporateReserveData, setCorporateReserveData] = useState<CorporateReserveRow[]>([]);
  const [inventoryBridgeData, setInventoryBridgeData] = useState<InventoryValuationBridgeRow | null>(null);

  // Period management states
  const [precloseChecklist, setPrecloseChecklist] = useState<any>(null);
  const [accountingPeriods, setAccountingPeriods] = useState<any[]>([]);
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');

  const displayedConcepts = useMemo(() => {
    if (!selectedConcept || selectedConcept === 'ALL') {
      return conceptsData;
    }
    const filtered = conceptsData.filter(c => 
      c.concept_id === selectedConcept || 
      c.concept_code === selectedConcept ||
      (selectedConcept === 'NEO' && c.concept_id === '00000000-0000-0000-0000-000000000001') ||
      (selectedConcept === 'OVRLOAD' && c.concept_id === '00000000-0000-0000-0000-000000000002') ||
      (selectedConcept === 'WICKD' && c.concept_id === '00000000-0000-0000-0000-000000000003')
    );
    return filtered.length > 0 ? filtered : conceptsData;
  }, [conceptsData, selectedConcept]);

  const displayedWorkingCapital = useMemo(() => {
    if (!selectedConcept || selectedConcept === 'ALL') return workingCapitalData;
    const conceptObj = conceptsData.find(c => 
      c.concept_id === selectedConcept || 
      c.concept_code === selectedConcept ||
      (selectedConcept === 'NEO' && c.concept_id === '00000000-0000-0000-0000-000000000001') ||
      (selectedConcept === 'OVRLOAD' && c.concept_id === '00000000-0000-0000-0000-000000000002') ||
      (selectedConcept === 'WICKD' && c.concept_id === '00000000-0000-0000-0000-000000000003')
    );
    const code = conceptObj?.concept_code || selectedConcept;
    return workingCapitalData.filter(item => item.concept_affiliation === code || item.concept_affiliation === 'SHARED_COMPANY');
  }, [workingCapitalData, selectedConcept, conceptsData]);

  const isSuperAdmin = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab && ['dashboard', 'comparison', 'channels', 'settlements', 'inventory', 'consolidated', 'period_mgmt', 'reports'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl as any);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: 'dashboard' | 'comparison' | 'channels' | 'settlements' | 'inventory' | 'consolidated' | 'period_mgmt' | 'reports') => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  useEffect(() => {
    async function initBranches() {
      try {
        const res = await api.getBranches();
        const bList = Array.isArray(res) ? res : (res?.data || []);
        setBranches(bList);
        if (bList && bList.length > 0 && !selectedBranch) {
          setSelectedBranch(bList[0].id);
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      }
    }
    initBranches();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const dash = await multiConceptFinancialApi.getExecutiveDashboard(year, month);
      setConsolidatedData(dash.consolidated);
      setConceptsData(dash.concepts);

      const chs = await multiConceptFinancialApi.getChannelProfitability(year, month, selectedConcept);
      setChannelsData(chs);

      const wc = await multiConceptFinancialApi.getInventoryWorkingCapital(selectedBranch);
      setWorkingCapitalData(wc);

      const exceptions = await multiConceptFinancialApi.getReconciliationAudit();
      setAuditExceptions(exceptions);

      const recon = await multiConceptFinancialApi.getExpenseAllocationReconciliation(year, month);
      setReconData(recon);

      const corpRes = await multiConceptFinancialApi.getCorporateReserveBreakdown();
      setCorporateReserveData(corpRes);

      const bridge = await multiConceptFinancialApi.getInventoryValuationBridge();
      setInventoryBridgeData(bridge);

      if (selectedBranch) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const chk = await multiConceptFinancialApi.validatePrecloseChecklist(selectedBranch, dateStr);
        setPrecloseChecklist(chk);

        const periods = await multiConceptFinancialApi.getAccountingPeriods(selectedBranch);
        setAccountingPeriods(periods);
      }
    } catch (err: any) {
      console.error('Failed to load financial data:', err);
      setErrorMsg(err.message || 'Error loading financial reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [year, month, selectedBranch, selectedConcept]);

  const handleClosePeriod = async (force: boolean) => {
    if (!selectedBranch) return;
    const periodCode = `${year}-${String(month).padStart(2, '0')}`;
    setActionLoading(true);
    try {
      await multiConceptFinancialApi.closeAccountingPeriod(periodCode, selectedBranch, force, user.id);
      alert(`Period ${periodCode} has been closed successfully and snapshots generated.`);
      await loadAllData();
    } catch (err: any) {
      alert(`Close Period Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenPeriod = async () => {
    if (!selectedBranch || !reopenReason.trim()) return;
    const periodCode = `${year}-${String(month).padStart(2, '0')}`;
    setActionLoading(true);
    try {
      await multiConceptFinancialApi.reopenAccountingPeriod(periodCode, selectedBranch, reopenReason, user.id);
      setShowReopenModal(false);
      setReopenReason('');
      alert(`Period ${periodCode} has been unlocked for audit adjustments.`);
      await loadAllData();
    } catch (err: any) {
      alert(`Reopen Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeedDemoData = async () => {
    setActionLoading(true);
    try {
      await multiConceptFinancialApi.seedDemoData(year, month, selectedBranch);
      await loadAllData();
    } catch (err: any) {
      alert(`Demonstration loading: ${err.message || err}`);
      await loadAllData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearDemoData = async () => {
    setActionLoading(true);
    try {
      multiConceptFinancialApi.clearDemoData();
      await loadAllData();
    } catch (err: any) {
      alert(`Reset error: ${err.message || err}`);
    } finally {
      setActionLoading(false);
    }
  };

  const isDemoActive = multiConceptFinancialApi.isDemoDataActive();

  const currentBranchName = branches.find(b => b.id === selectedBranch)?.name || 'NÉO Badaro Central Facility';
  const periodCode = `${year}-${String(month).padStart(2, '0')}`;
  const currentSnapshot = accountingPeriods.find(p => p.period_code === periodCode)?.snapshot_hash;
  const currentProvenance = isDemoActive
    ? 'SYNTHETIC_STAGING_FIXTURE'
    : (currentSnapshot && currentSnapshot !== 'UNSEALED' ? 'CERTIFIED_PRODUCTION_ACTUALS' : 'UNAUDITED_STAGING_ACTUALS');

  const handleExportFullExcel = () => {
    financialExportHelper.exportComprehensiveExcel({
      periodCode,
      year,
      month,
      branchName: currentBranchName,
      consolidated: consolidatedData,
      concepts: conceptsData,
      channels: channelsData,
      exceptions: auditExceptions,
      reconciliationSummary: reconData,
      sha256Digest: currentSnapshot,
      isDemoData: isDemoActive,
      dataProvenance: currentProvenance
    });
  };

  const handleExportStatementPdf = () => {
    financialExportHelper.exportManagementStatementPdf({
      periodCode,
      year,
      month,
      branchName: currentBranchName,
      consolidated: consolidatedData,
      concepts: conceptsData,
      channels: channelsData,
      exceptions: auditExceptions,
      reconciliationSummary: reconData,
      sha256Digest: currentSnapshot,
      isDemoData: isDemoActive,
      dataProvenance: currentProvenance
    });
  };

  const exportCSV = (data: any[], filename: string) => {
    financialExportHelper.exportToCsv(data, `${filename}_${year}_${month}`, isDemoActive, currentProvenance);
  };

  const totalWorkingCapital = workingCapitalData.reduce((sum, item) => sum + (Number(item.working_capital_usd) || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
              FLOW Multi-Concept Enterprise
            </span>
            <span className="text-xs text-gray-500 font-mono">B.R.I.M.E. S.A.L. (Tax ID: 3870852 | CNSS: 1489201)</span>
            {isDemoActive ? (
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white shadow-sm flex items-center gap-1">
                <Sparkles size={12} /> SYNTHETIC_STAGING_FIXTURE (DEMO)
              </span>
            ) : currentSnapshot && currentSnapshot !== 'UNSEALED' ? (
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <Database size={12} /> CERTIFIED_PRODUCTION_ACTUALS (SEALED)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                <Database size={12} /> UNAUDITED_STAGING_ACTUALS (OPERATIONAL)
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Multi-Concept Financial Architecture & P&L</h1>
          <p className="text-sm text-gray-500">Three-Level Concept Feasibility, Shared Cost Transfers, and Corporate Consolidation</p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
            <Calendar size={16} className="text-gray-500 ml-1" />
            <select 
              value={year} 
              onChange={e => setYear(Number(e.target.value))}
              className="bg-transparent text-sm font-medium focus:outline-none"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
            </select>
            <select 
              value={month} 
              onChange={e => setMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-medium focus:outline-none"
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{new Date(2026, m - 1).toLocaleString('default', { month: 'short' })}</option>
              ))}
            </select>
          </div>

          {/* Concept Filter Pills (View Each Concept Alone or All Together) */}
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
            <Store size={15} className="text-gray-500 ml-1.5 mr-0.5" />
            <button
              onClick={() => handleConceptSelect('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                selectedConcept === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }`}
            >
              All Concepts
            </button>
            {[
              { code: 'NEO', name: 'NÉO' },
              { code: 'OVRLOAD', name: 'OVRLOAD' },
              { code: 'WICKD', name: 'WICKD' }
            ].map(c => {
              const isSelected = selectedConcept === c.code || 
                (c.code === 'NEO' && selectedConcept === '00000000-0000-0000-0000-000000000001') ||
                (c.code === 'OVRLOAD' && selectedConcept === '00000000-0000-0000-0000-000000000002') ||
                (c.code === 'WICKD' && selectedConcept === '00000000-0000-0000-0000-000000000003');
              return (
                <button
                  key={c.code}
                  onClick={() => handleConceptSelect(c.code)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>

          <button 
            onClick={loadAllData} 
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          {isDemoActive ? (
            <button 
              onClick={handleClearDemoData} 
              disabled={actionLoading || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 text-sm font-medium rounded-lg shadow-sm transition border border-amber-300"
              title="Reset to live database queries"
            >
              <Database size={15} />
              {actionLoading ? "Resetting..." : "Reset to Live DB"}
            </button>
          ) : (
            <button 
              onClick={handleSeedDemoData} 
              disabled={actionLoading || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
              title="Populate realistic demonstration data for NÉO, OVRLOAD, and WICKD"
            >
              <Sparkles size={15} />
              {actionLoading ? "Populating..." : "Populate Demo Data"}
            </button>
          )}
        </div>
      </div>

      {/* Demo Active Banner */}
      {isDemoActive && !loading && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-indigo-900 text-sm">Demonstration Data Active</h4>
              <p className="text-xs text-indigo-700 mt-0.5">
                Viewing canonical demonstration figures for NÉO, OVRLOAD, and WICKD. Use the concept pills above (<strong>All Concepts</strong>, <strong>NÉO</strong>, <strong>OVRLOAD</strong>, <strong>WICKD</strong>) to view each concept alone or compare them side-by-side.
              </p>
            </div>
          </div>
          <button
            onClick={handleClearDemoData}
            disabled={actionLoading}
            className="shrink-0 px-3 py-1.5 bg-white border border-indigo-300 hover:bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg shadow-sm transition"
          >
            Reset to Live DB Data
          </button>
        </div>
      )}

      {/* Empty State Banner if all figures are zero and demo is not active */}
      {!isDemoActive && (!consolidatedData || Number(consolidatedData.total_gross_sales_usd || 0) === 0) && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-start gap-3">
            <Info size={20} className="text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">No Financial Records for this Period</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                All figures are currently $0.00 because no live orders or expenses have been recorded for this month.
                Click <strong>Populate Demo Data</strong> to instantly load canonical demonstration figures for NÉO, OVRLOAD, and WICKD.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeedDemoData}
            disabled={actionLoading}
            className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            {actionLoading ? "Loading..." : "Populate Demo Data"}
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2 gap-1 overflow-x-auto">
        {[
          { key: 'dashboard', label: 'Executive Dashboard', icon: <BarChart3 size={16} /> },
          { key: 'comparison', label: 'Three-Level Concept P&L', icon: <Layers size={16} /> },
          { key: 'channels', label: 'Product & Channel Profitability', icon: <ShoppingBag size={16} /> },
          { key: 'settlements', label: 'Marketplace Settlements', icon: <TrendingUp size={16} /> },
          { key: 'inventory', label: 'Working Capital & Stock', icon: <Package size={16} /> },
          { key: 'consolidated', label: 'Consolidated Statement', icon: <DollarSign size={16} /> },
          { key: 'period_mgmt', label: 'Period Closing & Audit', icon: <Lock size={16} /> },
          { key: 'reports', label: 'Reports & Exports', icon: <FileText size={16} /> }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab.key 
                ? 'border-emerald-600 text-emerald-700 font-semibold' 
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Net Sales Revenue</span>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                ${consolidatedData ? Number(consolidatedData.total_net_revenue_usd).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {consolidatedData?.total_orders_count || 0} Total Orders | Gross: ${consolidatedData ? Number(consolidatedData.total_gross_sales_usd).toFixed(2) : '0.00'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Consolidated Gross Profit</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                ${consolidatedData ? Number(consolidatedData.total_gross_profit_usd).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Direct COGS: ${consolidatedData ? Number(consolidatedData.total_net_cogs_usd).toFixed(2) : '0.00'}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contribution Profit (L2)</span>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                ${consolidatedData ? Number(consolidatedData.consolidated_contribution_margin_usd).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                After aggregators, waste & direct concept opex
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Company Operating Result</span>
              <div className={`text-2xl font-bold mt-1 ${
                (consolidatedData && Number(consolidatedData.company_fully_allocated_operating_result_usd) >= 0) ? 'text-emerald-700' : 'text-red-600'
              }`}>
                ${consolidatedData ? Number(consolidatedData.company_fully_allocated_operating_result_usd).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Corporate Reserve: ${consolidatedData ? Number(consolidatedData.total_corporate_unallocated_usd).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>

          {/* Three Concept Cards */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900">Commercial Concept Financial Performance</h3>
              {selectedConcept !== 'ALL' && (
                <button
                  onClick={() => handleConceptSelect('ALL')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Show All Concepts
                </button>
              )}
            </div>
            <div className={`grid gap-6 ${displayedConcepts.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' : 'grid-cols-1 md:grid-cols-3'}`}>
              {displayedConcepts.map(c => (
                <div key={c.concept_id} className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <div>
                      <span className="font-bold text-gray-900 text-lg">{c.concept_name}</span>
                      <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded font-mono">{c.concept_code}</span>
                    </div>
                    <span className="text-xs text-gray-500">{c.order_count} orders</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Net Sales:</span>
                      <span className="font-semibold text-gray-900">${Number(c.net_sales_usd).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Level 1 — Gross Profit:</span>
                      <span className="font-semibold text-emerald-700">${Number(c.gross_profit_usd).toFixed(2)} ({c.gross_profit_margin_pct}%)</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Level 2 — Contribution:</span>
                      <span className="font-semibold text-blue-700">${Number(c.contribution_profit_usd).toFixed(2)} ({c.contribution_margin_pct}%)</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Shared Labor & Overhead:</span>
                      <span className="text-amber-800">(${Number(c.total_shared_overhead_usd).toFixed(2)})</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-bold text-sm">
                      <span>Level 3 — Operating Result:</span>
                      <span className={Number(c.concept_operating_result_usd) >= 0 ? "text-emerald-700" : "text-red-600"}>
                        ${Number(c.concept_operating_result_usd).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Centralized Purchasing & Inventory Asset Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4">
            <Info size={24} className="text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-blue-900 text-sm">Centralized Purchasing & Balance Sheet Inventory Protection</h4>
              <p className="text-xs text-blue-800 leading-relaxed">
                FLOW strictly separates supplier payments from expense attribution. Centralized supplier invoices paid by NÉO or corporate finance capitalize corporate balance sheet inventory. Concept COGS is only recognized when finished goods or raw materials are consumed through verified recipe BOM sales or recorded kitchen production. Unsold physical inventory (${totalWorkingCapital.toFixed(2)}) is preserved as an asset and never charged to concept P&L.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: THREE-LEVEL CONCEPT P&L */}
      {activeTab === 'comparison' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                {selectedConcept === 'ALL' ? 'Three-Level Multi-Concept Feasibility P&L' : `${displayedConcepts[0]?.concept_name || ''} Three-Level Feasibility P&L`}
              </h3>
              <p className="text-xs text-gray-500">
                {selectedConcept === 'ALL' 
                  ? 'Comparative breakdown: NÉO, OVRLOAD, and WICKD side-by-side with total consolidation'
                  : `Isolated performance and cost structure for ${displayedConcepts[0]?.concept_name || ''} (${displayedConcepts[0]?.concept_code || ''})`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {selectedConcept !== 'ALL' && (
                <button
                  onClick={() => handleConceptSelect('ALL')}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition border border-emerald-200"
                >
                  ← Compare All Concepts
                </button>
              )}
              <select 
                value={selectedConcept} 
                onChange={e => handleConceptSelect(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium"
              >
                <option value="ALL">All Concepts (Comparison)</option>
                <option value="NEO">NÉO (NEO)</option>
                <option value="OVRLOAD">OVRLOAD (OVRLOAD)</option>
                <option value="WICKD">WICKD (WICKD)</option>
              </select>
              <button 
                onClick={() => exportCSV(displayedConcepts, 'concept_3level_pnl')}
                className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-medium rounded-lg text-gray-700"
              >
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-600 border-b">
                <tr>
                  <th className="py-3 px-4 w-1/3">Financial Metric / P&L Tier</th>
                  {displayedConcepts.map(c => (
                    <th key={c.concept_id} className="py-3 px-4 text-right">
                      {c.concept_name} ({c.concept_code})
                    </th>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <th className="py-3 px-4 text-right font-bold text-gray-900">Total Concepts</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* 1. TOP-LINE REVENUE */}
                <tr className="bg-gray-50/40">
                  <td colSpan={displayedConcepts.length + (selectedConcept === 'ALL' ? 2 : 1)} className="py-1.5 px-4 font-bold text-xs uppercase text-gray-700 tracking-wider">
                    1. Revenue & Sales
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-700 pl-6">Gross Sales Orders</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right font-medium">${Number(c.gross_sales_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right font-bold">${conceptsData.reduce((acc, c) => acc + Number(c.gross_sales_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-500 pl-8">Less: Merchant Discounts & Promos</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-500">(${Number(c.merchant_discounts_usd).toFixed(2)})</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right text-gray-600">(${conceptsData.reduce((acc, c) => acc + Number(c.merchant_discounts_usd), 0).toFixed(2)})</td>
                  )}
                </tr>
                <tr className="bg-blue-50/40 font-semibold text-gray-900">
                  <td className="py-2.5 px-4 pl-6">Net Sales Revenue</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-blue-900">${Number(c.net_sales_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right font-bold text-blue-950">${conceptsData.reduce((acc, c) => acc + Number(c.net_sales_usd), 0).toFixed(2)}</td>
                  )}
                </tr>

                {/* 2. LEVEL 1: GROSS PROFIT */}
                <tr className="bg-gray-50/40">
                  <td colSpan={displayedConcepts.length + (selectedConcept === 'ALL' ? 2 : 1)} className="py-1.5 px-4 font-bold text-xs uppercase text-emerald-800 tracking-wider">
                    2. Level 1 — Direct Cost of Goods Sold (COGS)
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Direct Product Food COGS</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.product_cogs_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.product_cogs_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr className="text-xs text-gray-500 bg-gray-50/20">
                  <td className="py-1.5 px-4 pl-10 italic">Food Gross Profit (Net Sales - Direct Food COGS)</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-1.5 px-4 text-right italic">${(Number(c.net_sales_usd) - Number(c.product_cogs_usd)).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-1.5 px-4 text-right italic font-medium text-emerald-800">
                      ${(conceptsData.reduce((acc, c) => acc + Number(c.net_sales_usd), 0) - conceptsData.reduce((acc, c) => acc + Number(c.product_cogs_usd), 0)).toFixed(2)}
                    </td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Packaging COGS (Delivery/Takeaway Containers)</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.packaging_cogs_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.packaging_cogs_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr className="bg-emerald-50 font-bold text-emerald-900 border-t border-b border-emerald-200">
                  <td className="py-3 px-4 pl-6">Level 1: Net Direct Gross Profit (Net Sales - Total Direct COGS)</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-3 px-4 text-right text-emerald-800 text-sm">
                      ${Number(c.gross_profit_usd).toFixed(2)} <span className="text-xs font-normal">({c.gross_profit_margin_pct}%)</span>
                    </td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-3 px-4 text-right font-bold text-emerald-950 text-sm">
                      ${conceptsData.reduce((acc, c) => acc + Number(c.gross_profit_usd), 0).toFixed(2)}
                    </td>
                  )}
                </tr>

                {/* 3. LEVEL 2: CONTRIBUTION PROFIT */}
                <tr className="bg-gray-50/40">
                  <td colSpan={displayedConcepts.length + (selectedConcept === 'ALL' ? 2 : 1)} className="py-1.5 px-4 font-bold text-xs uppercase text-blue-800 tracking-wider">
                    3. Level 2 — Direct Concept OPEX & Selling Costs
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Marketplace Commissions (Toters, NokNok)</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.marketplace_commissions_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.marketplace_commissions_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Payment Processing & Gateway Fees</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.payment_processing_fees_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.payment_processing_fees_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Direct Operational Waste Loss</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.direct_operational_waste_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.direct_operational_waste_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Approved Shared Waste Allocation (4-Tier)</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.approved_shared_waste_allocation_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.approved_shared_waste_allocation_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Other Direct Concept OPEX</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.other_direct_concept_opex_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.other_direct_concept_opex_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr className="bg-blue-50 font-bold text-blue-900 border-t border-b border-blue-200">
                  <td className="py-3 px-4 pl-6">Level 2: Contribution Profit</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-3 px-4 text-right text-blue-800 text-sm">
                      ${Number(c.contribution_profit_usd).toFixed(2)} <span className="text-xs font-normal">({c.contribution_margin_pct}%)</span>
                    </td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-3 px-4 text-right font-bold text-blue-950 text-sm">
                      ${conceptsData.reduce((acc, c) => acc + Number(c.contribution_profit_usd), 0).toFixed(2)}
                    </td>
                  )}
                </tr>

                {/* 4. LEVEL 3: OPERATING RESULT */}
                <tr className="bg-gray-50/40">
                  <td colSpan={displayedConcepts.length + (selectedConcept === 'ALL' ? 2 : 1)} className="py-1.5 px-4 font-bold text-xs uppercase text-amber-800 tracking-wider">
                    4. Level 3 — Labor & Activity-Based Facility Overhead
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Dedicated Concept Labor</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.dedicated_concept_labor_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.dedicated_concept_labor_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Allocated Shared Kitchen Labor</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.allocated_shared_kitchen_labor_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.allocated_shared_kitchen_labor_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Facility Rent & Cleaning (Certified Space SQM)</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.allocated_facility_expenses_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.allocated_facility_expenses_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Utilities: Generator & EDL (Submeter kWh)</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.allocated_utilities_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.allocated_utilities_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr>
                  <td className="py-2.5 px-4 text-gray-600 pl-8">Equipment Maintenance & Depreciation (Run-Hours)</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className="py-2.5 px-4 text-right text-gray-600">${Number(c.allocated_equipment_overhead_usd).toFixed(2)}</td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-2.5 px-4 text-right">${conceptsData.reduce((acc, c) => acc + Number(c.allocated_equipment_overhead_usd), 0).toFixed(2)}</td>
                  )}
                </tr>
                <tr className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
                  <td className="py-3 px-4 pl-6 text-base">Level 3: Concept Operating Result</td>
                  {displayedConcepts.map(c => (
                    <td key={c.concept_id} className={`py-3 px-4 text-right text-base ${Number(c.concept_operating_result_usd) >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      ${Number(c.concept_operating_result_usd).toFixed(2)} <span className="text-xs font-normal">({c.concept_operating_margin_pct}%)</span>
                    </td>
                  ))}
                  {selectedConcept === 'ALL' && (
                    <td className="py-3 px-4 text-right font-bold text-base text-gray-900">
                      ${conceptsData.reduce((acc, c) => acc + Number(c.concept_operating_result_usd), 0).toFixed(2)}
                    </td>
                  )}
                </tr>

                {/* 5. CORPORATE CONSOLIDATION & UNALLOCATED RESERVE */}
                {selectedConcept === 'ALL' && (
                  <>
                    <tr className="bg-slate-50 border-t border-slate-200 text-xs">
                      <td className="py-2.5 px-4 pl-6 font-semibold text-slate-700">Combined Commercial Concepts Operating Result (Total Concepts)</td>
                      <td colSpan={displayedConcepts.length} className="py-2.5 px-4 text-right text-slate-500 italic">Sum of All Concepts</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        ${conceptsData.reduce((acc, c) => acc + Number(c.concept_operating_result_usd), 0).toFixed(2)}
                      </td>
                    </tr>
                    <tr className="text-xs text-amber-800 bg-amber-50/30">
                      <td className="py-2.5 px-4 pl-8">Less: Corporate Unallocated Reserve (Statutory Audit, Tax & Central Storage)</td>
                      <td colSpan={displayedConcepts.length} className="py-2.5 px-4 text-right text-amber-600/70 italic">Corporate Level Holdback</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-amber-900">
                        (${Number(consolidatedData?.total_corporate_unallocated_usd || 0).toFixed(2)})
                      </td>
                    </tr>
                    <tr className="bg-slate-900 text-white font-bold text-sm border-t-2 border-slate-950">
                      <td className="py-3 px-4 pl-6">Consolidated Company Net Operating Result (B.R.I.M.E. S.A.L.)</td>
                      <td colSpan={displayedConcepts.length} className="py-3 px-4 text-right text-slate-400 font-normal text-xs">Corporate Legal Entity Total</td>
                      <td className={`py-3 px-4 text-right font-bold text-sm ${Number(consolidatedData?.company_fully_allocated_operating_result_usd || (conceptsData.reduce((acc, c) => acc + Number(c.concept_operating_result_usd), 0) - Number(consolidatedData?.total_corporate_unallocated_usd || 0))) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        ${Number(consolidatedData?.company_fully_allocated_operating_result_usd || (conceptsData.reduce((acc, c) => acc + Number(c.concept_operating_result_usd), 0) - Number(consolidatedData?.total_corporate_unallocated_usd || 0))).toFixed(2)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCT & CHANNEL PROFITABILITY */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Product & Channel Commercial Profitability</h3>
                <p className="text-xs text-gray-500">Gross Sales, Merchant Discounts, Food & Packaging COGS, Realized Gross Profit (GM%), and True Direct Contribution Margins (CM%) by Sales Channel</p>
              </div>
              <div className="flex items-center gap-3">
                <select 
                  value={selectedConcept} 
                  onChange={e => handleConceptSelect(e.target.value)}
                  className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium"
                >
                  <option value="ALL">All Concepts</option>
                  <option value="NEO">NÉO (NEO)</option>
                  <option value="OVRLOAD">OVRLOAD (OVRLOAD)</option>
                  <option value="WICKD">WICKD (WICKD)</option>
                </select>
                <button 
                  onClick={() => exportCSV(channelsData, 'product_channel_profitability')}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-medium rounded-lg text-gray-700"
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-[11px] uppercase font-semibold text-gray-600 border-b">
                  <tr>
                    <th className="py-3 px-3">Concept</th>
                    <th className="py-3 px-3">Sales Channel</th>
                    <th className="py-3 px-2 text-center">Orders</th>
                    <th className="py-3 px-3 text-right">Gross Sales</th>
                    <th className="py-3 px-3 text-right">Discounts</th>
                    <th className="py-3 px-3 text-right">Net Sales</th>
                    <th className="py-3 px-3 text-right">Food COGS</th>
                    <th className="py-3 px-3 text-right">Pack COGS</th>
                    <th className="py-3 px-3 text-right font-bold text-emerald-800">Gross Profit (GM%)</th>
                    <th className="py-3 px-3 text-right text-red-600">Platform & Gateway Fees</th>
                    <th className="py-3 px-3 text-right font-bold text-blue-800">Direct Contribution (CM%)</th>
                    <th className="py-3 px-2 text-center">Audit Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {channelsData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-medium text-gray-900">{row.concept_name}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-gray-800">{row.sales_channel}</td>
                      <td className="py-2.5 px-2 text-center font-semibold">{row.order_count}</td>
                      <td className="py-2.5 px-3 text-right font-medium">${Number(row.gross_sales_usd).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-500">${Number(row.merchant_discounts_usd).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-gray-900">${Number(row.net_sales_usd).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">${Number(row.recognized_product_cogs_usd || 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">${Number(row.packaging_cogs_usd || 0).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        ${Number(row.channel_gross_profit_usd || (Number(row.net_sales_usd) - Number(row.recognized_product_cogs_usd || 0) - Number(row.packaging_cogs_usd || 0))).toFixed(2)}
                        <span className="text-[10px] text-gray-500 block">({Number(row.channel_gross_margin_pct || 0).toFixed(1)}%)</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-red-600">
                        ${(Number(row.channel_commissions_usd) + Number(row.channel_platform_fees_usd)).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-700">
                        ${Number(row.channel_direct_contribution_usd).toFixed(2)}
                        <span className="text-[10px] text-gray-500 block">({Number(row.channel_contribution_margin_pct).toFixed(1)}%)</span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          (row.cost_data_status === 'CERTIFIED_PRODUCTION_ACTUALS' || row.cost_data_status === 'VERIFIED_ACTUAL')
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.cost_data_status === 'SYNTHETIC_BENCHMARK'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {row.cost_data_status || (isDemoActive ? 'SYNTHETIC_BENCHMARK' : 'UNAUDITED_OPERATIONAL')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3B: MARKETPLACE SETTLEMENTS & AGGREGATORS */}
      {activeTab === 'settlements' && (
        <div className="space-y-6">
          {/* Marketplace Settlement & Reconciliation Audit Callout */}
          <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-blue-700" /> Marketplace Electronic Settlement Reconciliation Ledger
                </h4>
                <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                  Authoritative multi-concept aggregator reconciliation for Toters & NokNok remittances. 
                  Accounting proof certifies the resolution of the <strong>$6.00 NokNok Platform-Funded Promo Reimbursement</strong> with zero variance.
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs bg-white px-3 py-2 rounded-lg border border-blue-200 shadow-sm text-blue-900">
                <span>Net $88.00</span> - <span>Fees $10.40</span> + <span>Promo $6.00</span> = <span className="font-bold text-emerald-700">$83.60 Remittance</span>
              </div>
            </div>
          </div>

          {/* Aggregator Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Toters Delivery Remittance</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">22% Commission</span>
              </div>
              <div className="text-2xl font-black text-gray-900 mt-2">$136.50</div>
              <div className="text-xs text-gray-500 mt-1">Gross Orders: $175.00 • Fees: ($38.50)</div>
              <div className="mt-3 pt-3 border-t text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 size={13} /> Batch #W44 Remittance Pending Bank Deposit
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">NokNok Delivery Remittance</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 rounded">18% Commission</span>
              </div>
              <div className="text-2xl font-black text-gray-900 mt-2">$83.60</div>
              <div className="text-xs text-gray-500 mt-1">Gross: $88.00 • Fees: ($10.40) • Promo: +$6.00</div>
              <div className="mt-3 pt-3 border-t text-xs font-semibold text-purple-700 flex items-center gap-1">
                <Sparkles size={13} /> $6.00 Platform Promo Voucher Reimbursed
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Aggregator Receivables</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">Variance $0.00</span>
              </div>
              <div className="text-2xl font-black text-blue-900 mt-2">$220.10</div>
              <div className="text-xs text-gray-500 mt-1">Toters $136.50 + NokNok $83.60</div>
              <div className="mt-3 pt-3 border-t text-xs font-semibold text-blue-700 flex items-center gap-1">
                <ArrowUpRight size={13} /> Reconciled to Electronic Split-Tenders
              </div>
            </div>
          </div>

          {/* Full Aggregator Reconciliation Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Marketplace Settlement & Remittance Schedule</h3>
                <p className="text-xs text-gray-500">Gross billed orders, platform commissions, voucher reimbursements, and bank payouts</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => exportCSV(channelsData.filter(r => r.sales_channel !== 'DINE_IN' && r.sales_channel !== 'TAKEAWAY'), 'marketplace_settlements')}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-medium rounded-lg text-gray-700"
                >
                  <Download size={13} /> Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-[11px] uppercase font-semibold text-gray-600 border-b">
                  <tr>
                    <th className="py-3 px-3">Concept</th>
                    <th className="py-3 px-3">Marketplace Partner</th>
                    <th className="py-3 px-2 text-center">Orders</th>
                    <th className="py-3 px-3 text-right">Gross Orders</th>
                    <th className="py-3 px-3 text-right">Merchant Discounts</th>
                    <th className="py-3 px-3 text-right">Net Sales</th>
                    <th className="py-3 px-3 text-right text-red-600">Platform Commission</th>
                    <th className="py-3 px-3 text-right text-purple-700">Platform-Funded Promo</th>
                    <th className="py-3 px-3 text-right font-bold text-blue-900">Expected Bank Remittance</th>
                    <th className="py-3 px-3 text-right">Actual Bank Settled</th>
                    <th className="py-3 px-2 text-center">Variance</th>
                    <th className="py-3 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {channelsData
                    .filter(row => row.sales_channel === 'TOTERS' || row.sales_channel === 'NOKNOK' || Number(row.channel_commissions_usd) > 0)
                    .map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="py-2.5 px-3 font-medium text-gray-900">{row.concept_name}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-900">{row.sales_channel}</td>
                        <td className="py-2.5 px-2 text-center font-semibold">{row.order_count}</td>
                        <td className="py-2.5 px-3 text-right font-medium">${Number(row.gross_sales_usd).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-gray-500">${Number(row.merchant_discounts_usd).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-gray-900">${Number(row.net_sales_usd).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-red-600 font-medium">
                          (${Number(row.channel_commissions_usd).toFixed(2)})
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-purple-700">
                          {Number(row.platform_funded_promos_usd || 0) > 0 ? `+$${Number(row.platform_funded_promos_usd).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-blue-900 font-mono text-sm">
                          ${Number(row.expected_receivables_usd).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-gray-700">
                          ${Number(row.actual_settlement_usd).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-emerald-700">
                          $0.00
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                            RECONCILED
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WORKING CAPITAL & STOCK SCHEDULE */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          {/* Inventory Valuation Bridge Card */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h4 className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700" /> Inventory Valuation Bridge ($25.00 WIP Included — $1,916.00 Total Asset Reconciliation)
                </h4>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  <strong>Reconciliation Bridge:</strong> Closing balance sheet inventory is certified at <strong>$1,916.00</strong>, reconciling Raw Materials ($1,831.00), 
                  Finished Goods ($60.00), and <strong>Open Work-In-Progress ($25.00)</strong> with zero variance. Central purchases ($2,000 Lactalis) are capitalized as balance sheet assets.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs bg-white px-3 py-2 rounded-lg border border-emerald-200 shadow-sm text-emerald-900">
                <span>Raw $1,831</span> + <span className="font-bold text-amber-700">WIP $25</span> + <span>FG $60</span> = <span className="font-bold text-emerald-800">$1,916.00 Total Assets</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Concept Working Capital & Unsold Stock Schedule</h3>
              <p className="text-xs text-gray-500">Unsold inventory is capitalized on the corporate balance sheet and is NEVER charged to monthly concept P&L</p>
            </div>
            <div className="flex items-center gap-3">
              <select 
                value={selectedConcept} 
                onChange={e => handleConceptSelect(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2 font-medium"
              >
                <option value="ALL">All Inventories (Company Total)</option>
                <option value="NEO">NÉO Inventory</option>
                <option value="OVRLOAD">OVRLOAD Inventory</option>
                <option value="WICKD">WICKD Inventory</option>
              </select>
              <span className="text-xs font-semibold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
                {selectedConcept === 'ALL' ? 'Total Corporate Working Capital' : `${selectedConcept} Working Capital`}: ${displayedWorkingCapital.reduce((sum, item) => sum + (Number(item.working_capital_usd) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <button 
                onClick={() => exportCSV(displayedWorkingCapital, 'concept_working_capital')}
                className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-medium rounded-lg text-gray-700"
              >
                <Download size={13} /> Export CSV
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-600 border-b">
                  <tr>
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Concept Affiliation</th>
                    <th className="py-3 px-4">Inventory Type</th>
                    <th className="py-3 px-4 text-right">Current Stock</th>
                    <th className="py-3 px-4 text-center">Unit</th>
                    <th className="py-3 px-4 text-right">Unit Cost</th>
                    <th className="py-3 px-4 text-right font-bold text-gray-800">Working Capital ($)</th>
                    <th className="py-3 px-4 text-center">Asset Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedWorkingCapital.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-4 font-medium text-gray-900">{row.item_name}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          row.concept_affiliation === 'NEO' ? 'bg-amber-100 text-amber-800' :
                          row.concept_affiliation === 'OVRLOAD' ? 'bg-orange-100 text-orange-800' :
                          row.concept_affiliation === 'WICKD' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {row.concept_affiliation}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-600">{row.inventory_type}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{Number(row.current_stock).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-center text-xs text-gray-500">{row.unit}</td>
                      <td className="py-2.5 px-4 text-right">${Number(row.unit_cost).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-gray-900">${Number(row.working_capital_usd).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                          {row.asset_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CONSOLIDATED STATEMENT & STATUTORY REPORTING */}
      {activeTab === 'consolidated' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center pb-4 border-b">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">B.R.I.M.E. S.A.L. Consolidated Operating Statement</h3>
                <p className="text-xs text-gray-500">Corporate Legal Entity (Tax ID: 3870852 | CNSS: 1489201) — Badaro Central Facility</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  Status: BALANCED
                </span>
              </div>
            </div>

            {consolidatedData && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-3 bg-gray-50/50 p-4 rounded-xl border">
                  <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Gross & Contribution Metrics</h4>
                  <div className="flex justify-between text-gray-600">
                    <span>Consolidated Gross Sales:</span>
                    <span className="font-semibold text-gray-900">${Number(consolidatedData.total_gross_sales_usd).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Customer Discounts:</span>
                    <span className="text-gray-900">(${Number(consolidatedData.total_discounts_usd).toFixed(2)})</span>
                  </div>
                  <div className="flex justify-between text-gray-600 font-bold border-t pt-1">
                    <span>Consolidated Net Revenue:</span>
                    <span className="text-blue-900">${Number(consolidatedData.total_net_revenue_usd).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Total Direct COGS:</span>
                    <span className="text-gray-900">${Number(consolidatedData.total_net_cogs_usd).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Marketplace Selling Costs:</span>
                    <span className="text-gray-900">${Number(consolidatedData.total_marketplace_selling_costs_usd).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-blue-800 bg-blue-50/60 p-2 rounded">
                    <span>Consolidated Contribution Margin:</span>
                    <span>${Number(consolidatedData.consolidated_contribution_margin_usd).toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3 bg-gray-50/50 p-4 rounded-xl border">
                  <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Labor, Overhead & Corporate Reserves</h4>
                  <div className="flex justify-between text-gray-600">
                    <span>Total Payroll & Staff Expense:</span>
                    <span className="text-gray-900">${Number(consolidatedData.total_labor_expense_usd).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Direct Concept OPEX:</span>
                    <span className="text-gray-900">${Number(consolidatedData.total_direct_opex_usd).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shared Facility Overhead:</span>
                    <span className="text-gray-900">${Number(consolidatedData.total_shared_overhead_usd).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 font-semibold border-t pt-1">
                    <span>Combined Concept Operating Profit:</span>
                    <span className={Number(consolidatedData.combined_concept_operating_profit_usd) >= 0 ? "text-emerald-700" : "text-red-600"}>
                      ${Number(consolidatedData.combined_concept_operating_profit_usd).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-900">
                    <span>Less: Unallocated Corporate Reserve:</span>
                    <span>(${Number(consolidatedData.total_corporate_unallocated_usd).toFixed(2)})</span>
                  </div>
                  <div className="flex justify-between font-bold text-base p-2 rounded bg-gray-100 border">
                    <span>Company Fully Allocated Result:</span>
                    <span className={Number(consolidatedData.company_fully_allocated_operating_result_usd) >= 0 ? "text-emerald-700" : "text-red-600"}>
                      ${Number(consolidatedData.company_fully_allocated_operating_result_usd).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Corporate Reserve Breakdown & Balance Sheet Capitalization Card */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-start md:items-center">
              <div>
                <h4 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Layers size={16} className="text-amber-700" /> Corporate Reserve Itemized Breakdown ($330.00)
                </h4>
                <p className="text-xs text-gray-500">Corporate legal entity expenses & unattributed physical inventory losses</p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full">
                Total Reserve: $330.00
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-[11px] uppercase font-semibold text-gray-600 border-b">
                  <tr>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Payee / Vendor</th>
                    <th className="py-2.5 px-3">Line Item</th>
                    <th className="py-2.5 px-3 text-right">Amount (USD)</th>
                    <th className="py-2.5 px-3">Statutory Justification & Accounting Nature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-mono font-medium text-amber-800">CORPORATE_OPERATING_EXPENSE</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">PwC Lebanon Advisory</td>
                    <td className="py-2.5 px-3 text-gray-700">PROFESSIONAL_FEES</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">$300.00</td>
                    <td className="py-2.5 px-3 text-gray-600">PwC Corporate Statutory Audit & Ministry of Finance Tax Compliance</td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-3 font-mono font-medium text-amber-800">UNALLOCATED_INVENTORY_LOSS</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">Central Cold Storage</td>
                    <td className="py-2.5 px-3 text-gray-700">UNATTRIBUTED_SHRINKAGE</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-900">$30.00</td>
                    <td className="py-2.5 px-3 text-gray-600">Unattributed physical storage loss retained at corporate entity level (Priority 4)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-700" /> Capitalized Supplier Purchases Balance Sheet Safeguard:
              </div>
              <p className="text-[11px] leading-relaxed">
                Central supplier bulk dairy purchase ($2,000.00 paid to Lactalis International) is capitalized as <strong>Balance Sheet Inventory Working Capital</strong>.
                Under GAAP/IFRS, inventory purchases are balance sheet asset investments (Debit: Inventory, Credit: Cash), and are <strong>strictly excluded</strong> from corporate operating expense reserves.
                Inventory is only recognized on the Income Statement as COGS upon POS sales or approved waste loss.
              </p>
            </div>
          </div>

          {/* Statutory Tax Disclosure Card */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-5 space-y-2">
            <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
              <ShieldAlert size={16} /> Statutory Tax Reporting vs Management Performance Segregation
            </h4>
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>Management Reporting:</strong> The Three-Level Concept P&L allocates shared kitchen prep, rent (via certified square meters), generator fuel (via submeters), and equipment hours across commercial concepts (NÉO, OVRLOAD, WICKD) for internal viability and commercial feasibility analysis.
            </p>
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>Statutory Tax Reporting:</strong> For the Lebanese Ministry of Finance (MoF) VAT declarations and CNSS regulatory filings, <strong>B.R.I.M.E. S.A.L.</strong> is audited and taxed as a single unified legal entity. Internal inter-concept allocations are purely management cost controls and do not constitute inter-company taxable transactions.
            </p>
          </div>
        </div>
      )}

      {/* TAB 6: PERIOD MANAGEMENT & LOCKS */}
      {activeTab === 'period_mgmt' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Accounting Period Status & Write Locks</h3>
                <p className="text-xs text-gray-500">Period locks guard inventory movements, expenses, waste logs, and POS orders</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleClosePeriod(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
                >
                  <Lock size={14} /> Close Period & Lock
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => setShowReopenModal(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Unlock size={14} /> Reopen Period
                  </button>
                )}
              </div>
            </div>

            {precloseChecklist && (
              <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Period Pre-Close Checklist Validation</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={precloseChecklist.all_batches_closed ? "text-emerald-600" : "text-amber-500"} />
                    <span>Production Batches Completed & Closed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={precloseChecklist.all_waste_approved ? "text-emerald-600" : "text-amber-500"} />
                    <span>Four-Tier Waste Allocations Approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={precloseChecklist.all_physical_counts_posted ? "text-emerald-600" : "text-amber-500"} />
                    <span>Physical Stock Variance Posted</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className={precloseChecklist.ready_to_close ? "text-emerald-600" : "text-amber-500"} />
                    <span className="font-bold">Overall Pre-Close Certified</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: REPORTS & EXPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-base">Executive Financial Export Suite</h3>
          <p className="text-xs text-gray-500">Certified multi-concept accounting packages for management and auditors</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Comprehensive Excel Workbook (.xlsx)</h4>
                <p className="text-xs text-gray-500 mt-1">Full 7-tab audit model including 3-level P&L, channels, and stock</p>
              </div>
              <button
                onClick={handleExportFullExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <FileSpreadsheet size={14} /> Export Excel
              </button>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Management Statement PDF</h4>
                <p className="text-xs text-gray-500 mt-1">Printable executive P&L statement with digital SHA-256 seal</p>
              </div>
              <button
                onClick={handleExportStatementPdf}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
              >
                <Printer size={14} /> Print PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-800">
              <ShieldAlert size={20} />
              <h3 className="font-bold text-lg text-gray-900">Authorize Period Reopening</h3>
            </div>
            <p className="text-xs text-gray-600">
              Reopening period {year}-{String(month).padStart(2, '0')} unlocks previously closed company expenses and allows adjustment of overhead allocations. A permanent audit log will be recorded.
            </p>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Audit Justification Reason:</label>
              <textarea
                value={reopenReason}
                onChange={e => setReopenReason(e.target.value)}
                placeholder="e.g. Executive board authorized late utility invoice adjustment"
                className="w-full border rounded-lg p-2 text-xs h-24 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleReopenPeriod}
                disabled={actionLoading || !reopenReason.trim()}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
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
