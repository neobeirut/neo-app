import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Calendar, 
  User, 
  Building, 
  Tag, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  AlertCircle,
  RefreshCw,
  Clock
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

export default function ClientOrdersScreen({ user, permissions }: { user: any; permissions: any }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [salespeople, setSalespeople] = useState<string[]>([]);
  const branches = ['Downtown', 'Hamra', 'Achrafieh', 'Badaro'];

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [salespersonFilter, setSalespersonFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const canViewReports = permissions?.can_view_client_reports || user.role === 'Admin' || user.role === 'Manager';

  useEffect(() => {
    loadOrders();
  }, [categoryFilter, statusFilter, branchFilter, salespersonFilter, startDate, endDate]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (categoryFilter !== 'All') filters.category = categoryFilter;
      if (statusFilter !== 'All') filters.status = statusFilter;
      if (branchFilter !== 'All') filters.branch = branchFilter;
      if (salespersonFilter !== 'All') filters.salesperson = salespersonFilter;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const res = await api.getClientOrders(filters);
      if (res.success && res.data) {
        let fetchedOrders = res.data;
        
        // Role based row restriction:
        // Staff can only view/edit client orders they created (unless they are admin/manager or from the same branch)
        if (user.role === 'Staff' && !permissions?.can_manage_client_orders) {
          fetchedOrders = fetchedOrders.filter((o: any) => 
            o.salesperson === user.name || 
            (user.branch && o.branch && user.branch.toLowerCase() === o.branch.toLowerCase())
          );
        }

        setOrders(fetchedOrders);

        // Collect unique salespeople for filter dropdown
        const uniqueSales = Array.from(new Set(res.data.map((o: any) => o.salesperson))).filter(Boolean) as string[];
        setSalespeople(uniqueSales);
      }
    } catch (e) {
      console.error('Error loading client orders:', e);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string, salesperson: string) => {
    // Creator or Admin can delete
    const isCreator = salesperson === user.name;
    const isAdmin = user.role === 'Admin';
    if (!isCreator && !isAdmin) {
      alert('Only the creator of this order or an Administrator can delete it.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete order ${id}?`)) {
      try {
        const res = await api.deleteClientOrder(id);
        if (res.success) {
          alert('Order deleted successfully.');
          loadOrders();
        } else {
          alert('Failed to delete order: ' + res.error);
        }
      } catch (e: any) {
        alert('Error deleting order: ' + e.message);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Inquiry':
        return '#3b82f6'; // Blue
      case 'Quotation Sent':
        return '#a855f7'; // Purple
      case 'Confirmed':
        return '#10b981'; // Green
      case 'In Production':
        return '#f59e0b'; // Amber
      case 'Ready for Pickup':
      case 'Ready for Delivery':
        return '#14b8a6'; // Teal
      case 'Delivered':
      case 'Completed':
        return '#059669'; // Emerald
      case 'Cancelled':
        return '#ef4444'; // Red
      default:
        return '#64748b'; // Gray
    }
  };

  // Client-side search matching client name, company, ID, salesperson
  const filteredOrders = orders.filter((o: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const idMatch = o.id?.toLowerCase().includes(query);
    const clientNameMatch = o.clients?.name?.toLowerCase().includes(query);
    const clientCompanyMatch = o.clients?.company_name?.toLowerCase().includes(query);
    const salesMatch = o.salesperson?.toLowerCase().includes(query);
    return idMatch || clientNameMatch || clientCompanyMatch || salesMatch;
  });

  return (
    <div className="dashboard-container">
      {/* Title Header */}
      <div className="dashboard-title-row">
        <div>
          <h1>Client Orders (CRM)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Record, track, and manage phone, WhatsApp, catering, and walk-in sales inquiries.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {canViewReports && (
            <Link 
              to="/client-orders/reports"
              className="auth-btn"
              style={{ 
                width: 'auto', 
                backgroundColor: '#e2e8f0', 
                color: 'var(--text-main)', 
                border: 'none', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                textDecoration: 'none',
                lineHeight: '40px',
                padding: '0 16px'
              }}
            >
              <TrendingUp size={16} /> Sales Reports
            </Link>
          )}
          
          <Link 
            to="/client-orders/new"
            className="auth-btn"
            style={{ 
              width: 'auto', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              textDecoration: 'none',
              lineHeight: '40px',
              padding: '0 16px'
            }}
          >
            <Plus size={16} /> New Order
          </Link>
        </div>
      </div>

      {/* Filters Card */}
      <div className="filters-card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
          
          <div className="filter-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Search size={14} /> Search</label>
            <input 
              type="text" 
              placeholder="Search by client, ID, company..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div className="filter-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Tag size={14} /> Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="All">All Categories</option>
              <option value="Pastry">Pastry</option>
              <option value="Bakery">Bakery</option>
              <option value="Breakfast">Breakfast</option>
              <option value="Lunch">Lunch</option>
              <option value="Dinner">Dinner</option>
              <option value="Catering">Catering</option>
              <option value="Corporate">Corporate</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="filter-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="All">All Statuses</option>
              <option value="Inquiry">Inquiry</option>
              <option value="Quotation Sent">Quotation Sent</option>
              <option value="Confirmed">Confirmed</option>
              <option value="In Production">In Production</option>
              <option value="Ready for Pickup">Ready for Pickup</option>
              <option value="Ready for Delivery">Ready for Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="filter-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building size={14} /> Branch</label>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="All">All Branches</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={14} /> Salesperson</label>
            <select value={salespersonFilter} onChange={(e) => setSalespersonFilter(e.target.value)} style={{ width: '100%' }}>
              <option value="All">All Salespeople</option>
              {salespeople.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%' }} />
          </div>

          <div className="filter-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => {
                setCategoryFilter('All');
                setStatusFilter('All');
                setBranchFilter('All');
                setSalespersonFilter('All');
                setStartDate('');
                setEndDate('');
                setSearchQuery('');
              }}
              className="auth-btn"
              style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
            >
              Reset
            </button>
            <button 
              onClick={loadOrders}
              className="auth-btn"
              style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div style={{ 
        backgroundColor: 'var(--surface)', 
        borderRadius: '12px', 
        border: '1px solid var(--border)', 
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
        marginTop: '20px'
      }}>
        {loading ? (
          <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
            <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading client orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
            <AlertCircle size={36} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>No Orders Found</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>There are no client orders matching the filters.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Order ID</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Client / Company</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Order Date</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Category</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Branch</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Salesperson</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Grand Total</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const clientName = order.clients?.name || 'Walk-in Client';
                  const companyName = order.clients?.company_name;
                  
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                        {order.id}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{clientName}</span>
                          {companyName && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              🏢 {companyName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{order.order_date}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: order.category === 'Catering' || order.category === 'Corporate' ? '#eff6ff' : '#f3f4f6',
                          color: order.category === 'Catering' || order.category === 'Corporate' ? '#1e40af' : 'var(--text-main)',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '11px'
                        }}>
                          {order.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{order.branch}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>{order.salesperson}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                        ${Number(order.grand_total).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          backgroundColor: getStatusColor(order.status) + '15',
                          color: getStatusColor(order.status),
                          borderRadius: '12px',
                          fontWeight: 800,
                          fontSize: '11px',
                          border: `1px solid ${getStatusColor(order.status)}30`,
                          display: 'inline-block'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => navigate(`/client-orders/edit/${order.id}`)}
                            className="auth-btn"
                            style={{
                              width: 'auto',
                              padding: '6px 12px',
                              fontSize: '12px',
                              backgroundColor: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(order.id, order.salesperson)}
                            className="auth-btn"
                            style={{
                              width: 'auto',
                              padding: '6px 12px',
                              fontSize: '12px',
                              backgroundColor: 'white',
                              color: 'var(--danger)',
                              border: '1px solid var(--danger)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
