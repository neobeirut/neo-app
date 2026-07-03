import React, { useState, useEffect } from 'react';
import { Trash2, Download, FileSpreadsheet, RefreshCw, BarChart2, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';

export default function WasteScreen({ user }: { user: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filterBranch, setFilterBranch] = useState(user.role === 'Admin' ? 'All' : user.branch || 'All');
  const [filterSource, setFilterSource] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const sources = ['All', 'Kitchen', 'Bar', 'Retail', 'Supplies'];
  const types = ['All', 'Spoilage', 'Expired', 'Burned/Ruined', 'Spillage', 'Overproduction'];

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filterBranch, filterSource, filterType, startDate, endDate]);

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

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getWasteLogs({
        branch: filterBranch,
        source: filterSource,
      });

      if (res.success && res.data) {
        let filtered = res.data;

        // Filter by Waste Type in memory
        if (filterType !== 'All') {
          filtered = filtered.filter((l: any) => l.waste_type === filterType);
        }

        // Filter by date range in memory
        if (startDate) {
          filtered = filtered.filter((l: any) => new Date(l.date) >= new Date(startDate));
        }
        if (endDate) {
          // Include the entire end day
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          filtered = filtered.filter((l: any) => new Date(l.date) <= endDateTime);
        }

        setLogs(filtered);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error('Error loading waste logs:', e);
      setLogs([]);
    }
    setLoading(false);
  };

  // Helper to generate analytics metrics
  const metrics = React.useMemo(() => {
    const totalIncidents = logs.length;
    
    // Group by source
    const sourceCount: Record<string, number> = {};
    const typeCount: Record<string, number> = {};
    const itemVolume: Record<string, number> = {};
    
    logs.forEach(l => {
      sourceCount[l.waste_source] = (sourceCount[l.waste_source] || 0) + 1;
      typeCount[l.waste_type] = (typeCount[l.waste_type] || 0) + 1;
      itemVolume[l.item_name] = (itemVolume[l.item_name] || 0) + Number(l.quantity || 0);
    });

    // Top Source
    let topSource = 'N/A';
    let maxSourceVal = 0;
    Object.entries(sourceCount).forEach(([k, v]) => {
      if (v > maxSourceVal) {
        maxSourceVal = v;
        topSource = k;
      }
    });

    // Top Reason/Type
    let topType = 'N/A';
    let maxTypeVal = 0;
    Object.entries(typeCount).forEach(([k, v]) => {
      if (v > maxTypeVal) {
        maxTypeVal = v;
        topType = k;
      }
    });

    // Most Wasted Item
    let topItem = 'N/A';
    let maxItemVal = 0;
    Object.entries(itemVolume).forEach(([k, v]) => {
      if (v > maxItemVal) {
        maxItemVal = v;
        topItem = k;
      }
    });

    return {
      totalIncidents,
      topSource: topSource === 'N/A' ? 'N/A' : `${topSource} (${maxSourceVal} logs)`,
      topType: topType === 'N/A' ? 'N/A' : `${topType} (${maxTypeVal} logs)`,
      topItem: topItem === 'N/A' ? 'N/A' : `${topItem} (${maxItemVal.toFixed(1)} units)`
    };
  }, [logs]);

  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert('No data to export.');
      return;
    }

    const header = 'Date,Branch,Department,Source,Type,Item,Quantity,Unit,Notes,Logged By\n';
    const csvRows = logs.map(log => {
      const cleanNotes = (log.reason_notes || '').replace(/"/g, '""'); // Escape double quotes
      return `"${log.date.split('T')[0]}","${log.branch}","${log.department}","${log.waste_source}","${log.waste_type}","${log.item_name}","${log.quantity}","${log.unit}","${cleanNotes}","${log.created_by}"`;
    }).join('\n');

    const csvString = header + csvRows;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const fileName = `Waste_Report_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-title-row">
        <div>
          <h1>Waste Management & Analysis</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Monitor spoilage, expired items, and raw material waste across branches
          </p>
        </div>
        <button 
          onClick={handleExportCSV} 
          className="auth-btn" 
          style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
        >
          <Download size={16} /> Export Report (CSV)
        </button>
      </div>

      {/* Analytics KPI cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Total Incidents</span>
            <div className="kpi-card-icon-wrapper">
              <Trash2 size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{metrics.totalIncidents}</span>
            <span className="kpi-card-label">Logged waste events</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Top Waste Source</span>
            <div className="kpi-card-icon-wrapper">
              <BarChart2 size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value" style={{ fontSize: '18px', fontWeight: 700 }}>{metrics.topSource}</span>
            <span className="kpi-card-label">Highest incident area</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-danger" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Main Waste Reason</span>
            <div className="kpi-card-icon-wrapper">
              <ShieldAlert size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value" style={{ fontSize: '18px', fontWeight: 700 }}>{metrics.topType}</span>
            <span className="kpi-card-label">Most frequent type</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Most Wasted Item</span>
            <div className="kpi-card-icon-wrapper">
              <FileSpreadsheet size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value" style={{ fontSize: '18px', fontWeight: 700 }} title={metrics.topItem}>{metrics.topItem}</span>
            <span className="kpi-card-label">Highest volume item</span>
          </div>
        </div>
      </div>

      {/* Filter Card */}
      <div className="filters-card">
        <div className="filters-row">
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
            <label>Source</label>
            <select 
              className="filter-select"
              value={filterSource} 
              onChange={(e) => setFilterSource(e.target.value)}
            >
              {sources.map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All Sources' : s}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Waste Type</label>
            <select 
              className="filter-select"
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
            >
              {types.map(t => (
                <option key={t} value={t}>{t === 'All' ? 'All Reasons' : t}</option>
              ))}
            </select>
          </div>

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

          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
            <button 
              onClick={() => {
                setFilterBranch(user.role === 'Admin' ? 'All' : user.branch);
                setFilterSource('All');
                setFilterType('All');
                setStartDate('');
                setEndDate('');
              }}
              className="auth-btn"
              style={{ width: 'auto', height: '42px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
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
        overflow: 'hidden'
      }}>
        {loading ? (
          <div className="loading-container">
            <RefreshCw className="animate-spin" size={24} />
            <p>Loading waste log records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state" style={{ margin: '40px' }}>
            <span className="empty-state-title">No logs found</span>
            <span className="empty-state-desc">Try loosening your search filters.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)' }}>
                  <th style={tableHeaderStyle}>Date</th>
                  <th style={tableHeaderStyle}>Branch</th>
                  <th style={tableHeaderStyle}>Department</th>
                  <th style={tableHeaderStyle}>Source</th>
                  <th style={tableHeaderStyle}>Reason</th>
                  <th style={tableHeaderStyle}>Wasted Item</th>
                  <th style={{ ...tableHeaderStyle, textAlign: 'right', padding: '16px' }}>Quantity</th>
                  <th style={tableHeaderStyle}>Logged By</th>
                  <th style={tableHeaderStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                    <td style={tableCellStyle}>{log.date ? log.date.split('T')[0] : 'N/A'}</td>
                    <td style={{ ...tableCellStyle, fontWeight: 600 }}>{log.branch}</td>
                    <td style={tableCellStyle}>{log.department}</td>
                    <td style={tableCellStyle}>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: '#eef2f5',
                        color: 'var(--primary)'
                      }}>
                        {log.waste_source}
                      </span>
                    </td>
                    <td style={tableCellStyle}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: log.waste_type === 'Spoilage' ? 'rgba(253, 126, 20, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                        color: log.waste_type === 'Spoilage' ? '#fd7e14' : 'var(--danger)'
                      }}>
                        {log.waste_type}
                      </span>
                    </td>
                    <td style={{ ...tableCellStyle, fontWeight: 600 }}>{log.item_name}</td>
                    <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>
                      {log.quantity} {log.unit}
                    </td>
                    <td style={tableCellStyle}>{log.created_by}</td>
                    <td style={{ ...tableCellStyle, maxWidth: '300px', whiteSpace: 'normal', fontStyle: 'italic', color: '#6c757d' }}>
                      {log.reason_notes || '—'}
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
  padding: '16px',
  color: 'var(--text-muted)',
  fontWeight: 600,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const tableCellStyle: React.CSSProperties = {
  padding: '16px',
  verticalAlign: 'middle',
  fontSize: '14px',
  color: 'var(--text-main)',
};
