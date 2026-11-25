import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, Search, Download, 
  Eye, MessageSquare, ShieldCheck, RefreshCw, X, AlertTriangle, Truck, ChevronLeft, ChevronRight,
  Layers, CheckCircle2
} from 'lucide-react';
import { useActiveConcept } from '../context/ConceptContext';
import {
  unifiedOrdersService,
  type UnifiedOrder,
  type OrderFilters,
  type OrderDateRange,
  type OrderKpiSummary
} from '../services/unifiedOrdersService';
import { KNOWN_CONCEPTS, type ConceptCode } from '../types/concept';
import { api } from '../api/client';

const EMPTY_KPIS: OrderKpiSummary = {
  totalMatchingCount: 0,
  activeCount: 0,
  grossSales: 0,
  totalDiscounts: 0,
  totalDeliveryFees: 0,
  totalOrderAmount: 0,
  netSalesExDelivery: 0,
  recordedCommission: 0,
  operationalDriverCash: 0,
  avgTicket: 0,
  seriesACount: 0,
  seriesStandardCount: 0,
  historicalCount: 0,
  liveCount: 0
};

export default function UnifiedOrderHistoryScreen({ user, permissions }: { user: any; permissions?: any }) {
  const { activeConcept, activeProfile } = useActiveConcept();
  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [kpis, setKpis] = useState<OrderKpiSummary>(EMPTY_KPIS);
  const [loading, setLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);

  // Filters — default to 'all' so historical orders are immediately visible
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSeries, setSelectedSeries] = useState<'All' | 'STANDARD' | 'A'>('All');
  const [selectedConceptFilter, setSelectedConceptFilter] = useState<string>(activeConcept);
  const [dateRange, setDateRange] = useState<OrderDateRange>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Modal Detail & Cancellation Actions
  const [selectedOrder, setSelectedOrder] = useState<UnifiedOrder | null>(null);
  const [selectedOrderItemsLoading, setSelectedOrderItemsLoading] = useState(false);
  const [cancellationReasonInput, setCancellationReasonInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Sync selected concept filter with global active concept
  useEffect(() => {
    setSelectedConceptFilter(activeConcept);
    setPage(1);
  }, [activeConcept]);

  const buildFilters = useCallback((): OrderFilters => ({
    concept: selectedConceptFilter,
    channel: selectedChannel,
    status: selectedStatus,
    series: selectedSeries,
    search: searchQuery,
    dateRange,
    startDate: dateRange === 'custom' ? customStartDate : undefined,
    endDate: dateRange === 'custom' ? customEndDate : undefined
  }), [selectedConceptFilter, selectedChannel, selectedStatus, selectedSeries, searchQuery, dateRange, customStartDate, customEndDate]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const filters = buildFilters();
      const res = await unifiedOrdersService.getOrdersPage(filters, page, pageSize);
      setOrders(res.orders);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error('Failed to load unified orders page:', err);
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [buildFilters, page, pageSize]);

  const loadKpis = useCallback(async () => {
    setKpiLoading(true);
    try {
      const filters = buildFilters();
      const summary = await unifiedOrdersService.getOrdersKpis(filters);
      setKpis(summary);
    } catch (err) {
      console.error('Failed to load order KPIs:', err);
      setKpis(EMPTY_KPIS);
    } finally {
      setKpiLoading(false);
    }
  }, [buildFilters]);

  const loadOrders = useCallback(() => {
    loadPage();
    loadKpis();
  }, [loadPage, loadKpis]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  const handleOpenOrderDetail = async (order: UnifiedOrder) => {
    setSelectedOrder(order);
    setSelectedOrderItemsLoading(true);
    try {
      const items = await unifiedOrdersService.getOrderItems(order.id);
      setSelectedOrder(prev => (prev && String(prev.id) === String(order.id) ? { ...prev, items } : prev));
    } catch (err) {
      console.error('Failed to load order items:', err);
    } finally {
      setSelectedOrderItemsLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'dispatched':
      case 'ready':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'preparing':
      case 'accepted':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getChannelBadge = (order: UnifiedOrder) => {
    const raw = (order.order_source || order.order_type || '').toLowerCase();
    if (raw.includes('toter')) {
      return { label: 'Toters', emoji: '🛵', style: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (raw.includes('nok')) {
      return { label: 'NokNok', emoji: '📦', style: 'bg-pink-50 text-pink-700 border-pink-200' };
    }
    if (raw.includes('what') || raw.includes('wa')) {
      return { label: 'WhatsApp', emoji: '💬', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (raw.includes('pick') || raw.includes('take')) {
      return { label: 'Pickup', emoji: '🏪', style: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (raw.includes('dine') || raw.includes('pos')) {
      return { label: 'In-Store / POS', emoji: '🍽️', style: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    return { label: 'Direct App', emoji: '📱', style: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const allOrders = await unifiedOrdersService.getAllMatchingOrdersForExport(buildFilters());
      if (!allOrders.length) return;
      const headers = [
        'Order ID', 'Source Order ID', 'Data Provenance', 'Invoice #', 'Invoice Series',
        'Concept', 'Branch', 'Created At', 'Type', 'Channel', 'Customer', 'Phone', 'Address',
        'Status', 'Original Source Status', 'Gross Subtotal', 'Discount', 'Delivery Fee',
        'Total Order Amount', 'Net Sales ex-Delivery', 'Recorded Commission USD', 'Payment Method'
      ];
      const csvEscape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = allOrders.map(o => [
        o.id,
        o.source_order_id || '',
        o.data_provenance || 'LIVE_OPERATIONAL',
        o.invoice_number || '',
        o.invoice_series || '',
        o.concept_name,
        o.branch_name,
        o.created_at,
        o.order_type,
        o.order_source,
        csvEscape(o.customer_name),
        csvEscape(o.customer_phone),
        csvEscape(o.delivery_address || ''),
        o.status,
        o.order_channel_status || o.status,
        o.subtotal_amount.toFixed(2),
        o.discount_amount.toFixed(2),
        o.delivery_fee.toFixed(2),
        o.total_amount.toFixed(2),
        (o.total_amount - o.delivery_fee).toFixed(2),
        (o.marketplace_commission_usd || 0).toFixed(2),
        csvEscape(o.payment_method)
      ]);

      const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `FLOW_Orders_${selectedConceptFilter}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const isDeliveryBrand = activeConcept === 'OVRLOAD' || activeConcept === 'WICKD';
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, page * pageSize);

  const brandAccent = activeConcept === 'OVRLOAD' ? '#e11d48' : (activeConcept === 'WICKD' ? '#7c3aed' : '#1e5c4f');

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* 1. Header Banner (Clean White Theme) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm"
            style={{ backgroundColor: brandAccent }}
          >
            {activeConcept === 'ALL' ? 'ALL' : activeProfile.prefix}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <ShoppingBag size={22} className="text-amber-500" />
                Order History & Sales Channels
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {activeConcept === 'ALL' ? 'ALL CONCEPTS' : `${activeProfile.name} ISOLATION`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative sales records, channels breakdown, aggregator references, and fiscal invoice sequencing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            disabled={exporting || totalCount === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-sm transition-colors"
          >
            <Download size={14} />
            <span>{exporting ? 'Exporting...' : `Export CSV (${totalCount.toLocaleString()})`}</span>
          </button>
          <button
            onClick={loadOrders}
            title="Refresh Orders"
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-sm transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Top-line Filtered Order KPIs (White Theme) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500">Filtered Orders</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {kpiLoading ? '...' : kpis.totalMatchingCount.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Avg: <strong className="text-slate-700">{formatCurrency(kpis.avgTicket)}</strong> • A: {kpis.seriesACount} / Std: {kpis.seriesStandardCount}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Order Amount</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {kpiLoading ? '...' : formatCurrency(kpis.totalOrderAmount)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Gross: <strong className="text-slate-700">{formatCurrency(kpis.grossSales)}</strong> • <span className="text-amber-600">Disc: -{formatCurrency(kpis.totalDiscounts)}</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500">Net Sales (ex-Delivery)</span>
          <div className="text-2xl font-bold text-teal-600 mt-1">
            {kpiLoading ? '...' : formatCurrency(kpis.netSalesExDelivery)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Delivery Fees: <strong className="text-slate-700">{formatCurrency(kpis.totalDeliveryFees)}</strong>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500">Marketplace Comm.</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            -{kpiLoading ? '...' : formatCurrency(kpis.recordedCommission)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Recorded platform deductions</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500">Driver Cash Collections</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {kpiLoading ? '...' : formatCurrency(kpis.operationalDriverCash)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Operational shift cash</span>
        </div>
      </div>

      {/* 3. Filter Controls Bar (Clean White Background) */}
      <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder="Search Order #, Invoice, Source ID, Customer, Phone..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Dropdowns & Range */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Concept Filter (when in Company Overview) */}
          {activeConcept === 'ALL' && (
            <select
              value={selectedConceptFilter}
              onChange={(e) => { setSelectedConceptFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none"
            >
              <option value="ALL">All Concepts</option>
              <option value="NEO">NÉO</option>
              <option value="OVRLOAD">OVRLOAD</option>
              <option value="WICKD">WICKD</option>
            </select>
          )}

          {/* Channel Filter */}
          <select
            value={selectedChannel}
            onChange={(e) => { setSelectedChannel(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none"
          >
            <option value="All">All Channels</option>
            <option value="Toters">Toters (1,762)</option>
            <option value="WhatsApp">WhatsApp (588)</option>
            <option value="NokNok">NokNok (2)</option>
            <option value="Pickup">Pickup (11)</option>
            <option value="POS">In-Store / POS (14)</option>
            <option value="App">Direct App (1)</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="delivered">Delivered</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Invoice Series Filter */}
          <select
            value={selectedSeries}
            onChange={(e) => { setSelectedSeries(e.target.value as any); setPage(1); }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none"
          >
            <option value="All">All Series</option>
            <option value="STANDARD">Standard Series (OVR-######)</option>
            <option value="A">A-Series (OVR-A-######)</option>
          </select>

          {/* Date Range Selector */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['all', 'month', 'week', 'yesterday', 'today', 'custom'] as const).map((r) => (
              <button
                key={r}
                onClick={() => { setDateRange(r); setPage(1); }}
                className={`px-2.5 py-1 rounded text-[11px] capitalize transition-colors ${
                  dateRange === r 
                    ? 'bg-white text-slate-900 font-bold shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'week' ? '7D' : (r === 'month' ? 'Month' : (r === 'all' ? 'All Time' : r))}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => { setCustomStartDate(e.target.value); setPage(1); }}
                className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[11px]"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => { setCustomEndDate(e.target.value); setPage(1); }}
                className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[11px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Orders Data Table (Clean White Theme) */}
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <th className="py-3 px-3.5">Invoice / Order #</th>
                {activeConcept === 'ALL' && <th className="py-3 px-3">Brand</th>}
                <th className="py-3 px-3">Channel</th>
                {isDeliveryBrand ? (
                  <>
                    <th className="py-3 px-3">Aggregator Ref</th>
                    <th className="py-3 px-3">Customer & Delivery Details</th>
                    <th className="py-3 px-3">Driver Handover</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-3">Table / Service</th>
                    <th className="py-3 px-3">Customer / Server</th>
                    <th className="py-3 px-3">Split Bill</th>
                  </>
                )}
                <th className="py-3 px-3 text-right">Items & Total</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-amber-500" />
                    <p className="text-xs font-semibold">Loading orders...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <ShoppingBag size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">No orders found matching the selected filters.</p>
                    <p className="text-xs mt-1 text-slate-500">Try selecting 'All Time' or clearing search criteria.</p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const chBadge = getChannelBadge(o);
                  const statusBadgeClass = getStatusBadge(o.status);

                  return (
                    <tr 
                      key={o.id} 
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => handleOpenOrderDetail(o)}
                    >
                      {/* Invoice & Order ID */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {o.invoice_number ? (
                                o.invoice_number
                              ) : (
                                <span className="text-slate-400 italic">#{o.id} (Draft)</span>
                              )}
                            </span>
                            {o.invoice_number && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                o.invoice_series === 'A' || o.invoice_number.includes('-A-')
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {o.invoice_series === 'A' || o.invoice_number.includes('-A-') ? 'A-Series' : 'Standard'}
                              </span>
                            )}
                            {o.is_canceled && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                                Void
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(o.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {o.branch_name}
                          </span>
                        </div>
                      </td>

                      {/* Brand Pill (if ALL) */}
                      {activeConcept === 'ALL' && (
                        <td className="py-3 px-3">
                          <span 
                            className="px-2 py-0.5 rounded text-[10px] font-bold"
                            style={{ 
                              backgroundColor: `${KNOWN_CONCEPTS[o.concept_code]?.primaryColor || '#333'}15`,
                              color: KNOWN_CONCEPTS[o.concept_code]?.primaryColor || '#333'
                            }}
                          >
                            {o.concept_name}
                          </span>
                        </td>
                      )}

                      {/* Channel Badge */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${chBadge.style}`}>
                          <span>{chBadge.emoji}</span>
                          <span>{chBadge.label}</span>
                        </span>
                      </td>

                      {/* Delivery Brand Columns */}
                      {isDeliveryBrand ? (
                        <>
                          {/* Aggregator Ref */}
                          <td className="py-3 px-3">
                            {o.marketplace_order_ref ? (
                              <span className="font-mono text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                {o.marketplace_order_ref}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Direct Store</span>
                            )}
                          </td>

                          {/* Customer & Address */}
                          <td className="py-3 px-3 max-w-xs">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 truncate">{o.customer_name}</span>
                              {o.customer_phone && (
                                <a
                                  href={`https://wa.me/${o.customer_phone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 w-fit mt-0.5"
                                >
                                  <MessageSquare size={10} />
                                  <span>{o.customer_phone}</span>
                                </a>
                              )}
                              {o.delivery_address && (
                                <span className="text-[10px] text-slate-500 truncate mt-0.5" title={o.delivery_address}>
                                  📍 {o.delivery_address}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Driver Handover */}
                          <td className="py-3 px-3">
                            {o.driver_handover_status === 'collected' ? (
                              <div className="flex flex-col">
                                <span className="text-[11px] text-slate-700 font-medium">{o.driver_name}</span>
                                <span className="text-[10px] text-emerald-700 font-semibold">
                                  ✓ Handover: {formatCurrency(o.driver_collected_amount || 0)}
                                </span>
                              </div>
                            ) : o.driver_handover_status === 'historical_untracked' ? (
                              <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500">
                                  {o.driver_phone ? `Driver: ${o.driver_phone}` : 'Historical Record'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">N/A</span>
                            )}
                          </td>
                        </>
                      ) : (
                        /* Restaurant Brand Columns (NÉO) */
                        <>
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-xs">{o.table_number || 'Takeaway'}</span>
                              {o.guest_count && (
                                <span className="text-[10px] text-slate-400">{o.guest_count} Guests</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="text-slate-800 font-medium">{o.customer_name}</span>
                              <span className="text-[10px] text-slate-400">Server: {o.server_name || 'Front Desk'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {o.is_split_bill ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
                                Split Bill
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Single Bill</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Items & Total */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-slate-900 text-sm">
                            {formatCurrency(o.total_amount)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {o.items_count ?? o.items?.length ?? 1} items • {o.payment_method}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusBadgeClass}`}>
                          {o.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenOrderDetail(o)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
                          title="View Order Details"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Controls */}
        <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-bold text-slate-900">{rangeStart.toLocaleString()}</span>–<span className="font-bold text-slate-900">{rangeEnd.toLocaleString()}</span> of{' '}
            <span className="font-bold text-slate-900">{totalCount.toLocaleString()}</span> orders
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-700 text-xs focus:outline-none shadow-sm"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 text-slate-700 font-semibold shadow-sm transition-colors"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
              <span className="px-2 text-[11px] text-slate-500">
                Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong>
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 text-slate-700 font-semibold shadow-sm transition-colors"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Safe Read-Only Order Details Modal (Clean White Theme) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-black text-slate-900 text-base">
                  {selectedOrder.invoice_number || `#${selectedOrder.id}`}
                </span>
                <span 
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ 
                    backgroundColor: `${KNOWN_CONCEPTS[selectedOrder.concept_code]?.primaryColor || '#333'}15`,
                    color: KNOWN_CONCEPTS[selectedOrder.concept_code]?.primaryColor || '#333'
                  }}
                >
                  {selectedOrder.concept_name}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(selectedOrder.status)}`}>
                  {selectedOrder.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600">
              {/* Order Metadata Info */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Order Timestamp</span>
                  <div className="text-slate-900 font-medium mt-0.5">
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Sales Channel</span>
                  <div className="text-slate-900 font-medium mt-0.5">
                    {selectedOrder.order_source} {selectedOrder.marketplace_order_ref ? `(${selectedOrder.marketplace_order_ref})` : ''}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Customer Contact</span>
                  <div className="text-slate-900 font-medium mt-0.5 flex items-center gap-2">
                    <span>{selectedOrder.customer_name}</span>
                    {selectedOrder.customer_phone && (
                      <a
                        href={`https://wa.me/${selectedOrder.customer_phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline inline-flex items-center gap-1 font-mono"
                      >
                        <MessageSquare size={11} /> {selectedOrder.customer_phone}
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Branch Kitchen</span>
                  <div className="text-slate-900 font-medium mt-0.5">
                    {selectedOrder.branch_name}
                  </div>
                </div>
                {selectedOrder.delivery_address && (
                  <div className="col-span-2 border-t border-slate-200 pt-2">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Delivery Address</span>
                    <div className="text-slate-900 mt-0.5 font-medium">
                      📍 {selectedOrder.delivery_address}
                    </div>
                  </div>
                )}
                {selectedOrder.special_instructions && (
                  <div className="col-span-2 bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-800">
                    <span className="text-[10px] uppercase font-bold block text-amber-700">Special Instructions</span>
                    {selectedOrder.special_instructions}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Ordered Products & Customizations
                </span>
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedOrderItemsLoading ? (
                    <div className="p-4 text-center text-slate-500 text-xs">Loading order items...</div>
                  ) : (selectedOrder.items || []).length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">No line items recorded for this order.</div>
                  ) : (
                    (selectedOrder.items || []).map((item, idx) => (
                      <div key={idx} className="p-3 bg-white flex items-start justify-between">
                        <div className="flex-1 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{item.quantity}x</span>
                            <span className="font-semibold text-slate-800">{item.product_name}</span>
                          </div>
                          {item.customizations && (
                            <div className="text-[10px] text-slate-500 mt-0.5 italic">
                              + {typeof item.customizations === 'string' ? item.customizations : JSON.stringify(item.customizations)}
                            </div>
                          )}
                        </div>
                        <div className="font-bold text-slate-900 text-xs">
                          {formatCurrency(item.total_price)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Financial Settlement Breakdown */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Financial Settlement & Reconciliation Audit
                </span>
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Gross Subtotal:</span>
                    <span className="text-slate-900 font-medium">{formatCurrency(selectedOrder.subtotal_amount)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Customer Discount:</span>
                      <span>-{formatCurrency(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_fee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Fee (Driver Retained):</span>
                      <span className="text-slate-700">+{formatCurrency(selectedOrder.delivery_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1.5">
                    <span>Total Order Bill:</span>
                    <span className="text-amber-600 text-sm">{formatCurrency(selectedOrder.total_amount)}</span>
                  </div>
                  {selectedOrder.marketplace_commission_usd !== undefined && selectedOrder.marketplace_commission_usd > 0 && (
                    <div className="flex justify-between text-rose-600 border-t border-slate-200 pt-1.5">
                      <span>Aggregator Commission ({selectedOrder.marketplace_commission_pct}%):</span>
                      <span>-{formatCurrency(selectedOrder.marketplace_commission_usd)}</span>
                    </div>
                  )}
                  {selectedOrder.net_receivable_usd !== undefined && (
                    <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200 pt-1.5">
                      <span>Net Settlement Receivable:</span>
                      <span className="text-base">{formatCurrency(selectedOrder.net_receivable_usd)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Driver Handover Audit */}
              {selectedOrder.driver_handover_status === 'collected' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Truck size={18} className="text-amber-600" />
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Operational Driver Handover (Live Shift)</span>
                      <div className="text-slate-800 font-medium">
                        {selectedOrder.driver_name} {selectedOrder.driver_phone ? `• ${selectedOrder.driver_phone}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase block">STATUS: COLLECTED</span>
                    <span className="font-mono text-xs text-slate-900">Amount: {formatCurrency(selectedOrder.driver_collected_amount || 0)}</span>
                  </div>
                </div>
              )}

              {selectedOrder.driver_handover_status === 'historical_untracked' && selectedOrder.driver_phone && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Truck size={18} className="text-slate-400" />
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Historical Driver Reference</span>
                      <div className="text-slate-700 font-medium">
                        Legacy Driver Phone: {selectedOrder.driver_phone}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">Historical Archive</span>
                </div>
              )}

              {/* Cancellation & Void Audit Box */}
              {selectedOrder.is_canceled && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
                    <AlertTriangle size={15} />
                    <span>INVOICE VOIDED / CANCELLED</span>
                  </div>
                  <p className="text-slate-700 text-xs">
                    Reason: <strong>{selectedOrder.cancellation_reason || 'Administrative cancellation'}</strong>
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Canceled at: {selectedOrder.canceled_at ? new Date(selectedOrder.canceled_at).toLocaleString() : 'N/A'} {selectedOrder.canceled_by ? `by ${selectedOrder.canceled_by}` : ''}
                  </p>
                </div>
              )}

              {/* Action: Cancel Issued Invoice or Delete Unissued Draft */}
              {!selectedOrder.is_canceled && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-600 block">
                    Fiscal & Administrative Actions
                  </span>
                  {selectedOrder.invoice_number ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-500">
                        To void this issued invoice (Series {selectedOrder.invoice_series || 'STANDARD'}), enter an audit reason. The sequence number remains reserved and will not be reused.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Mandatory cancellation reason..."
                          value={cancellationReasonInput}
                          onChange={e => setCancellationReasonInput(e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-rose-500"
                        />
                        <button
                          disabled={actionLoading || !cancellationReasonInput.trim()}
                          onClick={async () => {
                            if (!cancellationReasonInput.trim()) return;
                            setActionLoading(true);
                            try {
                              const res = await (api as any).cancelPosOrderInvoice(selectedOrder.id, cancellationReasonInput, user?.name || 'Admin');
                              if (res.success) {
                                setSelectedOrder({ 
                                  ...selectedOrder, 
                                  is_canceled: true, 
                                  cancellation_reason: cancellationReasonInput, 
                                  status: 'cancelled',
                                  canceled_at: new Date().toISOString(),
                                  canceled_by: user?.name || 'Admin'
                                });
                                setCancellationReasonInput('');
                                loadOrders();
                              } else {
                                alert(res.error || 'Failed to cancel invoice');
                              }
                            } catch (e: any) {
                              alert(e.message || 'Error canceling invoice');
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
                        >
                          {actionLoading ? 'Processing...' : 'Cancel Invoice'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        This is an unissued draft order. Deleting it consumes no sequence numbers.
                      </span>
                      <button
                        disabled={actionLoading}
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to delete unissued draft Order #${selectedOrder.id}?`)) return;
                          setActionLoading(true);
                          try {
                            const res = await (api as any).deleteUnissuedPosOrder(selectedOrder.id);
                            if (res.success) {
                              setSelectedOrder(null);
                              loadOrders();
                            } else {
                              alert(res.error || 'Failed to delete draft order');
                            }
                          } catch (e: any) {
                            alert(e.message || 'Error deleting draft order');
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 text-xs font-semibold shadow-sm"
                      >
                        {actionLoading ? 'Deleting...' : 'Delete Draft Order'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-emerald-700 font-medium">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Historical records are read-only. Viewing does not trigger financial or inventory deductions.</span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
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
