import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  RefreshCw,
  Download,
  Search,
  DollarSign,
  Utensils,
  CreditCard,
  AlertTriangle,
  Receipt,
  Clock,
  Eye,
  X,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  ShoppingBag,
} from 'lucide-react';
import {
  fetchLiveDailyReport,
  fetchOrderLineItems,
  getBeirutTodayYmd,
  type LiveDailyReportData,
  type LiveDailyOrder,
  type LiveDailyOrderItem,
} from '../services/liveDailyReportService';
import { getRestaurantId } from '../api/supabase';

function fmtUsd(val: number | null | undefined): string {
  return `$${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtLbp(val: number | null | undefined): string {
  return `${Math.round(Number(val || 0)).toLocaleString('en-US')} L.L.`;
}

function fmtBeirutTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Beirut',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(d);
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

export default function LiveDailyTransactionsScreen({ user }: { user?: any; permissions?: any }) {
  const restaurantId = getRestaurantId(user);
  const [selectedDate, setSelectedDate] = useState<string>(() => getBeirutTodayYmd());
  const [branchId, setBranchId] = useState<string>('ALL');
  const [conceptId, setConceptId] = useState<string>('ALL');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const [report, setReport] = useState<LiveDailyReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'orders' | 'tables' | 'payments' | 'voids'>('orders');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SETTLED' | 'OPEN' | 'CANCELED'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');

  const [selectedOrder, setSelectedOrder] = useState<LiveDailyOrder | null>(null);
  const [orderItems, setOrderItems] = useState<LiveDailyOrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);

  const loadReport = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchLiveDailyReport({
          date: selectedDate,
          branchId,
          conceptId,
          restaurantId,
        });
        setReport(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load live daily transactions report.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate, branchId, conceptId, restaurantId]
  );

  useEffect(() => {
    void loadReport(false);
  }, [loadReport]);

  // Live auto-polling every 15 seconds while viewing today and autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void loadReport(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadReport]);

  const handleOpenOrderDetail = async (order: LiveDailyOrder) => {
    setSelectedOrder(order);
    setOrderItems([]);
    setLoadingItems(true);
    try {
      const items = await fetchOrderLineItems(order.id);
      setOrderItems(items);
    } finally {
      setLoadingItems(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!report) return [];
    const q = searchQuery.trim().toLowerCase();
    return report.orders.filter(o => {
      if (statusFilter === 'CANCELED' && !o.is_canceled) return false;
      if (statusFilter === 'SETTLED') {
        const st = String(o.status || '').toLowerCase();
        if (o.is_canceled || !['completed', 'closed', 'delivered', 'paid'].includes(st)) return false;
      }
      if (statusFilter === 'OPEN') {
        const st = String(o.status || '').toLowerCase();
        if (o.is_canceled || ['completed', 'closed', 'delivered', 'paid'].includes(st)) return false;
      }
      if (paymentFilter !== 'ALL' && o.payment_method !== paymentFilter) return false;
      if (!q) return true;
      return (
        String(o.id).includes(q) ||
        String(o.invoice_number || '').toLowerCase().includes(q) ||
        String(o.customer_name || '').toLowerCase().includes(q) ||
        String(o.table_label || '').toLowerCase().includes(q) ||
        String(o.waiter_name || '').toLowerCase().includes(q) ||
        String(o.cashier_name || '').toLowerCase().includes(q) ||
        String(o.payment_method || '').toLowerCase().includes(q) ||
        String(o.channel || '').toLowerCase().includes(q)
      );
    });
  }, [report, searchQuery, statusFilter, paymentFilter]);

  const paymentMethodOptions = useMemo(() => {
    if (!report) return [];
    return Array.from(new Set(report.orders.map(o => o.payment_method))).sort();
  }, [report]);

  const canceledOrders = useMemo(() => {
    return (report?.orders || []).filter(o => o.is_canceled);
  }, [report]);

  const handleExportCsv = () => {
    if (!report) return;
    downloadCsv(
      `Live_Daily_Transactions_${report.date}.csv`,
      [
        'Time (Beirut)',
        'Order ID',
        'Invoice #',
        'Concept',
        'Branch',
        'Channel',
        'Table',
        'Customer',
        'Waiter / Cashier',
        'Payment Method',
        'Status',
        'Subtotal USD',
        'Discount USD',
        'Delivery Fee USD',
        'Total USD',
        'Total LBP',
      ],
      filteredOrders.map(o => [
        fmtBeirutTime(o.created_at),
        o.id,
        o.invoice_number || '',
        o.concept_name,
        o.branch_name,
        o.channel,
        o.table_label || '',
        o.customer_name || '',
        o.waiter_name || o.cashier_name || '',
        o.payment_method,
        o.is_canceled ? 'cancelled' : o.status,
        o.subtotal_amount.toFixed(2),
        o.discount_amount.toFixed(2),
        o.delivery_fee.toFixed(2),
        o.total_amount.toFixed(2),
        Math.round(o.total_amount * o.exchange_rate),
      ])
    );
  };

  const k = report?.kpis;
  const rate = report?.exchangeRate || 90000;

  return (
    <div style={{ padding: '24px', maxWidth: '1500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* HEADER BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          background: '#fff',
          padding: '20px 24px',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#e9f4ed',
                color: '#1e5c4f',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Activity size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                  Live Daily Transactions Report
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: autoRefresh ? '#dcfce7' : '#f1f5f9',
                    color: autoRefresh ? '#166534' : '#475569',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: autoRefresh ? '#16a34a' : '#94a3b8',
                    }}
                  />
                  {autoRefresh ? 'LIVE (15s)' : 'PAUSED'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Real-time daily orders, open tables, payment methods, shift drawers, cash payouts, and voids • Updated:{' '}
                <strong>{report ? fmtBeirutTime(report.fetchedAt) : '—'}</strong> (Beirut)
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0f172a',
              background: '#fff',
            }}
          />

          <select
            value={branchId}
            onChange={e => setBranchId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0f172a',
              background: '#fff',
            }}
          >
            <option value="ALL">All Branches</option>
            {(report?.branches || []).map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={conceptId}
            onChange={e => setConceptId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0f172a',
              background: '#fff',
            }}
          >
            <option value="ALL">All Concepts</option>
            <option value="00000000-0000-0000-0000-000000000001">NÉO</option>
            <option value="00000000-0000-0000-0000-000000000002">OVRLOAD</option>
            <option value="00000000-0000-0000-0000-000000000003">WICKD</option>
          </select>

          <button
            type="button"
            onClick={() => setAutoRefresh(v => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: autoRefresh ? '#f0fdf4' : '#f8fafc',
              color: autoRefresh ? '#166534' : '#475569',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {autoRefresh ? <PauseCircle size={15} /> : <PlayCircle size={15} />}
            {autoRefresh ? 'Pause Live' : 'Resume Live'}
          </button>

          <button
            type="button"
            onClick={() => void loadReport(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#0f172a',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!report}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              background: '#1e5c4f',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* KPI SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Net Sales (Settled)</span>
            <DollarSign size={16} color="#1e5c4f" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginTop: '6px', fontFamily: 'monospace' }}>
            {fmtUsd(k?.netSalesUsd)}
          </div>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
            ≈ {fmtLbp((k?.netSalesUsd || 0) * rate)} • <strong>{k?.completedOrdersCount || 0}</strong> settled • Avg{' '}
            <strong>{fmtUsd(k?.avgTicketUsd)}</strong>
          </div>
        </div>

        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#92400e', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Open Tables & Unsettled</span>
            <Utensils size={16} color="#d97706" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#92400e', marginTop: '6px', fontFamily: 'monospace' }}>
            {fmtUsd((k?.openTablesValueUsd || 0) + (k?.openNonTableOrdersValueUsd || 0))}
          </div>
          <div style={{ fontSize: '12px', color: '#78350f', marginTop: '4px' }}>
            <strong>{k?.openTablesCount || 0}</strong> open tables ({fmtUsd(k?.openTablesValueUsd)}) •{' '}
            <strong>{k?.openNonTableOrdersCount || 0}</strong> open orders ({fmtUsd(k?.openNonTableOrdersValueUsd)})
          </div>
        </div>

        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Daily Cash In / Out</span>
            <CreditCard size={16} color="#2563eb" />
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', fontWeight: 700 }}>
            <span style={{ color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowUpRight size={15} /> In: {fmtUsd(k?.cashInUsd)}
            </span>
            <span style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ArrowDownRight size={15} /> Out: {fmtUsd((k?.supplierPayoutsUsd || 0) + (k?.cashOutUsd || 0))}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
            Suppliers: {fmtUsd(k?.supplierPayoutsUsd)} / {fmtLbp(k?.supplierPayoutsLbp)} • CashOut: {fmtUsd(k?.cashOutUsd)}
          </div>
        </div>

        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #fecaca' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#991b1b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
            <span>Discounts, Voids & Cancels</span>
            <AlertTriangle size={16} color="#dc2626" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#991b1b', marginTop: '6px', fontFamily: 'monospace' }}>
            {fmtUsd((k?.totalDiscountsUsd || 0) + (k?.canceledValueUsd || 0))}
          </div>
          <div style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '4px' }}>
            Discounts: {fmtUsd(k?.totalDiscountsUsd)} • <strong>{k?.canceledOrdersCount || 0}</strong> canceled •{' '}
            <strong>{k?.voidReceiptsCount || 0}</strong> void logs
          </div>
        </div>
      </div>

      {/* ACTIVE SHIFTS STRIP */}
      {report && report.shifts.length > 0 && (
        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} /> Shift Cash Sessions ({report.shifts.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '12px' }}>
            {report.shifts.map(s => (
              <div
                key={s.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: s.status === 'open' ? '1px solid #86efac' : s.status === 'on_hold' ? '1px solid #fcd34d' : '1px solid #e2e8f0',
                  background: s.status === 'open' ? '#f0fdf4' : s.status === 'on_hold' ? '#fffbeb' : '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                    {s.branch} — {s.shift}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      background: s.status === 'open' ? '#16a34a' : s.status === 'on_hold' ? '#d97706' : '#64748b',
                      color: '#fff',
                    }}
                  >
                    {s.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>
                    Cashier: <strong>{s.user_name || '—'}</strong>
                    {s.closed_by ? ` • Closed by ${s.closed_by}` : ''}
                  </span>
                  <span>
                    Float: {fmtUsd(s.opening_usd)} / {fmtLbp(s.opening_lbp)}
                  </span>
                  {s.actual_usd != null && (
                    <span>
                      Actual: <strong>{fmtUsd(s.actual_usd)}</strong> / {fmtLbp(s.actual_lbp)}{' '}
                      {s.variance_usd != null && (
                        <strong style={{ color: s.variance_usd < 0 ? '#dc2626' : '#15803d' }}>
                          ({s.variance_usd >= 0 ? '+' : ''}
                          {fmtUsd(s.variance_usd)})
                        </strong>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PAYMENT & CHANNEL BREAKDOWN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
            Payment Method Breakdown (Settled)
          </h3>
          {!report || report.paymentBreakdown.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>No settled transactions for this filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {report.paymentBreakdown.map(row => (
                <div key={row.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    <span>
                      {row.key} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({row.count})</span>
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {fmtUsd(row.amount_usd)} <span style={{ color: '#64748b', fontSize: '11px' }}>({row.share_pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, row.share_pct)}%`, height: '100%', background: '#1e5c4f', borderRadius: '999px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', padding: '18px 20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
            Channel Breakdown (Settled)
          </h3>
          {!report || report.channelBreakdown.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>No settled transactions for this filter.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {report.channelBreakdown.map(row => (
                <div key={row.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    <span>
                      {row.key} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({row.count})</span>
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {fmtUsd(row.amount_usd)} <span style={{ color: '#64748b', fontSize: '11px' }}>({row.share_pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, row.share_pct)}%`, height: '100%', background: '#ea580c', borderRadius: '999px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TABBED TRANSACTION LEDGER */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'orders', label: `All Orders (${report?.orders.length || 0})`, icon: <ShoppingBag size={14} /> },
              { id: 'tables', label: `Open Tables (${report?.openTables.length || 0})`, icon: <Utensils size={14} /> },
              { id: 'payments', label: `Cash In/Out (${report?.dailyPayments.length || 0})`, icon: <DollarSign size={14} /> },
              { id: 'voids', label: `Voids & Cancels (${canceledOrders.length + (report?.voidReceipts.length || 0)})`, icon: <Receipt size={14} /> },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  border: activeTab === tab.id ? '1px solid #1e5c4f' : '1px solid #e2e8f0',
                  background: activeTab === tab.id ? '#1e5c4f' : '#fff',
                  color: activeTab === tab.id ? '#fff' : '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'orders' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search order #, table, customer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    padding: '7px 10px 7px 30px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    minWidth: '210px',
                  }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
              >
                <option value="ALL">All Statuses</option>
                <option value="SETTLED">Settled / Paid</option>
                <option value="OPEN">Open / Preparing</option>
                <option value="CANCELED">Canceled</option>
              </select>

              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600 }}
              >
                <option value="ALL">All Payment Methods</option>
                {paymentMethodOptions.map(pm => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* BODY */}
        {loading && !report ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            Loading live daily transactions...
          </div>
        ) : activeTab === 'orders' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '11px 14px' }}>Time</th>
                  <th style={{ padding: '11px 14px' }}>Order / Invoice</th>
                  <th style={{ padding: '11px 14px' }}>Concept / Branch</th>
                  <th style={{ padding: '11px 14px' }}>Channel / Table</th>
                  <th style={{ padding: '11px 14px' }}>Customer / Staff</th>
                  <th style={{ padding: '11px 14px' }}>Payment</th>
                  <th style={{ padding: '11px 14px' }}>Status</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '11px 14px', textAlign: 'center' }}>Items</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No orders matching your filters for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => (
                    <tr
                      key={o.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: o.is_canceled ? '#fef2f2' : '#fff',
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap' }}>
                        {fmtBeirutTime(o.created_at)}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                        #{o.id}
                        {o.invoice_number && (
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{o.invoice_number}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{o.concept_name}</span>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{o.branch_name}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontWeight: 600 }}>{o.channel}</span>
                        {o.table_label && (
                          <span
                            style={{
                              marginLeft: '6px',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: '#fef3c7',
                              color: '#92400e',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            {o.table_label}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{o.customer_name || 'Walk-In'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{o.waiter_name || o.cashier_name || '—'}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{o.payment_method}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'capitalize',
                            background: o.is_canceled
                              ? '#fee2e2'
                              : ['completed', 'closed', 'delivered', 'paid'].includes(o.status.toLowerCase())
                              ? '#dcfce7'
                              : '#fef3c7',
                            color: o.is_canceled
                              ? '#991b1b'
                              : ['completed', 'closed', 'delivered', 'paid'].includes(o.status.toLowerCase())
                              ? '#166534'
                              : '#92400e',
                          }}
                        >
                          {o.is_canceled ? 'Canceled' : o.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                        {fmtUsd(o.total_amount)}
                        {o.discount_amount > 0 && (
                          <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>
                            -{fmtUsd(o.discount_amount)} disc
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => void handleOpenOrderDetail(o)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: '#1e5c4f',
                          }}
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'tables' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '11px 14px' }}>Table</th>
                  <th style={{ padding: '11px 14px' }}>Branch</th>
                  <th style={{ padding: '11px 14px' }}>Guests</th>
                  <th style={{ padding: '11px 14px' }}>Waiter</th>
                  <th style={{ padding: '11px 14px' }}>Opened At</th>
                  <th style={{ padding: '11px 14px' }}>Status</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right' }}>Current Bill</th>
                </tr>
              </thead>
              <tbody>
                {!report || report.openTables.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No currently open tables.
                    </td>
                  </tr>
                ) : (
                  report.openTables.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>🪑 {t.table_code}</td>
                      <td style={{ padding: '10px 14px' }}>{t.branch_name}</td>
                      <td style={{ padding: '10px 14px' }}>{t.guest_count}</td>
                      <td style={{ padding: '10px 14px' }}>{t.waiter_name || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{fmtBeirutTime(t.opened_at)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: t.is_paid_in_advance ? '#dcfce7' : '#fef3c7',
                            color: t.is_paid_in_advance ? '#166534' : '#92400e',
                          }}
                        >
                          {t.is_paid_in_advance ? 'Paid in Advance' : t.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>
                        {fmtUsd(t.total_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'payments' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '11px 14px' }}>Time</th>
                  <th style={{ padding: '11px 14px' }}>Branch / Shift</th>
                  <th style={{ padding: '11px 14px' }}>Type</th>
                  <th style={{ padding: '11px 14px' }}>Supplier / Recipient</th>
                  <th style={{ padding: '11px 14px' }}>Recorded By</th>
                  <th style={{ padding: '11px 14px' }}>Status</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right' }}>USD</th>
                  <th style={{ padding: '11px 14px', textAlign: 'right' }}>LBP</th>
                </tr>
              </thead>
              <tbody>
                {!report || report.dailyPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No daily cash-in / cash-out / supplier payments recorded for {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  report.dailyPayments.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{fmtBeirutTime(p.created_at)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <strong>{p.branch}</strong> {p.shift ? `(${p.shift})` : ''}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{p.type}</td>
                      <td style={{ padding: '10px 14px' }}>{p.supplier || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>{p.user_name || '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                          <CheckCircle2 size={13} color="#16a34a" /> {p.status || 'Paid'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                        {fmtUsd(p.amount_usd)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>
                        {fmtLbp(p.amount_lbp)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: '#991b1b' }}>
                Canceled Orders ({canceledOrders.length})
              </h4>
              {canceledOrders.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>No canceled orders for {selectedDate}.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#fef2f2', textAlign: 'left', color: '#991b1b' }}>
                      <th style={{ padding: '8px 12px' }}>Time</th>
                      <th style={{ padding: '8px 12px' }}>Order #</th>
                      <th style={{ padding: '8px 12px' }}>Branch</th>
                      <th style={{ padding: '8px 12px' }}>Reason</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {canceledOrders.map(o => (
                      <tr key={o.id} style={{ borderBottom: '1px solid #fee2e2' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{fmtBeirutTime(o.created_at)}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>#{o.id}</td>
                        <td style={{ padding: '8px 12px' }}>{o.branch_name}</td>
                        <td style={{ padding: '8px 12px' }}>{o.cancellation_reason || '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          {fmtUsd(o.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: '#92400e' }}>
                Void Receipt Logs ({report?.voidReceipts.length || 0})
              </h4>
              {!report || report.voidReceipts.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>No void receipt logs for {selectedDate}.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#fffbeb', textAlign: 'left', color: '#92400e' }}>
                      <th style={{ padding: '8px 12px' }}>Time</th>
                      <th style={{ padding: '8px 12px' }}>Branch / Table</th>
                      <th style={{ padding: '8px 12px' }}>Items</th>
                      <th style={{ padding: '8px 12px' }}>Reason</th>
                      <th style={{ padding: '8px 12px' }}>Staff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.voidReceipts.map(v => (
                      <tr key={v.id} style={{ borderBottom: '1px solid #fef3c7' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{fmtBeirutTime(v.created_at)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {v.branch} {v.table_number ? `• T${v.table_number}` : ''} {v.order_number ? `(#${v.order_number})` : ''}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {v.canceled_items.map(i => `${i.qty || 1}x ${i.name}`).join(', ') || '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>{v.reason_comment || '—'}</td>
                        <td style={{ padding: '8px 12px' }}>{v.created_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div
          onClick={() => setSelectedOrder(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '580px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  Order #{selectedOrder.id} {selectedOrder.invoice_number ? `• ${selectedOrder.invoice_number}` : ''}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {selectedOrder.concept_name} • {selectedOrder.branch_name} • {selectedOrder.channel}
                  {selectedOrder.table_label ? ` (${selectedOrder.table_label})` : ''} • {fmtBeirutTime(selectedOrder.created_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {loadingItems ? (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading line items...</p>
              ) : orderItems.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No line items recorded for this order.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '11px' }}>
                      <th style={{ padding: '6px 0' }}>Item</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '6px 0', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 0', fontWeight: 600 }}>
                          {item.product_name}
                          {item.comment && <div style={{ fontSize: '11px', color: '#64748b' }}>Note: {item.comment}</div>}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{item.quantity}</td>
                        <td style={{ padding: '8px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                          {fmtUsd(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <div>
                Payment: <strong>{selectedOrder.payment_method}</strong> • Status: <strong>{selectedOrder.status}</strong>
              </div>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '16px', color: '#1e5c4f' }}>
                {fmtUsd(selectedOrder.total_amount)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
