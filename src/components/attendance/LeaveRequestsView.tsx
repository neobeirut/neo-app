/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import { 
  Calendar, CheckCircle, XCircle, Clock, Plus, Search,
  Loader2, Check, X
} from 'lucide-react';

interface LeaveRequestsViewProps {
  user?: any;
  employees: any[];
}

export default function LeaveRequestsView({ user, employees }: LeaveRequestsViewProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterEmployee, setFilterEmployee] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formLeaveType, setFormLeaveType] = useState('Vacation');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const [agreeingId, setAgreeingId] = useState<string | null>(null);

  const managerName = user?.name || user?.email || 'Store Manager';
  const currentUserEmpId = user?.employee_id || user?.id || '';
  const currentUserName = user?.name || user?.first_name || 'Staff Member';

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    const res = await api.getLeaveRequests();
    if (res.success) {
      setRequests(res.data || []);
    }
    setLoading(false);
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const d1 = new Date(start);
    const d2 = new Date(end);
    const diff = Math.abs(d2.getTime() - d1.getTime());
    return Math.max(1, Math.ceil(diff / (1000 * 3600 * 24)) + 1);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const endDate = formLeaveType === 'Shift Swap' ? formStartDate : formEndDate;
    if (!formEmployeeId || !formStartDate || !endDate) {
      alert('Employee and Target Date are required.');
      return;
    }

    setSubmitting(true);
    const totalDays = calculateDays(formStartDate, endDate);

    const payload = {
      employee_id: formEmployeeId,
      leave_type: formLeaveType,
      start_date: formStartDate,
      end_date: endDate,
      total_days: totalDays,
      reason: formReason.trim() || undefined
    };

    const res = await api.createLeaveRequest(payload);
    setSubmitting(false);

    if (res.success) {
      setShowAddModal(false);
      setFormEmployeeId('');
      setFormReason('');
      loadRequests();
    } else {
      alert(res.error || 'Failed to submit leave request.');
    }
  };

  const handlePeerAgree = async (req: any) => {
    if (!confirm(`Are you sure you want to agree to swap shift with employee ${req.employee_id} on ${req.start_date}?`)) return;
    setAgreeingId(req.id);
    const peerId = currentUserEmpId || 'peer_user';
    const peerName = currentUserName || 'Peer Staff';

    const res = await api.agreeToShiftSwap(req.id, peerId, peerName);
    setAgreeingId(null);

    if (res.success) {
      alert('You have agreed to this shift swap! Manager notification sent for final approval.');
      loadRequests();
    } else {
      alert(res.error || 'Failed to record swap agreement.');
    }
  };

  const handleReviewStatus = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    setReviewing(true);

    const res = await api.updateLeaveRequestStatus(selectedRequest.id, status, managerName, reviewNotes);
    setReviewing(false);

    if (res.success) {
      setSelectedRequest(null);
      setReviewNotes('');
      loadRequests();
    } else {
      alert(res.error || 'Failed to update request status.');
    }
  };

  // Filtered & Enriched Requests
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const emp = employees.find(e => e.employee_id === req.employee_id);
      if (!emp || emp.status === 'Inactive' || emp.is_active === false) return false;
      const empName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
      const matchesSearch = !searchQuery || empName.includes(searchQuery.toLowerCase()) || req.leave_type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'All' || req.status === filterStatus;
      const matchesEmp = filterEmployee === 'All' || req.employee_id === filterEmployee;

      return matchesSearch && matchesStatus && matchesEmp;
    });
  }, [requests, employees, searchQuery, filterStatus, filterEmployee]);

  const kpis = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let total = 0;
    requests.forEach(r => {
      const emp = employees.find(e => e.employee_id === r.employee_id);
      if (!emp || emp.status === 'Inactive' || emp.is_active === false) return;
      total++;
      if (r.status === 'pending' || r.status === 'pending_peer' || r.status === 'pending_manager') pending++;
      else if (r.status === 'approved') approved++;
      else if (r.status === 'rejected') rejected++;
    });
    return { pending, approved, rejected, total };
  }, [requests, employees]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>APPROVED</span>;
      case 'rejected':
        return <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>REJECTED</span>;
      case 'pending_peer':
        return <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>WAITING PEER AGREE</span>;
      case 'pending_manager':
        return <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' }}>PENDING MANAGER</span>;
      default:
        return <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>PENDING REVIEW</span>;
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    switch (type) {
      case 'Vacation': return '#0284c7';
      case 'Sick Leave': return '#e11d48';
      case 'Unpaid': return '#6b7280';
      case 'Shift Swap': return '#8b5cf6';
      default: return '#7c3aed';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* KPI Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Pending Approvals</span>
            <Clock size={20} style={{ color: '#b45309' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#b45309', marginTop: '8px' }}>{kpis.pending}</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Approved Leaves</span>
            <CheckCircle size={20} style={{ color: '#15803d' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#15803d', marginTop: '8px' }}>{kpis.approved}</div>
        </div>

        <div style={kpiCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Rejected Requests</span>
            <XCircle size={20} style={{ color: '#b91c1c' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#b91c1c', marginTop: '8px' }}>{kpis.rejected}</div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search employee or type..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              style={{ ...inputStyle, paddingLeft: '36px' }} 
            />
          </div>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
            <option value="All">All Statuses</option>
            <option value="pending">Pending Only</option>
            <option value="pending_peer">Waiting Peer Agree</option>
            <option value="pending_manager">Pending Manager</option>
            <option value="approved">Approved Only</option>
            <option value="rejected">Rejected Only</option>
          </select>

          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} style={inputStyle}>
            <option value="All">All Staff Members</option>
            {employees.filter(e => e.status !== 'Inactive' && e.is_active !== false).map(e => <option key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</option>)}
          </select>
        </div>

        <button 
          onClick={() => setShowAddModal(true)} 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={18} /> New Request
        </button>
      </div>

      {/* Requests Data Table */}
      <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--primary)', marginBottom: '8px' }} />
            <p style={{ margin: 0 }}>Loading leave requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Calendar size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main)' }}>No Leave Requests Found</h3>
            <p style={{ fontSize: '13px', margin: '4px 0 0 0' }}>No leave applications match the selected criteria.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '14px 16px' }}>Employee</th>
                <th style={{ padding: '14px 16px' }}>Request Type</th>
                <th style={{ padding: '14px 16px' }}>Duration / Date</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Total Days</th>
                <th style={{ padding: '14px 16px' }}>Reason / Peer Info</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(req => {
                const emp = employees.find(e => e.employee_id === req.employee_id);
                const empName = emp ? `${emp.first_name || ''} ${emp.last_name || ''}` : req.employee_id;
                const peerEmp = req.peer_employee_id ? employees.find(e => e.employee_id === req.peer_employee_id) : null;
                const peerName = peerEmp ? `${peerEmp.first_name || ''} ${peerEmp.last_name || ''}` : req.peer_employee_id;

                return (
                  <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {empName}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>{emp?.position || 'Staff Member'} ({emp?.branch || 'Main'})</div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: getLeaveTypeBadge(req.leave_type) }}>
                        • {req.leave_type}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                      {req.start_date === req.end_date ? req.start_date : `${req.start_date} to ${req.end_date}`}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700 }}>
                      {req.total_days} {req.total_days === 1 ? 'day' : 'days'}
                    </td>

                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', maxWidth: '240px' }}>
                      {req.reason || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>No reason specified</span>}
                      {peerName && (
                        <div style={{ fontSize: '11px', color: '#4338ca', fontWeight: 600, marginTop: '2px' }}>
                          🤝 Peer: {peerName}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {getStatusBadge(req.status)}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {req.status === 'pending_peer' && req.leave_type === 'Shift Swap' ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => handlePeerAgree(req)}
                            disabled={agreeingId === req.id}
                            style={{ padding: '6px 12px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            {agreeingId === req.id ? <Loader2 size={14} className="spin" /> : '🤝 Agree to Swap'}
                          </button>
                          <button 
                            onClick={() => setSelectedRequest(req)} 
                            style={{ padding: '6px 10px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Review
                          </button>
                        </div>
                      ) : req.status === 'pending' || req.status === 'pending_manager' ? (
                        <button 
                          onClick={() => setSelectedRequest(req)} 
                          style={{ padding: '6px 12px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Review Request
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Reviewed by {req.reviewed_by || 'Manager'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* NEW LEAVE / SHIFT SWAP MODAL */}
      {showAddModal && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0' }}>Submit New Request</h2>
            <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Employee *</label>
                <select value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)} style={inputStyle} required>
                  <option value="">Select Employee...</option>
                  {employees.filter(e => e.status !== 'Inactive' && e.is_active !== false).map(e => <option key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name} ({e.position})</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Request Type *</label>
                <select value={formLeaveType} onChange={e => setFormLeaveType(e.target.value)} style={inputStyle} required>
                  <option value="Vacation">Vacation</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Unpaid">Unpaid Leave</option>
                  <option value="Shift Swap">Shift Swap</option>
                  <option value="Maternity/Paternity">Maternity/Paternity</option>
                  <option value="Emergency">Emergency Leave</option>
                </select>
              </div>

              {formLeaveType === 'Shift Swap' ? (
                <div>
                  <label style={labelStyle}>Shift Date to Swap * (Date Picker)</label>
                  <input 
                    type="date" 
                    value={formStartDate} 
                    onChange={e => {
                      setFormStartDate(e.target.value);
                      setFormEndDate(e.target.value);
                    }} 
                    style={inputStyle} 
                    required 
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Submitting a Shift Swap sends an instant notification to all peer employees in your branch/department.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Start Date * (Date Picker)</label>
                    <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>End Date * (Date Picker)</label>
                    <input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} style={inputStyle} required />
                  </div>
                </div>
              )}

              <div>
                <label style={labelStyle}>Reason / Manager Notes</label>
                <textarea 
                  rows={3} 
                  placeholder={formLeaveType === 'Shift Swap' ? 'Describe the shift you wish to swap (e.g. Morning shift on Friday)...' : 'Enter reason for leave request...'} 
                  value={formReason} 
                  onChange={e => setFormReason(e.target.value)} 
                  style={{ ...inputStyle, resize: 'vertical' }} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting} style={{ padding: '8px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {submitting ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      {selectedRequest && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0' }}>Review Request</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              Approve or Reject request for <strong>{employees.find(e => e.employee_id === selectedRequest.employee_id)?.first_name || selectedRequest.employee_id}</strong>.
            </p>

            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', marginBottom: '16px' }}>
              <div><strong>Type:</strong> {selectedRequest.leave_type}</div>
              <div><strong>Dates:</strong> {selectedRequest.start_date} {selectedRequest.start_date !== selectedRequest.end_date && `to ${selectedRequest.end_date}`} ({selectedRequest.total_days} days)</div>
              {selectedRequest.peer_employee_id && (
                <div style={{ color: '#4338ca', fontWeight: 700, marginTop: '4px' }}>
                  🤝 Agreed Peer Employee: {employees.find(e => e.employee_id === selectedRequest.peer_employee_id)?.first_name || selectedRequest.peer_employee_id}
                </div>
              )}
              {selectedRequest.reason && <div style={{ marginTop: '4px' }}><strong>Reason:</strong> {selectedRequest.reason}</div>}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Review Notes / Manager Comment</label>
              <textarea 
                rows={3} 
                placeholder="Optional manager comments..." 
                value={reviewNotes} 
                onChange={e => setReviewNotes(e.target.value)} 
                style={{ ...inputStyle, resize: 'vertical' }} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setSelectedRequest(null)} disabled={reviewing} style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleReviewStatus('rejected')} disabled={reviewing} style={{ padding: '8px 16px', backgroundColor: '#b91c1c', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <X size={16} /> Reject Request
              </button>
              <button onClick={() => handleReviewStatus('approved')} disabled={reviewing} style={{ padding: '8px 18px', backgroundColor: '#15803d', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={16} /> Approve & Apply to Schedule
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const kpiCardStyle = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '20px',
  boxShadow: 'var(--shadow)'
};

const inputStyle = {
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '13px',
  outline: 'none',
  backgroundColor: 'white'
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '6px'
};

const modalBackdropStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const modalContentStyle = {
  backgroundColor: 'white',
  padding: '24px',
  borderRadius: '12px',
  width: '90%',
  maxWidth: '520px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
};
