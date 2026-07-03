import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  Monitor, 
  RefreshCw, 
  AlertCircle, 
  ShieldCheck,
  Smartphone,
  Globe
} from 'lucide-react';
import { api } from '../api/client';

export default function SignInLogsScreen({ user }: { user: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterBranch, setFilterBranch] = useState(user.role === 'Admin' ? 'All' : user.branch || 'All');
  const [filterDept, setFilterDept] = useState('All');
  const [filterUser, setFilterUser] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDevice, setFilterDevice] = useState('All');

  // KPI States
  const [kpis, setKpis] = useState({
    totalToday: 0,
    activeNow: 0,
    expiredToday: 0,
    topUser: 'N/A'
  });

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [startDate, endDate, filterBranch, filterDept, filterUser, filterStatus, filterDevice]);

  const loadFilterOptions = async () => {
    try {
      const [branchRes, deptRes, userRes] = await Promise.all([
        api.getBranchesList(),
        api.getDepartmentsList(),
        api.getAllUsers()
      ]);

      if (branchRes.success && branchRes.data) {
        setBranches(branchRes.data.map((b: any) => typeof b === 'string' ? b : b.name));
      }
      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data.map((d: any) => typeof d === 'string' ? d : d.name));
      }
      if (userRes.success && userRes.data) {
        setUsers(userRes.data.map((u: any) => u.name));
      }
    } catch (e) {
      console.error('Error loading filter options:', e);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getLoginLogs({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        branch: filterBranch,
        department: filterDept,
        userName: filterUser,
        status: filterStatus,
        deviceType: filterDevice
      });

      if (res.success && res.data) {
        setLogs(res.data);
        calculateKpis(res.data);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error('Error loading login logs:', e);
      setLogs([]);
    }
    setLoading(false);
  };

  const calculateKpis = (data: any[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Total sessions today (session created on current date)
    const todayLogs = data.filter(log => log.Date && log.Date.startsWith(todayStr));
    const totalToday = todayLogs.length;

    // 2. Active Now (Status = 'Active')
    const activeNow = data.filter(log => log.Status === 'Active').length;

    // 3. Expired sessions today
    const expiredToday = todayLogs.filter(log => log.Status === 'Expired').length;

    // 4. Top active user today (or overall if today is empty)
    const userCounts: Record<string, number> = {};
    const datasetForTopUser = todayLogs.length > 0 ? todayLogs : data;
    
    datasetForTopUser.forEach(log => {
      if (log.UserName) {
        userCounts[log.UserName] = (userCounts[log.UserName] || 0) + 1;
      }
    });

    let topUser = 'N/A';
    let maxVal = 0;
    Object.entries(userCounts).forEach(([name, count]) => {
      if (count > maxVal) {
        maxVal = count;
        topUser = `${name} (${count} sess)`;
      }
    });

    setKpis({
      totalToday,
      activeNow,
      expiredToday,
      topUser
    });
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setFilterBranch(user.role === 'Admin' ? 'All' : user.branch || 'All');
    setFilterDept('All');
    setFilterUser('All');
    setFilterStatus('All');
    setFilterDevice('All');
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return '—';
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '—';
    
    // Formats: YYYY-MM-DD HH:MM
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Active':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          color: 'var(--success)',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'inline-block'
        };
      case 'Logged Out':
        return {
          backgroundColor: 'rgba(100, 116, 139, 0.1)',
          color: 'var(--text-muted)',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'inline-block'
        };
      case 'Expired':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--danger)',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'inline-block'
        };
      default:
        return {
          backgroundColor: '#e2e8f0',
          color: '#475569',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600,
          display: 'inline-block'
        };
    }
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-title-row">
        <div>
          <h1>Sign-In Activity Logs</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Monitor active sessions, device usage, and audit access security logs.
          </p>
        </div>
        <div>
          <button 
            onClick={loadLogs} 
            className="auth-btn" 
            style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
          >
            <RefreshCw size={16} /> Sync Logs
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Active Sessions Now</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{kpis.activeNow}</span>
            <span className="kpi-card-label">Currently interacting with app</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Total Sessions Today</span>
            <div className="kpi-card-icon-wrapper">
              <Users size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{kpis.totalToday}</span>
            <span className="kpi-card-label">Logins recorded today</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Expired Sessions Today</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{kpis.expiredToday}</span>
            <span className="kpi-card-label">Auto-logged out by inactivity</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-danger" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Top Active User Today</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
              <Monitor size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value" style={{ fontSize: '16px', fontWeight: 700, paddingTop: '4px' }}>{kpis.topUser}</span>
            <span className="kpi-card-label">Most sessions registered today</span>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="filters-card">
        <div className="filters-row">
          <div className="filter-group">
            <label>Start Date</label>
            <input 
              type="date" 
              className="filter-input"
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input 
              type="date" 
              className="filter-input"
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {user.role === 'Admin' && (
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
          )}

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

          <div className="filter-group">
            <label>User</label>
            <select 
              className="filter-select"
              value={filterUser} 
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="All">All Users</option>
              {users.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select 
              className="filter-select"
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Logged Out">Logged Out</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Device Type</label>
            <select 
              className="filter-select"
              value={filterDevice} 
              onChange={(e) => setFilterDevice(e.target.value)}
            >
              <option value="All">All Devices</option>
              <option value="Web">Web</option>
              <option value="iPhone">iPhone</option>
              <option value="Android">Android</option>
              <option value="Tablet">Tablet</option>
              <option value="Desktop">Desktop</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
            <button 
              onClick={handleResetFilters}
              className="auth-btn"
              style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table Area */}
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
            <p style={{ color: 'var(--text-muted)' }}>Loading activity logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
            <AlertCircle size={36} style={{ color: 'var(--text-muted)' }} />
            <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>No Sign-In Logs Found</span>
            <span className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try adjusting your filters or date range.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1200px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <th style={tableHeaderStyle}>User</th>
                  <th style={tableHeaderStyle}>Branch</th>
                  <th style={tableHeaderStyle}>Department</th>
                  <th style={tableHeaderStyle}>Login Time</th>
                  <th style={tableHeaderStyle}>Logout Time</th>
                  <th style={tableHeaderStyle}>Last Activity</th>
                  <th style={tableHeaderStyle}>Session Duration</th>
                  <th style={tableHeaderStyle}>Device details</th>
                  <th style={tableHeaderStyle}>App version</th>
                  <th style={tableHeaderStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.LogID} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                    {/* User */}
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{log.UserName || '—'}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{log.Role || '—'}</span>
                        <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>{log.LogID}</span>
                      </div>
                    </td>

                    {/* Branch */}
                    <td style={{ ...tableCellStyle, fontWeight: 600 }}>{log.Branch || '—'}</td>

                    {/* Department */}
                    <td style={tableCellStyle}>{log.Department || '—'}</td>

                    {/* Login Time */}
                    <td style={tableCellStyle}>{formatTimestamp(log.LoginTime)}</td>

                    {/* Logout Time */}
                    <td style={tableCellStyle}>{formatTimestamp(log.LogoutTime)}</td>

                    {/* Last Activity */}
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{formatTimestamp(log.LastActivityAt)}</span>
                        {log.Action === 'SessionExpired' && (
                          <span style={{ fontSize: '10px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                            Expired
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Session Duration */}
                    <td style={{ ...tableCellStyle, fontWeight: 700, color: 'var(--primary)' }}>
                      {log.SessionDuration || '—'}
                    </td>

                    {/* Device Details */}
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                          {log.DeviceType === 'Web' || log.Browser !== 'App' ? (
                            <Globe size={14} style={{ color: 'var(--text-muted)' }} />
                          ) : (
                            <Smartphone size={14} style={{ color: 'var(--text-muted)' }} />
                          )}
                          <strong style={{ fontWeight: 600 }}>{log.DeviceType || '—'}</strong> ({log.DeviceName || '—'})
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          OS: {log.OS || '—'} | Browser: {log.Browser || '—'}
                        </span>
                      </div>
                    </td>

                    {/* App Version */}
                    <td style={tableCellStyle}>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '2px 6px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#475569'
                      }}>
                        v{log.AppVersion || '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={tableCellStyle}>
                      <span style={getStatusBadgeStyle(log.Status)}>
                        {log.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
