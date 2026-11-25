import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, ShoppingBag, Truck, DollarSign, Percent, 
  Receipt, Users, Clock, AlertCircle, ArrowUpRight, 
  ChevronRight, RefreshCw, CheckCircle2, ShieldCheck, 
  Layers, Package, Coffee, Sparkles, Filter, Calendar
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { conceptDeliveryAnalyticsService, type DeliveryDashboardData } from '../../services/conceptDeliveryAnalyticsService';
import { type ConceptCode } from '../../types/concept';

interface DeliveryConceptDashboardProps {
  conceptCode: 'OVRLOAD' | 'WICKD';
  branchId?: string;
  user: any;
  permissions?: any;
}

export default function DeliveryConceptDashboard({
  conceptCode,
  branchId,
  user,
  permissions
}: DeliveryConceptDashboardProps) {
  const [range, setRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DeliveryDashboardData | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await conceptDeliveryAnalyticsService.getDeliveryDashboardData(conceptCode, branchId, range);
      setData(res);
    } catch (err) {
      console.error('Failed to load delivery dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [conceptCode, branchId, range]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 gap-3">
        <RefreshCw size={24} className="animate-spin text-amber-500" />
        <span className="text-sm font-medium">Loading {conceptCode} Delivery Analytics...</span>
      </div>
    );
  }

  if (!data) return null;

  const isOvrload = conceptCode === 'OVRLOAD';
  const brandAccent = isOvrload ? '#e11d48' : '#7c3aed';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(val || 0);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* 1. Header Banner & Filters (Clean White Background) */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm"
            style={{ backgroundColor: brandAccent }}
          >
            {isOvrload ? 'OVR' : 'WCK'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{data.conceptName} Operations & Delivery Dashboard</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE PIPELINE
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live delivery orders, aggregator channels, driver collections & contribution margins
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* Time Range Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {(['today', 'yesterday', 'week', 'month', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                  range === r 
                    ? 'bg-white text-slate-900 shadow-sm font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'week' ? 'Last 7 Days' : (r === 'all' ? 'All Time' : r)}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            title="Refresh Data"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Top Tier Metrics (6 KPI Grid on White Background) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* KPI 1: Net Sales */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium">Net Sales</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(data.netSales)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Gross: <strong className="text-slate-700">{formatCurrency(data.grossSales)}</strong></span>
            <span className="text-amber-600 font-semibold">Disc: -{formatCurrency(data.totalDiscounts)}</span>
          </div>
        </div>

        {/* KPI 2: Orders & Ticket */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium">Orders Count</span>
            <ShoppingBag size={16} className="text-blue-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {data.totalOrders}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Today: <strong className="text-slate-900">{data.ordersToday}</strong></span>
            <span>Avg Ticket: <strong className="text-slate-900">{formatCurrency(data.averageTicket)}</strong></span>
          </div>
        </div>

        {/* KPI 3: Marketplace Receivables */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium">Aggregator Receivables</span>
            <TrendingUp size={16} className="text-indigo-600" />
          </div>
          <div className="text-xl font-bold text-indigo-600 tracking-tight">
            {formatCurrency(data.marketplaceReceivables)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Comm: <strong className="text-rose-600">-{formatCurrency(data.marketplaceCommission)}</strong></span>
            <span className="text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Net to Bank</span>
          </div>
        </div>

        {/* KPI 4: Driver Cash Collections */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium">Driver Cash Handover</span>
            <Truck size={16} className="text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-600 tracking-tight">
            {formatCurrency(data.driverCashCollections)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Driver Retained: <strong className="text-slate-700">{formatCurrency(data.driverFeesRetainedByDrivers)}</strong></span>
            <span className="text-emerald-700 font-semibold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">In Drawer</span>
          </div>
        </div>

        {/* KPI 5: COGS (Food + Packaging) */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium">Direct COGS</span>
            <Package size={16} className="text-rose-600" />
          </div>
          <div className="text-xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(data.totalCogs)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Food: <strong className="text-slate-700">{formatCurrency(data.foodCost)}</strong></span>
            <span>Pkg: <strong className="text-slate-700">{formatCurrency(data.packagingCost)}</strong></span>
          </div>
        </div>

        {/* KPI 6: Channel Contribution Margin */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-medium">Contribution Margin</span>
            <Percent size={16} className="text-teal-600" />
          </div>
          <div className="text-xl font-bold text-teal-600 tracking-tight">
            {data.contributionMarginPct}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span className="text-teal-700 font-semibold">{formatCurrency(data.channelContributionMargin)}</span>
            <span>Gross: <strong className="text-slate-700">{data.grossMarginPct}%</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Sales By Channel Breakdown (Toters, NokNok, WhatsApp, Pickup, App) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers size={18} className="text-amber-500" />
              Sales Channels Breakdown & Commissions
            </h2>
            <p className="text-xs text-slate-500">
              Contracted commission deductions and settlement receivables by channel
            </p>
          </div>
          <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
            AUTHORITATIVE FLOW LEDGER
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider bg-slate-50/70">
                <th className="py-2.5 px-3">Sales Channel</th>
                <th className="py-2.5 px-3 text-right">Orders</th>
                <th className="py-2.5 px-3 text-right">Gross Sales</th>
                <th className="py-2.5 px-3 text-right">Discounts</th>
                <th className="py-2.5 px-3 text-right">Net Sales</th>
                <th className="py-2.5 px-3 text-right">Delivery Fees</th>
                <th className="py-2.5 px-3 text-right">Commission Fee</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-900">Net Receivable</th>
                <th className="py-2.5 px-3 text-right">Channel Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.channels.map((ch) => {
                const getBadge = (name: string) => {
                  switch (name) {
                    case 'Toters':
                      return { emoji: '🛵', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
                    case 'NokNok':
                      return { emoji: '📦', bg: 'bg-pink-50 text-pink-800 border-pink-200' };
                    case 'WhatsApp':
                      return { emoji: '💬', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
                    case 'Pickup':
                      return { emoji: '🏪', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
                    default:
                      return { emoji: '📱', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
                  }
                };
                const badge = getBadge(ch.channel);

                return (
                  <tr key={ch.channel} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.bg}`}>
                        {badge.emoji} {ch.channel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900">{ch.orderCount}</td>
                    <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(ch.grossSales)}</td>
                    <td className="py-3 px-3 text-right text-amber-600 font-medium">-{formatCurrency(ch.discounts)}</td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900">{formatCurrency(ch.netSales)}</td>
                    <td className="py-3 px-3 text-right text-slate-600">{formatCurrency(ch.deliveryFees)}</td>
                    <td className="py-3 px-3 text-right text-rose-600 font-medium">
                      {ch.commissionExpense > 0 ? `-${formatCurrency(ch.commissionExpense)}` : '$0.00'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600 text-sm">
                      {formatCurrency(ch.netReceivable)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono text-slate-600">{ch.sharePct}%</span>
                        <div className="w-16 bg-slate-100 border border-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ width: `${ch.sharePct}%`, backgroundColor: brandAccent }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-slate-900 bg-slate-50/90">
                <td className="py-3 px-3">Total Consolidated</td>
                <td className="py-3 px-3 text-right">{data.totalOrders}</td>
                <td className="py-3 px-3 text-right">{formatCurrency(data.grossSales)}</td>
                <td className="py-3 px-3 text-right text-amber-600">-{formatCurrency(data.totalDiscounts)}</td>
                <td className="py-3 px-3 text-right">{formatCurrency(data.netSales)}</td>
                <td className="py-3 px-3 text-right">{formatCurrency(data.driverFeesRetainedByDrivers)}</td>
                <td className="py-3 px-3 text-right text-rose-600">-{formatCurrency(data.marketplaceCommission)}</td>
                <td className="py-3 px-3 text-right text-emerald-700 text-sm">{formatCurrency(data.marketplaceReceivables + data.driverCashCollections)}</td>
                <td className="py-3 px-3 text-right">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. Two-Column Operational Row: Hourly Velocity & Driver Handovers / Shift Reconciliation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Hourly Velocity Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock size={16} className="text-blue-600" />
                Hourly Order Velocity & Sales Curve
              </h3>
              <p className="text-xs text-slate-500">Delivery order volume by hour</p>
            </div>
            <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">11:00 - 23:00 Window</span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.hourlyDistribution} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={brandAccent} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={brandAccent} stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#0f172a' }}
                  labelStyle={{ color: '#475569', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="sales" name="Sales ($)" stroke={brandAccent} strokeWidth={2} fillOpacity={1} fill="url(#orderGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Cash Shift Reconciliation & Driver Handovers */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                Active Shift Cash & Drawer Reconciliation
              </h3>
              <p className="text-xs text-slate-500">Cash register audit ledger and driver collection</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {data.shiftReconciliation?.status || 'BALANCED'}
            </span>
          </div>

          {data.shiftReconciliation && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-500">Opening Float</span>
                <div className="text-sm font-bold text-slate-900">{formatCurrency(data.shiftReconciliation.openingFloatUsd)}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-500">Driver Collections</span>
                <div className="text-sm font-bold text-emerald-600">+{formatCurrency(data.shiftReconciliation.driverCollectionsUsd)}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-500">Cash Payouts</span>
                <div className="text-sm font-bold text-rose-600">-{formatCurrency(data.shiftReconciliation.cashOutUsd)}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[10px] text-slate-500">Drawer Actual</span>
                <div className="text-sm font-bold text-slate-900">{formatCurrency(data.shiftReconciliation.actualDrawerUsd)}</div>
              </div>
            </div>
          )}

          {/* Recent Driver Handovers Table */}
          <div className="pt-1">
            <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
              <span>Recent Driver Handovers (One per order)</span>
              <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">pos_order_handovers</span>
            </div>
            <div className="space-y-1.5">
              {data.recentHandovers.map((h) => (
                <div key={h.orderId} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 hover:bg-slate-100/60 transition-colors text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{h.orderId}</span>
                    <span className="text-slate-800 font-medium">{h.driverName}</span>
                    <span className="text-slate-400 text-[11px] hidden sm:inline">{h.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-emerald-600">{formatCurrency(h.amountCollected)}</div>
                      <div className="text-[10px] text-slate-500">Fee retained: {formatCurrency(h.feeRetained)}</div>
                    </div>
                    <span className="text-[10px] text-slate-400">{h.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Product Performance & Contribution Margin */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              {data.conceptName} Top Product Performance & Unit Margin
            </h2>
            <p className="text-xs text-slate-500">
              Quantity sold, revenue, recipe BOM food cost, packaging cost, and profit margin
            </p>
          </div>
          <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            Sorted by Sales Volume
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider bg-slate-50/70">
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Units Sold</th>
                <th className="py-2.5 px-3 text-right">Unit Food Cost</th>
                <th className="py-2.5 px-3 text-right">Packaging Cost</th>
                <th className="py-2.5 px-3 text-right">Total Revenue</th>
                <th className="py-2.5 px-3 text-right">Gross Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.topProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{p.name}</td>
                  <td className="py-2.5 px-3 text-slate-500">{p.category}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{p.quantitySold}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(p.unitCost)}</td>
                  <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(p.packagingCost)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(p.revenue)}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-600">{p.marginPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
