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
  Clock,
  Settings,
  X
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

export default function ClientOrdersScreen({ user, permissions, onUpdateUser }: { user: any; permissions: any; onUpdateUser: (user: any) => void }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [salespeople, setSalespeople] = useState<string[]>([]);
  const branches = ['Downtown', 'Hamra', 'Achrafieh', 'Badaro'];

  // Dynamic Categories
  const categories = user?.restaurants?.settings?.client_order_categories || [
    'Pastry', 'Bakery', 'Breakfast', 'Lunch', 'Dinner', 'Catering', 'Corporate', 'Other'
  ];

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatIndex, setEditingCatIndex] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveCategories = async (updatedCats: string[]) => {
    setSavingSettings(true);
    try {
      const currentSettings = user?.restaurants?.settings || {};
      const newSettings = {
        ...currentSettings,
        client_order_categories: updatedCats
      };
      const res = await api.updateRestaurantSettings(user.restaurant_id || user.restaurants?.id, newSettings);
      if (res.success && res.data) {
        onUpdateUser({
          ...user,
          restaurants: {
            ...user.restaurants,
            settings: res.data.settings
          }
        });
      } else {
        alert('Error updating categories: ' + (res.error || 'Unknown error'));
      }
    } catch (e: any) {
      alert('Error updating categories: ' + e.message);
    }
    setSavingSettings(false);
  };

  const handleAddCategory = () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      alert('Category already exists.');
      return;
    }
    const updated = [...categories, trimmed];
    handleSaveCategories(updated);
    setNewCatName('');
  };

  const handleDeleteCategory = (cat: string) => {
    if (window.confirm(`Are you sure you want to remove the category "${cat}"? Existing orders under this category will not be changed, but you won't be able to select it for new orders.`)) {
      const updated = categories.filter((c: string) => c !== cat);
      handleSaveCategories(updated);
    }
  };

  const handleStartEdit = (index: number, cat: string) => {
    setEditingCatIndex(index);
    setEditingCatName(cat);
  };

  const handleSaveEdit = () => {
    const trimmed = editingCatName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed) && categories[editingCatIndex!] !== trimmed) {
      alert('Category already exists.');
      return;
    }
    const updated = [...categories];
    updated[editingCatIndex!] = trimmed;
    handleSaveCategories(updated);
    setEditingCatIndex(null);
    setEditingCatName('');
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [salespersonFilter, setSalespersonFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const canViewReports = permissions?.can_view_client_reports || user.role === 'Admin' || user.role === 'Manager';
  const roleLower = user.role?.toLowerCase();
  const canManage = permissions?.can_manage_client_orders || roleLower === 'admin' || roleLower === 'manager' || roleLower === 'superadmin';

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
          <h1>Client Orders</h1>
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

          {canManage && (
            <button 
              onClick={() => setShowCategoryModal(true)}
              className="auth-btn"
              style={{ 
                width: 'auto', 
                backgroundColor: '#f1f5f9', 
                color: 'var(--text-main)', 
                border: '1px solid var(--border)', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '0 16px',
                cursor: 'pointer'
              }}
            >
              <Settings size={16} /> Categories
            </button>
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
              {categories.map((cat: string) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
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

      {showCategoryModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Manage Order Categories
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                  Add, rename, or delete categories for client CRM orders.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCatIndex(null);
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Add New Category form */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="New category name..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  style={{ flex: 1, height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  disabled={savingSettings}
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '0 16px', height: '38px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600 }}
                  disabled={savingSettings}
                >
                  Add
                </button>
              </div>

              {/* Categories list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-main)' }}>Existing Categories</h4>
                {categories.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>No categories configured. Static defaults will be used.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', backgroundColor: '#f8fafc', maxHeight: '300px', overflowY: 'auto' }}>
                    {categories.map((cat: string, index: number) => (
                      <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        {editingCatIndex === index ? (
                          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                            <input 
                              type="text" 
                              value={editingCatName}
                              onChange={(e) => setEditingCatName(e.target.value)}
                              style={{ flex: 1, height: '28px', padding: '0 8px', borderRadius: '4px', border: '1px solid var(--primary)', fontSize: '13px' }}
                            />
                            <button 
                              onClick={handleSaveEdit}
                              style={{ padding: '0 8px', fontSize: '12px', backgroundColor: 'var(--success)', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                              disabled={savingSettings}
                            >
                              Save
                            </button>
                            <button 
                              onClick={() => setEditingCatIndex(null)}
                              style={{ padding: '0 8px', fontSize: '12px', backgroundColor: '#f1f5f9', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>{cat}</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => handleStartEdit(index, cat)}
                                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#eff6ff', color: '#1e40af', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                disabled={savingSettings}
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat)}
                                style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#fef2f2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                disabled={savingSettings}
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCatIndex(null);
                }}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '6px' }}
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
