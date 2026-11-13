import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  CONCEPT_IDS,
  DEFAULT_CONCEPT_TIME_WINDOWS,
  conceptIdToCode,
  hourMatchesWindow,
  resolveDateRangeForPreset,
  salesAnalyticsService,
  type ConceptTimeWindowsMap,
  type DatePreset,
  type OpenCashDrawerSummary,
  type SalesAnalyticsFilters,
  type SalesAnalyticsPayload,
  type TimeWindowConfig,
} from '../services/salesAnalyticsService';

const CONCEPT_META: Record<string, { code: string; name: string; color: string }> = {
  [CONCEPT_IDS.NEO]: { code: 'NEO', name: 'NÉO', color: '#1e5c4f' },
  [CONCEPT_IDS.OVRLOAD]: { code: 'OVRLOAD', name: 'OVRLOAD', color: '#ea580c' },
  [CONCEPT_IDS.WICKD]: { code: 'WICKD', name: 'WICKD', color: '#7c3aed' },
};

const CHANNELS = ['ALL', 'Dine-In', 'POS / In-Store', 'Pickup', 'WhatsApp', 'App / Website', 'Toters', 'NokNok', 'Other'];
const SERIES_OPTIONS = [
  { value: 'ALL', label: 'All Series' },
  { value: 'A', label: 'Series A (OVR-A)' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'MAIN', label: 'NÉO Main' },
];

function fmtUsd(n: number | null | undefined): string {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n: number | null | undefined): string {
  return `${Number(n || 0).toFixed(2)}%`;
}

function calcDelta(cur: number, prev?: number | null): string | null {
  if (prev === undefined || prev === null || prev === 0) return null;
  const pct = ((cur - prev) / prev) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SalesAnalyticsScreen({ user, permissions }: { user?: any; permissions?: any }) {
  const initialRange = resolveDateRangeForPreset('all_time');
  const [filters, setFilters] = useState<SalesAnalyticsFilters>({
    preset: 'all_time',
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
    conceptId: 'ALL',
    branchId: 'ALL',
    channel: 'ALL',
    invoiceSeries: 'ALL',
  });

  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [timeWindowsMap, setTimeWindowsMap] = useState<ConceptTimeWindowsMap>(DEFAULT_CONCEPT_TIME_WINDOWS);
  const [drawerSummary, setDrawerSummary] = useState<OpenCashDrawerSummary>({ open_shifts_count: 0, expected_cash_usd: 0, opening_float_usd: 0 });
  const [data, setData] = useState<SalesAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UI view toggles
  const [trendMetric, setTrendMetric] = useState<'net_sales' | 'customer_total' | 'order_count' | 'avg_order_value'>('net_sales');
  const [showHourlyChart, setShowHourlyChart] = useState(false);
  const [productTab, setProductTab] = useState<'top15' | 'lowest15' | 'all' | 'categories'>('top15');
  const [productSort, setProductSort] = useState<'revenue' | 'quantity'>('revenue');
  const [productPage, setProductPage] = useState(1);

  // Paginated order details
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersRows, setOrdersRows] = useState<any[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Time windows configuration modal
  const [showWindowModal, setShowWindowModal] = useState(false);
  const [editingWindows, setEditingWindows] = useState<ConceptTimeWindowsMap>(DEFAULT_CONCEPT_TIME_WINDOWS);
  const [savingWindows, setSavingWindows] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      salesAnalyticsService.getBranches().catch(() => []),
      salesAnalyticsService.getTimeWindowsConfig().catch(() => DEFAULT_CONCEPT_TIME_WINDOWS),
    ]).then(([bList, tw]) => {
      setBranches(bList);
      setTimeWindowsMap(tw);
    });
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [analytics, drawer] = await Promise.all([
        salesAnalyticsService.fetchAnalytics(filters),
        salesAnalyticsService.getOpenCashDrawerSummary(filters.branchId),
      ]);
      setData(analytics);
      setDrawerSummary(drawer);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load sales analytics.');
    } finally {
      setLoading(false);
    }
  };

  const loadOrdersPage = async (page: number) => {
    setOrdersLoading(true);
    try {
      const res = await salesAnalyticsService.fetchFilteredOrders(filters, page, 25, false);
      setOrdersRows(res.rows);
      setOrdersTotal(res.totalCount);
    } catch {
      setOrdersRows([]);
      setOrdersTotal(0);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    setProductPage(1);
    setOrdersPage(1);
    loadReport();
    loadOrdersPage(1);
  }, [filters]);

  const handlePresetChange = (preset: DatePreset) => {
    if (preset === 'custom') {
      const monthRange = resolveDateRangeForPreset('this_month');
      setFilters(prev => ({
        ...prev,
        preset: 'custom',
        startDate: prev.startDate || monthRange.startDate,
        endDate: prev.endDate || monthRange.endDate,
      }));
      return;
    }
    const r = resolveDateRangeForPreset(preset);
    setFilters(prev => ({ ...prev, preset, startDate: r.startDate, endDate: r.endDate }));
  };

  // Group trends by period_key
  const groupedTrends = useMemo(() => {
    if (!data?.trends) return [];
    const byPeriod = new Map<string, { period: string; total: number; neo: number; ovrload: number; wickd: number; orders: number }>();
    for (const t of data.trends) {
      if (!byPeriod.has(t.period_key)) {
        byPeriod.set(t.period_key, { period: t.period_key, total: 0, neo: 0, ovrload: 0, wickd: 0, orders: 0 });
      }
      const row = byPeriod.get(t.period_key)!;
      const val = Number(t[trendMetric] || 0);
      row.total += val;
      row.orders += Number(t.order_count || 0);
      if (t.concept_id === CONCEPT_IDS.NEO) row.neo += val;
      else if (t.concept_id === CONCEPT_IDS.OVRLOAD) row.ovrload += val;
      else if (t.concept_id === CONCEPT_IDS.WICKD) row.wickd += val;
    }
    return Array.from(byPeriod.values());
  }, [data?.trends, trendMetric]);

  const maxTrendVal = useMemo(
    () => Math.max(1, ...groupedTrends.map(t => t.total)),
    [groupedTrends]
  );

  // Order Time Breakdown computed from hourly buckets + active concept's configurable windows
  const activeTimeWindows = useMemo<TimeWindowConfig[]>(() => {
    const code = conceptIdToCode(filters.conceptId);
    if (code === 'NEO') return timeWindowsMap.NEO || DEFAULT_CONCEPT_TIME_WINDOWS.NEO;
    if (code === 'WICKD') return timeWindowsMap.WICKD || DEFAULT_CONCEPT_TIME_WINDOWS.WICKD;
    return timeWindowsMap.OVRLOAD || DEFAULT_CONCEPT_TIME_WINDOWS.OVRLOAD;
  }, [filters.conceptId, timeWindowsMap]);

  const timeWindowRows = useMemo(() => {
    const hourly = data?.hourly || [];
    const totalSales = hourly.reduce((s, h) => s + Number(h.customer_total || 0), 0);
    return activeTimeWindows.map(w => {
      const matching = hourly.filter(h => hourMatchesWindow(h.hour, w));
      const orders = matching.reduce((s, h) => s + Number(h.order_count || 0), 0);
      const revenue = matching.reduce((s, h) => s + Number(h.customer_total || 0), 0);
      const netSales = matching.reduce((s, h) => s + Number(h.net_sales || 0), 0);
      return {
        ...w,
        orders,
        revenue,
        netSales,
        pct: totalSales > 0 ? (revenue / totalSales) * 100 : 0,
        aov: orders > 0 ? revenue / orders : 0,
      };
    });
  }, [data?.hourly, activeTimeWindows]);

  const sortedProducts = useMemo(() => {
    const list = [...(data?.products || [])];
    list.sort((a, b) =>
      productSort === 'quantity'
        ? Number(b.quantity_sold) - Number(a.quantity_sold)
        : Number(b.gross_sales) - Number(a.gross_sales)
    );
    return list;
  }, [data?.products, productSort]);

  const displayedProducts = useMemo(() => {
    if (productTab === 'top15') return sortedProducts.slice(0, 15);
    if (productTab === 'lowest15') return [...sortedProducts].reverse().slice(0, 15);
    const start = (productPage - 1) * 20;
    return sortedProducts.slice(start, start + 20);
  }, [sortedProducts, productTab, productPage]);

  const handleExport = async (kind: 'summary' | 'orders' | 'channels' | 'products' | 'categories') => {
    if (!data) return;
    const tag = `${conceptIdToCode(filters.conceptId)}_${filters.startDate || 'all'}_${filters.endDate || 'time'}`;
    if (kind === 'summary') {
      const k = data.kpis;
      downloadCsv(`flow_sales_summary_${tag}.csv`, ['Metric', 'Value'], [
        ['Gross F&B Sales (USD)', k.gross_sales],
        ['Completed Orders', k.order_count],
        ['Average Order Value (USD)', k.avg_order_value],
        ['Total Discounts (USD)', k.total_discounts],
        ['Discount %', k.discount_pct],
        ['Net Product Sales (USD)', k.net_product_sales],
        ['Delivery Fees Collected (USD)', k.delivery_fees],
        ['Customer Order Total (USD)', k.customer_total],
        ['Verified Marketplace Commissions (USD)', k.verified_commission_usd],
        ['Historical Orders With Unavailable Commission', k.unavailable_commission_orders],
        ['Net Receivable (USD)', k.net_receivable],
      ]);
      return;
    }
    if (kind === 'channels') {
      downloadCsv(
        `flow_sales_channels_${tag}.csv`,
        ['Channel', 'Orders', 'Gross Sales', 'Discounts', 'Net Product Sales', 'Delivery Fees', 'Customer Total', 'Verified Marketplace Fees', 'Unavailable Comm. Orders', 'Net Receivable', 'AOV', '% of Sales'],
        data.channels.map(c => [
          c.channel, c.order_count, c.gross_sales, c.discounts, c.net_product_sales,
          c.delivery_fees, c.customer_total, c.verified_commission_usd, c.unavailable_commission_orders,
          c.net_receivable, c.avg_order_value, c.pct_of_sales,
        ])
      );
      return;
    }
    if (kind === 'products') {
      downloadCsv(
        `flow_sales_products_${tag}.csv`,
        ['Rank', 'Product', 'Category', 'Mapping Status', 'Quantity Sold', 'Gross Sales', 'Est. Discounts', 'Net Sales', '% of Sales'],
        sortedProducts.map((p, i) => [
          i + 1, p.product_name, p.category_name, p.is_unmapped ? 'Historical Unmapped' : 'Mapped',
          p.quantity_sold, p.gross_sales, p.discounts_est, p.net_sales, p.pct_of_sales,
        ])
      );
      return;
    }
    if (kind === 'categories') {
      downloadCsv(
        `flow_sales_categories_${tag}.csv`,
        ['Category', 'Quantity Sold', 'Gross Sales', 'Est. Discounts', 'Net Sales', '% of Sales'],
        data.categories.map(c => [c.category_name, c.quantity_sold, c.gross_sales, c.discounts_est, c.net_sales, c.pct_of_sales])
      );
      return;
    }
    setExporting(true);
    try {
      const full = await salesAnalyticsService.fetchFilteredOrders(filters, 1, 25, true);
      downloadCsv(
        `flow_sales_orders_${tag}.csv`,
        ['Order ID', 'Concept', 'Business Date', 'Invoice #', 'Series', 'Channel', 'Payment Method', 'Provenance', 'Gross Subtotal', 'Discount', 'Delivery Fee', 'Customer Total', 'Verified Commission', 'Net Receivable'],
        full.rows.map(o => [
          o.id,
          CONCEPT_META[o.concept_id]?.code || o.concept_id,
          o.bizDate,
          o.invoice_number || '',
          o.normSeries,
          o.normChannel,
          o.payment_method || '',
          o.data_provenance || 'LIVE_POS',
          o.subtotal_amount || 0,
          o.discount_amount || 0,
          o.delivery_fee || 0,
          o.total_amount || 0,
          o.marketplace_commission_usd || 0,
          o.net_receivable_usd || 0,
        ])
      );
    } finally {
      setExporting(false);
    }
  };

  const kpis = data?.kpis;
  const prev = data?.previous_kpis;
  const isEmptyState = !loading && kpis && kpis.order_count === 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ea580c18', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>
                Sales &amp; Analytics Report
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Multi-concept POS sales performance (Asia/Beirut) • Excludes cancelled/voided orders • Preserves historical OVRLOAD line items
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => { loadReport(); loadOrdersPage(ordersPage); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button type="button" onClick={() => handleExport('summary')} disabled={!data} style={exportBtnStyle}>
            <Download size={13} /> Summary CSV
          </button>
          <button type="button" onClick={() => handleExport('channels')} disabled={!data} style={exportBtnStyle}>
            <Download size={13} /> Channels CSV
          </button>
          <button type="button" onClick={() => handleExport('products')} disabled={!data} style={exportBtnStyle}>
            <Download size={13} /> Products CSV
          </button>
          <button type="button" onClick={() => handleExport('categories')} disabled={!data} style={exportBtnStyle}>
            <Download size={13} /> Categories CSV
          </button>
          <button type="button" onClick={() => handleExport('orders')} disabled={!data || exporting} style={{ ...exportBtnStyle, backgroundColor: '#0f172a', color: '#fff', borderColor: '#0f172a' }}>
            <FileSpreadsheet size={13} /> {exporting ? 'Exporting...' : 'Orders CSV (All)'}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Concept Pills + Quick Date Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Store size={13} /> Concept:
            </span>
            {[
              { id: 'ALL', label: 'All Concepts', color: '#0f172a' },
              { id: CONCEPT_IDS.NEO, label: 'NÉO', color: '#1e5c4f' },
              { id: CONCEPT_IDS.OVRLOAD, label: 'OVRLOAD', color: '#ea580c' },
              { id: CONCEPT_IDS.WICKD, label: 'WICKD', color: '#7c3aed' },
            ].map(c => {
              const active = filters.conceptId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setFilters(prev => ({ ...prev, conceptId: c.id }))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: active ? `2px solid ${c.color}` : '1px solid #cbd5e1',
                    backgroundColor: active ? c.color : '#fff',
                    color: active ? '#fff' : '#334155',
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} /> Period:
            </span>
            {(
              [
                ['today', 'Today'],
                ['yesterday', 'Yesterday'],
                ['last7', 'Last 7 Days'],
                ['this_month', 'This Month'],
                ['all_time', 'All Time'],
                ['custom', 'Custom Range'],
              ] as Array<[DatePreset, string]>
            ).map(([key, label]) => {
              const active = filters.preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetChange(key)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? '1px solid #ea580c' : '1px solid #cbd5e1',
                    backgroundColor: active ? '#fff7ed' : '#fff',
                    color: active ? '#c2410c' : '#334155',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={13} color="#64748b" />
            <label style={labelStyle}>Branch</label>
            <select
              value={filters.branchId}
              onChange={e => setFilters(prev => ({ ...prev, branchId: e.target.value }))}
              style={selectStyle}
            >
              <option value="ALL">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={labelStyle}>Channel</label>
            <select
              value={filters.channel}
              onChange={e => setFilters(prev => ({ ...prev, channel: e.target.value }))}
              style={selectStyle}
            >
              {CHANNELS.map(ch => (
                <option key={ch} value={ch}>{ch === 'ALL' ? 'All Channels' : ch}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={labelStyle}>Invoice Series</label>
            <select
              value={filters.invoiceSeries}
              onChange={e => setFilters(prev => ({ ...prev, invoiceSeries: e.target.value }))}
              style={selectStyle}
            >
              {SERIES_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {filters.preset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={labelStyle}>From</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                style={selectStyle}
              />
              <label style={labelStyle}>To</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                style={selectStyle}
              />
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}

      {/* Main 8 KPI Cards */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <KpiCard
            title="1. Gross F&B Sales"
            value={fmtUsd(kpis.gross_sales)}
            subtitle="Before discounts • Excludes delivery fees"
            delta={calcDelta(kpis.gross_sales, prev?.gross_sales)}
            accent="#0f172a"
          />
          <KpiCard
            title="2. Completed Orders"
            value={kpis.order_count.toLocaleString()}
            subtitle={`Customer Total: ${fmtUsd(kpis.customer_total)}`}
            delta={calcDelta(kpis.order_count, prev?.order_count)}
            accent="#1e5c4f"
          />
          <KpiCard
            title="3. Average Order Value"
            value={fmtUsd(kpis.avg_order_value)}
            subtitle="Customer total / completed orders"
            delta={calcDelta(kpis.avg_order_value, prev?.avg_order_value)}
            accent="#2563eb"
          />
          <KpiCard
            title="4. Total Discounts"
            value={fmtUsd(kpis.total_discounts)}
            subtitle={`${fmtPct(kpis.discount_pct)} of gross F&B sales`}
            delta={calcDelta(kpis.total_discounts, prev?.total_discounts)}
            accent="#d97706"
          />
          <KpiCard
            title="5. Net Product Sales"
            value={fmtUsd(kpis.net_product_sales)}
            subtitle="Gross F&B sales minus discounts"
            delta={calcDelta(kpis.net_product_sales, prev?.net_product_sales)}
            accent="#15803d"
          />
          <KpiCard
            title="6. Delivery Fees Collected"
            value={fmtUsd(kpis.delivery_fees)}
            subtitle="Pass-through delivery • Not F&B revenue"
            delta={calcDelta(kpis.delivery_fees, prev?.delivery_fees)}
            accent="#0284c7"
          />
          <KpiCard
            title="7. Marketplace Fees"
            value={kpis.verified_commission_usd > 0 ? fmtUsd(kpis.verified_commission_usd) : (kpis.unavailable_commission_orders > 0 ? 'Unavailable (Hist.)' : '$0.00')}
            subtitle={
              kpis.unavailable_commission_orders > 0
                ? `${kpis.unavailable_commission_orders.toLocaleString()} historical Toters/NokNok orders have unavailable legacy commission`
                : 'Verified marketplace commissions'
            }
            accent="#7c3aed"
          />
          <KpiCard
            title="8. Net Receivable"
            value={fmtUsd(kpis.net_receivable)}
            subtitle={
              kpis.unavailable_commission_orders > 0
                ? 'After verified deductions (excl. unrecorded historical fees)'
                : 'Net product sales minus verified fees'
            }
            accent="#ea580c"
          />
        </div>
      )}

      {/* WICKD / Empty State */}
      {isEmptyState && (
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px dashed #cbd5e1', padding: '36px 24px', textAlign: 'center' }}>
          <Package size={32} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
            No completed sales for {filters.conceptId === CONCEPT_IDS.WICKD ? 'WICKD' : 'this filter'}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {filters.conceptId === CONCEPT_IDS.WICKD
              ? 'WICKD is configured and structurally active, with zero operational sales recorded yet.'
              : 'Try expanding the date range or clearing channel/series filters.'}
          </p>
        </div>
      )}

      {data && !isEmptyState && (
        <>
          {/* Sales Trends Chart */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}><TrendingUp size={17} color="#ea580c" /> Sales Trends</h2>
                <p style={sectionSubStyle}>
                  {filters.conceptId === 'ALL'
                    ? 'Comparing NÉO, OVRLOAD & WICKD across periods'
                    : 'Daily (≤62 days) or Monthly (>62 days / All Time) performance'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(
                  [
                    ['net_sales', 'Net Sales'],
                    ['customer_total', 'Customer Total'],
                    ['order_count', 'Orders'],
                    ['avg_order_value', 'AOV'],
                  ] as const
                ).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTrendMetric(k)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: trendMetric === k ? '1px solid #0f172a' : '1px solid #cbd5e1',
                      backgroundColor: trendMetric === k ? '#0f172a' : '#fff',
                      color: trendMetric === k ? '#fff' : '#334155',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {groupedTrends.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No trend points in range.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '190px', padding: '12px 8px 4px', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
                  {groupedTrends.map(pt => {
                    const hTotal = Math.max(4, (pt.total / maxTrendVal) * 155);
                    const neoH = pt.total > 0 ? (pt.neo / pt.total) * hTotal : 0;
                    const ovrH = pt.total > 0 ? (pt.ovrload / pt.total) * hTotal : 0;
                    const wckH = pt.total > 0 ? (pt.wickd / pt.total) * hTotal : 0;
                    return (
                      <div
                        key={pt.period}
                        title={`${pt.period}\nTotal: ${trendMetric === 'order_count' ? pt.total : fmtUsd(pt.total)}\nOrders: ${pt.orders}\nNÉO: ${fmtUsd(pt.neo)} | OVRLOAD: ${fmtUsd(pt.ovrload)}`}
                        style={{ flex: '1 0 36px', minWidth: '36px', maxWidth: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                      >
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>
                          {trendMetric === 'order_count' ? pt.total : `$${Math.round(pt.total).toLocaleString()}`}
                        </div>
                        <div style={{ width: '100%', maxWidth: '34px', display: 'flex', flexDirection: 'column-reverse', borderRadius: '4px 4px 0 0', overflow: 'hidden' }}>
                          {ovrH > 0 && <div style={{ height: `${ovrH}px`, backgroundColor: '#ea580c' }} />}
                          {neoH > 0 && <div style={{ height: `${neoH}px`, backgroundColor: '#1e5c4f' }} />}
                          {wckH > 0 && <div style={{ height: `${wckH}px`, backgroundColor: '#7c3aed' }} />}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>{pt.period}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#475569', justifyContent: 'flex-end' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#1e5c4f' }} /> NÉO</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#ea580c' }} /> OVRLOAD</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#7c3aed' }} /> WICKD</span>
                </div>
              </div>
            )}
          </div>

          {/* Order Time Breakdown + Optional Hourly Chart */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}><Clock size={17} color="#2563eb" /> Order Time Breakdown</h2>
                <p style={sectionSubStyle}>
                  Service periods ({conceptIdToCode(filters.conceptId) === 'NEO' ? 'NÉO' : conceptIdToCode(filters.conceptId) === 'WICKD' ? 'WICKD' : 'OVRLOAD'} schedule, Asia/Beirut)
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowHourlyChart(v => !v)}
                  style={exportBtnStyle}
                >
                  {showHourlyChart ? 'Hide Hourly Chart' : 'Show Hourly Peak Chart'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingWindows(JSON.parse(JSON.stringify(timeWindowsMap)));
                    setShowWindowModal(true);
                  }}
                  style={exportBtnStyle}
                >
                  <Settings size={13} /> Configure Windows
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {timeWindowRows.map(w => (
                <div key={w.id} style={{ padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>{w.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{fmtUsd(w.revenue)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                    <span>{w.orders.toLocaleString()} orders</span>
                    <span>{fmtPct(w.pct)} of sales</span>
                    <span>AOV {fmtUsd(w.aov)}</span>
                  </div>
                  <div style={{ marginTop: '8px', height: '5px', borderRadius: '99px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, w.pct)}%`, height: '100%', backgroundColor: '#2563eb' }} />
                  </div>
                </div>
              ))}
            </div>

            {showHourlyChart && (
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Hourly Order Distribution (00:00 – 23:00 Asia/Beirut)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '110px', overflowX: 'auto' }}>
                  {Array.from({ length: 24 }, (_, hr) => {
                    const pt = data.hourly.find(h => h.hour === hr);
                    const maxHr = Math.max(1, ...data.hourly.map(h => Number(h.customer_total || 0)));
                    const val = Number(pt?.customer_total || 0);
                    const barH = Math.max(2, (val / maxHr) * 80);
                    return (
                      <div key={hr} title={`${String(hr).padStart(2, '0')}:00 • ${pt?.order_count || 0} orders • ${fmtUsd(val)}`} style={{ flex: 1, minWidth: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <div style={{ width: '100%', height: `${barH}px`, backgroundColor: val > 0 ? '#0284c7' : '#e2e8f0', borderRadius: '3px 3px 0 0' }} />
                        <div style={{ fontSize: '9px', color: '#64748b' }}>{String(hr).padStart(2, '0')}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sales Channel Performance */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}><ShoppingBag size={17} color="#15803d" /> Sales Channel Performance</h2>
                <p style={sectionSubStyle}>Verified channel breakdown • Historical marketplace fees marked unavailable where unrecorded</p>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRowStyle}>
                    <th style={thStyle}>Channel</th>
                    <th style={thRightStyle}>Orders</th>
                    <th style={thRightStyle}>Gross Sales</th>
                    <th style={thRightStyle}>Discounts</th>
                    <th style={thRightStyle}>Net Product Sales</th>
                    <th style={thRightStyle}>Delivery Fees</th>
                    <th style={thRightStyle}>Marketplace Fees</th>
                    <th style={thRightStyle}>Net Receivable</th>
                    <th style={thRightStyle}>AOV</th>
                    <th style={thRightStyle}>% Share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.channels.map(c => (
                    <tr key={c.channel} style={trStyle}>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{c.channel}</td>
                      <td style={tdRightStyle}>{c.order_count.toLocaleString()}</td>
                      <td style={tdRightStyle}>{fmtUsd(c.gross_sales)}</td>
                      <td style={{ ...tdRightStyle, color: '#b45309' }}>{fmtUsd(c.discounts)}</td>
                      <td style={{ ...tdRightStyle, fontWeight: 700 }}>{fmtUsd(c.net_product_sales)}</td>
                      <td style={tdRightStyle}>{fmtUsd(c.delivery_fees)}</td>
                      <td style={tdRightStyle}>
                        {c.verified_commission_usd > 0 ? (
                          fmtUsd(c.verified_commission_usd)
                        ) : c.unavailable_commission_orders > 0 ? (
                          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600 }} title={`${c.unavailable_commission_orders} historical orders without legacy fee split`}>
                            Unavailable (Hist.)
                          </span>
                        ) : (
                          '$0.00'
                        )}
                      </td>
                      <td style={{ ...tdRightStyle, fontWeight: 700, color: '#15803d' }}>{fmtUsd(c.net_receivable)}</td>
                      <td style={tdRightStyle}>{fmtUsd(c.avg_order_value)}</td>
                      <td style={tdRightStyle}>{fmtPct(c.pct_of_sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Method Reconciliation + Invoice Series */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
            {/* Payment Method Reconciliation */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}><CreditCard size={17} color="#0284c7" /> Payment Method Reconciliation</h2>
                  <p style={sectionSubStyle}>Separates recorded order methods, historical imports (no Daily Cash), and live cash drawers</p>
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', fontSize: '12px', color: '#0369a1', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span><strong>Live Cash Drawer ({drawerSummary.open_shifts_count} open shift{drawerSummary.open_shifts_count === 1 ? '' : 's'}):</strong></span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                  Expected Drawer: {fmtUsd(drawerSummary.expected_cash_usd)} (Float: {fmtUsd(drawerSummary.opening_float_usd)})
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Payment Method</th>
                      <th style={thStyle}>Provenance</th>
                      <th style={thRightStyle}>Orders</th>
                      <th style={thRightStyle}>Customer Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p, idx) => (
                      <tr key={`${p.payment_method}-${p.provenance_group}-${idx}`} style={trStyle}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{p.payment_method}</td>
                        <td style={tdStyle}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '99px',
                            backgroundColor: p.provenance_group === 'HISTORICAL_IMPORTED' ? '#fff7ed' : '#f0fdf4',
                            color: p.provenance_group === 'HISTORICAL_IMPORTED' ? '#c2410c' : '#15803d',
                            border: `1px solid ${p.provenance_group === 'HISTORICAL_IMPORTED' ? '#fed7aa' : '#bbf7d0'}`,
                          }}>
                            {p.provenance_group === 'HISTORICAL_IMPORTED' ? 'Historical (No Daily Cash)' : 'Live POS'}
                          </span>
                        </td>
                        <td style={tdRightStyle}>{p.order_count.toLocaleString()}</td>
                        <td style={{ ...tdRightStyle, fontWeight: 700 }}>{fmtUsd(p.customer_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoice Series Breakdown */}
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div>
                  <h2 style={sectionTitleStyle}><Layers size={17} color="#7c3aed" /> Invoice Series Breakdown</h2>
                  <p style={sectionSubStyle}>OVRLOAD Series A (OVR-A) vs Standard (OVR) &amp; NÉO Main</p>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Concept</th>
                      <th style={thStyle}>Series</th>
                      <th style={thRightStyle}>Invoices</th>
                      <th style={thRightStyle}>Customer Total</th>
                      <th style={thStyle}>Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoice_series.map((s, idx) => {
                      const cMeta = CONCEPT_META[s.concept_id];
                      return (
                        <tr key={`${s.concept_id}-${s.series_code}-${idx}`} style={trStyle}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: cMeta?.color || '#0f172a' }}>{cMeta?.name || s.concept_id}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', backgroundColor: '#f1f5f9', color: '#334155' }}>
                              {s.series_code === 'A' ? 'Series A' : s.series_code}
                            </span>
                          </td>
                          <td style={tdRightStyle}>{s.order_count.toLocaleString()}</td>
                          <td style={{ ...tdRightStyle, fontWeight: 700 }}>{fmtUsd(s.customer_total)}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                            {s.min_invoice && s.max_invoice ? `${s.min_invoice} → ${s.max_invoice}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Best-Selling Products & Category Performance */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}><Package size={17} color="#ea580c" /> Product &amp; Category Performance</h2>
                <p style={sectionSubStyle}>Includes preserved historical OVRLOAD line items (including unmapped legacy product_id = NULL)</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                {(
                  [
                    ['top15', 'Top 15 Best-Selling'],
                    ['lowest15', 'Lowest-Selling'],
                    ['all', `All Products (${sortedProducts.length})`],
                    ['categories', `Categories (${data.categories.length})`],
                  ] as const
                ).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setProductTab(k); setProductPage(1); }}
                    style={{
                      padding: '6px 11px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: productTab === k ? '1px solid #ea580c' : '1px solid #cbd5e1',
                      backgroundColor: productTab === k ? '#fff7ed' : '#fff',
                      color: productTab === k ? '#c2410c' : '#334155',
                    }}
                  >
                    {lbl}
                  </button>
                ))}
                {productTab !== 'categories' && (
                  <select value={productSort} onChange={e => setProductSort(e.target.value as 'revenue' | 'quantity')} style={selectStyle}>
                    <option value="revenue">Sort: Revenue</option>
                    <option value="quantity">Sort: Quantity</option>
                  </select>
                )}
              </div>
            </div>

            {productTab === 'categories' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Category</th>
                      <th style={thRightStyle}>Quantity Sold</th>
                      <th style={thRightStyle}>Gross Sales</th>
                      <th style={thRightStyle}>Est. Discounts</th>
                      <th style={thRightStyle}>Net Sales</th>
                      <th style={thRightStyle}>% of Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map(cat => (
                      <tr key={cat.category_name} style={trStyle}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{cat.category_name}</td>
                        <td style={tdRightStyle}>{Number(cat.quantity_sold).toLocaleString()}</td>
                        <td style={tdRightStyle}>{fmtUsd(cat.gross_sales)}</td>
                        <td style={{ ...tdRightStyle, color: '#b45309' }}>{fmtUsd(cat.discounts_est)}</td>
                        <td style={{ ...tdRightStyle, fontWeight: 700, color: '#15803d' }}>{fmtUsd(cat.net_sales)}</td>
                        <td style={tdRightStyle}>{fmtPct(cat.pct_of_sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={theadRowStyle}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Product</th>
                        <th style={thStyle}>Category</th>
                        <th style={thRightStyle}>Qty Sold</th>
                        <th style={thRightStyle}>Gross Sales</th>
                        <th style={thRightStyle}>Est. Discounts</th>
                        <th style={thRightStyle}>Net Sales</th>
                        <th style={thRightStyle}>% Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedProducts.map((p, idx) => {
                        const rank = productTab === 'all' ? (productPage - 1) * 20 + idx + 1 : idx + 1;
                        return (
                          <tr key={p.product_key} style={trStyle}>
                            <td style={{ ...tdStyle, color: '#64748b', fontWeight: 700 }}>{rank}</td>
                            <td style={{ ...tdStyle, fontWeight: 700 }}>
                              {p.product_name}
                              {p.is_unmapped && (
                                <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 6px', borderRadius: '99px', backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
                                  Historical Line
                                </span>
                              )}
                            </td>
                            <td style={{ ...tdStyle, color: '#475569' }}>{p.category_name}</td>
                            <td style={tdRightStyle}>{Number(p.quantity_sold).toLocaleString()}</td>
                            <td style={tdRightStyle}>{fmtUsd(p.gross_sales)}</td>
                            <td style={{ ...tdRightStyle, color: '#b45309' }}>{fmtUsd(p.discounts_est)}</td>
                            <td style={{ ...tdRightStyle, fontWeight: 700, color: '#15803d' }}>{fmtUsd(p.net_sales)}</td>
                            <td style={tdRightStyle}>{fmtPct(p.pct_of_sales)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {productTab === 'all' && sortedProducts.length > 20 && (
                  <div style={paginationStyle}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Page {productPage} of {Math.ceil(sortedProducts.length / 20)} ({sortedProducts.length} products)
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" disabled={productPage <= 1} onClick={() => setProductPage(p => p - 1)} style={pageBtnStyle}>
                        <ChevronLeft size={14} /> Prev
                      </button>
                      <button type="button" disabled={productPage >= Math.ceil(sortedProducts.length / 20)} onClick={() => setProductPage(p => p + 1)} style={pageBtnStyle}>
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Paginated Order-Level Sales Details */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}><FileSpreadsheet size={17} color="#0f172a" /> Order-Level Sales Details</h2>
                <p style={sectionSubStyle}>Paginated view (25/page) • CSV export downloads all {ordersTotal.toLocaleString()} matching orders</p>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRowStyle}>
                    <th style={thStyle}>Date (Beirut)</th>
                    <th style={thStyle}>Concept</th>
                    <th style={thStyle}>Invoice #</th>
                    <th style={thStyle}>Channel</th>
                    <th style={thStyle}>Payment</th>
                    <th style={thRightStyle}>Gross</th>
                    <th style={thRightStyle}>Discount</th>
                    <th style={thRightStyle}>Delivery</th>
                    <th style={thRightStyle}>Customer Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    <tr><td colSpan={9} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Loading orders...</td></tr>
                  ) : ordersRows.map(o => {
                    const cMeta = CONCEPT_META[o.concept_id];
                    return (
                      <tr key={o.id} style={trStyle}>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{o.bizDate}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: cMeta?.color || '#0f172a' }}>{cMeta?.code || o.concept_id}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{o.invoice_number || `#${o.id}`}</td>
                        <td style={tdStyle}>{o.normChannel}</td>
                        <td style={tdStyle}>{o.payment_method || '—'}</td>
                        <td style={tdRightStyle}>{fmtUsd(o.subtotal_amount)}</td>
                        <td style={{ ...tdRightStyle, color: '#b45309' }}>{fmtUsd(o.discount_amount)}</td>
                        <td style={tdRightStyle}>{fmtUsd(o.delivery_fee)}</td>
                        <td style={{ ...tdRightStyle, fontWeight: 700 }}>{fmtUsd(o.total_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {ordersTotal > 25 && (
              <div style={paginationStyle}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Page {ordersPage} of {Math.ceil(ordersTotal / 25)} ({ordersTotal.toLocaleString()} orders)
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={ordersPage <= 1}
                    onClick={() => { const p = ordersPage - 1; setOrdersPage(p); loadOrdersPage(p); }}
                    style={pageBtnStyle}
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    type="button"
                    disabled={ordersPage >= Math.ceil(ordersTotal / 25)}
                    onClick={() => { const p = ordersPage + 1; setOrdersPage(p); loadOrdersPage(p); }}
                    style={pageBtnStyle}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Configure Time Windows Modal */}
      {showWindowModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '14px', width: '100%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Configure Order Time Windows per Concept</h3>
              <button type="button" onClick={() => setShowWindowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(['NEO', 'OVRLOAD', 'WICKD'] as const).map(code => (
                <div key={code} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>{code}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(editingWindows[code] || []).map((w, idx) => (
                      <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={w.label}
                          onChange={e => {
                            const next = { ...editingWindows };
                            next[code][idx] = { ...w, label: e.target.value };
                            setEditingWindows(next);
                          }}
                          style={selectStyle}
                        />
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={w.startHour}
                          onChange={e => {
                            const next = { ...editingWindows };
                            next[code][idx] = { ...w, startHour: Number(e.target.value) };
                            setEditingWindows(next);
                          }}
                          style={selectStyle}
                          title="Start Hour (0-23)"
                        />
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={w.endHour}
                          onChange={e => {
                            const next = { ...editingWindows };
                            next[code][idx] = { ...w, endHour: Number(e.target.value) };
                            setEditingWindows(next);
                          }}
                          style={selectStyle}
                          title="End Hour (0-23)"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowWindowModal(false)} style={exportBtnStyle}>Cancel</button>
              <button
                type="button"
                disabled={savingWindows}
                onClick={async () => {
                  setSavingWindows(true);
                  try {
                    await salesAnalyticsService.saveTimeWindowsConfig(editingWindows);
                    setTimeWindowsMap(editingWindows);
                    setShowWindowModal(false);
                  } finally {
                    setSavingWindows(false);
                  }
                }}
                style={{ ...exportBtnStyle, backgroundColor: '#ea580c', color: '#fff', borderColor: '#ea580c' }}
              >
                {savingWindows ? 'Saving...' : 'Save Windows'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, subtitle, delta, accent }: { title: string; value: string; subtitle: string; delta?: string | null; accent: string }) {
  const isNeg = delta?.startsWith('-');
  return (
    <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px 16px', borderTop: `3px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{title}</span>
        {delta && (
          <span style={{ fontSize: '11px', fontWeight: 700, color: isNeg ? '#dc2626' : '#15803d', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            {isNeg ? <TrendingDown size={12} /> : <TrendingUp size={12} />} {delta}
          </span>
        )}
      </div>
      <div style={{ fontSize: '21px', fontWeight: 800, color: 'var(--text-main)', marginTop: '6px', fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{subtitle}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderRadius: '12px',
  border: '1px solid var(--border)',
  padding: '16px 18px',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '12px',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '15px',
  fontWeight: 800,
  color: 'var(--text-main)',
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
};

const sectionSubStyle: React.CSSProperties = {
  margin: '2px 0 0',
  fontSize: '12px',
  color: 'var(--text-muted)',
};

const exportBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '6px 10px',
  borderRadius: '7px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#fff',
  color: '#334155',
  fontSize: '11px',
  fontWeight: 700,
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#64748b',
};

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#fff',
  fontSize: '12px',
  color: '#0f172a',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12.5px',
};

const theadRowStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
};

const thStyle: React.CSSProperties = {
  padding: '9px 12px',
  textAlign: 'left',
  fontWeight: 700,
  color: '#475569',
  whiteSpace: 'nowrap',
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: 'right',
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #f1f5f9',
};

const tdStyle: React.CSSProperties = {
  padding: '9px 12px',
  color: '#0f172a',
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontFamily: 'monospace',
};

const paginationStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '12px',
  paddingTop: '10px',
  borderTop: '1px solid #f1f5f9',
};

const pageBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '5px 10px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#fff',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};
