import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, Plus, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, 
  RefreshCw, Power, Radio, ShieldCheck, ChevronRight, Layers, FileText,
  Search, Check, Filter, Info, Server, Wifi, ArrowRight, CornerDownRight,
  Store, Ban, Send, PlayCircle, Eye, X
} from 'lucide-react';
import { 
  printerApi, 
  type PosPrinter, 
  type PosPrinterSectionRoute, 
  type PosPrintJob, 
  type CatalogProductCoverage 
} from '../../api/printerApi';
import { supabase } from '../../api/supabase';
import './PrinterManagementScreen.css';

interface PrinterManagementScreenProps {
  user?: any;
  permissions?: any;
}

export default function PrinterManagementScreen({ user, permissions }: PrinterManagementScreenProps) {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'printers' | 'routes' | 'coverage' | 'jobs'>('printers');

  // Branch Selection
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('9c214659-9cc7-4f33-b115-cbbb8a823a94');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Data States
  const [printers, setPrinters] = useState<PosPrinter[]>([]);
  const [routes, setRoutes] = useState<PosPrinterSectionRoute[]>([]);
  const [coverageData, setCoverageData] = useState<{
    totalProducts: number;
    routedCount: number;
    noPrintCount: number;
    unassignedCount: number;
    products: CatalogProductCoverage[];
    fallbackPrinter?: PosPrinter | null;
    mainBillPrinter?: PosPrinter | null;
  }>({
    totalProducts: 0,
    routedCount: 0,
    noPrintCount: 0,
    unassignedCount: 0,
    products: []
  });
  const [printJobs, setPrintJobs] = useState<PosPrintJob[]>([]);

  // Printer Modal State (Add / Edit)
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PosPrinter | null>(null);
  const [printerFormData, setPrinterFormData] = useState<Partial<PosPrinter>>({
    name: '',
    printer_role: 'kitchen',
    connection_type: 'network_raw',
    windows_printer_name: '',
    ip_address: '',
    port: 9100,
    paper_width_mm: 80,
    is_active: true,
    is_receipt_printer: false,
    is_fallback: false
  });
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);

  // Payload Inspector Modal
  const [inspectedJob, setInspectedJob] = useState<PosPrintJob | null>(null);

  // Batch Assignment State (Tab 3)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [batchSection, setBatchSection] = useState<string>('Kitchen');
  const [batchOverride, setBatchOverride] = useState<'INHERIT' | 'PRINT' | 'NO_PRINT'>('INHERIT');
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'routed' | 'no_print' | 'unassigned'>('all');
  const [coverageSearch, setCoverageSearch] = useState('');

  // Notifications
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Initial Load: Branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await supabase.from('branches').select('id, name').order('name');
        if (data && data.length > 0) {
          setBranches(data);
          // Default to Badaro or first branch
          const badaro = data.find(b => b.name.toLowerCase().includes('badaro'));
          setSelectedBranchId(badaro ? badaro.id : data[0].id);
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
      }
    };
    fetchBranches();
  }, []);

  // 2. Fetch Data for selected branch
  const loadData = async () => {
    if (!selectedBranchId) return;
    setLoading(true);
    try {
      const [printersRes, routesRes, coverageRes, jobsRes] = await Promise.all([
        printerApi.getPrinters(selectedBranchId, user),
        printerApi.getSectionRoutes(selectedBranchId, user),
        printerApi.getCatalogCoverage(selectedBranchId, user),
        printerApi.getPrintJobs({ branchId: selectedBranchId, limit: 40 }, user)
      ]);

      if (printersRes.success) setPrinters(printersRes.data);
      if (routesRes.success) setRoutes(routesRes.data);
      if (coverageRes.success) setCoverageData(coverageRes);
      if (jobsRes.success) setPrintJobs(jobsRes.data);
    } catch (err: any) {
      showToast('error', 'Error loading printer data: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranchId]);

  // Handle Printer Save (Add / Update)
  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerFormData.name?.trim()) {
      showToast('error', 'Please enter a printer name.');
      return;
    }
    setActionLoading(true);
    try {
      const payload: Partial<PosPrinter> = {
        ...printerFormData,
        branch_id: selectedBranchId
      };

      if (editingPrinter?.id) {
        const res = await printerApi.updatePrinter(editingPrinter.id, payload, user);
        if (res.success) {
          showToast('success', `Printer "${printerFormData.name}" updated successfully!`);
          setIsPrinterModalOpen(false);
          await loadData();
        } else {
          showToast('error', res.error || 'Failed to update printer');
        }
      } else {
        const res = await printerApi.createPrinter(payload, user);
        if (res.success) {
          showToast('success', `Printer "${printerFormData.name}" created successfully!`);
          setIsPrinterModalOpen(false);
          await loadData();
        } else {
          showToast('error', res.error || 'Failed to create printer');
        }
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete Printer
  const handleDeletePrinter = async (p: PosPrinter) => {
    if (!window.confirm(`Are you sure you want to remove printer "${p.name}"? Existing route assignments using this printer will be unlinked.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await printerApi.deletePrinter(p.id);
      if (res.success) {
        showToast('success', `Printer "${p.name}" deleted.`);
        await loadData();
      } else {
        showToast('error', res.error || 'Failed to delete printer');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Toggle Active
  const handleToggleActive = async (p: PosPrinter) => {
    try {
      const nextActive = !p.is_active;
      const res = await printerApi.updatePrinter(p.id, { is_active: nextActive }, user);
      if (res.success) {
        setPrinters(prev => prev.map(item => item.id === p.id ? { ...item, is_active: nextActive } : item));
        showToast('info', `Printer "${p.name}" ${nextActive ? 'activated' : 'deactivated'}.`);
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Handle Test Print
  const handleTestPrint = async (p: Partial<PosPrinter>) => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await printerApi.testPrinterConnection({
        name: p.name,
        ip_address: p.ip_address,
        port: p.port
      });
      setTestResult(res);
      if (res.success) {
        showToast('success', res.message);
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
      showToast('error', err.message);
    } finally {
      setTestingConnection(false);
    }
  };

  // Handle Update Route Row
  const handleUpdateRoute = async (sectionKey: string, printPrep: boolean, printerId: string | null) => {
    try {
      const res = await printerApi.upsertSectionRoute({
        branch_id: selectedBranchId,
        section_key: sectionKey,
        print_preparation_ticket: printPrep,
        printer_id: printPrep ? printerId : null
      }, user);

      if (res.success) {
        showToast('success', `Route for section "${sectionKey}" updated!`);
        await loadData();
      } else {
        showToast('error', res.error || 'Failed to update route');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Handle Batch Section Assignment
  const handleBatchAssign = async () => {
    if (selectedProductIds.size === 0) {
      showToast('error', 'Select at least one product to assign.');
      return;
    }
    setActionLoading(true);
    try {
      const overrideVal = batchOverride === 'INHERIT' ? null : batchOverride;
      const res = await printerApi.batchAssignProductSections(
        Array.from(selectedProductIds),
        batchSection,
        overrideVal,
        user
      );

      if (res.success) {
        showToast('success', `Assigned ${selectedProductIds.size} products to ${batchSection}!`);
        setSelectedProductIds(new Set());
        await loadData();
      } else {
        showToast('error', res.error || 'Failed to batch assign products');
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Products for Coverage Tab
  const filteredProducts = useMemo(() => {
    return coverageData.products.filter(p => {
      const matchesSearch = !coverageSearch || p.name.toLowerCase().includes(coverageSearch.toLowerCase()) || p.category_name.toLowerCase().includes(coverageSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (coverageFilter === 'unassigned') return p.is_unassigned;
      if (coverageFilter === 'no_print') return p.is_no_print;
      if (coverageFilter === 'routed') return !p.is_unassigned && !p.is_no_print;
      return true;
    });
  }, [coverageData.products, coverageFilter, coverageSearch]);

  const toggleSelectAllProducts = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleSelectProduct = (id: number) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);
  };

  // Main Bill Printer resolution
  const mainBillPrinter = printers.find(p => p.is_receipt_printer) || printers.find(p => p.name.toLowerCase() === 'main');
  const fallbackPrepPrinter = printers.find(p => p.is_fallback) || printers.find(p => p.name.toLowerCase().includes('kitchen'));

  return (
    <div className="pm-container min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-3 ${
          toastMessage.type === 'success' ? 'bg-emerald-500 text-white border-emerald-600' :
          toastMessage.type === 'error' ? 'bg-red-500 text-white border-red-600' :
          'bg-slate-800 text-white border-slate-900'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> :
           toastMessage.type === 'error' ? <XCircle size={18} /> :
           <Info size={18} />}
          <span className="text-xs font-bold">{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="pm-header-card flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 bg-white p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center font-black text-2xl shadow-sm">
            <Printer size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Multi-Printer Management & Intelligent Routing
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                FLOW Engine v2.0
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Manage physical LAN thermal printers, automated section routing, dedicated Main bill printing, and bundle expansions.
            </p>
          </div>
        </div>

        {/* Branch Selector & Refresh */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-2xl px-3 py-1.5">
            <Store size={15} className="text-slate-500 mr-2" />
            <span className="text-xs font-bold text-slate-600 mr-2">Branch:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => { setRefreshing(true); loadData(); }}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl border border-slate-200 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-amber-600' : ''} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingPrinter(null);
              setPrinterFormData({
                name: '',
                printer_role: 'kitchen',
                connection_type: 'network_raw',
                ip_address: '',
                port: 9100,
                paper_width_mm: 80,
                is_active: true,
                is_receipt_printer: false,
                is_fallback: false
              });
              setTestResult(null);
              setIsPrinterModalOpen(true);
            }}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-2xl shadow-sm flex items-center gap-2 transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Printer</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Printers */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Configured Printers</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{printers.length}</span>
              <span className="text-xs font-bold text-emerald-600">({printers.filter(p => p.is_active).length} Active)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Main Bill: <span className="font-bold text-slate-700">{mainBillPrinter?.name || 'Not set'}</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Printer size={22} />
          </div>
        </div>

        {/* Card 2: Routed Preparation Sections */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Preparation Routes</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{routes.filter(r => r.print_preparation_ticket && r.printer_id).length}</span>
              <span className="text-xs font-bold text-slate-500">Active Stations</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Fallback: <span className="font-bold text-slate-700">{fallbackPrepPrinter?.name || 'Kitchen (Auto)'}</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Layers size={22} />
          </div>
        </div>

        {/* Card 3: Intentional No-Print (Store / Retail) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">No-Prep (Store / Retail)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">{coverageData.noPrintCount}</span>
              <span className="text-xs font-bold text-slate-500">Items (Excluded from KOT)</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Prints exclusively on customer bill</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Ban size={22} />
          </div>
        </div>

        {/* Card 4: Catalog Coverage / Unassigned */}
        <div className={`border rounded-3xl p-5 shadow-sm flex items-center justify-between ${
          coverageData.unassignedCount > 0 ? 'bg-amber-50/80 border-amber-300' : 'bg-white border-slate-200'
        }`}>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Routing Coverage</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900">
                {coverageData.totalProducts > 0 
                  ? `${Math.round(((coverageData.routedCount + coverageData.noPrintCount) / coverageData.totalProducts) * 100)}%`
                  : '100%'}
              </span>
              {coverageData.unassignedCount > 0 ? (
                <span className="text-xs font-black text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
                  {coverageData.unassignedCount} Unassigned
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-600">100% Verified</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {coverageData.unassignedCount > 0 ? 'Requires section mapping' : 'All items mapped to stations'}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold ${
            coverageData.unassignedCount > 0 ? 'bg-amber-200 text-amber-800' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {coverageData.unassignedCount > 0 ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('printers')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'printers'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Printer size={15} />
          <span>1. Printers Registry</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {printers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('routes')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'routes'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers size={15} />
          <span>2. Section Routing & Eligibility</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {routes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('coverage')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'coverage'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText size={15} />
          <span>3. Catalog Coverage & Audit</span>
          {coverageData.unassignedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-black animate-pulse">
              {coverageData.unassignedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('jobs')}
          className={`px-5 py-2.5 rounded-2xl font-black text-xs transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'jobs'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Server size={15} />
          <span>4. Live Print Jobs & History</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {printJobs.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PRINTERS REGISTRY */}
      {/* ========================================================================= */}
      {activeTab === 'printers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {printers.map(p => {
              const assignedSections = routes.filter(r => r.printer_id === p.id).map(r => r.section_key);
              return (
                <div 
                  key={p.id} 
                  className={`bg-white border rounded-3xl p-6 shadow-sm space-y-4 relative transition hover:shadow-md ${
                    !p.is_active ? 'opacity-60 border-slate-200' : 'border-slate-200'
                  }`}
                >
                  {/* Top line with badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold ${
                        p.is_receipt_printer ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                        p.is_fallback ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        <Printer size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                          {p.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {p.connection_type === 'windows_driver' || p.connection_type === 'usb'
                            ? `ðŸ”Œ USB: ${p.windows_printer_name || p.name}`
                            : p.ip_address ? `LAN: ${p.ip_address}:${p.port}` : 'Local Windows Spooler'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className={`p-1.5 rounded-xl border transition cursor-pointer ${
                          p.is_active 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                        }`}
                        title={p.is_active ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}
                      >
                        <Power size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Special Role Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {p.is_receipt_printer && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500 text-white">
                        Main Bill & Receipt Printer
                      </span>
                    )}
                    {p.is_fallback && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white">
                        Preparation Fallback Printer
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      {p.paper_width_mm}mm Thermal
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                      {p.connection_type.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Assigned Sections */}
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      Assigned Preparation Sections:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {assignedSections.length > 0 ? (
                        assignedSections.map(sec => (
                          <span key={sec} className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {sec}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No preparation sections assigned</span>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleTestPrint(p)}
                      disabled={testingConnection}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Send size={12} className="text-amber-600" />
                      <span>Test Print</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPrinter(p);
                          setPrinterFormData({
                            name: p.name,
                            printer_role: p.printer_role,
                            connection_type: p.connection_type,
                            windows_printer_name: p.windows_printer_name || '',
                            ip_address: p.ip_address,
                            port: p.port,
                            paper_width_mm: p.paper_width_mm,
                            is_active: p.is_active,
                            is_receipt_printer: p.is_receipt_printer,
                            is_fallback: p.is_fallback
                          });
                          setTestResult(null);
                          setIsPrinterModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        title="Edit Printer"
                      >
                        <Edit2 size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePrinter(p)}
                        className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition cursor-pointer"
                        title="Remove Printer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {printers.length === 0 && !loading && (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
              <Printer size={36} className="mx-auto text-slate-300" />
              <h3 className="text-base font-black text-slate-800">No Printers Configured for this Branch</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Add physical thermal printers (e.g. Main bill printer, Kitchen printer, Bar printer) to enable intelligent ticket splitting.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SECTION ROUTING & ELIGIBILITY MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'routes' && (
        <div className="space-y-6">
          {/* Top Info Banner on Dual Separation */}
          <div className="bg-blue-50 border border-blue-200 rounded-3xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-500 text-white flex items-center justify-center shrink-0">
              <Info size={20} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-blue-950">Independent Preparation Tickets vs Customer Bills</h3>
              <p className="text-xs text-blue-800 leading-relaxed">
                Items marked <strong>Print Preparation Ticket: Yes</strong> automatically generate station preparation chits when sent to the kitchen.
                Items marked <strong>No (e.g. Store / Retail)</strong> produce <strong>zero</strong> preparation tickets, but are always preserved on the complete commercial customer bill printed on the designated <strong>Main</strong> bill printer.
              </p>
            </div>
          </div>

          {/* Top Selectors for Dedicated Roles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Main Bill Selector */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText size={15} className="text-blue-600" />
                  <span>Dedicated Main Customer Bill Printer</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">Required</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Receives complete guest check bills, commercial invoices, and tax summaries across all categories.
              </p>
              <select
                value={mainBillPrinter?.id || ''}
                onChange={async (e) => {
                  const pid = e.target.value;
                  if (!pid) return;
                  await printerApi.updatePrinter(pid, { is_receipt_printer: true, branch_id: selectedBranchId }, user);
                  showToast('success', 'Main customer bill printer updated.');
                  await loadData();
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-800 focus:outline-none"
              >
                <option value="">-- Select Main Bill Printer --</option>
                {printers.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.ip_address || 'LAN'})</option>
                ))}
              </select>
            </div>

            {/* Fallback Prep Selector */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-amber-600" />
                  <span>Preparation Fallback Printer</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">Safety Net</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Only receives items that require preparation but lack an active assigned destination.
              </p>
              <select
                value={fallbackPrepPrinter?.id || ''}
                onChange={async (e) => {
                  const pid = e.target.value;
                  if (!pid) return;
                  await printerApi.updatePrinter(pid, { is_fallback: true, branch_id: selectedBranchId }, user);
                  showToast('success', 'Preparation fallback printer updated.');
                  await loadData();
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-black text-slate-800 focus:outline-none"
              >
                <option value="">-- Select Fallback Printer --</option>
                {printers.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.ip_address || 'LAN'})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Routing Matrix Table */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Preparation Section Routing Matrix</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Configure which physical printer receives tickets for each preparation section. Multiple sections may share a physical printer.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-6">Preparation Section</th>
                    <th className="py-3.5 px-6">Print Preparation Ticket?</th>
                    <th className="py-3.5 px-6">Assigned Physical Printer</th>
                    <th className="py-3.5 px-6">Operational Behavior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {routes.map(r => {
                    const isStore = r.section_key.toLowerCase() === 'store' || r.section_key.toLowerCase() === 'retail';
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-4 px-6 font-black text-slate-900 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                            <span>{r.section_key}</span>
                          </div>
                        </td>

                        {/* Print Prep Ticket Toggle */}
                        <td className="py-4 px-6">
                          <button
                            type="button"
                            onClick={() => handleUpdateRoute(r.section_key, !r.print_preparation_ticket, r.printer_id)}
                            className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition cursor-pointer border ${
                              r.print_preparation_ticket
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {r.print_preparation_ticket ? (
                              <>
                                <CheckCircle2 size={14} className="text-emerald-600" />
                                <span>Yes (Generate KOT)</span>
                              </>
                            ) : (
                              <>
                                <Ban size={14} className="text-slate-400" />
                                <span>No (Intentional Store / Retail)</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Assigned Printer Dropdown */}
                        <td className="py-4 px-6">
                          {r.print_preparation_ticket ? (
                            <select
                              value={r.printer_id || ''}
                              onChange={(e) => handleUpdateRoute(r.section_key, true, e.target.value || null)}
                              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                            >
                              <option value="">-- No Printer (Falls back) --</option>
                              {printers.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.ip_address || 'LAN'})</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-400 italic font-mono text-[11px]">None (Excluded from kitchen dispatch)</span>
                          )}
                        </td>

                        {/* Operational Behavior Status */}
                        <td className="py-4 px-6 text-slate-600">
                          {r.print_preparation_ticket ? (
                            r.printer ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                                <Check size={14} className="text-emerald-600" />
                                Prints on {r.printer.name}
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-amber-600" />
                                Will route to Fallback ({fallbackPrepPrinter?.name || 'Kitchen'})
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500 font-medium flex items-center gap-1.5">
                              <Ban size={14} className="text-slate-400" />
                              Zero prep chits generated; prints only on Main customer bill
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CATALOG COVERAGE & MISSING SECTION AUDIT */}
      {/* ========================================================================= */}
      {activeTab === 'coverage' && (
        <div className="space-y-4">
          {/* Action Bar & Filters */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search catalog products..."
                  value={coverageSearch}
                  onChange={(e) => setCoverageSearch(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-2xl pl-9 pr-3.5 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setCoverageFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    coverageFilter === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'
                  }`}
                >
                  All ({coverageData.products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCoverageFilter('routed')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    coverageFilter === 'routed' ? 'bg-white shadow-sm text-emerald-800' : 'text-slate-600'
                  }`}
                >
                  Prep Routed ({coverageData.routedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCoverageFilter('no_print')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    coverageFilter === 'no_print' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600'
                  }`}
                >
                  No-Print ({coverageData.noPrintCount})
                </button>
                <button
                  type="button"
                  onClick={() => setCoverageFilter('unassigned')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                    coverageFilter === 'unassigned' ? 'bg-white shadow-sm text-amber-800' : 'text-slate-600'
                  }`}
                >
                  Unassigned ({coverageData.unassignedCount})
                </button>
              </div>
            </div>

            {/* Batch Assign Bar */}
            {selectedProductIds.size > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 p-2 rounded-2xl">
                <span className="text-xs font-black text-amber-900 px-2">
                  {selectedProductIds.size} Selected
                </span>
                <select
                  value={batchSection}
                  onChange={(e) => setBatchSection(e.target.value)}
                  className="bg-white border border-amber-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="Kitchen">Kitchen</option>
                  <option value="Bar">Bar</option>
                  <option value="Pastry">Pastry</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Store">Store / Retail (No-Print)</option>
                </select>

                <select
                  value={batchOverride}
                  onChange={(e) => setBatchOverride(e.target.value as any)}
                  className="bg-white border border-amber-300 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none"
                >
                  <option value="INHERIT">Inherit Section Default</option>
                  <option value="PRINT">Force Print KOT</option>
                  <option value="NO_PRINT">Force Suppress KOT</option>
                </select>

                <button
                  type="button"
                  onClick={handleBatchAssign}
                  disabled={actionLoading}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer"
                >
                  {actionLoading ? 'Assigning...' : 'Apply Section'}
                </button>
              </div>
            )}
          </div>

          {/* Products Coverage Table */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0}
                        onChange={toggleSelectAllProducts}
                        className="rounded border-slate-300 text-amber-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Resolved Section</th>
                    <th className="py-3 px-4">Preparation Ticket</th>
                    <th className="py-3 px-4">Assigned Printer</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(p.id)}
                          onChange={() => toggleSelectProduct(p.id)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">{p.name}</td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{p.category_name}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 border border-slate-200">
                          {p.resolved_section}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {p.is_no_print ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 w-max">
                            <Ban size={12} className="text-slate-400" />
                            No Print (Bill Only)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-max">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            Generates KOT
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                        {p.is_no_print ? 'None (Main Bill Only)' : (p.assigned_printer_name || 'Unassigned')}
                      </td>
                      <td className="py-3 px-4">
                        {p.is_unassigned ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-max">
                            <AlertTriangle size={12} />
                            Needs Assignment
                          </span>
                        ) : p.is_no_print ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 w-max block">
                            Store / Retail
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 w-max block">
                            Routed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LIVE PRINT JOBS & HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Live Print Job Queue & Audit Log</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Real-time status tracking of all preparation tickets and customer receipts dispatched from POS terminals.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-6">Time</th>
                    <th className="py-3 px-6">Job Type</th>
                    <th className="py-3 px-6">Destination Printer</th>
                    <th className="py-3 px-6">Order Ref</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printJobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-6 font-mono text-[11px] text-slate-500">
                        {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          job.job_type === 'receipt' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          job.job_type === 'cancellation' ? 'bg-red-100 text-red-800 border border-red-200' :
                          job.job_type === 'modification' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          job.job_type === 'reprint' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {job.job_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-black text-slate-900">
                        {job.printer?.name || job.section_key}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-600">
                        {job.order_id ? `#${job.order_id}` : 'Manual Test'}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          job.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                          job.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          job.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setInspectedJob(job)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                            title="Inspect Payload"
                          >
                            <Eye size={15} />
                          </button>
                          {job.status === 'failed' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await printerApi.retryPrintJob(job.id);
                                if (res.success) {
                                  showToast('success', 'Retry dispatched.');
                                  await loadData();
                                }
                              }}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded-lg transition cursor-pointer"
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {printJobs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                        No print jobs recorded for this branch yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PRINTER */}
      {/* ========================================================================= */}
      {isPrinterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingPrinter ? 'Edit Thermal Printer' : 'Add New Thermal Printer'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Configure hardware IP and operational printing roles.</p>
              </div>
              <button 
                onClick={() => setIsPrinterModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-2xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePrinter} className="space-y-4">
              {/* Printer Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Printer Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kitchen Printer, Bar Printer, Main"
                  value={printerFormData.name || ''}
                  onChange={(e) => setPrinterFormData({ ...printerFormData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              {/* Connection Protocol & Paper Width */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Connection Protocol
                  </label>
                  <select
                    value={printerFormData.connection_type || 'network_raw'}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, connection_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="network_raw">Network Raw Socket (LAN 9100)</option>
                    <option value="windows_driver">Direct USB / Windows Driver (winspool.drv)</option>
                    <option value="http_bridge">HTTP Local Bridge (LAN 9191)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Paper Roll Width
                  </label>
                  <select
                    value={printerFormData.paper_width_mm || 80}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, paper_width_mm: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value={80}>80 mm (Standard Restaurant)</option>
                    <option value={58}>58 mm (Compact)</option>
                  </select>
                </div>
              </div>

              {/* Conditional: USB Windows Spooler vs LAN IP Address */}
              {printerFormData.connection_type === 'windows_driver' || printerFormData.connection_type === 'usb' ? (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
                  <label className="block text-xs font-bold text-indigo-950 uppercase tracking-wider">
                    Windows USB Printer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Generic / Text Only, EPSON TM-T20III, POS-80"
                    value={printerFormData.windows_printer_name || ''}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, windows_printer_name: e.target.value })}
                    className="w-full bg-white border border-indigo-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                  />
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    Connected directly to the Windows server via USB. Must match the exact printer name under Windows Settings &rarr; <strong>Printers &amp; scanners</strong>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      LAN IP Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 192.168.18.11"
                      value={printerFormData.ip_address || ''}
                      onChange={(e) => setPrinterFormData({ ...printerFormData, ip_address: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      RAW Port
                    </label>
                    <input
                      type="number"
                      value={printerFormData.port || 9100}
                      onChange={(e) => setPrinterFormData({ ...printerFormData, port: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Special Role Checkboxes */}
              <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(printerFormData.is_receipt_printer)}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, is_receipt_printer: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Designate as Main Customer Bill Printer</span>
                    <span className="text-[11px] text-slate-500 block">Prints guest check bills and fiscal customer receipts for this branch.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(printerFormData.is_fallback)}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, is_fallback: e.target.checked })}
                    className="rounded border-slate-300 text-amber-600 focus:ring-0 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Designate as Preparation Fallback Printer</span>
                    <span className="text-[11px] text-slate-500 block">Catches unrouted prep items with a warning banner.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printerFormData.is_active !== false}
                    onChange={(e) => setPrinterFormData({ ...printerFormData, is_active: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-0 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Printer Enabled</span>
                    <span className="text-[11px] text-slate-500 block">Active and accepting dispatch requests.</span>
                  </div>
                </label>
              </div>

              {/* Live Test Feedback */}
              {testResult && (
                <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  testResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  {testResult.success ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleTestPrint(printerFormData)}
                  disabled={testingConnection || !printerFormData.ip_address}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Send size={13} className="text-amber-600" />
                  <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrinterModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-sm transition cursor-pointer"
                  >
                    {actionLoading ? 'Saving...' : editingPrinter ? 'Save Changes' : 'Create Printer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSPECT JOB PAYLOAD */}
      {/* ========================================================================= */}
      {inspectedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-black text-slate-900">
                Print Job Payload #{inspectedJob.id.substring(0, 8)}
              </h3>
              <button onClick={() => setInspectedJob(null)} className="p-1 hover:bg-slate-100 rounded-xl cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <pre className="bg-slate-900 text-emerald-400 p-4 rounded-2xl text-[11px] font-mono overflow-auto max-h-96">
              {JSON.stringify(inspectedJob.payload, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setInspectedJob(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
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
