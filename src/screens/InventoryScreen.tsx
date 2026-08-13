import { useState, useEffect, useMemo, Fragment } from 'react';
import { 
  Package, 
  ClipboardList, 
  ArrowLeftRight, 
  PlusCircle, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  X, 
  Save, 
  Layers,
  RefreshCw,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { api } from '../api/client';
import './InventoryScreen.css';

interface InventoryScreenProps {
  user: any;
  permissions?: any;
}

export default function InventoryScreen({ user }: InventoryScreenProps) {
  const [activeTab, setActiveTab] = useState<'balances' | 'stocktake' | 'adjustments' | 'transfers'>('balances');
  
  // Data States
  const [branches, setBranches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [stockBalances, setStockBalances] = useState<any[]>([]);
  const [stockCounts, setStockCounts] = useState<any[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<any[]>([]);
  const [stockTransfers, setStockTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('All');

  // Modals & Data Entry States
  const [showStocktakeModal, setShowStocktakeModal] = useState<boolean>(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<boolean>(false);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [showLocationManagerModal, setShowLocationManagerModal] = useState<boolean>(false);
  const [viewDetailsModal, setViewDetailsModal] = useState<any>(null);
  const [newLocationName, setNewLocationName] = useState<string>('');
  const [newLocationDept, setNewLocationDept] = useState<string>('Kitchen');

  // Accordion Collapse & Group View States
  const [groupByMode, setGroupByMode] = useState<'date_location' | 'date_item'>('date_location');
  const [collapsedDates, setCollapsedDates] = useState<{ [key: string]: boolean }>({});
  const [collapsedLocations, setCollapsedLocations] = useState<{ [key: string]: boolean }>({});
  const [collapsedItems, setCollapsedItems] = useState<{ [key: string]: boolean }>({});

  const toggleDateCollapse = (dateKey: string) => {
    setCollapsedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const toggleLocationCollapse = (locKey: string) => {
    setCollapsedLocations(prev => ({ ...prev, [locKey]: !prev[locKey] }));
  };

  const toggleItemCollapse = (itemKey: string) => {
    setCollapsedItems(prev => ({ ...prev, [itemKey]: !prev[itemKey] }));
  };

  // Form: Stock Count Entry
  const [countHeader, setCountHeader] = useState({
    branch: '',
    location: '',
    department: 'All',
    counted_by: user?.name || user?.email || 'Admin',
    notes: ''
  });
  const [countItemsForm, setCountItemsForm] = useState<any[]>([]);

  // Form: Adjustment Entry
  const [adjustmentForm, setAdjustmentForm] = useState({
    branch: '',
    location: '',
    item_name: '',
    item_id: '',
    adjustment_type: 'Waste/Damage',
    quantity: '',
    unit: '',
    unit_cost: '0',
    reason: '',
    created_by: user?.name || user?.email || 'Admin'
  });

  // Form: Transfer Entry
  const [transferHeader, setTransferHeader] = useState({
    from_branch: '',
    from_location: '',
    to_branch: '',
    to_location: '',
    notes: '',
    created_by: user?.name || user?.email || 'Admin'
  });
  const [transferItemsForm, setTransferItemsForm] = useState<any[]>([
    { item_name: '', quantity: '', unit: '', unit_cost: '0' }
  ]);

  // Adjustment Modal Filter States
  const [adjSelectedDept, setAdjSelectedDept] = useState<string>('All');
  const [adjSelectedSubDept, setAdjSelectedSubDept] = useState<string>('All');
  const [adjItemSearch, setAdjItemSearch] = useState<string>('');

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    fetchStockData();
  }, [selectedBranch, selectedLocation, activeTab]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [branchesRes, locsRes, itemsRes] = await Promise.all([
        api.getBranchesList(),
        api.getInventoryLocationsList(),
        api.getAllCatalogItems()
      ]);

      if (branchesRes.data) setBranches(branchesRes.data);
      if (itemsRes.data) setCatalogItems(itemsRes.data);

      const DEFAULT_LOCATIONS = [
        { id: 'loc-1', name: 'Main Kitchen' },
        { id: 'loc-2', name: 'Bar' },
        { id: 'loc-3', name: 'Cold Room / Fridge' },
        { id: 'loc-4', name: 'Bar Fridge' },
        { id: 'loc-5', name: 'Dry Storage' },
        { id: 'loc-6', name: 'Main Warehouse' }
      ];

      const dbLocs = locsRes.data || [];
      const extractedIndividualLocs: any[] = [];
      (itemsRes.data || []).forEach((i: any) => {
        if (i.inventory_location) {
          i.inventory_location.split(',').forEach((sub: string) => {
            const trimmed = sub.trim();
            if (trimmed) {
              extractedIndividualLocs.push({ id: trimmed, name: trimmed });
            }
          });
        }
      });

      const locsMap = new Map();
      DEFAULT_LOCATIONS.forEach(l => locsMap.set(l.name, l));
      extractedIndividualLocs.forEach(l => locsMap.set(l.name, l));
      dbLocs.forEach((l: any) => locsMap.set(l.name, l));

      const mergedLocations = Array.from(locsMap.values());
      setLocations(mergedLocations);

      const defaultBranch = branchesRes.data?.[0]?.name || user?.branch || 'Main Branch';
      const defaultLoc = mergedLocations[0]?.name || 'Main Kitchen';

      setCountHeader(prev => ({ ...prev, branch: defaultBranch, location: defaultLoc }));
      setAdjustmentForm(prev => ({ ...prev, branch: defaultBranch, location: defaultLoc }));
      setTransferHeader(prev => ({ 
        ...prev, 
        from_branch: defaultBranch, 
        from_location: defaultLoc,
        to_branch: defaultBranch,
        to_location: mergedLocations[1]?.name || defaultLoc
      }));
    } catch (err) {
      console.error("Failed loading initial metadata", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) {
      alert("Please enter a location name.");
      return;
    }
    setLoading(true);
    const res = await api.saveInventoryLocation({ 
      name: newLocationName.trim(),
      department: newLocationDept || 'Kitchen'
    });
    setLoading(false);
    if (res.success) {
      alert("Storage location added successfully!");
      setNewLocationName('');
      loadInitialData();
    } else {
      alert(`Error saving location: ${res.error}`);
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete storage location "${name}"?`)) return;
    setLoading(true);
    const res = await api.deleteInventoryLocation(id);
    setLoading(false);
    if (res.success) {
      alert("Location deleted.");
      loadInitialData();
    } else {
      alert(`Error deleting location: ${res.error}`);
    }
  };

  const fetchStockData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'balances') {
        const [balRes, countRes, catRes] = await Promise.all([
          api.getStockBalances(selectedBranch, selectedLocation),
          api.getStockCounts(selectedBranch),
          api.getAllCatalogItems()
        ]);
        if (balRes.data) setStockBalances(balRes.data);
        if (countRes.data) setStockCounts(countRes.data);
        if (catRes.data) setCatalogItems(catRes.data);
      } else if (activeTab === 'stocktake') {
        const res = await api.getStockCounts(selectedBranch);
        if (res.data) setStockCounts(res.data);
      } else if (activeTab === 'adjustments') {
        const res = await api.getStockAdjustments(selectedBranch);
        if (res.data) setStockAdjustments(res.data);
      } else if (activeTab === 'transfers') {
        const res = await api.getStockTransfers(selectedBranch);
        if (res.data) setStockTransfers(res.data);
      }
    } catch (err) {
      console.error("Failed fetching inventory stock data", err);
    } finally {
      setLoading(false);
    }
  };

  // Setup Stocktake Form Sheet Items when opening Stocktake Modal
  const openNewStocktakeModal = () => {
    const matchedItems = catalogItems.map(item => {
      const itemName = item.name || item.item_name || item.title || item.item || 'Item';
      return {
        item_id: item.id || null,
        item_name: itemName,
        department: item.department || 'General',
        unit: item.unit || 'pcs',
        par_level: item.par_level || 0,
        count_qty: '0',
        unit_cost: item.price_usd || item.unit_cost || 0
      };
    });

    setCountItemsForm(matchedItems);
    setShowStocktakeModal(true);
  };

  const handleStocktakeQtyChange = (index: number, val: string) => {
    setCountItemsForm(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        count_qty: val
      };
      return updated;
    });
  };

  const handleSaveStockCount = async () => {
    if (!countHeader.branch || !countHeader.location) {
      alert("Please select branch and location for stock count.");
      return;
    }

    const headerPayload = {
      ...countHeader,
      status: 'Completed',
      date: new Date().toISOString()
    };

    const formattedItems = countItemsForm.map(item => ({
      ...item,
      count_qty: Number(item.count_qty || 0)
    }));

    setLoading(true);
    const res = await api.saveStockCount(headerPayload, formattedItems);
    setLoading(false);

    if (res.success) {
      alert("Stock count saved successfully!");
      setShowStocktakeModal(false);
      fetchStockData();
    } else {
      alert(`Error saving stock count: ${res.error}`);
    }
  };

  // Stock Adjustment Submission
  const handleSaveAdjustment = async () => {
    if (!adjustmentForm.branch || !adjustmentForm.location || !adjustmentForm.item_name || !adjustmentForm.quantity) {
      alert("Please fill in all required adjustment fields.");
      return;
    }

    const qty = Number(adjustmentForm.quantity);
    const cost = Number(adjustmentForm.unit_cost || 0);
    const payload = {
      ...adjustmentForm,
      quantity: qty,
      unit_cost: cost,
      total_value: qty * cost
    };

    setLoading(true);
    const res = await api.saveStockAdjustment(payload);
    setLoading(false);

    if (res.success) {
      alert("Stock adjustment recorded successfully!");
      setShowAdjustmentModal(false);
      setAdjustmentForm(prev => ({ ...prev, item_name: '', quantity: '', reason: '' }));
      fetchStockData();
    } else {
      alert(`Error recording adjustment: ${res.error}`);
    }
  };

  // Stock Transfer Submission
  const handleSaveTransfer = async () => {
    if (!transferHeader.from_branch || !transferHeader.to_branch || !transferHeader.from_location || !transferHeader.to_location) {
      alert("Please select source and destination branch and locations.");
      return;
    }
    const validItems = transferItemsForm.filter(i => i.item_name && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      alert("Please add at least one valid item with quantity > 0.");
      return;
    }

    setLoading(true);
    const res = await api.saveStockTransfer(transferHeader, validItems);
    setLoading(false);

    if (res.success) {
      alert("Stock transfer completed successfully!");
      setShowTransferModal(false);
      fetchStockData();
    } else {
      alert(`Error recording transfer: ${res.error}`);
    }
  };

  // Unified Stock Ledger constructed from catalog items + latest physical counts + stock balances
  const displayBalances = useMemo(() => {
    const latestCountMap: { [itemName: string]: any } = {};
    stockCounts.forEach(sc => {
      const name = (sc.item || sc.item_name || sc.name || '').toLowerCase().trim();
      if (name && !latestCountMap[name]) {
        latestCountMap[name] = sc;
      }
    });

    const balMap: { [itemName: string]: any } = {};
    stockBalances.forEach(sb => {
      const name = (sb.item_name || sb.name || '').toLowerCase().trim();
      if (name) balMap[name] = sb;
    });

    return catalogItems.map(catItem => {
      const nameKey = (catItem.name || '').toLowerCase().trim();
      const existingBal = balMap[nameKey];
      const latestCount = latestCountMap[nameKey];

      const stockQty = existingBal?.current_stock ?? latestCount?.count_qty ?? latestCount?.quantity ?? 0;
      const unitCost = Number(catItem.price_usd || existingBal?.unit_cost || latestCount?.unit_cost || 0);
      const par = Number(catItem.par_level || existingBal?.par_level || 0);
      const lastDate = existingBal?.last_updated || latestCount?.date || latestCount?.created_at || null;

      return {
        id: catItem.id,
        item_name: catItem.name,
        department: catItem.department || 'General',
        unit: catItem.unit || 'pcs',
        par_level: par,
        current_stock: Number(stockQty),
        unit_cost: unitCost,
        valuation: Number(stockQty) * unitCost,
        last_updated: lastDate,
        branch: selectedBranch !== 'All' ? selectedBranch : (existingBal?.branch || 'Main Branch'),
        location: selectedLocation !== 'All' ? selectedLocation : (existingBal?.location || 'Main Kitchen')
      };
    });
  }, [catalogItems, stockBalances, stockCounts, selectedBranch, selectedLocation]);

  // Filtered Stock Balances List
  const filteredBalances = displayBalances.filter(item => {
    const matchesSearch = item.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.department?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDepartment === 'All' || item.department === selectedDepartment;
    
    let matchesStatus = true;
    const stock = Number(item.current_stock || 0);
    const par = Number(item.par_level || 0);
    if (stockStatusFilter === 'Out of Stock') matchesStatus = stock <= 0;
    else if (stockStatusFilter === 'Low Stock') matchesStatus = stock > 0 && stock <= par;
    else if (stockStatusFilter === 'In Stock') matchesStatus = stock > par;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Calculate Metrics
  const totalValuation = displayBalances.reduce((acc, item) => acc + (Number(item.current_stock || 0) * Number(item.unit_cost || 0)), 0);
  const totalItemsCount = displayBalances.length;
  const lowStockCount = displayBalances.filter(i => Number(i.current_stock || 0) <= Number(i.par_level || 0) && Number(i.current_stock || 0) > 0).length;
  const outOfStockCount = displayBalances.filter(i => Number(i.current_stock || 0) <= 0).length;

  // Group physical stock counts: Level 1 = Date, Level 2 = Location
  const groupedByDateAndLocation = useMemo(() => {
    const datesMap: {
      [dateKey: string]: {
        dateStr: string;
        totalVariance: number;
        totalSheets: number;
        locations: {
          [locName: string]: {
            locKey: string;
            location: string;
            branch: string;
            sheets: any[];
            variance: number;
          }
        }
      }
    } = {};

    stockCounts.forEach(sc => {
      const d = sc.date || sc.created_at;
      const rawDateObj = d ? new Date(d) : new Date();
      const dateKey = rawDateObj.toISOString().slice(0, 10); // YYYY-MM-DD
      const dateStr = rawDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
      const loc = sc.location || 'General Storage';
      const locKey = `${dateKey}__${loc}`;
      const branch = sc.branch || 'Main Branch';
      const varCost = Number(sc.total_variance_cost || 0);

      if (!datesMap[dateKey]) {
        datesMap[dateKey] = {
          dateStr,
          totalVariance: 0,
          totalSheets: 0,
          locations: {}
        };
      }

      datesMap[dateKey].totalVariance += varCost;
      datesMap[dateKey].totalSheets += 1;

      if (!datesMap[dateKey].locations[loc]) {
        datesMap[dateKey].locations[loc] = {
          locKey,
          location: loc,
          branch,
          sheets: [],
          variance: 0
        };
      }

      datesMap[dateKey].locations[loc].sheets.push(sc);
      datesMap[dateKey].locations[loc].variance += varCost;
    });

    return Object.keys(datesMap)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => {
        const dateGroup = datesMap[dateKey];
        return {
          dateKey,
          dateStr: dateGroup.dateStr,
          totalVariance: dateGroup.totalVariance,
          totalSheets: dateGroup.totalSheets,
          locations: Object.values(dateGroup.locations)
        };
      });
  }, [stockCounts]);

  // Group physical stock counts: Level 1 = Date, Level 2 = Item
  const groupedByDateAndItem = useMemo(() => {
    const datesMap: {
      [dateKey: string]: {
        dateStr: string;
        totalVariance: number;
        totalRecords: number;
        items: {
          [itemName: string]: {
            itemKey: string;
            itemName: string;
            department: string;
            records: any[];
            variance: number;
            totalQty: number;
          }
        }
      }
    } = {};

    stockCounts.forEach(sc => {
      const d = sc.date || sc.created_at;
      const rawDateObj = d ? new Date(d) : new Date();
      const dateKey = rawDateObj.toISOString().slice(0, 10);
      const dateStr = rawDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
      const itemName = sc.item || sc.item_name || sc.name || sc.count_number || 'Unnamed Item';
      const itemKey = `${dateKey}__${itemName}`;
      const varCost = Number(sc.variance_cost ?? sc.total_variance_cost ?? 0);
      const qty = Number(sc.count_qty ?? sc.quantity ?? 0);

      if (!datesMap[dateKey]) {
        datesMap[dateKey] = {
          dateStr,
          totalVariance: 0,
          totalRecords: 0,
          items: {}
        };
      }

      datesMap[dateKey].totalVariance += varCost;
      datesMap[dateKey].totalRecords += 1;

      if (!datesMap[dateKey].items[itemName]) {
        datesMap[dateKey].items[itemName] = {
          itemKey,
          itemName,
          department: sc.department || 'General',
          records: [],
          variance: 0,
          totalQty: 0
        };
      }

      datesMap[dateKey].items[itemName].records.push(sc);
      datesMap[dateKey].items[itemName].variance += varCost;
      datesMap[dateKey].items[itemName].totalQty += qty;
    });

    return Object.keys(datesMap)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => {
        const dateGroup = datesMap[dateKey];
        return {
          dateKey,
          dateStr: dateGroup.dateStr,
          totalVariance: dateGroup.totalVariance,
          totalRecords: dateGroup.totalRecords,
          items: Object.values(dateGroup.items)
        };
      });
  }, [stockCounts]);

  // Group Stock Count Entry Modal items by Department
  const groupedCountItemsForm = useMemo(() => {
    const depts: { [dept: string]: any[] } = {};
    countItemsForm.forEach((item, idx) => {
      const d = item.department || 'General';
      if (!depts[d]) depts[d] = [];
      depts[d].push({ ...item, originalIndex: idx });
    });
    return depts;
  }, [countItemsForm]);

  const departmentsList = Array.from(new Set(catalogItems.map(i => i.department).filter(Boolean)));

  const subDepartmentsList = Array.from(
    new Set(
      catalogItems
        .filter(i => adjSelectedDept === 'All' || i.department === adjSelectedDept)
        .map(i => i.sub_department)
        .filter(Boolean)
    )
  );

  const filteredAdjustmentCatalogItems = catalogItems.filter(item => {
    const matchesSearch = !adjItemSearch || item.name?.toLowerCase().includes(adjItemSearch.toLowerCase());
    const matchesDept = adjSelectedDept === 'All' || item.department === adjSelectedDept;
    const matchesSubDept = adjSelectedSubDept === 'All' || item.sub_department === adjSelectedSubDept;
    return matchesSearch && matchesDept && matchesSubDept;
  });

  return (
    <div className="inventory-container">
      {/* Header */}
      <div className="inventory-header">
        <div className="inventory-title-group">
          <h1>Inventory & Stock Management</h1>
          <p>Real-time stock ledger, physical stocktakes, manual stock adjustments, and internal transfers.</p>
        </div>
        <div className="inventory-actions">
          <button className="btn-secondary" onClick={() => setShowLocationManagerModal(true)}>
            <MapPin size={16} /> Manage Locations
          </button>
          <button className="btn-secondary" onClick={fetchStockData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button className="btn-primary" onClick={openNewStocktakeModal}>
            <ClipboardList size={16} /> New Stock Count Sheet
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inventory-tabs">
        <button 
          className={`inventory-tab-btn ${activeTab === 'balances' ? 'active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          <Package size={18} /> Live Stock Ledger & Valuation
        </button>
        <button 
          className={`inventory-tab-btn ${activeTab === 'stocktake' ? 'active' : ''}`}
          onClick={() => setActiveTab('stocktake')}
        >
          <ClipboardList size={18} /> Physical Stock Counts (Stocktakes)
        </button>
        <button 
          className={`inventory-tab-btn ${activeTab === 'adjustments' ? 'active' : ''}`}
          onClick={() => setActiveTab('adjustments')}
        >
          <PlusCircle size={18} /> Stock Adjustments (Data Entry)
        </button>
        <button 
          className={`inventory-tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
          onClick={() => setActiveTab('transfers')}
        >
          <ArrowLeftRight size={18} /> Stock Transfers
        </button>
      </div>

      {/* KPI Cards */}
      <div className="inventory-kpi-grid">
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
            <Package size={24} />
          </div>
          <div className="inventory-kpi-info">
            <h4>Total Stock Valuation</h4>
            <p>${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Layers size={24} />
          </div>
          <div className="inventory-kpi-info">
            <h4>Catalog Items Tracked</h4>
            <p>{totalItemsCount} items</p>
          </div>
        </div>
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon" style={{ background: '#fefce8', color: '#ca8a04' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="inventory-kpi-info">
            <h4>Low Stock (Below Par)</h4>
            <p>{lowStockCount} items</p>
          </div>
        </div>
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
            <TrendingDown size={24} />
          </div>
          <div className="inventory-kpi-info">
            <h4>Out of Stock (86'd)</h4>
            <p>{outOfStockCount} items</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="inventory-filter-bar">
        <div className="inventory-search-box">
          <Search size={16} color="#64748b" />
          <input 
            type="text" 
            placeholder="Search items or departments..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select 
          className="inventory-filter-select"
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
        >
          <option value="All">All Branches</option>
          {branches.map(b => (
            <option key={b.id || b.name} value={b.name}>{b.name}</option>
          ))}
        </select>

        <select 
          className="inventory-filter-select"
          value={selectedLocation}
          onChange={(e) => setSelectedLocation(e.target.value)}
        >
          <option value="All">All Storage Locations</option>
          {locations.map(loc => (
            <option key={loc.id || loc.name} value={loc.name}>{loc.name}</option>
          ))}
        </select>

        {activeTab === 'balances' && (
          <>
            <select 
              className="inventory-filter-select"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departmentsList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select 
              className="inventory-filter-select"
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value)}
            >
              <option value="All">All Stock Statuses</option>
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </>
        )}
      </div>

      {/* Tab 1: Stock Balances & Valuation */}
      {activeTab === 'balances' && (
        <div className="inventory-table-card">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Branch</th>
                <th>Location</th>
                <th>Department</th>
                <th>Unit</th>
                <th>Par Level</th>
                <th>Current Stock</th>
                <th>Unit Cost</th>
                <th>Stock Valuation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.length > 0 ? (
                filteredBalances.map((item, idx) => {
                  const stock = Number(item.current_stock || 0);
                  const par = Number(item.par_level || 0);
                  const cost = Number(item.unit_cost || 0);
                  const val = stock * cost;

                  let badgeClass = 'inv-badge-green';
                  let statusText = 'In Stock';
                  if (stock <= 0) {
                    badgeClass = 'inv-badge-red';
                    statusText = 'Out of Stock';
                  } else if (stock <= par) {
                    badgeClass = 'inv-badge-yellow';
                    statusText = 'Low Stock';
                  }

                  return (
                    <tr key={item.id || idx}>
                      <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                      <td>{item.branch || selectedBranch}</td>
                      <td>{item.location || selectedLocation}</td>
                      <td>{item.department || '-'}</td>
                      <td>{item.unit || 'pcs'}</td>
                      <td>{par}</td>
                      <td style={{ fontWeight: 700, color: stock <= par ? '#dc2626' : '#1e293b' }}>
                        {stock}
                      </td>
                      <td>${cost.toFixed(2)}</td>
                      <td style={{ fontWeight: 700 }}>${val.toFixed(2)}</td>
                      <td>
                        <span className={`inv-badge ${badgeClass}`}>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    No inventory items found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Stocktake History (Grouped by Date & Location or Date & Item) */}
      {activeTab === 'stocktake' && (
        <div>
          {/* Group View Mode Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>Group View Mode:</span>
            <button 
              className={`btn-secondary ${groupByMode === 'date_location' ? 'active-group-btn' : ''}`}
              onClick={() => setGroupByMode('date_location')}
              style={{ padding: '6px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <MapPin size={14} /> Group by Date & Location
            </button>
            <button 
              className={`btn-secondary ${groupByMode === 'date_item' ? 'active-group-btn' : ''}`}
              onClick={() => setGroupByMode('date_item')}
              style={{ padding: '6px 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Package size={14} /> Group by Date & Item
            </button>
          </div>

          {/* MODE 1: Group by Date then Location */}
          {groupByMode === 'date_location' && (
            groupedByDateAndLocation.length > 0 ? (
              groupedByDateAndLocation.map((dateGroup) => {
                const isDateCollapsed = !!collapsedDates[dateGroup.dateKey];

                return (
                  <div key={dateGroup.dateKey} className="date-group-card">
                    {/* Level 1: Date Header (Collapsible) */}
                    <div 
                      className="date-group-header"
                      onClick={() => toggleDateCollapse(dateGroup.dateKey)}
                    >
                      <div className="inv-group-title">
                        {isDateCollapsed ? <ChevronRight size={20} color="#3b82f6" /> : <ChevronDown size={20} color="#3b82f6" />}
                        <Calendar size={18} color="#3b82f6" />
                        <h3 style={{ fontSize: '17px', fontWeight: 800 }}>{dateGroup.dateStr}</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          Locations: <strong>{dateGroup.locations.length}</strong> • Records: <strong>{dateGroup.totalSheets}</strong>
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: dateGroup.totalVariance < 0 ? '#dc2626' : '#16a34a' }}>
                          Total Impact: ${dateGroup.totalVariance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Level 2: Locations under this Date */}
                    {!isDateCollapsed && (
                      <div style={{ padding: '8px 0' }}>
                        {dateGroup.locations.map((locGroup) => {
                          const isLocCollapsed = !!collapsedLocations[locGroup.locKey];

                          return (
                            <div key={locGroup.locKey} className="location-group-card">
                              {/* Location Header (Collapsible) */}
                              <div 
                                className="location-group-header"
                                onClick={() => toggleLocationCollapse(locGroup.locKey)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {isLocCollapsed ? <ChevronRight size={18} color="#16a34a" /> : <ChevronDown size={18} color="#16a34a" />}
                                  <MapPin size={16} color="#16a34a" />
                                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                                    {locGroup.location}
                                  </h4>
                                  <span className="inv-badge inv-badge-blue">{locGroup.branch}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                                    Count Records: <strong>{locGroup.sheets.length}</strong>
                                  </span>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: locGroup.variance < 0 ? '#dc2626' : '#16a34a' }}>
                                    ${locGroup.variance.toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              {/* Count Sheets Table under Location */}
                              {!isLocCollapsed && (
                                <table className="inventory-table">
                                  <thead>
                                    <tr>
                                      <th>Item / Count Sheet #</th>
                                      <th>Dept & Counted Qty</th>
                                      <th>Min Par Level</th>
                                      <th>Time</th>
                                      <th>Counted By</th>
                                      <th>Status</th>
                                      <th>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {locGroup.sheets.map((sc, sIdx) => {
                                      const itemName = sc.item || sc.item_name || sc.name;
                                      const titleDisplay = itemName || sc.count_number || `Count Entry #${sIdx + 1}`;
                                      const qtyDisplay = sc.count_qty !== undefined ? `${sc.count_qty} ${sc.unit || 'pcs'}` : '-';
                                      const statusText = sc.status || 'Draft';
                                      const countedBy = sc.counted_by || sc.user || sc.created_by || 'Staff';
                                      const timeStr = new Date(sc.date || sc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                      return (
                                        <tr key={sc.id || sIdx}>
                                          <td style={{ fontWeight: 700, color: itemName ? '#1e293b' : '#3b82f6' }}>
                                            {titleDisplay}
                                          </td>
                                          <td>
                                            {itemName ? (
                                              <span>{sc.department || 'General'} • <strong>{qtyDisplay}</strong></span>
                                            ) : (
                                              <span>Count Sheet</span>
                                            )}
                                          </td>
                                          <td style={{ fontWeight: 600, color: '#475569' }}>{sc.par_level ?? '-'} {sc.unit || ''}</td>
                                          <td>{timeStr}</td>
                                          <td>{countedBy}</td>
                                          <td>
                                            <span className={`inv-badge ${statusText.toLowerCase() === 'completed' ? 'inv-badge-green' : 'inv-badge-yellow'}`}>
                                              <CheckCircle2 size={12} /> {statusText}
                                            </span>
                                          </td>
                                          <td>
                                            <button 
                                              className="btn-secondary"
                                              style={{ padding: '4px 10px', fontSize: '12px' }}
                                              onClick={async () => {
                                                if (itemName) {
                                                  setViewDetailsModal({ 
                                                    header: { count_number: sc.count_number || titleDisplay }, 
                                                    items: [sc], 
                                                    type: 'stocktake' 
                                                  });
                                                } else {
                                                  const res = await api.getStockCountItems(sc.id);
                                                  setViewDetailsModal({ header: sc, items: res.data || [], type: 'stocktake' });
                                                }
                                              }}
                                            >
                                              View Details
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="inventory-table-card" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                No physical stock count sheets logged yet. Click "New Stock Count Sheet" to submit one.
              </div>
            )
          )}

          {/* MODE 2: Group by Date then Item */}
          {groupByMode === 'date_item' && (
            groupedByDateAndItem.length > 0 ? (
              groupedByDateAndItem.map((dateGroup) => {
                const isDateCollapsed = !!collapsedDates[dateGroup.dateKey];

                return (
                  <div key={dateGroup.dateKey} className="date-group-card">
                    {/* Level 1: Date Header (Collapsible) */}
                    <div 
                      className="date-group-header"
                      onClick={() => toggleDateCollapse(dateGroup.dateKey)}
                    >
                      <div className="inv-group-title">
                        {isDateCollapsed ? <ChevronRight size={20} color="#3b82f6" /> : <ChevronDown size={20} color="#3b82f6" />}
                        <Calendar size={18} color="#3b82f6" />
                        <h3 style={{ fontSize: '17px', fontWeight: 800 }}>{dateGroup.dateStr}</h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          Unique Items: <strong>{dateGroup.items.length}</strong> • Total Records: <strong>{dateGroup.totalRecords}</strong>
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: dateGroup.totalVariance < 0 ? '#dc2626' : '#16a34a' }}>
                          Total Impact: ${dateGroup.totalVariance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Level 2: Items under this Date */}
                    {!isDateCollapsed && (
                      <div style={{ padding: '8px 0' }}>
                        {dateGroup.items.map((itemGroup) => {
                          const isItemCollapsed = !!collapsedItems[itemGroup.itemKey];

                          return (
                            <div key={itemGroup.itemKey} className="item-group-card">
                              {/* Item Header (Collapsible) */}
                              <div 
                                className="item-group-header"
                                onClick={() => toggleItemCollapse(itemGroup.itemKey)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {isItemCollapsed ? <ChevronRight size={18} color="#3b82f6" /> : <ChevronDown size={18} color="#3b82f6" />}
                                  <Package size={16} color="#3b82f6" />
                                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                                    {itemGroup.itemName}
                                  </h4>
                                  <span className="inv-badge inv-badge-blue">{itemGroup.department}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                                    Total Qty: <strong>{itemGroup.totalQty}</strong> • Locations: <strong>{itemGroup.records.length}</strong>
                                  </span>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: itemGroup.variance < 0 ? '#dc2626' : '#16a34a' }}>
                                    ${itemGroup.variance.toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              {/* Item Counts Table across Locations */}
                              {!isItemCollapsed && (
                                <table className="inventory-table">
                                  <thead>
                                    <tr>
                                      <th>Storage Location</th>
                                      <th>Branch</th>
                                      <th>Counted Physical Qty</th>
                                      <th>Min Par Level</th>
                                      <th>Time</th>
                                      <th>Counted By</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {itemGroup.records.map((rec, rIdx) => {
                                      const statusText = rec.status || 'Draft';
                                      const timeStr = new Date(rec.date || rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                                      return (
                                        <tr key={rec.id || rIdx}>
                                          <td style={{ fontWeight: 700, color: '#16a34a' }}>
                                            <MapPin size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                            {rec.location || 'General Storage'}
                                          </td>
                                          <td>{rec.branch || 'Main Branch'}</td>
                                          <td style={{ fontWeight: 700 }}>
                                            {rec.count_qty ?? rec.quantity ?? 0} {rec.unit || 'pcs'}
                                          </td>
                                          <td style={{ fontWeight: 600, color: '#475569' }}>{rec.par_level ?? '-'} {rec.unit || 'pcs'}</td>
                                          <td>{timeStr}</td>
                                          <td>{rec.counted_by || rec.user || 'Staff'}</td>
                                          <td>
                                            <span className={`inv-badge ${statusText.toLowerCase() === 'completed' ? 'inv-badge-green' : 'inv-badge-yellow'}`}>
                                              <CheckCircle2 size={12} /> {statusText}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="inventory-table-card" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                No physical stock count items logged yet. Click "New Stock Count Sheet" to submit one.
              </div>
            )
          )}
        </div>
      )}

      {/* Tab 3: Stock Adjustments */}
      {activeTab === 'adjustments' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={() => setShowAdjustmentModal(true)}>
              <PlusCircle size={16} /> New Stock Adjustment Entry
            </button>
          </div>
          <div className="inventory-table-card">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Branch</th>
                  <th>Location</th>
                  <th>Item Name</th>
                  <th>Adjustment Type</th>
                  <th>Quantity</th>
                  <th>Unit Cost</th>
                  <th>Total Value</th>
                  <th>Reason / Notes</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {stockAdjustments.length > 0 ? (
                  stockAdjustments.map((adj) => (
                    <tr key={adj.id}>
                      <td>{new Date(adj.created_at).toLocaleString()}</td>
                      <td>{adj.branch}</td>
                      <td>{adj.location}</td>
                      <td style={{ fontWeight: 600 }}>{adj.item_name}</td>
                      <td>
                        <span className={`inv-badge ${['Waste/Damage', 'Expiry'].includes(adj.adjustment_type) ? 'inv-badge-red' : 'inv-badge-blue'}`}>
                          {adj.adjustment_type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{adj.quantity} {adj.unit}</td>
                      <td>${Number(adj.unit_cost || 0).toFixed(2)}</td>
                      <td style={{ fontWeight: 700 }}>${Number(adj.total_value || 0).toFixed(2)}</td>
                      <td>{adj.reason || '-'}</td>
                      <td>{adj.created_by}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      No manual stock adjustments logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Stock Transfers */}
      {activeTab === 'transfers' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={() => setShowTransferModal(true)}>
              <ArrowLeftRight size={16} /> Log Internal Transfer
            </button>
          </div>
          <div className="inventory-table-card">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Date</th>
                  <th>From (Source)</th>
                  <th>To (Destination)</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stockTransfers.length > 0 ? (
                  stockTransfers.map((trf) => (
                    <tr key={trf.id}>
                      <td style={{ fontWeight: 700, color: '#3b82f6' }}>{trf.transfer_number}</td>
                      <td>{new Date(trf.transfer_date || trf.created_at).toLocaleString()}</td>
                      <td>{trf.from_branch} - {trf.from_location}</td>
                      <td>{trf.to_branch} - {trf.to_location}</td>
                      <td>
                        <span className="inv-badge inv-badge-blue">{trf.status}</span>
                      </td>
                      <td>{trf.notes || '-'}</td>
                      <td>{trf.created_by}</td>
                      <td>
                        <button 
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={async () => {
                            const res = await api.getStockTransferItems(trf.id);
                            setViewDetailsModal({ header: trf, items: res.data || [], type: 'transfer' });
                          }}
                        >
                          View Items
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      No internal stock transfers recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Physical Stock Count (Stocktake Entry Sheet) */}
      {showStocktakeModal && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-content">
            <div className="inv-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList color="#3b82f6" size={24} />
                <h3>New Physical Stock Count Sheet (Stocktake Data Entry)</h3>
              </div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowStocktakeModal(false)} />
            </div>
            <div className="inv-modal-body">
              {/* Count Sheet Metadata Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Branch</label>
                  <select 
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={countHeader.branch}
                    onChange={(e) => setCountHeader({ ...countHeader, branch: e.target.value })}
                  >
                    {branches.map(b => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Storage Location</label>
                  <select 
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={countHeader.location}
                    onChange={(e) => setCountHeader({ ...countHeader, location: e.target.value })}
                  >
                    {locations.map(loc => <option key={loc.id || loc.name} value={loc.name}>{loc.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Counted By</label>
                  <input 
                    type="text" 
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={countHeader.counted_by}
                    onChange={(e) => setCountHeader({ ...countHeader, counted_by: e.target.value })}
                  />
                </div>
              </div>

              {/* Items Entry Table */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Item Name</th>
                      <th>Dept</th>
                      <th>Unit</th>
                      <th>Min Par Level</th>
                      <th>Actual Physical Count</th>
                      <th>Par Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(groupedCountItemsForm).map((dept) => (
                      <Fragment key={dept}>
                        <tr className="inv-dept-header-row">
                          <td colSpan={6}>📂 {dept}</td>
                        </tr>
                        {groupedCountItemsForm[dept].map((item) => {
                          const idx = item.originalIndex;
                          const isBelowPar = Number(item.count_qty || 0) < Number(item.par_level || 0);
                          return (
                            <tr key={item.item_id || idx}>
                              <td style={{ fontWeight: 600, paddingLeft: '24px' }}>{item.item_name}</td>
                              <td>{item.department}</td>
                              <td>{item.unit}</td>
                              <td style={{ fontWeight: 600, color: '#475569' }}>{item.par_level || 0}</td>
                              <td>
                                <input 
                                  type="number"
                                  className="qty-input"
                                  value={item.count_qty}
                                  onChange={(e) => handleStocktakeQtyChange(idx, e.target.value)}
                                />
                              </td>
                              <td>
                                {isBelowPar && item.par_level > 0 ? (
                                  <span className="inv-badge inv-badge-red" style={{ fontSize: '11px' }}>
                                    ⚠️ Below Par
                                  </span>
                                ) : (
                                  <span className="inv-badge inv-badge-green" style={{ fontSize: '11px' }}>
                                    ✓ Ok
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="btn-secondary" onClick={() => setShowStocktakeModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveStockCount}>
                <Save size={16} /> Save & Post Stock Count
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Stock Adjustment Data Entry */}
      {showAdjustmentModal && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-content" style={{ maxWidth: '500px' }}>
            <div className="inv-modal-header">
              <h3>Record Stock Adjustment</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowAdjustmentModal(false)} />
            </div>
            <div className="inv-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Branch</label>
                    <select 
                      className="inventory-filter-select"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={adjustmentForm.branch}
                      onChange={(e) => setAdjustmentForm({ ...adjustmentForm, branch: e.target.value })}
                    >
                      {branches.map(b => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Location</label>
                    <select 
                      className="inventory-filter-select"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={adjustmentForm.location}
                      onChange={(e) => setAdjustmentForm({ ...adjustmentForm, location: e.target.value })}
                    >
                      {locations.map(loc => <option key={loc.id || loc.name} value={loc.name}>{loc.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Filters for item selection: Department & Sub-Department & Search */}
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Filter Item Catalog</span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Department</label>
                      <select 
                        className="inventory-filter-select"
                        style={{ width: '100%', marginTop: '2px', fontSize: '12px' }}
                        value={adjSelectedDept}
                        onChange={(e) => {
                          setAdjSelectedDept(e.target.value);
                          setAdjSelectedSubDept('All');
                        }}
                      >
                        <option value="All">All Departments</option>
                        {departmentsList.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Sub-Department</label>
                      <select 
                        className="inventory-filter-select"
                        style={{ width: '100%', marginTop: '2px', fontSize: '12px' }}
                        value={adjSelectedSubDept}
                        onChange={(e) => setAdjSelectedSubDept(e.target.value)}
                      >
                        <option value="All">All Sub-Departments</option>
                        {subDepartmentsList.map(sd => <option key={sd} value={sd}>{sd}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Search Item Name</label>
                    <div style={{ position: 'relative', marginTop: '2px' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
                      <input 
                        type="text"
                        placeholder="Search items..."
                        className="inventory-filter-select"
                        style={{ width: '100%', paddingLeft: '30px', fontSize: '12px' }}
                        value={adjItemSearch}
                        onChange={(e) => setAdjItemSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>
                    Select Catalog Item ({filteredAdjustmentCatalogItems.length} available)
                  </label>
                  <select 
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={adjustmentForm.item_name}
                    onChange={(e) => {
                      const selected = catalogItems.find(i => i.name === e.target.value);
                      setAdjustmentForm({ 
                        ...adjustmentForm, 
                        item_name: e.target.value,
                        item_id: selected?.id || '',
                        unit: selected?.unit || 'pcs',
                        unit_cost: String(selected?.price_usd || '0')
                      });
                    }}
                  >
                    <option value="">-- Choose Item --</option>
                    {filteredAdjustmentCatalogItems.map(i => (
                      <option key={i.id || i.name} value={i.name}>
                        {i.name} ({i.department || 'General'}{i.sub_department ? ` - ${i.sub_department}` : ''})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>Adjustment Reason / Type</label>
                  <select 
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={adjustmentForm.adjustment_type}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: e.target.value })}
                  >
                    <option value="Direct Inflow">Direct Purchase Inflow (+)</option>
                    <option value="Waste/Damage">Waste & Damaged Stock (-)</option>
                    <option value="Expiry">Expired Goods (-)</option>
                    <option value="Internal Use">Internal Staff/Kitchen Consumption (-)</option>
                    <option value="Recount Correction">Recount Correction (+/-)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>
                      Quantity {adjustmentForm.unit ? `(${adjustmentForm.unit})` : ''}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <input 
                        type="number"
                        className="inventory-filter-select"
                        style={{ flex: 1 }}
                        value={adjustmentForm.quantity}
                        onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: e.target.value })}
                        placeholder="0"
                      />
                      {adjustmentForm.unit && (
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 700, 
                          color: '#0f766e', 
                          background: '#ccfbf1', 
                          padding: '6px 10px', 
                          borderRadius: '6px', 
                          border: '1px solid #99f6e4',
                          whiteSpace: 'nowrap'
                        }}>
                          {adjustmentForm.unit}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 700 }}>Unit Cost ($)</label>
                    <input 
                      type="number"
                      className="inventory-filter-select"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={adjustmentForm.unit_cost}
                      onChange={(e) => setAdjustmentForm({ ...adjustmentForm, unit_cost: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 700 }}>Notes / Explanation</label>
                  <textarea 
                    className="inventory-filter-select"
                    style={{ width: '100%', marginTop: '4px', height: '60px' }}
                    value={adjustmentForm.reason}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="btn-secondary" onClick={() => setShowAdjustmentModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveAdjustment}>Save Adjustment</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Stock Transfer Data Entry */}
      {showTransferModal && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-content" style={{ maxWidth: '650px' }}>
            <div className="inv-modal-header">
              <h3>Log Internal Stock Transfer</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowTransferModal(false)} />
            </div>
            <div className="inv-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#3b82f6' }}>Source (From)</h4>
                  <select 
                    className="inventory-filter-select"
                    style={{ width: '100%', marginBottom: '8px' }}
                    value={transferHeader.from_branch}
                    onChange={(e) => setTransferHeader({ ...transferHeader, from_branch: e.target.value })}
                  >
                    {branches.map(b => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
                  </select>
                  <select 
                    className="inventory-filter-select"
                    style={{ width: '100%' }}
                    value={transferHeader.from_location}
                    onChange={(e) => setTransferHeader({ ...transferHeader, from_location: e.target.value })}
                  >
                    {locations.map(loc => <option key={loc.id || loc.name} value={loc.name}>{loc.name}</option>)}
                  </select>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#16a34a' }}>Destination (To)</h4>
                  <select 
                    className="inventory-filter-select"
                    style={{ width: '100%', marginBottom: '8px' }}
                    value={transferHeader.to_branch}
                    onChange={(e) => setTransferHeader({ ...transferHeader, to_branch: e.target.value })}
                  >
                    {branches.map(b => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
                  </select>
                  <select 
                    className="inventory-filter-select"
                    style={{ width: '100%' }}
                    value={transferHeader.to_location}
                    onChange={(e) => setTransferHeader({ ...transferHeader, to_location: e.target.value })}
                  >
                    {locations.map(loc => <option key={loc.id || loc.name} value={loc.name}>{loc.name}</option>)}
                  </select>
                </div>
              </div>

              <h4 style={{ fontSize: '14px', margin: '16px 0 8px 0' }}>Transfer Items</h4>
              {transferItemsForm.map((row, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 40px', gap: '8px', marginBottom: '8px' }}>
                  <select 
                    className="inventory-filter-select"
                    value={row.item_name}
                    onChange={(e) => {
                      const selected = catalogItems.find(i => i.name === e.target.value);
                      const updated = [...transferItemsForm];
                      updated[idx] = {
                        ...updated[idx],
                        item_name: e.target.value,
                        item_id: selected?.id || '',
                        unit: selected?.unit || 'pcs',
                        unit_cost: selected?.price_usd || '0'
                      };
                      setTransferItemsForm(updated);
                    }}
                  >
                    <option value="">-- Choose Item --</option>
                    {catalogItems.map(i => <option key={i.id || i.name} value={i.name}>{i.name}</option>)}
                  </select>
                  <input 
                    type="number" 
                    placeholder="Qty" 
                    className="inventory-filter-select"
                    value={row.quantity}
                    onChange={(e) => {
                      const updated = [...transferItemsForm];
                      updated[idx].quantity = e.target.value;
                      setTransferItemsForm(updated);
                    }}
                  />
                  <input 
                    type="text" 
                    placeholder="Unit" 
                    className="inventory-filter-select"
                    value={row.unit}
                    readOnly 
                  />
                  <button 
                    className="btn-secondary" 
                    style={{ color: '#dc2626', padding: '0 8px' }}
                    onClick={() => {
                      setTransferItemsForm(transferItemsForm.filter((_, i) => i !== idx));
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}

              <button 
                className="btn-secondary" 
                style={{ marginTop: '8px', fontSize: '13px' }}
                onClick={() => setTransferItemsForm([...transferItemsForm, { item_name: '', quantity: '', unit: '', unit_cost: '0' }])}
              >
                + Add Another Item
              </button>
            </div>
            <div className="inv-modal-footer">
              <button className="btn-secondary" onClick={() => setShowTransferModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveTransfer}>Post Transfer</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: View Details */}
      {viewDetailsModal && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-content">
            <div className="inv-modal-header">
              <h3>
                {viewDetailsModal.type === 'stocktake' ? `Stock Count Details (${viewDetailsModal.header.count_number})` : `Transfer Details (${viewDetailsModal.header.transfer_number})`}
              </h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setViewDetailsModal(null)} />
            </div>
            <div className="inv-modal-body">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Unit Cost</th>
                    {viewDetailsModal.type === 'stocktake' && <th>Variance Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {viewDetailsModal.items.length > 0 ? (
                    viewDetailsModal.items.map((item: any, i: number) => {
                      const itemName = item.item_name || item.name || item.item || item.product_name || `Item #${i + 1}`;
                      const qty = item.count_qty ?? item.quantity ?? item.actual_qty ?? 0;
                      const cost = Number(item.unit_cost || item.price_usd || 0);
                      const varCost = Number(item.variance_cost || 0);

                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{itemName}</td>
                          <td style={{ fontWeight: 700 }}>{qty}</td>
                          <td>{item.unit || 'pcs'}</td>
                          <td>${cost.toFixed(2)}</td>
                          {viewDetailsModal.type === 'stocktake' && (
                            <td style={{ fontWeight: 700, color: varCost < 0 ? '#dc2626' : varCost > 0 ? '#16a34a' : '#64748b' }}>
                              ${varCost.toFixed(2)}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No item details logged for this sheet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="inv-modal-footer">
              <button className="btn-secondary" onClick={() => setViewDetailsModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Storage Locations Manager */}
      {showLocationManagerModal && (
        <div className="inv-modal-overlay">
          <div className="inv-modal-content" style={{ maxWidth: '650px' }}>
            <div className="inv-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} color="#16a34a" />
                <h3 style={{ margin: 0 }}>Storage Locations Management</h3>
              </div>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowLocationManagerModal(false)} />
            </div>
            <div className="inv-modal-body">
              {/* Form: Add New Storage Location */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px', color: '#334155' }}>
                  + Add New Clean Storage Location
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Department</span>
                    <select 
                      className="inventory-filter-select"
                      style={{ width: '140px', background: '#fff', fontWeight: 600 }}
                      value={newLocationDept}
                      onChange={(e) => setNewLocationDept(e.target.value)}
                    >
                      {['Kitchen', 'Bar', 'Pastry', 'Storage', 'Floor', 'Supplies'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Location Name</span>
                    <input 
                      type="text"
                      placeholder="e.g. Pastry Kitchen, Wine Cellar, Bar Fridge..."
                      className="inventory-filter-select"
                      style={{ flex: 1 }}
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                    />
                  </div>
                  <button className="btn-primary" style={{ marginTop: '18px' }} onClick={handleAddLocation}>
                    Add Location
                  </button>
                </div>
              </div>

              {/* Table of Storage Locations */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', maxHeight: '350px', overflowY: 'auto' }}>
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Storage Location Name</th>
                      <th>Department</th>
                      <th>Type / Source</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc, idx) => {
                      const isCustom = loc.id && !loc.id.toString().startsWith('loc-');
                      return (
                        <tr key={loc.id || idx}>
                          <td style={{ fontWeight: 600, color: '#1e293b' }}>
                            <MapPin size={14} style={{ marginRight: '6px', color: '#16a34a', verticalAlign: 'middle' }} />
                            {loc.name}
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f766e', background: '#ccfbf1', padding: '3px 8px', borderRadius: '12px' }}>
                              {loc.department || 'Kitchen'}
                            </span>
                          </td>
                          <td>
                            <span className={`inv-badge ${isCustom ? 'inv-badge-green' : 'inv-badge-blue'}`} style={{ fontSize: '11px' }}>
                              {isCustom ? 'Custom Storage' : 'Default / Catalog'}
                            </span>
                          </td>
                          <td>
                            {isCustom ? (
                              <button 
                                className="btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '12px', color: '#dc2626', borderColor: '#fca5a5' }}
                                onClick={() => handleDeleteLocation(loc.id, loc.name)}
                              >
                                Delete
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>System Standard</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="inv-modal-footer">
              <button className="btn-secondary" onClick={() => setShowLocationManagerModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
