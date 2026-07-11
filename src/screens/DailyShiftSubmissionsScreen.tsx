import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { api } from '../api/client';

export default function DailyShiftSubmissionsScreen({ user }: { user: any }) {
  const isAdmin = user?.role === 'Admin' || user?.role === 'SuperAdmin';

  // Default filters to today
  const todayStr = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterShift, setFilterShift] = useState('All');

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Summary Metrics
  const [metrics, setMetrics] = useState({
    expected: 0,
    submitted: 0,
    missing: 0
  });

  useEffect(() => {
    if (isAdmin) {
      loadBranches();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadSubmissions();
    }
  }, [fromDate, toDate, filterBranch, filterShift, isAdmin]);

  const loadBranches = async () => {
    try {
      const res = await api.getBranchesList();
      if (res.success && res.data) {
        setBranches(res.data.map((b: any) => typeof b === 'string' ? b : b.name));
      }
    } catch (e) {
      console.error('Error loading branches:', e);
    }
  };

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const res = await api.getDailyShiftSubmissions({
        branch: filterBranch,
        shift: filterShift,
        fromDate,
        toDate
      });

      if (res.success && res.data) {
        setSubmissions(res.data);
        
        // Calculate Metrics
        const expected = res.data.length;
        const submitted = res.data.filter((s: any) => s.status === 'Submitted').length;
        const missing = res.data.filter((s: any) => s.status === 'Missing').length;
        
        setMetrics({ expected, submitted, missing });
      } else {
        setSubmissions([]);
        setMetrics({ expected: 0, submitted: 0, missing: 0 });
      }
    } catch (e) {
      console.error('Error loading daily shift submissions:', e);
      setSubmissions([]);
    }
    setLoading(false);
  };

  const handleResetFilters = () => {
    setFromDate(todayStr);
    setToDate(todayStr);
    setFilterBranch('All');
    setFilterShift('All');
  };

  // Render Access Denied for Non-Admin
  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        textAlign: 'center',
        color: 'var(--text-muted)',
        gap: '16px'
      }}>
        <div style={{
          padding: '20px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ShieldAlert size={48} />
        </div>
        <h2 style={{ color: 'var(--text-main)', fontWeight: 700 }}>Access Denied</h2>
        <p style={{ maxWidth: '400px', fontSize: '14px', lineHeight: '1.6' }}>
          Only Administrator users have permissions to view the Daily Shift Submissions logs.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Title & Top Bar */}
      <div className="dashboard-title-row">
        <div>
          <h1>Daily Shift Submissions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Monitor and track closed register shifts (AM & PM) across branches.
          </p>
        </div>
        <div>
          <button 
            onClick={loadSubmissions} 
            className="auth-btn" 
            style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
          >
            <RefreshCw size={16} /> Sync Shifts
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="kpi-grid">
        {/* Expected Card */}
        <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Expected Shifts</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{metrics.expected}</span>
            <span className="kpi-card-label">Total shifts required</span>
          </div>
        </div>

        {/* Submitted Card */}
        <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Submitted Shifts</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{metrics.submitted}</span>
            <span className="kpi-card-label">Successfully closed & logged</span>
          </div>
        </div>

        {/* Missing Card */}
        <div className="kpi-card kpi-status-danger" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Missing Shifts</span>
            <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{metrics.missing}</span>
            <span className="kpi-card-label">Shifts needing attention</span>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="filters-card">
        <div className="filters-row">
          <div className="filter-group">
            <label>Start Date</label>
            <input 
              type="date" 
              className="filter-input"
              value={fromDate} 
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input 
              type="date" 
              className="filter-input"
              value={toDate} 
              onChange={(e) => setToDate(e.target.value)}
            />
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
            <label>Shift</label>
            <select 
              className="filter-select"
              value={filterShift} 
              onChange={(e) => setFilterShift(e.target.value)}
            >
              <option value="All">All Shifts</option>
              <option value="AM">AM Shift</option>
              <option value="PM">PM Shift</option>
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

      {/* Table Container */}
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
            <p style={{ color: 'var(--text-muted)' }}>Loading shift data...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
            <HelpCircle size={36} style={{ color: 'var(--text-muted)' }} />
            <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>No Shifts Match the Criteria</span>
            <span className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try relaxing your search parameters.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                  <th style={tableHeaderStyle}>Date</th>
                  <th style={tableHeaderStyle}>Branch</th>
                  <th style={tableHeaderStyle}>Shift</th>
                  <th style={tableHeaderStyle}>Submitted Status</th>
                  <th style={tableHeaderStyle}>Submitted By</th>
                  <th style={tableHeaderStyle}>Submitted Time</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, idx) => (
                  <tr key={`${sub.date}_${sub.branch}_${sub.shift}_${idx}`} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                    <td style={tableCellStyle}>{sub.date}</td>
                    <td style={{ ...tableCellStyle, fontWeight: 600 }}>{sub.branch}</td>
                    <td style={tableCellStyle}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 6px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#475569'
                      }}>
                        {sub.shift}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      {sub.status === 'Submitted' ? (
                        <span style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: 'var(--success)',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-block'
                        }}>
                          Submitted
                        </span>
                      ) : (
                        <span style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: 'var(--danger)',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'inline-block'
                        }}>
                          Missing
                        </span>
                      )}
                    </td>
                    <td style={tableCellStyle}>{sub.user || '—'}</td>
                    <td style={tableCellStyle}>{sub.time || '—'}</td>
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
