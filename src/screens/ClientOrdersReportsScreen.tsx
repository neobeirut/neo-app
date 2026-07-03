import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  Clock, 
  RefreshCw, 
  Award, 
  DollarSign
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

export default function ClientOrdersReportsScreen({ user, permissions }: { user: any; permissions: any }) {
  const hasAccess = permissions?.can_view_client_reports || user?.role === 'Admin' || user?.role === 'Manager';
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);

  // Filter state for reports
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Last 30 days by default
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState('All');

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate, branchFilter]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (branchFilter !== 'All') filters.branch = branchFilter;

      const res = await api.getClientOrders(filters);
      if (res.success && res.data) {
        setOrders(res.data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // 1. KPI Calculations
  const totalOrdersCount = orders.length;
  const totalRevenue = orders
    .filter(o => o.status !== 'Cancelled')
    .reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);

  const avgOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;

  // Opportunity Conversion Rate: Confirmed/Production/Completed orders divided by non-cancelled
  const nonCancelledOrders = orders.filter(o => o.status !== 'Cancelled');
  const convertedOrders = orders.filter(o => 
    ['Confirmed', 'In Production', 'Ready for Pickup', 'Ready for Delivery', 'Delivered', 'Completed'].includes(o.status)
  );
  const conversionRate = nonCancelledOrders.length > 0 
    ? (convertedOrders.length / nonCancelledOrders.length) * 100 
    : 0;

  // 2. Revenue by Category
  const categoryTotals: { [key: string]: number } = {
    Pastry: 0,
    Bakery: 0,
    Breakfast: 0,
    Lunch: 0,
    Dinner: 0,
    Catering: 0,
    Corporate: 0,
    Other: 0
  };
  orders.filter(o => o.status !== 'Cancelled').forEach(o => {
    if (categoryTotals[o.category] !== undefined) {
      categoryTotals[o.category] += Number(o.grand_total) || 0;
    } else {
      categoryTotals.Other += Number(o.grand_total) || 0;
    }
  });

  // 3. Salesperson Performance Leaderboard
  const salespersonTotals: { [key: string]: { revenue: number; count: number } } = {};
  orders.filter(o => o.status !== 'Cancelled').forEach(o => {
    const sp = o.salesperson || 'Unknown';
    if (!salespersonTotals[sp]) {
      salespersonTotals[sp] = { revenue: 0, count: 0 };
    }
    salespersonTotals[sp].revenue += Number(o.grand_total) || 0;
    salespersonTotals[sp].count += 1;
  });

  const sortedSalespeople = Object.entries(salespersonTotals)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // 4. Top Clients Leaderboard
  const clientTotals: { [key: string]: { name: string; company: string; revenue: number; count: number } } = {};
  orders.filter(o => o.status !== 'Cancelled').forEach(o => {
    const cId = o.client_id || 'Unknown';
    const cName = o.clients?.name || 'Walk-in Client';
    const cCompany = o.clients?.company_name || '';
    if (!clientTotals[cId]) {
      clientTotals[cId] = { name: cName, company: cCompany, revenue: 0, count: 0 };
    }
    clientTotals[cId].revenue += Number(o.grand_total) || 0;
    clientTotals[cId].count += 1;
  });

  const sortedClients = Object.values(clientTotals)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // 5. Upcoming Events (Catering & Corporate bookings on or after today)
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingEvents = orders
    .filter(o => 
      ['Catering', 'Corporate'].includes(o.category) && 
      o.status !== 'Cancelled' && 
      o.event_date && 
      o.event_date >= todayStr
    )
    .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
    .slice(0, 5);

  // 6. Open Opportunities (Quotation Sent, not yet Confirmed)
  const openOpportunities = orders.filter(o => o.status === 'Quotation Sent');

  // 7. CSV Exporter
  const exportCSV = () => {
    if (orders.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = ['Order ID', 'Client Name', 'Company', 'Phone', 'Date', 'Category', 'Branch', 'Salesperson', 'Subtotal', 'Discount', 'VAT', 'Grand Total', 'Status', 'Event Location'];
    const rows = orders.map(o => [
      o.id || '',
      o.clients?.name || '',
      o.clients?.company_name || '',
      o.clients?.phone || '',
      o.order_date || '',
      o.category || '',
      o.branch || '',
      o.salesperson || '',
      Number(o.subtotal || 0).toFixed(2),
      Number(o.discount || 0).toFixed(2),
      Number(o.vat || 0).toFixed(2),
      Number(o.grand_total || 0).toFixed(2),
      o.status || '',
      o.event_location || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Client_Sales_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  if (!hasAccess) {
    return (
      <div className="dashboard-container">
        <h1>Access Denied</h1>
        <p>You do not have permission to view Client Sales Analytics & Reports.</p>
        <Link to="/client-orders" style={{ color: 'var(--primary)', fontWeight: 'bold', marginTop: '15px', display: 'inline-block' }}>
          &larr; Back to Client Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Print Page Styles Override */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .sidebar, .top-bar, .filters-card, .no-print, button {
            display: none !important;
          }
          .content-area {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .dashboard-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .kpi-grid {
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 10px !important;
          }
          .kpi-card {
            border: 1px solid #ccc !important;
            box-shadow: none !important;
          }
          .print-split {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="dashboard-title-row no-print">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/client-orders" style={{ color: 'var(--text-muted)' }}><ArrowLeft size={20} /></Link>
            <h1>Client Sales Analytics & Reports</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Review sales leaders, event schedules, revenue breakdown, export CSV, and print invoices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={exportCSV}
            className="auth-btn"
            style={{ 
              width: 'auto', 
              backgroundColor: '#e2e8f0', 
              color: 'var(--text-main)', 
              border: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px'
            }}
          >
            <Download size={16} /> Export CSV
          </button>
          
          <button 
            onClick={() => window.print()}
            className="auth-btn"
            style={{ 
              width: 'auto', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px'
            }}
          >
            <Printer size={16} /> Print Report
          </button>
        </div>
      </div>

      {/* Title block for printable layout */}
      <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800 }}>{(import.meta.env.VITE_APP_NAME || 'NÉO').toUpperCase()} — SALES & CRM INVOICE REPORT</h2>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          Period: {startDate || 'All Time'} to {endDate || 'All Time'} • Branch: {branchFilter}
        </p>
      </div>

      {/* Filters Card */}
      <div className="filters-card no-print" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          
          <div className="filter-group" style={{ minWidth: '180px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%' }} />
          </div>

          <div className="filter-group" style={{ minWidth: '180px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%' }} />
          </div>

          <div className="filter-group" style={{ minWidth: '180px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><DollarSign size={14} /> Branch</label>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="All">All Branches</option>
              <option value="Downtown">Downtown</option>
              <option value="Hamra">Hamra</option>
              <option value="Achrafieh">Achrafieh</option>
              <option value="Badaro">Badaro</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={loadReportData}
              className="auth-btn"
              style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px', marginTop: '20px' }}>
          <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Analyzing database analytics...</p>
        </div>
      ) : (
        <>
          {/* KPI Dashboard Row */}
          <div className="kpi-grid" style={{ marginTop: '20px' }}>
            <div className="kpi-card kpi-status-success">
              <div className="kpi-card-header">
                <span className="kpi-card-title">Total Revenue</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <DollarSign size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="kpi-card-label">Excluding Cancelled Orders</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-warning">
              <div className="kpi-card-header">
                <span className="kpi-card-title">Average Ticket Value</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <TrendingUp size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">${avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="kpi-card-label">Revenue divided by order count</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-neutral">
              <div className="kpi-card-header">
                <span className="kpi-card-title">Total Orders</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: '#e2e8f0', color: 'var(--text-muted)' }}>
                  <ShoppingBag size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{totalOrdersCount}</span>
                <span className="kpi-card-label">Quotes, inquiries, & sales logs</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-danger">
              <div className="kpi-card-header">
                <span className="kpi-card-title">CRM Conversion Rate</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <Award size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{conversionRate.toFixed(1)}%</span>
                <span className="kpi-card-label">Quotes turned into confirmed status</span>
              </div>
            </div>
          </div>

          {/* MAIN CHARTS SECTION */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }} className="print-split">
            
            {/* Category Revenue Chart */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)' }}>Revenue by Category</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(categoryTotals).map(([cat, amount]) => {
                  const percent = totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0;
                  return (
                    <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                        <span>{cat}</span>
                        <span>${amount.toFixed(2)} ({percent.toFixed(1)}%)</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${percent}%`, backgroundColor: 'var(--primary)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Salesperson leaderboard */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)' }}>Salesperson Leaderboard</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {sortedSalespeople.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No sales logged.</div>
                ) : (
                  sortedSalespeople.map((sp, idx) => {
                    const maxRevenue = sortedSalespeople[0].revenue || 1;
                    const barWidth = (sp.revenue / maxRevenue) * 100;
                    return (
                      <div key={sp.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: idx === 0 ? '#fef3c7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '12px', color: idx === 0 ? '#b45309' : 'var(--text-main)' }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                            <span>{sp.name}</span>
                            <span style={{ color: 'var(--primary)' }}>${sp.revenue.toFixed(2)} ({sp.count} orders)</span>
                          </div>
                          <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${barWidth}%`, backgroundColor: '#3b82f6', borderRadius: '4px' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Top Clients */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)' }}>Top Revenue Client Accounts</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sortedClients.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No clients logged.</div>
                ) : (
                  sortedClients.map((client, idx) => (
                    <div key={client.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: idx < sortedClients.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>{client.name}</span>
                        {client.company && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🏢 {client.company}</span>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>${client.revenue.toFixed(2)}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{client.count} order(s)</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* LOWER SECTION - Event Calendar & Quotes Opportunities */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' }} className="print-split">
            
            {/* Catering & Corporate event schedule */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} /> Upcoming Event Schedule (Catering / Corp)
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcomingEvents.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No upcoming catering or corporate events.
                  </div>
                ) : (
                  upcomingEvents.map(ev => (
                    <div key={ev.id} style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{ev.event_name || ev.clients?.name || 'Private Event'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          📍 {ev.event_location || 'Not Specified'} • 🕒 {ev.event_time || 'N/A'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', backgroundColor: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          {ev.event_date}
                        </span>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>${Number(ev.grand_total).toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quotations Open opportunities */}
            <div style={{ backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> Open Sales Opportunities (Pending Quotes)
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {openOpportunities.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No pending quotations open. All offers are cancelled or confirmed.
                  </div>
                ) : (
                  openOpportunities.map(opp => (
                    <div key={opp.id} style={{ padding: '10px', backgroundColor: '#fdfbeb', borderRadius: '8px', border: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700 }}>{opp.clients?.name || 'Walk-in Client'}</div>
                        <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px' }}>
                          ID: {opp.id} • Category: {opp.category}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', backgroundColor: '#fff7ed', color: '#c2410c', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          Quotation Sent
                        </span>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>${Number(opp.grand_total).toFixed(2)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
