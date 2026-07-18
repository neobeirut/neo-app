import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Eye, 
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

export default function PurchasingScreen({ user }: { user: any }) {
  const [activeTab, setActiveTab] = useState<'requests' | 'catalog'>('requests');
  const [loading, setLoading] = useState(true);

  // Lists
  const [requests, setRequests] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [allCatalogItems, setAllCatalogItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [dbVatRate, setDbVatRate] = useState<number>(11);

  // Request Filters
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterDept, setFilterDept] = useState('All');

  // Catalog Filters
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogDept, setCatalogDept] = useState('All');

  // Modal / Editor states
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [requestItems, setRequestItems] = useState<any[]>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogItemForm, setCatalogItemForm] = useState({
    id: '',
    name: '',
    department: 'Kitchen',
    unit: 'Pcs'
  });

  // KPI counts
  const [kpis, setKpis] = useState({
    pendingSubmitted: 0,
    pendingOrdered: 0,
    completed: 0
  });

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    if (activeTab === 'requests') {
      loadRequests();
    } else {
      loadCatalog();
    }
  }, [activeTab, filterStatus, filterBranch, filterDept, catalogSearch, catalogDept]);

  const loadFilterOptions = async () => {
    try {
      const [branchRes, deptRes, suppliersRes, catalogRes, vatRes] = await Promise.all([
        api.getBranchesList(),
        api.getDepartmentsList(),
        api.getSuppliers(),
        api.getAllCatalogItems(),
        api.getVatRate(user?.restaurant_id)
      ]);
      if (branchRes.success && branchRes.data) {
        setBranches(branchRes.data.map((b: any) => typeof b === 'string' ? b : b.name));
      }
      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data.map((d: any) => typeof d === 'string' ? d : d.name));
      }
      if (suppliersRes.success && suppliersRes.data) {
        setSuppliers(suppliersRes.data);
      }
      if (catalogRes.success && catalogRes.data) {
        setAllCatalogItems(catalogRes.data);
      }
      if (vatRes && vatRes.success && vatRes.rate !== undefined) {
        setDbVatRate(vatRes.rate);
      }
    } catch (e) {
      console.error('Error loading filter options:', e);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await api.getPurchasingRequests(
        filterStatus === 'All' ? undefined : filterStatus,
        filterDept
      );
      if (res.success && res.data) {
        let list = res.data;
        // Filter by branch locally if selected
        if (filterBranch !== 'All') {
          list = list.filter((r: any) => r.branch === filterBranch);
        }
        setRequests(list);
        
        // Calculate Metrics
        const pendingSubmitted = res.data.filter((r: any) => r.status === 'Submitted').length;
        const pendingOrdered = res.data.filter((r: any) => r.status === 'Ordered' || r.status === 'Partially Received').length;
        const completed = res.data.filter((r: any) => r.status === 'Received').length;
        setKpis({ pendingSubmitted, pendingOrdered, completed });
      } else {
        setRequests([]);
      }
    } catch (e) {
      console.error('Error loading requests:', e);
    }
    setLoading(false);
  };

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const res = await api.getPurchasingItems(catalogSearch || undefined, catalogDept);
      if (res.success && res.data) {
        setCatalogItems(res.data);
      } else {
        setCatalogItems([]);
      }
    } catch (e) {
      console.error('Error loading catalog:', e);
    }
    setLoading(false);
  };

  const resolveItemDeliveryInfo = (itemName: string) => {
    const item = allCatalogItems.find(i => i.name === itemName);
    if (!item || !item.supplier_id) return '—';
    const supplier = suppliers.find(s => s.id === item.supplier_id);
    if (!supplier) return '—';
    return `${supplier.delivery_days || 'No Days'} (${supplier.time_to_deliver || 'No Time'})`;
  };

  const resolveItemPrice = (itemName: string): number => {
    const item = allCatalogItems.find(i => i.name === itemName);
    return item?.price_usd || 0;
  };

  const getItemPrice = (item: any): number => {
    if (item.price !== undefined && item.price !== null && item.price !== '') return Number(item.price) || 0;
    return resolveItemPrice(item.item_name);
  };

  const getItemVat = (item: any): number => {
    if (item.vat !== undefined && item.vat !== null && item.vat !== '') return Number(item.vat) || 0;
    return 0;
  };

  const getItemsGroupedBySupplier = () => {
    const groups: { [supplierId: string]: { supplier: any; items: any[] } } = {};
    
    requestItems.forEach(item => {
      const catalogItem = allCatalogItems.find(i => i.name === item.item_name);
      const supplierId = catalogItem?.supplier_id;
      const supplier = suppliers.find(s => s.id === supplierId);
      
      const groupKey = supplierId || 'unassigned';
      if (!groups[groupKey]) {
        groups[groupKey] = {
          supplier: supplier || { name: 'Unassigned / Other', phone: '' },
          items: []
        };
      }
      groups[groupKey].items.push(item);
    });
    
    return Object.values(groups);
  };

  const handleSendWhatsApp = (group: any) => {
    const { supplier, items } = group;
    if (!supplier.phone) {
      alert('This supplier does not have a phone number configured.');
      return;
    }
    
    let text = `Hello ${supplier.name},\n\nHere is our purchasing request:\n\n`;
    items.forEach((item: any) => {
      const qty = selectedRequest?.status === 'Submitted' ? item.qty_requested : item.qty_ordered;
      text += `• ${item.item_name}: ${qty} ${item.unit}\n`;
    });
    text += `\nPlease confirm delivery.\nThank you!`;
    
    const cleanedPhone = supplier.phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleOpenRequest = async (req: any) => {
    setSelectedRequest(req);
    setRequestItems([]);
    setShowRequestModal(true);
    try {
      const res = await api.getPurchasingRequestItems(req.id);
      if (res.success && res.data) {
        const items = res.data.map((item: any) => {
          const qty_ordered = item.qty_ordered !== null && item.qty_ordered !== undefined ? Number(item.qty_ordered) : (req.status === 'Submitted' ? 0 : Number(item.qty_requested || 0));
          const qty_received = item.qty_received !== null && item.qty_received !== undefined ? Number(item.qty_received) : qty_ordered;

          const catalogItem = allCatalogItems.find((c: any) => c.name === item.item_name);
          const defaultPrice = resolveItemPrice(item.item_name);
          const priceVal = item.price !== null && item.price !== undefined ? Number(item.price) : defaultPrice;
          const price = String(priceVal);

          const hasVatInCatalog = catalogItem?.vat === 'yes';
          const defaultVat = hasVatInCatalog ? dbVatRate : 0;
          
          const isUnpriced = item.price === null || item.price === undefined || Number(item.price) === 0;
          const vatValResult = isUnpriced ? defaultVat : (item.vat !== null && item.vat !== undefined ? Number(item.vat) : defaultVat);
          const vat = String(vatValResult);

          return {
            ...item,
            qty_ordered,
            qty_received,
            price,
            vat
          };
        });
        setRequestItems(items);
      }
    } catch (e) {
      console.error('Error loading request items:', e);
    }
  };

  const handleOrderItems = async () => {
    if (!selectedRequest) return;
    setSubmittingAction(true);
    try {
      const headerUpdate = {
        ...selectedRequest,
        status: 'Ordered',
        ordered_by: user.name,
        date_ordered: new Date().toISOString()
      };
      
      const res = await api.savePurchasingRequest(headerUpdate, requestItems);
      if (res.success) {
        alert('Purchasing order successfully marked as Ordered.');
        setShowRequestModal(false);
        loadRequests();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error updating order: ' + e.message);
    }
    setSubmittingAction(false);
  };

  const handleReceiveItems = async () => {
    if (!selectedRequest) return;
    setSubmittingAction(true);
    try {
      // Check if there are missing/partially received quantities
      const missingItems = requestItems
        .filter(item => Number(item.qty_received) < Number(item.qty_ordered))
        .map(item => ({
          ...item,
          qty_missing: Number(item.qty_ordered) - Number(item.qty_received)
        }));

      let res;
      if (missingItems.length > 0) {
        // Automatically process split and backorder without prompt, matching mobile logic
        res = await api.processPurchasingBackorder(
          selectedRequest,
          requestItems,
          missingItems,
          user.name
        );
      } else {
        // Mark as received standard (fully received)
        const headerUpdate = {
          ...selectedRequest,
          status: 'Received',
          received_by: user.name,
          date_received: new Date().toISOString()
        };
        res = await api.savePurchasingRequest(headerUpdate, requestItems);
      }

      if (res.success) {
        alert(missingItems.length > 0 ? 'Order received and backorder created successfully.' : 'Purchasing order marked as Received.');
        setShowRequestModal(false);
        loadRequests();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error updating order: ' + e.message);
    }
    setSubmittingAction(false);
  };

  const handleDeleteRequest = async (purchasingId: string, requestObj: any) => {
    if (!window.confirm(`Are you sure you want to cancel the purchasing request: ${purchasingId}? This action is irreversible.`)) return;
    try {
      const res = await api.deletePurchasingRequest(purchasingId, user.name, requestObj);
      if (res.success) {
        alert('Purchasing request cancelled.');
        setShowRequestModal(false);
        loadRequests();
      } else {
        alert('Error cancelling request: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogItemForm.name.trim()) {
      alert('Please enter item name.');
      return;
    }
    try {
      const res = await api.savePurchasingItem(catalogItemForm);
      if (res.success) {
        setShowCatalogModal(false);
        loadCatalog();
        setCatalogItemForm({ id: '', name: '', department: 'Kitchen', unit: 'Pcs' });
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleEditCatalogItem = (item: any) => {
    setCatalogItemForm({
      id: item.id,
      name: item.name,
      department: item.department,
      unit: item.unit
    });
    setShowCatalogModal(true);
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (!window.confirm('Remove this item from the purchasing catalog?')) return;
    try {
      const res = await api.deletePurchasingItem(id);
      if (res.success) {
        loadCatalog();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Submitted':
        return 'kpi-status-neutral';
      case 'Ordered':
        return 'kpi-status-warning';
      case 'Partially Received':
        return 'kpi-status-warning';
      case 'Received':
        return 'kpi-status-success';
      case 'Deleted':
        return 'kpi-status-danger';
      default:
        return '';
    }
  };

  return (
    <div className="dashboard-container">
      {/* Title Header */}
      <div className="dashboard-title-row">
        <div>
          <h1>Purchasing & Procurement</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Manage supplier purchasing requests, process orders, receive deliveries, and edit items catalog.
          </p>
        </div>
        
        {/* Toggle Tabs */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          <button 
            className="auth-btn" 
            style={{ 
              width: 'auto', 
              borderRadius: 0,
              backgroundColor: activeTab === 'requests' ? 'var(--primary)' : '#ffffff',
              color: activeTab === 'requests' ? '#ffffff' : 'var(--text-main)',
              border: 'none',
              padding: '10px 18px',
              fontWeight: 600,
              fontSize: '14px'
            }}
            onClick={() => setActiveTab('requests')}
          >
            Requests Queue
          </button>
          <button 
            className="auth-btn" 
            style={{ 
              width: 'auto', 
              borderRadius: 0,
              backgroundColor: activeTab === 'catalog' ? 'var(--primary)' : '#ffffff',
              color: activeTab === 'catalog' ? '#ffffff' : 'var(--text-main)',
              border: 'none',
              padding: '10px 18px',
              fontWeight: 600,
              fontSize: '14px'
            }}
            onClick={() => setActiveTab('catalog')}
          >
            Purchasing Catalog
          </button>
        </div>
      </div>

      {activeTab === 'requests' && (
        <>
          {/* Summary KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Place the Orders</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: '#e2e8f0', color: '#64748b' }}>
                  <ClipboardList size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{kpis.pendingSubmitted}</span>
                <span className="kpi-card-label">Requests waiting to be ordered</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Receive the Orders</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <Truck size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{kpis.pendingOrdered}</span>
                <span className="kpi-card-label">Orders placed with suppliers</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Completed Orders</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{kpis.completed}</span>
                <span className="kpi-card-label">Received & closed requests</span>
              </div>
            </div>
          </div>

          {/* Request Filters */}
          <div className="filters-card" style={{ marginTop: '16px' }}>
            <div className="filters-row">
              <div className="filter-group">
                <label>Status</label>
                <select 
                  className="filter-select"
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Submitted">Place the Orders</option>
                  <option value="Ordered">Receive the Orders</option>
                  <option value="Partially Received">Partially Received</option>
                  <option value="Received">Received</option>
                  <option value="Deleted">Cancelled (Deleted)</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Branch</label>
                <select 
                  className="filter-select"
                  value={filterBranch} 
                  onChange={(e) => setFilterBranch(e.target.value)}
                >
                  <option value="All">All Branches</option>
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Department</label>
                <select 
                  className="filter-select"
                  value={filterDept} 
                  onChange={(e) => setFilterDept(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <button 
                  onClick={() => {
                    setFilterStatus('All');
                    setFilterBranch('All');
                    setFilterDept('All');
                  }}
                  className="auth-btn"
                  style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Requests Queue Table */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            {loading ? (
              <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading purchasing requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
                <AlertCircle size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>No Requests Found</span>
                <span className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try loosening your filter parameters.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={tableHeaderStyle}>Request ID</th>
                      <th style={tableHeaderStyle}>Branch</th>
                      <th style={tableHeaderStyle}>Department</th>
                      <th style={tableHeaderStyle}>Created By</th>
                      <th style={tableHeaderStyle}>Created Date</th>
                      <th style={tableHeaderStyle}>Status</th>
                      <th style={tableHeaderStyle}>Comments</th>
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                        <td style={{ ...tableCellStyle, fontWeight: 700, color: 'var(--primary)' }}>{req.purchasing_id}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>{req.branch}</td>
                        <td style={tableCellStyle}>{req.department}</td>
                        <td style={tableCellStyle}>{req.user_name || '—'}</td>
                        <td style={tableCellStyle}>{new Date(req.created_at).toLocaleString().split(',')[0]}</td>
                        <td style={tableCellStyle}>
                          <span className={`kpi-card ${getStatusBadgeClass(req.status)}`} style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-block',
                            margin: 0,
                            boxShadow: 'none',
                            border: 'none',
                            cursor: 'default'
                          }}>
                            {req.status}
                          </span>
                        </td>
                        <td style={{ ...tableCellStyle, maxWidth: '200px', whiteSpace: 'normal', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {req.comments || '—'}
                        </td>
                        <td style={tableCellStyle}>
                          <button 
                            onClick={() => handleOpenRequest(req)} 
                            className="auth-btn" 
                            style={{ 
                              width: 'auto', 
                              padding: '6px 12px', 
                              fontSize: '12px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              backgroundColor: 'var(--primary)'
                            }}
                          >
                            <Eye size={14} /> View / Process
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'catalog' && (
        <>
          {/* Catalog Filter card */}
          <div className="filters-card">
            <div className="filters-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px', flex: 1, maxWidth: '600px' }}>
                <div className="filter-group" style={{ flex: 1 }}>
                  <label>Search Item</label>
                  <input 
                    type="text" 
                    className="filter-input"
                    placeholder="Search by name..."
                    value={catalogSearch} 
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                </div>

                <div className="filter-group" style={{ width: '180px' }}>
                  <label>Department</label>
                  <select 
                    className="filter-select"
                    value={catalogDept} 
                    onChange={(e) => setCatalogDept(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '2px' }}>
                <button 
                  onClick={() => {
                    setCatalogItemForm({ id: '', name: '', department: 'Kitchen', unit: 'Pcs' });
                    setShowCatalogModal(true);
                  }}
                  className="auth-btn"
                  style={{ width: 'auto', height: '40px', padding: '0 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={16} /> Add Catalog Item
                </button>
              </div>
            </div>
          </div>

          {/* Catalog Grid List */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            {loading ? (
              <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading catalog items...</p>
              </div>
            ) : catalogItems.length === 0 ? (
              <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
                <ShoppingBag size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>Catalog is Empty</span>
                <span className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Add items using the button above to populate the purchasing list.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={tableHeaderStyle}>Item Name</th>
                      <th style={tableHeaderStyle}>Department</th>
                      <th style={tableHeaderStyle}>Sub Department</th>
                      <th style={tableHeaderStyle}>Standard Unit</th>
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogItems.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>{item.name}</td>
                        <td style={tableCellStyle}>{item.department}</td>
                        <td style={tableCellStyle}>{item.sub_department || '—'}</td>
                        <td style={tableCellStyle}>
                          <span style={{
                            padding: '2px 8px',
                            backgroundColor: '#f1f5f9',
                            borderRadius: '4px',
                            fontWeight: 600,
                            color: '#475569',
                            fontSize: '12px'
                          }}>
                            {item.unit}
                          </span>
                        </td>
                        <td style={tableCellStyle}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => handleEditCatalogItem(item)} 
                              className="auth-btn"
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none' }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteCatalogItem(item.id)} 
                              className="auth-btn"
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* REQUEST DETAIL MODAL */}
      {showRequestModal && selectedRequest && (
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
            maxWidth: '750px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Purchasing Request: <span style={{ color: 'var(--primary)' }}>{selectedRequest.purchasing_id}</span>
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Branch: <strong>{selectedRequest.branch}</strong> | Department: <strong>{selectedRequest.department}</strong> | Created by: <strong>{selectedRequest.user_name}</strong>
                </p>
              </div>
              <button 
                onClick={() => setShowRequestModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Meta details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</span>
                    <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>{selectedRequest.status}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Requested Date</span>
                    <strong style={{ fontSize: '14px' }}>{new Date(selectedRequest.created_at).toLocaleString()}</strong>
                  </div>
                  {selectedRequest.ordered_by && (
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Ordered By</span>
                      <strong style={{ fontSize: '14px' }}>{selectedRequest.ordered_by} ({new Date(selectedRequest.date_ordered).toLocaleString().split(',')[0]})</strong>
                    </div>
                  )}
                  {selectedRequest.received_by && (
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Received By</span>
                      <strong style={{ fontSize: '14px' }}>{selectedRequest.received_by} ({new Date(selectedRequest.date_received).toLocaleString().split(',')[0]})</strong>
                    </div>
                  )}
                </div>

                {/* Items list grouped by supplier */}
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Requested Items List (Grouped by Supplier)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {getItemsGroupedBySupplier().map((group, groupIdx) => {
                      const hasPhone = !!group.supplier.phone;
                      const showWhatsApp = selectedRequest.status === 'Submitted' && hasPhone;
                      
                      const groupTotalRequested = group.items.reduce((sum, item) => sum + (item.qty_requested * getItemPrice(item)), 0);
                      const groupTotalOrdered = group.items.reduce((sum, item) => sum + (item.qty_ordered * getItemPrice(item)), 0);
                      const groupTotalReceived = group.items.reduce((sum, item) => sum + ((item.qty_received || 0) * getItemPrice(item) * (1 + getItemVat(item) / 100)), 0);

                      return (
                        <div key={groupIdx} style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f8fafc', padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div>
                              <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>Supplier: {group.supplier.name}</strong>
                              {group.supplier.phone && (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>({group.supplier.phone})</span>
                              )}
                            </div>
                            {showWhatsApp && (
                              <button
                                type="button"
                                onClick={() => handleSendWhatsApp(group)}
                                className="auth-btn"
                                style={{
                                  width: 'auto',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  backgroundColor: '#25D366',
                                  color: '#ffffff',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontWeight: 700
                                }}
                              >
                                <WhatsAppIcon size={14} /> Send WhatsApp
                              </button>
                            )}
                          </div>
                                         <div style={{ backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                                  <th style={{ padding: '8px 12px', fontSize: '12px' }}>Item Name</th>
                                  <th style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'center', width: '60px' }}>Unit</th>
                                  <th style={{ padding: '8px 12px', fontSize: '12px' }}>Delivery Days & Lead Time</th>
                                  <th style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'right', width: '80px' }}>Requested</th>
                                  {selectedRequest.status !== 'Submitted' && (
                                    <th style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'right', width: '80px' }}>Ordered</th>
                                  )}
                                  {selectedRequest.status !== 'Submitted' && selectedRequest.status !== 'Ordered' && (
                                    <th style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'right', width: '80px' }}>Received</th>
                                  )}
                                  <th style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'right', width: '70px' }}>Price</th>
                                  <th style={{ padding: '8px 12px', fontSize: '12px', textAlign: 'right', width: '80px' }}>Total</th>
                                  {selectedRequest.status === 'Submitted' && (
                                    <th style={{ padding: '8px 12px', fontSize: '12px', width: '90px', textAlign: 'right' }}>Qty to Order</th>
                                  )}
                                  {(selectedRequest.status === 'Ordered' || selectedRequest.status === 'Partially Received') && (
                                    <>
                                      <th style={{ padding: '8px 12px', fontSize: '12px', width: '90px', textAlign: 'right' }}>Qty Received</th>
                                      <th style={{ padding: '8px 12px', fontSize: '12px', width: '95px', textAlign: 'right' }}>Price Input</th>
                                      <th style={{ padding: '8px 12px', fontSize: '12px', width: '70px', textAlign: 'right' }}>VAT %</th>
                                    </>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map((item) => {
                                  const origIdx = requestItems.findIndex(orig => orig.id === item.id);
                                  const price = getItemPrice(item);
                                  const vat = getItemVat(item);
                                  const rowQty = selectedRequest.status === 'Submitted' ? item.qty_ordered : item.qty_ordered;
                                  const rowTotal = rowQty * price;
                                  const recvTotal = (item.qty_received || 0) * price * (1 + vat / 100);

                                  return (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{item.item_name}</td>
                                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                        <span style={{ fontSize: '11px', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px' }}>{item.unit}</span>
                                      </td>
                                      <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {resolveItemDeliveryInfo(item.item_name)}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{item.qty_requested}</td>
                                      
                                      {selectedRequest.status !== 'Submitted' && (
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{item.qty_ordered}</td>
                                      )}
                                      
                                      {selectedRequest.status !== 'Submitted' && selectedRequest.status !== 'Ordered' && (
                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                          {item.qty_received}
                                        </td>
                                      )}

                                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                        ${price.toFixed(2)}
                                        {vat > 0 ? ` (+${vat}% VAT)` : ''}
                                      </td>
                                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>
                                        {selectedRequest.status === 'Received' ? `$${recvTotal.toFixed(2)}` : `$${rowTotal.toFixed(2)}`}
                                      </td>

                                      {selectedRequest.status === 'Submitted' && (
                                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                                          <input 
                                            type="number"
                                            style={{ width: '70px', height: '28px', textAlign: 'right', padding: '2px 6px' }}
                                            value={item.qty_ordered}
                                            min="0"
                                            onChange={(e) => {
                                              const val = Number(e.target.value) || 0;
                                              const updated = [...requestItems];
                                              updated[origIdx].qty_ordered = val;
                                              setRequestItems(updated);
                                            }}
                                          />
                                        </td>
                                      )}

                                      {(selectedRequest.status === 'Ordered' || selectedRequest.status === 'Partially Received') && (
                                        <>
                                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                                            <input 
                                              type="number"
                                              style={{ width: '70px', height: '28px', textAlign: 'right', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: '4px' }}
                                              value={item.qty_received}
                                              min="0"
                                              onChange={(e) => {
                                                const val = Number(e.target.value) || 0;
                                                const updated = [...requestItems];
                                                updated[origIdx].qty_received = val;
                                                setRequestItems(updated);
                                              }}
                                            />
                                          </td>
                                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                                            <input 
                                              type="text"
                                              style={{ width: '75px', height: '28px', textAlign: 'right', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: '4px' }}
                                              value={item.price !== undefined ? String(item.price) : ''}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                const updated = [...requestItems];
                                                updated[origIdx].price = val;
                                                setRequestItems(updated);
                                              }}
                                            />
                                          </td>
                                          <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                                            <input 
                                              type="text"
                                              style={{ width: '60px', height: '28px', textAlign: 'right', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: '4px' }}
                                              value={item.vat !== undefined ? String(item.vat) : ''}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                const updated = [...requestItems];
                                                updated[origIdx].vat = val;
                                                setRequestItems(updated);
                                              }}
                                            />
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  );
                                })}
                                {/* Group Summary Row */}
                                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                                  <td colSpan={3} style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                    Supplier Order Summary
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                    ${groupTotalRequested.toFixed(2)}
                                  </td>
                                  {selectedRequest.status !== 'Submitted' && (
                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--primary)' }}>
                                      ${groupTotalOrdered.toFixed(2)}
                                    </td>
                                  )}
                                  {selectedRequest.status !== 'Submitted' && selectedRequest.status !== 'Ordered' && (
                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--success)' }}>
                                      ${groupTotalReceived.toFixed(2)}
                                    </td>
                                  )}
                                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                    {selectedRequest.status === 'Submitted' ? '' : `Order Total:`}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--primary)', fontSize: '13px' }}>
                                    ${groupTotalOrdered.toFixed(2)}
                                  </td>
                                  {selectedRequest.status === 'Submitted' && <td />}
                                  {(selectedRequest.status === 'Ordered' || selectedRequest.status === 'Partially Received') && (
                                    <>
                                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--success)', fontSize: '13px' }}>
                                        Recv Total:
                                      </td>
                                      <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--success)', fontSize: '13px' }}>
                                        ${groupTotalReceived.toFixed(2)}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Comments display/field */}
                {selectedRequest.comments && (
                  <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '8px', color: '#b45309', fontSize: '13px', fontStyle: 'italic' }}>
                    <strong>Note / Comment:</strong> {selectedRequest.comments}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div style={{
              padding: '20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              {/* Cancel order button */}
              {selectedRequest.status !== 'Received' && selectedRequest.status !== 'Deleted' ? (
                <button
                  onClick={() => handleDeleteRequest(selectedRequest.purchasing_id, selectedRequest)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', fontWeight: 600 }}
                  disabled={submittingAction}
                >
                  Cancel Request
                </button>
              ) : <div />}

              {/* Action operations buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                >
                  Close
                </button>
                
                {selectedRequest.status === 'Submitted' && (
                  <button
                    onClick={handleOrderItems}
                    className="auth-btn"
                    style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}
                    disabled={submittingAction}
                  >
                    {submittingAction ? 'Processing...' : 'Mark as Ordered'}
                  </button>
                )}

                {(selectedRequest.status === 'Ordered' || selectedRequest.status === 'Partially Received') && (
                  <button
                    onClick={handleReceiveItems}
                    className="auth-btn"
                    style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'var(--success)', color: 'white', border: 'none' }}
                    disabled={submittingAction}
                  >
                    {submittingAction ? 'Processing...' : 'Receive Deliveries'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CATALOG ITEM EDIT / ADD MODAL */}
      {showCatalogModal && (
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
            maxWidth: '450px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800 }}>
                {catalogItemForm.id ? 'Edit Purchasing Item' : 'Add Purchasing Item'}
              </h2>
              <button 
                onClick={() => setShowCatalogModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Item Name</label>
                  <input 
                    type="text" 
                    className="filter-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Avocado Hass 10kg, Water 1L..."
                    value={catalogItemForm.name}
                    onChange={(e) => setCatalogItemForm({ ...catalogItemForm, name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Department</label>
                  <select 
                    className="filter-select"
                    style={{ width: '100%' }}
                    value={catalogItemForm.department}
                    onChange={(e) => setCatalogItemForm({ ...catalogItemForm, department: e.target.value })}
                  >
                    <option value="Kitchen">Kitchen</option>
                    <option value="Bar">Bar</option>
                    <option value="Retail">Retail</option>
                    <option value="Supplies">Supplies</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Standard Unit</label>
                  <input 
                    type="text" 
                    className="filter-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Kg, Box, Pcs, Bag..."
                    value={catalogItemForm.unit}
                    onChange={(e) => setCatalogItemForm({ ...catalogItemForm, unit: e.target.value })}
                  />
                </div>
              </div>

              <div style={{
                padding: '20px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                backgroundColor: '#f8fafc'
              }}>
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(false)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Close SVG helper
function X({ size = 20, color = 'currentColor' }: { size?: number, color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}

// Inline WhatsApp SVG helper
function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.504-5.714-1.465L0 24zm6.59-4.846c1.6.95 3.498 1.45 5.42 1.451 5.378 0 9.754-4.368 9.757-9.742.002-2.605-1.013-5.053-2.86-6.903C17.062 2.112 14.615.96 12.012.96c-5.385 0-9.762 4.37-9.765 9.743-.001 1.924.499 3.804 1.447 5.412L2.68 20.2l4.156-1.092c-.08-.047-.16-.096-.239-.144zM17.842 14.83c-.328-.164-1.939-.955-2.239-1.064-.3-.11-.518-.165-.736.164-.219.328-.847 1.064-1.037 1.282-.19.219-.382.246-.71.082-.328-.164-1.385-.51-2.637-1.63-1.002-.892-1.677-1.996-1.874-2.325-.196-.328-.02-.505.144-.668.148-.146.328-.382.492-.573.164-.19.219-.327.328-.546.11-.22.055-.41-.027-.573-.082-.164-.736-1.773-1.009-2.43-.266-.638-.537-.552-.736-.562-.19-.01-.409-.012-.628-.012-.218 0-.573.082-.873.41-.3.327-1.145 1.118-1.145 2.727s1.173 3.164 1.336 3.382c.164.219 2.307 3.52 5.59 4.94 2.73 1.18 3.284.95 3.9.39.617-.56 1.939-1.58 2.21-3.11.272-1.53.272-2.84.19-3.11-.081-.27-.272-.43-.6-.59z"/>
    </svg>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: 'var(--text-muted)',
  fontWeight: 700,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '2px solid var(--border)',
  backgroundColor: '#f8fafc',
};

const tableCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
  fontSize: '13.5px',
  color: 'var(--text-main)',
  fontWeight: 500,
};
