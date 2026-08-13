import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  X, 
  Search, 
  Edit,
  Clipboard,
  Grid,
  CheckCircle,
  XCircle,
  MapPin,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

export default function ItemCatalogScreen({ user, permissions }: { user: any; permissions?: any }) {
  const isPrivileged = user?.role?.toLowerCase() === 'superadmin' || user?.role?.toLowerCase() === 'admin';
  const canManage = isPrivileged || !!permissions?.can_manage_catalog;

  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [inventoryLocations, setInventoryLocations] = useState<any[]>([]);

  // Location Modal State
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any | null>(null);
  const [locationFormName, setLocationFormName] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  const [filterSubDept, setFilterSubDept] = useState('All');
  const [filterOrder, setFilterOrder] = useState('All');
  const [filterPurchasing, setFilterPurchasing] = useState('All');

  // Sort State
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Catalog Item Modal State
  const [showItemModal, setShowItemModal] = useState(false);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Parent Department Modal State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [deptFormName, setDeptFormName] = useState('');

  // Sub-Department Modal State
  const [showSubDeptModal, setShowSubDeptModal] = useState(false);
  const [editingSubDept, setEditingSubDept] = useState<any | null>(null);
  const [subDeptFormName, setSubDeptFormName] = useState('');
  const [subDeptParentName, setSubDeptParentName] = useState('');

  // Item Form Fields
  const [formName, setFormName] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formSubDept, setFormSubDept] = useState('');
  const [formUnit, setFormUnit] = useState('Pcs');
  const [formParLevel, setFormParLevel] = useState('0');
  const [formStep, setFormStep] = useState('1');
  const [formOrder, setFormOrder] = useState<'yes' | 'no'>('yes');
  const [formPurchasing, setFormPurchasing] = useState<'yes' | 'no'>('no');
  const [formDeliveryTime, setFormDeliveryTime] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formPriceUsd, setFormPriceUsd] = useState('0.00');
  const [formVat, setFormVat] = useState<'yes' | 'no'>('no');



  useEffect(() => {
    loadLookups();
    loadCatalogItems();
  }, []);

  const loadLookups = async () => {
    try {
      const [deptRes, subDeptRes, suppliersRes, locationsRes] = await Promise.all([
        api.getDepartmentsList(),
        api.getSubDepartmentsList(),
        api.getSuppliers(),
        api.getInventoryLocationsList()
      ]);
      if (deptRes.success && deptRes.data) {
        setDepartmentsList(deptRes.data);
        setDepartments(deptRes.data.map((d: any) => typeof d === 'string' ? d : d.name));
      } else {
        const fallback = [
          { id: 1, name: 'Bar' },
          { id: 2, name: 'Kitchen' },
          { id: 3, name: 'Pastry' },
          { id: 4, name: 'Storage' },
          { id: 5, name: 'Supplies' }
        ];
        setDepartmentsList(fallback);
        setDepartments(fallback.map(d => d.name));
      }

      if (subDeptRes.success && subDeptRes.data) {
        setSubDepartments(subDeptRes.data);
      } else {
        setSubDepartments([
          { department_name: 'Bar', name: 'Alcohol' },
          { department_name: 'Bar', name: 'Coffee' },
          { department_name: 'Bar', name: 'Soft Drinks' },
          { department_name: 'Bar', name: 'Consumables' },
          { department_name: 'Kitchen', name: 'Meats' },
          { department_name: 'Kitchen', name: 'Vegetables' },
          { department_name: 'Kitchen', name: 'Dry Goods' },
          { department_name: 'Kitchen', name: 'Dairy' },
          { department_name: 'Pastry', name: 'Desserts' },
          { department_name: 'Pastry', name: 'Chocolates' },
          { department_name: 'Storage', name: 'Packaging' },
          { department_name: 'Supplies', name: 'Cleaning' }
        ]);
      }

      if (suppliersRes.success && suppliersRes.data) {
        setSuppliers(suppliersRes.data);
      } else {
        setSuppliers([]);
      }

      const DEFAULT_LOCATIONS = [
        { id: 'loc-1', name: 'Main Kitchen' },
        { id: 'loc-2', name: 'Bar' },
        { id: 'loc-3', name: 'Cold Room / Fridge' },
        { id: 'loc-4', name: 'Bar Fridge' },
        { id: 'loc-5', name: 'Dry Storage' },
        { id: 'loc-6', name: 'Main Warehouse' }
      ];

      const dbLocs = (locationsRes && locationsRes.success && locationsRes.data) ? locationsRes.data : [];
      const locsMap = new Map();
      DEFAULT_LOCATIONS.forEach(l => locsMap.set(l.name, l));
      dbLocs.forEach((l: any) => locsMap.set(l.name, l));

      setInventoryLocations(Array.from(locsMap.values()));
    } catch (e) {
      console.error('Error loading lookups:', e);
    }
  };

  const loadCatalogItems = async () => {
    setLoading(true);
    try {
      const res = await api.getAllCatalogItems();
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error('Error loading catalog items:', e);
    }
    setLoading(false);
  };

  const getAvailableSubDepts = (deptName: string) => {
    return subDepartments
      .filter((s: any) => s.department_name === deptName)
      .map((s: any) => s.name);
  };

  const handleToggleLocation = (sugg: string) => {
    const current = formLocation
      ? formLocation.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const exists = current.includes(sugg);
    let updated;
    if (exists) {
      updated = current.filter(item => item !== sugg);
    } else {
      updated = [...current, sugg];
    }
    setFormLocation(updated.join(', '));
  };

  // --- Catalog Item Save & Delete ---
  const openCreateItemModal = () => {
    setIsEditingItem(false);
    setEditItemId(null);
    setFormName('');
    const initialDept = departments.length > 0 ? departments[0] : 'Kitchen';
    setFormDept(initialDept);
    
    const availableSubs = getAvailableSubDepts(initialDept);
    setFormSubDept(availableSubs.length > 0 ? availableSubs[0] : 'Other');
    
    setFormUnit('Pcs');
    setFormParLevel('0');
    setFormStep('1');
    setFormOrder('yes');
    setFormPurchasing('no');
    setFormDeliveryTime('');
    setFormLocation('');
    setFormSupplierId('');
    setFormPriceUsd('0.00');
    setFormVat('no');
    setShowItemModal(true);
  };

  const openEditItemModal = (item: any) => {
    setIsEditingItem(true);
    setEditItemId(item.id);
    setFormName(item.name || '');
    setFormDept(item.department || '');
    setFormSubDept(item.sub_department || '');
    setFormUnit(item.unit || 'Pcs');
    setFormParLevel(String(item.par_level || '0'));
    setFormStep(String(item.step || '1'));
    setFormOrder(item.order === 'yes' ? 'yes' : 'no');
    setFormPurchasing(item.purchasing === 'yes' ? 'yes' : 'no');
    setFormDeliveryTime(item.delivery_time || '');
    setFormLocation(item.inventory_location || '');
    setFormSupplierId(item.supplier_id || '');
    setFormPriceUsd(String(item.price_usd || '0.00'));
    setFormVat(item.vat === 'yes' ? 'yes' : 'no');
    setShowItemModal(true);
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from the catalog?`)) return;
    
    try {
      const res = await api.deleteCatalogItem(id);
      if (res.success) {
        alert('Item successfully deleted.');
        loadCatalogItems();
      } else {
        alert('Error deleting item: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Please enter an item name.');
      return;
    }
    if (!formDept) {
      alert('Please select a department.');
      return;
    }
    if (!formSubDept) {
      alert('Please select a sub-department.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: formName.trim(),
        department: formDept,
        sub_department: formSubDept,
        unit: formUnit,
        par_level: parseFloat(formParLevel) || 0,
        step: parseFloat(formStep) || 1,
        order: formOrder,
        purchasing: formPurchasing,
        delivery_time: formPurchasing === 'yes' ? formDeliveryTime.trim() : null,
        inventory_location: formLocation.trim() || null,
        supplier_id: formSupplierId || null,
        price_usd: parseFloat(formPriceUsd) || 0,
        vat: formVat,
        restaurant_id: user?.restaurant_id
      };

      if (isEditingItem && editItemId) {
        payload.id = editItemId;
      }

      const res = await api.saveCatalogItem(payload);
      if (res.success) {
        alert(isEditingItem ? 'Item updated successfully.' : 'Item created successfully.');
        setShowItemModal(false);
        loadCatalogItems();
      } else {
        alert('Error saving item: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  };

  // --- Department Actions ---
  const openCreateDeptModal = () => {
    setEditingDept(null);
    setDeptFormName('');
    setShowDeptModal(true);
  };

  const openEditDeptModal = (dept: any) => {
    setEditingDept(dept);
    setDeptFormName(dept.name);
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptFormName.trim()) {
      alert('Please enter a department name.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { 
        name: deptFormName.trim(),
        restaurant_id: user?.restaurant_id
      };
      if (editingDept?.id) {
        payload.id = editingDept.id;
      } else {
        payload.id = Math.floor(Date.now() / 1000);
      }
      const res = await api.saveDepartment(payload);
      if (res.success) {
        alert('Department saved successfully.');
        setShowDeptModal(false);
        await loadLookups();
      } else {
        alert('Error saving department: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  };

  const handleDeleteDept = async (id: number, name: string) => {
    const count = items.filter(item => item.department === name).length;
    if (count > 0) {
      alert(`Cannot delete department "${name}" because it is currently assigned to ${count} catalog items. Please reassign those items first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete department "${name}"? This will delete all sub-departments linked to it.`)) return;
    
    try {
      const res = await api.deleteDepartment(id);
      if (res.success) {
        alert('Department deleted successfully.');
        await loadLookups();
      } else {
        alert('Error deleting department: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  // --- Sub-Department Actions ---
  const openCreateSubDeptModal = (parentDeptName: string) => {
    setEditingSubDept(null);
    setSubDeptFormName('');
    setSubDeptParentName(parentDeptName);
    setShowSubDeptModal(true);
  };

  const openEditSubDeptModal = (subDept: any, parentDeptName: string) => {
    setEditingSubDept(subDept);
    setSubDeptFormName(subDept.name);
    setSubDeptParentName(parentDeptName);
    setShowSubDeptModal(true);
  };

  const handleSaveSubDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subDeptFormName.trim()) {
      alert('Please enter a sub-department name.');
      return;
    }
    if (!subDeptParentName) {
      alert('Parent department is missing.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { 
        department_name: subDeptParentName,
        name: subDeptFormName.trim(),
        restaurant_id: user?.restaurant_id
      };
      if (editingSubDept?.id) {
        payload.id = editingSubDept.id;
      } else {
        payload.id = Math.floor(Date.now() / 1000);
      }
      const res = await api.saveSubDepartment(payload);
      if (res.success) {
        alert('Sub-department saved successfully.');
        setShowSubDeptModal(false);
        await loadLookups();
      } else {
        alert('Error saving sub-department: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  };

  const handleDeleteSubDept = async (id: number, name: string) => {
    const count = items.filter(item => item.sub_department === name).length;
    if (count > 0) {
      alert(`Cannot delete sub-department "${name}" because it is currently assigned to ${count} catalog items. Please reassign those items first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete sub-department "${name}"?`)) return;
    
    try {
      const res = await api.deleteSubDepartment(id);
      if (res.success) {
        alert('Sub-department deleted successfully.');
        await loadLookups();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  // --- Location Actions ---
  const openCreateLocationModal = () => {
    setEditingLocation(null);
    setLocationFormName('');
    setShowLocationModal(true);
  };

  const openEditLocationModal = (loc: any) => {
    setEditingLocation(loc);
    setLocationFormName(loc.name);
    setShowLocationModal(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationFormName.trim()) {
      alert('Please enter a location name.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { 
        name: locationFormName.trim(),
        restaurant_id: user?.restaurant_id
      };
      if (editingLocation?.id) {
        payload.id = editingLocation.id;
      }
      const res = await api.saveInventoryLocation(payload);
      if (res.success) {
        alert('Location saved successfully.');
        setShowLocationModal(false);
        await loadLookups();
      } else {
        alert('Error saving location: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmitting(false);
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    const count = items.filter(item => {
      const current = item.inventory_location ? item.inventory_location.split(',').map((s: string) => s.trim()) : [];
      return current.includes(name);
    }).length;

    if (count > 0) {
      alert(`Cannot delete location "${name}" because it is currently assigned to ${count} catalog items. Please reassign those items first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete location "${name}"?`)) return;
    
    try {
      const res = await api.deleteInventoryLocation(id);
      if (res.success) {
        alert('Location deleted successfully.');
        await loadLookups();
      } else {
        alert('Error deleting location: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter & Sort Catalog Items
  const filteredItems = items.filter(item => {
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch = !searchLower || 
      item.name?.toLowerCase().includes(searchLower) || 
      item.department?.toLowerCase().includes(searchLower) || 
      item.sub_department?.toLowerCase().includes(searchLower) || 
      item.unit?.toLowerCase().includes(searchLower) || 
      String(item.par_level ?? '').toLowerCase().includes(searchLower) || 
      String(item.step ?? '').toLowerCase().includes(searchLower) || 
      item.inventory_location?.toLowerCase().includes(searchLower) ||
      (item.order === 'yes' ? 'yes ordering' : 'no ordering').includes(searchLower) ||
      (item.purchasing === 'yes' ? 'yes procurement' : 'no procurement').includes(searchLower);
    
    const matchesDept = filterDept === 'All' || item.department === filterDept;
    
    const matchesSubDept = filterSubDept === 'All' || item.sub_department === filterSubDept;
    
    const matchesOrder = filterOrder === 'All' || item.order === filterOrder;
    
    const matchesPurchasing = filterPurchasing === 'All' || item.purchasing === filterPurchasing;

    return matchesSearch && matchesDept && matchesSubDept && matchesOrder && matchesPurchasing;
  }).sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    // Handle null or undefined values
    if (valA === null || valA === undefined) valA = typeof valB === 'number' ? 0 : '';
    if (valB === null || valB === undefined) valB = typeof valA === 'number' ? 0 : '';

    if (typeof valA === 'string' && typeof valB === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate Metrics
  const totalCatalog = items.length;
  const orderingCount = items.filter(i => i.order === 'yes').length;
  const purchasingCount = items.filter(i => i.purchasing === 'yes').length;
  const bothCount = items.filter(i => i.order === 'yes' && i.purchasing === 'yes').length;

  // Style helpers
  const tableHeaderStyle: React.CSSProperties = {
    padding: '12px 16px',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: '1px solid var(--border)'
  };

  const renderHeader = (label: string, field: string) => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        style={{ ...tableHeaderStyle, cursor: 'pointer', userSelect: 'none', transition: 'color 0.15s' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-main)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = isSorted ? 'var(--text-main)' : 'var(--text-muted)'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{label}</span>
          {isSorted ? (
            <span style={{ fontSize: '10px', color: 'var(--primary)' }}>{sortDirection === 'asc' ? '▲' : '▼'}</span>
          ) : (
            <span style={{ fontSize: '10px', color: '#cbd5e1', opacity: 0 }}>▲</span>
          )}
        </div>
      </th>
    );
  };

  const tableCellStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: '14px',
    color: 'var(--text-main)'
  };

  return (
    <div className="dashboard-container">
      {/* Title Row */}
      <div className="dashboard-title-row">
        <div>
          <h1>Item Catalog Manager</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Unified catalog registry database of all operational goods, departments, sub-departments, and inventory locations.
          </p>
        </div>

        {/* Tab & Button Bar */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <button 
              className="auth-btn" 
              style={{ 
                width: 'auto', 
                borderRadius: 0,
                backgroundColor: activeTab === 'items' ? 'var(--primary)' : '#ffffff',
                color: activeTab === 'items' ? '#ffffff' : 'var(--text-main)',
                border: 'none',
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: '14px'
              }}
              onClick={() => setActiveTab('items')}
            >
              Items Catalog
            </button>
            <button 
              className="auth-btn" 
              style={{ 
                width: 'auto', 
                borderRadius: 0,
                backgroundColor: activeTab === 'categories' ? 'var(--primary)' : '#ffffff',
                color: activeTab === 'categories' ? '#ffffff' : 'var(--text-main)',
                border: 'none',
                padding: '10px 18px',
                fontWeight: 600,
                fontSize: '14px'
              }}
              onClick={() => setActiveTab('categories')}
            >
              Departments & Locations
            </button>
          </div>

          {canManage && (
            activeTab === 'items' ? (
              <button 
                onClick={openCreateItemModal}
                className="auth-btn"
                style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={18} /> New Catalog Item
              </button>
            ) : (
              <button 
                onClick={openCreateDeptModal}
                className="auth-btn"
                style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={18} /> Add Department
              </button>
            )
          )}
        </div>
      </div>

      {activeTab === 'items' && (
        <>
          {/* Metrics Cards */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Total Registry Items</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: '#e2e8f0', color: 'var(--text-muted)' }}>
                  <Grid size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{totalCatalog}</span>
                <span className="kpi-card-label">Defined catalog inventory items</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Ordering Enabled</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <CheckCircle size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{orderingCount}</span>
                <span className="kpi-card-label">Items visible to branch orders</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Purchasing Enabled</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <Clipboard size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{purchasingCount}</span>
                <span className="kpi-card-label">Items visible to procurement</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-danger" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">In Both Flows</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                  <HelpCircle size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{bothCount}</span>
                <span className="kpi-card-label">Items in both modules</span>
              </div>
            </div>
          </div>

          {/* Filter Row */}
          <div className="filters-card">
            <div className="filters-row">
              <div className="filter-group" style={{ minWidth: '220px' }}>
                <label>Search Registry</label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="filter-input"
                    style={{ paddingLeft: '40px' }}
                    placeholder="Search name, location..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="filter-group">
                <label>Department</label>
                <select 
                  className="filter-select"
                  value={filterDept} 
                  onChange={(e) => {
                    setFilterDept(e.target.value);
                    setFilterSubDept('All');
                  }}
                >
                  <option value="All">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Sub-Department</label>
                <select 
                  className="filter-select"
                  value={filterSubDept} 
                  onChange={(e) => setFilterSubDept(e.target.value)}
                >
                  <option value="All">All Sub-Departments</option>
                  {filterDept !== 'All' && getAvailableSubDepts(filterDept).map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group" style={{ minWidth: '130px' }}>
                <label>Branch Ordering</label>
                <select 
                  className="filter-select"
                  value={filterOrder} 
                  onChange={(e) => setFilterOrder(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div className="filter-group" style={{ minWidth: '130px' }}>
                <label>Procurement</label>
                <select 
                  className="filter-select"
                  value={filterPurchasing} 
                  onChange={(e) => setFilterPurchasing(e.target.value)}
                >
                  <option value="All">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setFilterDept('All');
                    setFilterSubDept('All');
                    setFilterOrder('All');
                    setFilterPurchasing('All');
                  }}
                  className="auth-btn"
                  style={{ width: 'auto', height: '42px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {/* Items Registry Table */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden'
          }}>
            {loading ? (
              <div className="loading-container">
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p>Loading items registry...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <XCircle size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title">No Catalog Items Found</span>
                <span className="empty-state-desc">Try modifying your query or filters.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      {renderHeader('Item Name', 'name')}
                      {renderHeader('Department', 'department')}
                      {renderHeader('Sub-Department', 'sub_department')}
                      {renderHeader('Unit', 'unit')}
                      {renderHeader('Par Level', 'par_level')}
                      {renderHeader('Step Size', 'step')}
                      {renderHeader('Ordering', 'order')}
                      {renderHeader('Procurement', 'purchasing')}
                      {renderHeader('VAT', 'vat')}
                      {renderHeader('Supplier', 'supplier_id')}
                      {renderHeader('Price', 'price_usd')}
                      {renderHeader('Location', 'inventory_location')}
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr 
                        key={item.id} 
                        onClick={() => openEditItemModal(item)}
                        style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s', cursor: 'pointer' }}
                      >
                        <td style={{ ...tableCellStyle, fontWeight: 700 }}>{item.name}</td>
                        <td style={tableCellStyle}>{item.department || '—'}</td>
                        <td style={tableCellStyle}>{item.sub_department || '—'}</td>
                        <td style={tableCellStyle}><span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '12px' }}>{item.unit || '—'}</span></td>
                        <td style={tableCellStyle}>{item.par_level ?? 0}</td>
                        <td style={tableCellStyle}>{item.step ?? 1}</td>
                        <td style={tableCellStyle}>
                          {item.order === 'yes' ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>Yes</span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>No</span>
                          )}
                        </td>
                        <td style={tableCellStyle}>
                          {item.purchasing === 'yes' ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>
                              Yes{item.delivery_time ? ` (${item.delivery_time})` : ''}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(156, 163, 175, 0.1)', color: 'var(--text-muted)' }}>No</span>
                          )}
                        </td>
                        <td style={tableCellStyle}>
                          {item.vat === 'yes' ? (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>Yes</span>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '12px', backgroundColor: 'rgba(156, 163, 175, 0.1)', color: 'var(--text-muted)' }}>No</span>
                          )}
                        </td>
                        <td style={tableCellStyle}>
                          {suppliers.find(s => s.id === item.supplier_id)?.name || '—'}
                        </td>
                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                          ${Number(item.price_usd || 0).toFixed(2)}
                        </td>
                        <td style={{ ...tableCellStyle, fontSize: '13px', color: 'var(--primary)', fontWeight: 500 }}>
                          {item.inventory_location ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={12} /> {item.inventory_location}
                            </div>
                          ) : '—'}
                        </td>
                        <td style={tableCellStyle}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditItemModal(item);
                              }}
                              className="auth-btn"
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none' }}
                            >
                              {canManage ? (
                                <>
                                  <Edit size={12} /> Edit
                                </>
                              ) : (
                                <>
                                  <FolderOpen size={12} /> View
                                </>
                              )}
                            </button>
                            {canManage && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item.id, item.name);
                                }}
                                className="auth-btn"
                                style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
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

      {activeTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {departmentsList.map((dept) => {
            const subs = subDepartments.filter(s => s.department_name === dept.name);
            return (
              <div key={dept.id} style={{ 
                backgroundColor: 'var(--surface)', 
                borderRadius: '12px', 
                border: '1px solid var(--border)', 
                boxShadow: 'var(--shadow)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '220px'
              }}>
                <div>
                  {/* Department Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderOpen size={20} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{dept.name}</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => openEditDeptModal(dept)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', padding: '4px' }}
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteDept(dept.id, dept.name)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Sub-departments List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {subs.map((sub) => (
                      <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{sub.name}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditSubDeptModal(sub, dept.name)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', padding: '2px' }}
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteSubDept(sub.id, sub.name)}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {subs.length === 0 && (
                      <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)', padding: '8px 0' }}>
                        No sub-departments defined yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Sub-department button */}
                <button
                  type="button"
                  onClick={() => openCreateSubDeptModal(dept.name)}
                  className="auth-btn"
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    fontSize: '12px', 
                    marginTop: '16px', 
                    border: '1px dashed var(--primary)', 
                    color: 'var(--primary)', 
                    backgroundColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={12} /> Add Sub-department
                </button>
              </div>
            );
          })}

          {/* Inventory Locations Card */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '220px'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={20} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Inventory Locations</h3>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                {inventoryLocations.map((loc) => (
                  <div key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{loc.name}</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => openEditLocationModal(loc)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--primary)', padding: '2px' }}
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc.id, loc.name)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                {inventoryLocations.length === 0 && (
                  <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)', padding: '8px 0' }}>
                    No inventory locations defined yet.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateLocationModal}
              className="auth-btn"
              style={{
                marginTop: '16px',
                height: '36px',
                border: '1px dashed var(--primary)',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                width: '100%'
              }}
            >
              <Plus size={14} /> Add Location
            </button>
          </div>

        </div>
      )}

      {/* CATALOG ITEM CREATE / EDIT DIALOG */}
      {showItemModal && (
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
          <form 
            onSubmit={handleSaveItem}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '550px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800 }}>{isEditingItem ? 'Edit Catalog Item' : 'New Catalog Item'}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Provide item details for branch orders, inventories, and procurement catalogs.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowItemModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Item Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Item Name *</label>
                <input 
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Almaza Beer 330ml, Tomatoes"
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Department & Sub-Department Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Department *</label>
                  <select 
                    value={formDept}
                    onChange={(e) => {
                      const newDept = e.target.value;
                      setFormDept(newDept);
                      const availableSubs = getAvailableSubDepts(newDept);
                      setFormSubDept(availableSubs.length > 0 ? availableSubs[0] : 'Other');
                    }}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Sub-Department *</label>
                  <select 
                    value={formSubDept}
                    onChange={(e) => setFormSubDept(e.target.value)}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {(() => {
                      const subs = getAvailableSubDepts(formDept);
                      if (formSubDept && !subs.includes(formSubDept)) {
                        return [formSubDept, ...subs];
                      }
                      return subs;
                    })().map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                    {getAvailableSubDepts(formDept).length === 0 && formSubDept !== 'Other' && (
                      <option value="Other">Other</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Unit, Par Level, and Step Size */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Unit</label>
                  <select 
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    {['Kg', 'g', 'Liter', 'ml', 'Pcs', 'Box', 'Pack', 'Bottle', 'Can', 'Dozen', 'Portion', 'Tray', 'Other'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Par Level</label>
                  <input 
                    type="number"
                    step="any"
                    value={formParLevel}
                    onChange={(e) => setFormParLevel(e.target.value)}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Step Size</label>
                  <input 
                    type="number"
                    step="any"
                    value={formStep}
                    onChange={(e) => setFormStep(e.target.value)}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Show in Ordering and Show in Purchasing Flags */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Branch Ordering Flow</label>
                  <select 
                    value={formOrder}
                    onChange={(e) => setFormOrder(e.target.value as 'yes' | 'no')}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="yes">Show in Ordering</option>
                    <option value="no">Hide from Ordering</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Procurement / Purchasing</label>
                  <select 
                    value={formPurchasing}
                    onChange={(e) => setFormPurchasing(e.target.value as 'yes' | 'no')}
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="yes">Show in Purchasing</option>
                    <option value="no">Hide from Purchasing</option>
                  </select>
                </div>
              </div>

              {/* VAT Flag */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>VAT Status</label>
                <select 
                  value={formVat}
                  onChange={(e) => setFormVat(e.target.value as 'yes' | 'no')}
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="no">No VAT (0%)</option>
                  <option value="yes">Subject to VAT (11% default)</option>
                </select>
              </div>

              {/* Delivery Time (Purchasing Only) */}
              {formPurchasing === 'yes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Delivery Lead Time</label>
                  <input 
                    type="text"
                    value={formDeliveryTime}
                    onChange={(e) => setFormDeliveryTime(e.target.value)}
                    placeholder="e.g. 24h, 48h, same day, weekly"
                    style={{
                      height: '42px',
                      padding: '0 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '14px'
                    }}
                  />
                </div>
              )}

              {/* Supplier Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Supplier</label>
                <select
                  value={formSupplierId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormSupplierId(val);
                    if (val) {
                      const found = suppliers.find(s => s.id === val);
                      if (found && found.time_to_deliver) {
                        setFormDeliveryTime(found.time_to_deliver);
                      }
                    }
                  }}
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="">No Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Price USD Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Price (USD)</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  value={formPriceUsd}
                  onChange={(e) => setFormPriceUsd(e.target.value)}
                  placeholder="0.00"
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Inventory Location Checkbox Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Inventory Locations (Select to add)</label>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '8px', 
                  padding: '12px', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius)', 
                  backgroundColor: '#f8fafc',
                  minHeight: '60px',
                  alignItems: 'center'
                }}>
                  {inventoryLocations.map((loc) => {
                    const currentSelected = formLocation ? formLocation.split(',').map(s => s.trim()).filter(Boolean) : [];
                    const isSelected = currentSelected.includes(loc.name);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleToggleLocation(loc.name)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--primary)' : '#ffffff',
                          color: isSelected ? '#ffffff' : 'var(--text-main)',
                          boxShadow: isSelected ? '0 2px 4px rgba(30,92,79,0.1)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{loc.name}
                      </button>
                    );
                  })}
                  {inventoryLocations.length === 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No inventory locations defined yet. Create them in the Categories tab.
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
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
                onClick={() => setShowItemModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              {canManage ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  {submitting && <RefreshCw className="spin" size={14} />}
                  {isEditingItem ? 'Save Changes' : 'Create Item'}
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                  Read-only view
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      {/* DEPARTMENT MODAL */}
      {showDeptModal && (
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
          <form 
            onSubmit={handleSaveDept}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{editingDept ? 'Edit Department' : 'New Department'}</h2>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700 }}>Department Name *</label>
                <input 
                  type="text"
                  required
                  value={deptFormName}
                  onChange={(e) => setDeptFormName(e.target.value)}
                  placeholder="e.g. Kitchen, Pastry"
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowDeptModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white' }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-DEPARTMENT MODAL */}
      {showSubDeptModal && (
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
          <form 
            onSubmit={handleSaveSubDept}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{editingSubDept ? 'Edit Sub-department' : 'New Sub-department'}</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Parent Department: <strong>{subDeptParentName}</strong></span>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700 }}>Sub-department Name *</label>
                <input 
                  type="text"
                  required
                  value={subDeptFormName}
                  onChange={(e) => setSubDeptFormName(e.target.value)}
                  placeholder="e.g. Meat, Alcohol, Cleaning"
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowSubDeptModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white' }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Location Modal */}
      {showLocationModal && (
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
          <form 
            onSubmit={handleSaveLocation}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{editingLocation ? 'Edit Location' : 'New Location'}</h2>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700 }}>Location Name *</label>
                <input 
                  type="text"
                  required
                  value={locationFormName}
                  onChange={(e) => setLocationFormName(e.target.value)}
                  placeholder="e.g. Dry Storage, Walk-in Fridge"
                  style={{
                    height: '42px',
                    padding: '0 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white' }}
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
