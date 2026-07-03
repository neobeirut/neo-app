import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, FileText, Calendar, Table, X } from 'lucide-react';
import { api } from '../api/client';

interface CanceledItem {
  name: string;
  qty: number;
  price: number | null;
}

interface VoidReceipt {
  id: string;
  branch: string;
  order_type: string | null;
  order_number: string | null;
  table_number: string | null;
  receipt_date: string | null;
  receipt_time: string | null;
  canceled_items: CanceledItem[] | null;
  image_url: string | null;
  reason_comment: string;
  created_by: string | null;
  created_at: string;
}

export default function VoidReceiptsScreen({ user }: { user: any }) {
  const [voids, setVoids] = useState<VoidReceipt[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filterBranch, setFilterBranch] = useState(user.role === 'Admin' ? 'All' : user.branch || 'All');
  const [filterDate, setFilterDate] = useState('');

  // Selected void receipt for modal review
  const [selectedVoid, setSelectedVoid] = useState<VoidReceipt | null>(null);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadVoidLogs();
  }, [filterBranch, filterDate]);

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

  const loadVoidLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getVoidReceipts({
        branch: filterBranch,
        date: filterDate || undefined
      });
      if (res.success && res.data) {
        setVoids(res.data);
      } else {
        setVoids([]);
      }
    } catch (e) {
      console.error('Error loading void logs:', e);
      setVoids([]);
    }
    setLoading(false);
  };

  // KPIs calculations
  const metrics = React.useMemo(() => {
    const totalVoids = voids.length;
    
    let totalCanceledItems = 0;
    const branchCounts: Record<string, number> = {};
    
    voids.forEach(v => {
      // Branch count
      branchCounts[v.branch] = (branchCounts[v.branch] || 0) + 1;
      
      // Items count
      if (Array.isArray(v.canceled_items)) {
        v.canceled_items.forEach(i => {
          totalCanceledItems += (i.qty || 1);
        });
      }
    });

    let topBranch = 'N/A';
    let maxBranchCount = 0;
    Object.entries(branchCounts).forEach(([k, v]) => {
      if (v > maxBranchCount) {
        maxBranchCount = v;
        topBranch = k;
      }
    });

    return {
      totalVoids,
      totalCanceledItems,
      topBranch: topBranch === 'N/A' ? 'N/A' : `${topBranch} (${maxBranchCount} voids)`
    };
  }, [voids]);

  const handleExportCSV = () => {
    if (voids.length === 0) {
      alert('No data to export.');
      return;
    }

    const header = 'Receipt Date,Receipt Time,Branch,Order Type,Order Number,Table Number,Canceled Items Count,Reason,Submitted By,Image URL,Created At\n';
    const csvRows = voids.map(v => {
      const itemsCount = Array.isArray(v.canceled_items) ? v.canceled_items.length : 0;
      const cleanReason = v.reason_comment.replace(/"/g, '""');
      return `"${v.receipt_date || ''}","${v.receipt_time || ''}","${v.branch}","${v.order_type || ''}","${v.order_number || ''}","${v.table_number || ''}","${itemsCount}","${cleanReason}","${v.created_by || ''}","${v.image_url || ''}","${v.created_at}"`;
    }).join('\n');

    const csvString = header + csvRows;
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const fileName = `Void_Receipts_Report_${new Date().toISOString().split('T')[0]}.csv`;
    
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
          <h1>Void Receipts Log Board</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Inspect photographed POS receipt voids scanned and parsed with Gemini AI.
          </p>
        </div>
        <button 
          onClick={handleExportCSV} 
          className="auth-btn" 
          style={{ width: 'auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}
        >
          <Download size={16} /> Export Voids Log (CSV)
        </button>
      </div>

      {/* KPI summaries */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Total Voids</span>
            <div className="kpi-card-icon-wrapper">
              <FileText size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{metrics.totalVoids}</span>
            <span className="kpi-card-label">Uploaded void logs</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Canceled Units</span>
            <div className="kpi-card-icon-wrapper">
              <Table size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value">{metrics.totalCanceledItems}</span>
            <span className="kpi-card-label">Total quantities voided</span>
          </div>
        </div>

        <div className="kpi-card kpi-status-danger" style={{ cursor: 'default' }}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">Highest Void Activity</span>
            <div className="kpi-card-icon-wrapper">
              <Calendar size={20} />
            </div>
          </div>
          <div className="kpi-card-body">
            <span className="kpi-card-value" style={{ fontSize: '18px', fontWeight: 700 }}>{metrics.topBranch}</span>
            <span className="kpi-card-label">Top branch with void submissions</span>
          </div>
        </div>
      </div>

      {/* Filters card */}
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
            <label>Receipt Date</label>
            <input 
              type="date" 
              className="filter-input"
              value={filterDate} 
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
            <button 
              onClick={() => {
                setFilterBranch(user.role === 'Admin' ? 'All' : user.branch);
                setFilterDate('');
              }}
              className="auth-btn"
              style={{ width: 'auto', height: '42px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
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
            <p>Loading void logs...</p>
          </div>
        ) : voids.length === 0 ? (
          <div className="empty-state" style={{ margin: '40px' }}>
            <span className="empty-state-title">No voids recorded</span>
            <span className="empty-state-desc">Try resetting your date/branch filters or capture one via the mobile app.</span>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid var(--border)' }}>
                  <th style={tableHeaderStyle}>Receipt Date & Time</th>
                  <th style={tableHeaderStyle}>Branch</th>
                  <th style={tableHeaderStyle}>Order Type</th>
                  <th style={tableHeaderStyle}>Order Number</th>
                  <th style={tableHeaderStyle}>Table Number</th>
                  <th style={tableHeaderStyle}>Canceled Items</th>
                  <th style={tableHeaderStyle}>Logged By</th>
                  <th style={tableHeaderStyle}>Reason Comment</th>
                  <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Audit Image</th>
                </tr>
              </thead>
              <tbody>
                {voids.map((v) => {
                  const itemString = Array.isArray(v.canceled_items) 
                    ? v.canceled_items.map(i => `${i.name} (x${i.qty})`).join(', ')
                    : 'None';
                  
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                      <td style={tableCellStyle}>
                        <div style={{ fontWeight: 600 }}>{v.receipt_date || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#868e96' }}>{v.receipt_time || ''}</div>
                      </td>
                      <td style={{ ...tableCellStyle, fontWeight: 600 }}>{v.branch}</td>
                      <td style={tableCellStyle}>
                        {v.order_type ? (
                          <span style={{ 
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: v.order_type === 'TABLE' ? 'rgba(0, 123, 255, 0.1)' : v.order_type === 'TAKE AWAY' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(253, 126, 20, 0.1)',
                            color: v.order_type === 'TABLE' ? '#007bff' : v.order_type === 'TAKE AWAY' ? '#28a745' : '#fd7e14'
                          }}>
                            {v.order_type}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={tableCellStyle}>{v.order_number || '—'}</td>
                      <td style={tableCellStyle}>{v.table_number || '—'}</td>
                      <td style={{ ...tableCellStyle, maxWidth: '250px' }}>
                        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={itemString}>
                          {Array.isArray(v.canceled_items) && v.canceled_items.map((item, index) => (
                            <span 
                              key={index} 
                              style={{ 
                                display: 'inline-block',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: 'rgba(23, 162, 184, 0.1)',
                                color: '#17a2b8',
                                marginRight: '4px',
                                marginBottom: '2px'
                              }}
                            >
                              {item.name} ×{item.qty}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={tableCellStyle}>{v.created_by || 'Unknown'}</td>
                      <td style={{ ...tableCellStyle, maxWidth: '250px', whiteSpace: 'normal', color: 'var(--text-muted)' }}>
                        {v.reason_comment}
                      </td>
                      <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                        {v.image_url ? (
                          <button 
                            className="auth-btn"
                            style={{ 
                              width: 'auto', 
                              padding: '6px 12px', 
                              fontSize: '12px', 
                              backgroundColor: '#1e5c4f', 
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px'
                            }}
                            onClick={() => setSelectedVoid(v)}
                          >
                            Verify Scan
                          </button>
                        ) : (
                          <span style={{ color: '#adb5bd', fontSize: '12px' }}>No photo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Review Modal */}
      {selectedVoid && (
        <div style={modalOverlayStyle}>
          <div style={modalContainerStyle}>
            <div style={modalHeaderStyle}>
              <h3>Audit Void Receipt Info</h3>
              <button 
                onClick={() => setSelectedVoid(null)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6c757d' }}
              >
                <X size={24} />
              </button>
            </div>
            
            <div style={modalBodyStyle}>
              {/* Image View */}
              <div style={modalImageContainerStyle}>
                {selectedVoid.image_url ? (
                  <img 
                    src={selectedVoid.image_url} 
                    alt="POS Void Receipt Photograph" 
                    style={{ width: '100%', maxHeight: '450px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #dee2e6' }}
                  />
                ) : (
                  <div style={{ height: '300px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
                    <p style={{ color: '#6c757d' }}>No image uploaded</p>
                  </div>
                )}
              </div>
              
              {/* Parsed Fields Information */}
              <div style={modalDetailsStyle}>
                <h4 style={{ color: '#1e5c4f', borderBottom: '2px solid #e9ecef', paddingBottom: '8px', marginBottom: '12px' }}>
                  Parsed POS Parameters
                </h4>
                
                <div style={detailRowStyle}>
                  <span style={detailLabelStyle}>Branch:</span>
                  <span style={detailValStyle}>{selectedVoid.branch}</span>
                </div>

                <div style={detailRowStyle}>
                  <span style={detailLabelStyle}>Order Type:</span>
                  <span style={detailValStyle}>{selectedVoid.order_type || '—'}</span>
                </div>
                
                <div style={detailRowStyle}>
                  <span style={detailLabelStyle}>Order / Receipt Number:</span>
                  <span style={detailValStyle}>{selectedVoid.order_number || '—'}</span>
                </div>

                <div style={detailRowStyle}>
                  <span style={detailLabelStyle}>Table Number:</span>
                  <span style={detailValStyle}>{selectedVoid.table_number || '—'}</span>
                </div>

                <div style={detailRowStyle}>
                  <span style={detailLabelStyle}>POS Receipt Date:</span>
                  <span style={detailValStyle}>{selectedVoid.receipt_date || '—'}</span>
                </div>

                <div style={detailRowStyle}>
                  <span style={detailLabelStyle}>POS Receipt Time:</span>
                  <span style={detailValStyle}>{selectedVoid.receipt_time || '—'}</span>
                </div>

                <div style={detailRowStyle}>
                  <span style={detailLabelStyle}>Submitted By (Employee):</span>
                  <span style={detailValStyle}>{selectedVoid.created_by || 'Unknown'}</span>
                </div>

                <div style={{ ...detailRowStyle, flexDirection: 'column', alignItems: 'flex-start', marginTop: '12px' }}>
                  <span style={{ ...detailLabelStyle, marginBottom: '4px' }}>Canceled Items & Cost breakdown:</span>
                  <div style={{ width: '100%', backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '10px', border: '1px solid #e9ecef' }}>
                    {Array.isArray(selectedVoid.canceled_items) && selectedVoid.canceled_items.length > 0 ? (
                      selectedVoid.canceled_items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '4px', paddingBottom: '4px', borderBottom: idx < selectedVoid.canceled_items!.length - 1 ? '1px solid #e9ecef' : 'none' }}>
                          <span style={{ fontWeight: 600 }}>{item.name} ×{item.qty}</span>
                          <span style={{ color: '#1e5c4f', fontWeight: 600 }}>
                            {item.price !== null && item.price !== undefined ? `$${item.price.toFixed(2)}` : '—'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '13px', color: '#6c757d' }}>No items parsed</span>
                    )}
                  </div>
                </div>

                <div style={{ ...detailRowStyle, flexDirection: 'column', alignItems: 'flex-start', marginTop: '12px' }}>
                  <span style={{ ...detailLabelStyle, marginBottom: '4px' }}>Submission Comment (Reason):</span>
                  <div style={{ width: '100%', backgroundColor: '#fdf3e2', borderRadius: '8px', padding: '12px', border: '1px solid #fae3c3', fontSize: '13px', fontStyle: 'italic', color: '#855d21' }}>
                    {selectedVoid.reason_comment}
                  </div>
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setSelectedVoid(null)} 
                    className="auth-btn"
                    style={{ width: 'auto', backgroundColor: '#6c757d', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '6px' }}
                  >
                    Close Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  padding: '20px'
};

const modalContainerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '900px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '90vh',
  overflow: 'hidden'
};

const modalHeaderStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #e9ecef',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#f8f9fa'
};

const modalBodyStyle: React.CSSProperties = {
  padding: '20px',
  display: 'flex',
  gap: '20px',
  flexDirection: 'row',
  overflowY: 'auto',
  // Make it wrap nicely on narrow screens
  flexWrap: 'wrap'
};

const modalImageContainerStyle: React.CSSProperties = {
  flex: 1.2,
  minWidth: '320px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  backgroundColor: '#f1f3f5',
  borderRadius: '8px',
  padding: '10px'
};

const modalDetailsStyle: React.CSSProperties = {
  flex: 1,
  minWidth: '320px',
  display: 'flex',
  flexDirection: 'column',
};

const detailRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '8px',
  paddingBottom: '8px',
  borderBottom: '1px solid #f1f3f5',
  fontSize: '14px'
};

const detailLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: '#495057'
};

const detailValStyle: React.CSSProperties = {
  color: 'var(--text-main)',
  fontWeight: 500
};
