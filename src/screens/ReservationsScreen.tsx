import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  MapPin, 
  Phone, 
  Cake, 
  Settings, 
  X,
  Info
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

export default function ReservationsScreen({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [capacities, setCapacities] = useState<any[]>([]);
  
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('All');

  // Client Search & Auto-complete
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Modals state
  const [showResModal, setShowResModal] = useState(false);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState<any | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Capacity Form State
  const [capacityForm, setCapacityForm] = useState<any[]>([]);

  // Reservation Form State
  const [resForm, setResForm] = useState({
    branch: '',
    reservation_date: '',
    reservation_time: '19:00',
    area: 'Inside',
    guest_count: 2,
    table_count: 1,
    is_smoking: false,
    baby_chairs: 0,
    is_birthday: false,
    comments: '',
    status: 'Pending',
    cancel_reason: '',
    confirmation_call: false
  });

  const canManage = user.role === 'Admin' || user.role === 'Manager';

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      loadReservations();
    }
  }, [selectedBranch, selectedDate]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      const delayDebounce = setTimeout(() => {
        searchClientDb(searchQuery);
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setClients([]);
    }
  }, [searchQuery]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const capRes = await api.getBranches();
      let dbBranches: string[] = [];
      if (capRes.success && capRes.data) {
        setCapacities(capRes.data);
        setCapacityForm(capRes.data);
        dbBranches = capRes.data.map((c: any) => c.name);
      }

      if (dbBranches.length > 0) {
        setBranches(dbBranches);
        // Default to user branch or first branch
        const defaultBranch = user.branch && dbBranches.includes(user.branch) ? user.branch : dbBranches[0];
        setSelectedBranch(defaultBranch);
      } else {
        setBranches(['Downtown']);
        setSelectedBranch('Downtown');
      }
    } catch (e) {
      console.error('Error loading initial reservations data:', e);
    }
    setLoading(false);
  };

  const loadReservations = async () => {
    setLoading(true);
    try {
      const res = await api.getReservations(selectedBranch, selectedDate);
      if (res.success && res.data) {
        setReservations(res.data);
      } else {
        setReservations([]);
      }
    } catch (e) {
      console.error('Error loading reservations:', e);
    }
    setLoading(false);
  };

  const searchClientDb = async (q: string) => {
    try {
      const res = await api.searchClients(q);
      if (res.success && res.data) {
        setClients(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleConfirmationCall = async (resObj: any) => {
    if (!canManage) return;
    try {
      const res = await api.updateReservation(resObj.id, { confirmation_call: !resObj.confirmation_call });
      if (res.success) {
        loadReservations();
      } else {
        alert('Failed to update confirmation: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleQuickStatusUpdate = async (resObj: any, newStatus: string) => {
    if (!canManage) return;
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'Cancelled') {
        updates.cancel_reason = 'Quick Status Change';
      }
      const res = await api.updateReservation(resObj.id, updates);
      if (res.success) {
        loadReservations();
        if (newStatus === 'Cancelled') {
          checkWaitlistNotification(resObj.branch, resObj.reservation_date);
        }
      } else {
        alert('Failed to update status: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const checkWaitlistNotification = async (branch: string, date: string) => {
    try {
      const res = await api.getReservations(branch, date);
      if (res.success && res.data) {
        const waitlist = res.data.filter((r: any) => r.status === 'Waiting List');
        if (waitlist.length > 0) {
          alert(`Spot Opened! There are ${waitlist.length} clients on the Waiting List for this branch/date.`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Capacity calculations
  const currentBranchCapacity = capacities.find(c => c.name === selectedBranch);
  const totalTables = currentBranchCapacity?.total_tables || 0;
  const totalChairs = currentBranchCapacity?.total_chairs || 0;

  const activeReservations = reservations.filter(r => 
    r.status !== 'Cancelled' && 
    r.status !== 'No-Show' && 
    r.status !== 'Waiting List'
  );
  
  const usedTables = activeReservations.reduce((sum, r) => sum + (r.table_count || 1), 0);
  const usedChairs = activeReservations.reduce((sum, r) => sum + (r.guest_count || 1), 0);
  const remainingTables = Math.max(0, totalTables - usedTables);
  const isBranchFull = totalTables > 0 && remainingTables === 0;

  // Filtered reservations
  const filteredReservations = reservations.filter(r => statusFilter === 'All' || r.status === statusFilter);

  // Open Add Reservation
  const handleOpenAdd = () => {
    setEditingReservation(null);
    setSelectedClient(null);
    setIsNewClient(false);
    setSearchQuery('');
    setClients([]);
    setNewClientName('');
    setNewClientPhone('');
    
    setResForm({
      branch: selectedBranch,
      reservation_date: selectedDate,
      reservation_time: '19:00',
      area: 'Inside',
      guest_count: 2,
      table_count: 1,
      is_smoking: false,
      baby_chairs: 0,
      is_birthday: false,
      comments: '',
      status: 'Pending',
      cancel_reason: '',
      confirmation_call: false
    });
    
    setShowResModal(true);
  };

  // Open Edit Reservation
  const handleOpenEdit = (resObj: any) => {
    setEditingReservation(resObj);
    setSelectedClient(resObj.clients || null);
    setIsNewClient(false);
    setSearchQuery('');
    setClients([]);
    
    setResForm({
      branch: resObj.branch,
      reservation_date: resObj.reservation_date,
      reservation_time: resObj.reservation_time ? resObj.reservation_time.substring(0, 5) : '19:00',
      area: resObj.area || 'Inside',
      guest_count: resObj.guest_count || 2,
      table_count: resObj.table_count || 1,
      is_smoking: resObj.is_smoking || false,
      baby_chairs: resObj.baby_chairs || 0,
      is_birthday: resObj.is_birthday || false,
      comments: resObj.comments || '',
      status: resObj.status || 'Pending',
      cancel_reason: resObj.cancel_reason || '',
      confirmation_call: resObj.confirmation_call || false
    });

    setShowResModal(true);
  };

  const proceedToSaveReservation = async (statusOverride?: string) => {
    setSubmittingAction(true);
    try {
      let clientId = selectedClient?.id;

      if (isNewClient) {
        if (!newClientName || !newClientPhone) {
          alert('Please enter client name and phone number.');
          setSubmittingAction(false);
          return;
        }
        const clientRes = await api.createClient({ name: newClientName, phone: newClientPhone });
        if (clientRes.success && clientRes.data) {
          clientId = clientRes.data.id;
        } else {
          alert('Failed to save client: ' + clientRes.error);
          setSubmittingAction(false);
          return;
        }
      }

      if (!clientId) {
        alert('Please select or create a client.');
        setSubmittingAction(false);
        return;
      }

      const finalStatus = statusOverride || resForm.status;

      const payload = {
        ...(editingReservation ? { id: editingReservation.id } : {}),
        client_id: clientId,
        branch: resForm.branch,
        reservation_date: resForm.reservation_date,
        reservation_time: resForm.reservation_time,
        area: resForm.area,
        guest_count: Number(resForm.guest_count) || 2,
        table_count: Number(resForm.table_count) || 1,
        is_smoking: resForm.is_smoking,
        baby_chairs: Number(resForm.baby_chairs) || 0,
        is_birthday: resForm.is_birthday,
        comments: resForm.comments,
        status: finalStatus,
        cancel_reason: finalStatus === 'Cancelled' ? (resForm.cancel_reason || 'Unknown') : null,
        confirmation_call: resForm.confirmation_call
      };

      const res = await api.saveReservation(payload);
      if (res.success) {
        alert('Reservation saved successfully.');
        setShowResModal(false);
        loadReservations();
        if (finalStatus === 'Cancelled') {
          checkWaitlistNotification(resForm.branch, resForm.reservation_date);
        }
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmittingAction(false);
  };

  const handleSaveReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resForm.branch || !resForm.reservation_date || !resForm.reservation_time) {
      alert('Please fill out all required fields.');
      return;
    }

    if (resForm.status === 'Waiting List' || resForm.status === 'Cancelled' || resForm.status === 'No-Show') {
      proceedToSaveReservation();
      return;
    }

    // Capacity checks
    const targetBranch = resForm.branch;
    const targetDate = resForm.reservation_date;

    const [capRes, resRes] = await Promise.all([
      api.getBranches(),
      api.getReservations(targetBranch, targetDate)
    ]);

    let branchCap = { total_tables: 0, total_chairs: 0 };
    if (capRes.success && capRes.data) {
      const found = capRes.data.find((c: any) => c.name === targetBranch);
      if (found) branchCap = found;
    }

    let activeTablesCount = 0;
    let activeChairsCount = 0;

    if (resRes.success && resRes.data) {
      const active = resRes.data.filter((r: any) => 
        r.status !== 'Cancelled' && 
        r.status !== 'No-Show' && 
        r.status !== 'Waiting List' &&
        (!editingReservation || r.id !== editingReservation.id)
      );
      activeTablesCount = active.reduce((sum: number, r: any) => sum + (r.table_count || 1), 0);
      activeChairsCount = active.reduce((sum: number, r: any) => sum + (r.guest_count || 1), 0);
    }

    const newTables = Number(resForm.table_count) || 1;
    const newChairs = Number(resForm.guest_count) || 2;

    if (branchCap.total_tables > 0 && (activeTablesCount + newTables > branchCap.total_tables || activeChairsCount + newChairs > branchCap.total_chairs)) {
      const confirmForce = window.confirm(
        `BRANCH IS FULL!\n\n` +
        `This booking exceeds capacity at ${targetBranch} for ${targetDate}.\n` +
        `Tables Allocated: ${activeTablesCount + newTables} / ${branchCap.total_tables}\n` +
        `Chairs Allocated: ${activeChairsCount + newChairs} / ${branchCap.total_chairs}\n\n` +
        `Click OK to FORCE reservation, or Cancel to add them to the Waiting List.`
      );

      if (confirmForce) {
        proceedToSaveReservation();
      } else {
        proceedToSaveReservation('Waiting List');
      }
    } else {
      proceedToSaveReservation();
    }
  };

  // Branch capacities save
  const handleSaveCapacities = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      for (const cap of capacityForm) {
        await api.saveBranch({
          id: cap.id,
          name: cap.name,
          total_tables: Number(cap.total_tables) || 0,
          total_chairs: Number(cap.total_chairs) || 0
        });
      }
      alert('Branch capacities updated successfully.');
      setShowCapacityModal(false);
      loadInitialData(); // Reload stats
    } catch (e: any) {
      alert('Error saving capacities: ' + e.message);
    }
    setSubmittingAction(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return '#f59e0b';
      case 'Confirmed':
        return 'var(--success)';
      case 'Seated':
        return '#64748b';
      case 'Waiting List':
        return '#0284c7';
      case 'Cancelled':
      case 'No-Show':
        return 'var(--danger)';
      default:
        return '#64748b';
    }
  };

  return (
    <div className="dashboard-container">
      {/* Title Header */}
      <div className="dashboard-title-row">
        <div>
          <h1>Table Reservations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Book client tables, manage seating layouts, monitor waitlists, and configure branch capacities.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setShowCapacityModal(true)}
            className="auth-btn"
            style={{ width: 'auto', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Settings size={16} /> Manage Capacity
          </button>
          
          <button 
            onClick={handleOpenAdd}
            className="auth-btn"
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} /> Book Table
          </button>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Active Guests Today</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{usedChairs} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {totalChairs} max</span></span>
            <span className="kpi-card-label">Chairs occupied or confirmed</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Tables Used</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <MapPin size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{usedTables} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>/ {totalTables} max</span></span>
            <span className="kpi-card-label">Allocated branch tables</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Remaining Capacity</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: '#e2e8f0', color: 'var(--text-muted)' }}>
              <Info size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value" style={{ color: isBranchFull ? 'var(--danger)' : 'var(--success)' }}>
              {remainingTables} <span style={{ fontSize: '14px', fontWeight: 500 }}>Tables</span>
            </span>
            <span className="kpi-card-label">{isBranchFull ? 'BRANCH IS FULL' : 'Available tables left'}</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-danger" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Waiting List</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
              <RefreshCw size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{reservations.filter(r => r.status === 'Waiting List').length}</span>
            <span className="kpi-card-label">Clients waiting for opening</span>
          </div>
        </div>
      </div>

      {/* Filter and Dropdowns Card */}
      <div className="filters-card" style={{ marginTop: '16px' }}>
        <div className="filters-row" style={{ alignItems: 'flex-end' }}>
          <div className="filter-group" style={{ maxWidth: '240px' }}>
            <label>Branch</label>
            <select 
              className="filter-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="filter-group" style={{ maxWidth: '200px' }}>
            <label>Reservation Date</label>
            <input 
              type="date" 
              className="filter-input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Status filter tabs/select */}
          <div className="filter-group" style={{ flex: 1, minWidth: '220px' }}>
            <label>Status Filter</label>
            <select 
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Bookings</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Waiting List">Waiting List</option>
              <option value="Seated">Seated</option>
              <option value="Cancelled">Cancelled</option>
              <option value="No-Show">No-Show</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => {
                setSelectedDate(new Date().toISOString().split('T')[0]);
                setStatusFilter('All');
              }}
              className="auth-btn"
              style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
            >
              Today
            </button>
            <button 
              onClick={loadReservations}
              className="auth-btn"
              style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Reservations Table Grid */}
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
            <p style={{ color: 'var(--text-muted)' }}>Loading reservations list...</p>
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
            <AlertCircle size={36} style={{ color: 'var(--text-muted)' }} />
            <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>No Bookings Found</span>
            <span className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>There are no reservations matches for the selected criteria.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <th style={tableHeaderStyle}>Time</th>
                  <th style={tableHeaderStyle}>Client / Registry</th>
                  <th style={tableHeaderStyle}>Guests</th>
                  <th style={tableHeaderStyle}>Tables</th>
                  <th style={tableHeaderStyle}>Area</th>
                  <th style={tableHeaderStyle}>Preferences / Tags</th>
                  <th style={tableHeaderStyle}>Confirm Call</th>
                  <th style={tableHeaderStyle}>Status</th>
                  <th style={tableHeaderStyle}>Comments & Cancellations</th>
                  <th style={tableHeaderStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((res) => {
                  const clientName = res.clients?.name || 'Unknown Client';
                  const clientPhone = res.clients?.phone || '—';
                  
                  return (
                    <tr key={res.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                      <td style={{ ...tableCellStyle, fontWeight: 800, fontSize: '16px', color: 'var(--primary)' }}>
                        {res.reservation_time ? res.reservation_time.substring(0, 5) : '—'}
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700 }}>{clientName}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} /> {clientPhone}
                          </span>
                        </div>
                      </td>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{res.guest_count || 1} Pax</td>
                      <td style={tableCellStyle}>{res.table_count || 1} Tbl(s)</td>
                      <td style={tableCellStyle}>
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: res.area === 'Outside' ? '#fff7ed' : '#f0fdf4',
                          color: res.area === 'Outside' ? '#c2410c' : '#15803d',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '12px'
                        }}>
                          {res.area || 'Inside'}
                        </span>
                      </td>
                      <td style={tableCellStyle}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {res.is_birthday && (
                            <span style={{ fontSize: '11px', backgroundColor: '#fae8ff', color: '#86198f', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                              <Cake size={10} /> Birthday
                            </span>
                          )}
                          {res.is_smoking && (
                            <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              🚬 Smoking Area
                            </span>
                          )}
                          {Number(res.baby_chairs) > 0 && (
                            <span style={{ fontSize: '11px', backgroundColor: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              👶 {res.baby_chairs} Baby Chair
                            </span>
                          )}
                          {!res.is_birthday && !res.is_smoking && Number(res.baby_chairs) === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </div>
                      </td>
                      <td style={tableCellStyle}>
                        {canManage ? (
                          <button
                            onClick={() => toggleConfirmationCall(res)}
                            className="auth-btn"
                            style={{
                              width: 'auto',
                              padding: '4px 10px',
                              fontSize: '11px',
                              backgroundColor: res.confirmation_call ? 'rgba(16, 185, 129, 0.1)' : '#fffbeb',
                              color: res.confirmation_call ? 'var(--success)' : '#b45309',
                              border: '1px solid ' + (res.confirmation_call ? 'rgba(16, 185, 129, 0.3)' : '#fef3c7'),
                              fontWeight: 700
                            }}
                          >
                            {res.confirmation_call ? '✅ Completed' : '⚠️ Call Client'}
                          </button>
                        ) : (
                          <span>{res.confirmation_call ? '✅ Yes' : '❌ No'}</span>
                        )}
                      </td>
                      <td style={tableCellStyle}>
                        {canManage && res.status !== 'Seated' ? (
                          <select
                            style={{
                              height: '28px',
                              padding: '2px 6px',
                              border: '1px solid ' + getStatusColor(res.status),
                              borderRadius: '6px',
                              color: getStatusColor(res.status),
                              fontWeight: 700,
                              fontSize: '12px',
                              backgroundColor: 'white'
                            }}
                            value={res.status}
                            onChange={(e) => handleQuickStatusUpdate(res, e.target.value)}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Seated">Seated</option>
                            <option value="Waiting List">Waiting List</option>
                            <option value="Cancelled">Cancelled</option>
                            <option value="No-Show">No-Show</option>
                          </select>
                        ) : (
                          <span style={{
                            color: getStatusColor(res.status),
                            fontWeight: 700,
                            fontSize: '13px'
                          }}>
                            {res.status}
                          </span>
                        )}
                      </td>
                      <td style={{ ...tableCellStyle, maxWidth: '200px', whiteSpace: 'normal', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                        {res.comments && <div>💬 "{res.comments}"</div>}
                        {res.cancel_reason && <div style={{ color: 'var(--danger)', fontWeight: 600, marginTop: '2px' }}>❌ Cancel Reason: {res.cancel_reason}</div>}
                        {!res.comments && !res.cancel_reason && '—'}
                      </td>
                      <td style={tableCellStyle}>
                        <button 
                          onClick={() => handleOpenEdit(res)} 
                          className="auth-btn" 
                          style={{ 
                            width: 'auto', 
                            padding: '6px 12px', 
                            fontSize: '12px',
                            backgroundColor: 'var(--primary)'
                          }}
                        >
                          Edit details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BOOKING/RESERVATION FORM MODAL */}
      {showResModal && (
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
            maxWidth: '600px',
            maxHeight: '90vh',
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
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>
                {editingReservation ? 'Edit Seating Reservation' : 'New Table Reservation'}
              </h2>
              <button 
                onClick={() => setShowResModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveReservation} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              {/* Modal Body */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* CLIENT SELECT REGISTRY */}
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Client Registry</h3>
                  
                  {selectedClient && !isNewClient ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '6px', color: '#166534', fontWeight: 600 }}>
                      <span>👤 {selectedClient.name} ({selectedClient.phone})</span>
                      {!editingReservation && (
                        <button type="button" onClick={() => setSelectedClient(null)} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                          Change
                        </button>
                      )}
                    </div>
                  ) : isNewClient ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Client Name</label>
                          <input 
                            type="text" 
                            className="filter-input" 
                            style={{ height: '36px' }}
                            placeholder="Full Name"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', fontWeight: 600 }}>Phone Number</label>
                          <input 
                            type="text" 
                            className="filter-input"
                            style={{ height: '36px' }}
                            placeholder="+961..."
                            value={newClientPhone}
                            onChange={(e) => setNewClientPhone(e.target.value)}
                          />
                        </div>
                      </div>
                      <button type="button" onClick={() => setIsNewClient(false)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>
                        Search Existing Client Registry
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input 
                        type="text" 
                        className="filter-input" 
                        style={{ width: '100%', height: '36px' }}
                        placeholder="Search by client name or phone number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {clients.length > 0 && (
                        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', maxHeight: '120px', overflowY: 'auto', backgroundColor: 'white' }}>
                          {clients.map(c => (
                            <div 
                              key={c.id} 
                              onClick={() => setSelectedClient(c)}
                              style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}
                              className="search-item-hover"
                            >
                              <strong>{c.name}</strong>
                              <span style={{ color: 'var(--text-muted)' }}>{c.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={() => setIsNewClient(true)} style={{ background: 'transparent', border: 'none', color: '#16a34a', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>
                        + Add New Client to Registry
                      </button>
                    </div>
                  )}
                </div>

                {/* RESERVATION SCHEDULING DETAILS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Branch</label>
                    <select
                      className="filter-select"
                      value={resForm.branch}
                      onChange={(e) => setResForm({ ...resForm, branch: e.target.value })}
                    >
                      {branches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Reservation Time (HH:MM)</label>
                    <input 
                      type="text" 
                      className="filter-input"
                      placeholder="e.g. 19:30"
                      value={resForm.reservation_time}
                      onChange={(e) => setResForm({ ...resForm, reservation_time: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Reservation Date</label>
                    <input 
                      type="date" 
                      className="filter-input"
                      value={resForm.reservation_date}
                      onChange={(e) => setResForm({ ...resForm, reservation_date: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Area Layout</label>
                    <select
                      className="filter-select"
                      value={resForm.area}
                      onChange={(e) => setResForm({ ...resForm, area: e.target.value })}
                    >
                      <option value="Inside">Inside Area</option>
                      <option value="Outside">Outside Area</option>
                    </select>
                  </div>
                </div>

                {/* CAPACITY ALLOCATION */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Guests (Pax)</label>
                    <input 
                      type="number" 
                      className="filter-input"
                      value={resForm.guest_count}
                      min="1"
                      onChange={(e) => setResForm({ ...resForm, guest_count: Number(e.target.value) || 1 })}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Tables Allocated</label>
                    <input 
                      type="number" 
                      className="filter-input"
                      value={resForm.table_count}
                      min="1"
                      onChange={(e) => setResForm({ ...resForm, table_count: Number(e.target.value) || 1 })}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600 }}>Baby Chairs</label>
                    <input 
                      type="number" 
                      className="filter-input"
                      value={resForm.baby_chairs}
                      min="0"
                      onChange={(e) => setResForm({ ...resForm, baby_chairs: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* PREFERENCES SWITCHES */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Event & Seating Preferences</label>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={resForm.is_smoking} 
                        onChange={(e) => setResForm({ ...resForm, is_smoking: e.target.checked })}
                      />
                      Smoking Section
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={resForm.is_birthday} 
                        onChange={(e) => setResForm({ ...resForm, is_birthday: e.target.checked })}
                      />
                      🎂 Birthday / Event
                    </label>
                  </div>
                </div>

                {/* ADDITIONAL COMMENTS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Comments / Allergies / Notes</label>
                  <textarea 
                    className="filter-input"
                    style={{ height: '70px', padding: '8px 12px', resize: 'none' }}
                    placeholder="Enter preferences, dietary requirements or general comments..."
                    value={resForm.comments}
                    onChange={(e) => setResForm({ ...resForm, comments: e.target.value })}
                  />
                </div>

                {/* STATUS & CALL CONFIRM (Editing only) */}
                {editingReservation && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 700 }}>Status Seating Management</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600 }}>Reservation Status</label>
                        <select
                          className="filter-select"
                          value={resForm.status}
                          onChange={(e) => setResForm({ ...resForm, status: e.target.value })}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Seated">Seated</option>
                          <option value="Waiting List">Waiting List</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="No-Show">No-Show</option>
                        </select>
                      </div>

                      {resForm.status === 'Cancelled' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)' }}>Cancellation Reason</label>
                          <select
                            className="filter-select"
                            value={resForm.cancel_reason}
                            onChange={(e) => setResForm({ ...resForm, cancel_reason: e.target.value })}
                          >
                            <option value="">Select Reason...</option>
                            <option value="Changed Mind">Changed Mind</option>
                            <option value="Weather">Weather</option>
                            <option value="Emergency">Emergency</option>
                            <option value="Found Another Place">Found Another Place</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', cursor: 'pointer', marginTop: '4px' }}>
                      <input 
                        type="checkbox" 
                        checked={resForm.confirmation_call} 
                        onChange={(e) => setResForm({ ...resForm, confirmation_call: e.target.checked })}
                      />
                      📞 Confirmation Call Completed?
                    </label>
                  </div>
                )}

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
                  onClick={() => setShowResModal(false)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}
                  disabled={submittingAction}
                >
                  {submittingAction ? 'Saving...' : 'Save Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE CAPACITY MODAL */}
      {showCapacityModal && (
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
              <h2 style={{ fontSize: '16px', fontWeight: 800 }}>Manage Branch Capacities</h2>
              <button 
                onClick={() => setShowCapacityModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCapacities}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
                {capacityForm.map((cap, idx) => (
                  <div key={cap.id || cap.name} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: idx < capacityForm.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: idx < capacityForm.length - 1 ? '16px' : '0' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--primary)' }}>{cap.name} Branch</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Tables</label>
                        <input 
                          type="number" 
                          className="filter-input" 
                          style={{ height: '36px' }}
                          value={cap.total_tables}
                          min="0"
                          onChange={(e) => {
                            const updated = [...capacityForm];
                            updated[idx].total_tables = Number(e.target.value) || 0;
                            setCapacityForm(updated);
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Chairs (Max Pax)</label>
                        <input 
                          type="number" 
                          className="filter-input" 
                          style={{ height: '36px' }}
                          value={cap.total_chairs}
                          min="0"
                          onChange={(e) => {
                            const updated = [...capacityForm];
                            updated[idx].total_chairs = Number(e.target.value) || 0;
                            setCapacityForm(updated);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
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
                  onClick={() => setShowCapacityModal(false)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}
                  disabled={submittingAction}
                >
                  {submittingAction ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
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
