import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { 
  Loader2, Clock, MapPin, Smartphone, RefreshCw, 
  Trash2, Edit, Plus, Search, CheckCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AttendanceDashboardScreen({ user, permissions }: { user: any; permissions: any }) {
  const canManage = useMemo(() => {
    return (
      permissions?.can_manage_attendance || 
      user?.role === 'Admin' || 
      user?.role === 'Manager' || 
      user?.role?.toLowerCase() === 'superadmin'
    );
  }, [user, permissions]);

  const [activeTab, setActiveTab] = useState<'active' | 'timesheets' | 'employees'>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data State
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  // Filters State
  const [filterEmployee, setFilterEmployee] = useState('All');
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modals State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit / Add Form State
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formPunchIn, setFormPunchIn] = useState('');
  const [formPunchOut, setFormPunchOut] = useState('');
  const [formPunchInNotes, setFormPunchInNotes] = useState('');
  const [formPunchOutNotes, setFormPunchOutNotes] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [empRes, branchRes] = await Promise.all([
        api.getEmployees(),
        api.getBranchesList()
      ]);
      if (empRes.success) setEmployees(empRes.data || []);
      if (branchRes.success && branchRes.data) setBranches(branchRes.data);

      await loadAttendanceLogs();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadAttendanceLogs = async () => {
    setRefreshing(true);
    const res = await api.getAttendanceLogs({
      employee_id: filterEmployee,
      branch: filterBranch,
      startDate: filterStartDate ? new Date(filterStartDate).toISOString() : undefined,
      endDate: filterEndDate ? new Date(filterEndDate + 'T23:59:59').toISOString() : undefined
    });
    if (res.success) {
      setAttendanceLogs(res.data || []);
    }
    setRefreshing(false);
  };

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    loadAttendanceLogs();
  };

  const handleClearFilters = () => {
    setFilterEmployee('All');
    setFilterBranch('All');
    setFilterStartDate('');
    setFilterEndDate('');
    // We fetch logs with cleared params immediately
    api.getAttendanceLogs({}).then(res => {
      if (res.success) setAttendanceLogs(res.data || []);
    });
  };

  // Derived state: active shifts (logs where punch_out is null)
  const activeShifts = useMemo(() => {
    return attendanceLogs.filter(log => !log.punch_out);
  }, [attendanceLogs]);

  // Derived state: completed timesheets
  const timesheetRecords = useMemo(() => {
    return attendanceLogs.filter(log => log.punch_out);
  }, [attendanceLogs]);

  const handleResetDevice = async (employeeId: string, employeeName: string) => {
    if (!window.confirm(`Are you sure you want to reset the registered device for ${employeeName}? This allows them to link a new phone.`)) return;
    
    const res = await api.resetEmployeeDevice(employeeId);
    if (res.success) {
      alert(`Device reset successfully for ${employeeName}.`);
      // Update employee list state
      setEmployees(prev => prev.map(e => e.employee_id === employeeId ? { ...e, device_id: null } : e));
    } else {
      alert(res.error || 'Failed to reset device.');
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm('Are you sure you want to delete this punch log record? This action cannot be undone.')) return;
    
    const res = await api.deleteAttendanceLog(logId);
    if (res.success) {
      setAttendanceLogs(prev => prev.filter(l => l.id !== logId));
    } else {
      alert(res.error || 'Failed to delete record.');
    }
  };

  const openEditModal = (log: any) => {
    setSelectedLog(log);
    setFormBranch(log.branch || '');
    // Format timestamp for datetime-local input
    setFormPunchIn(log.punch_in ? new Date(log.punch_in).toISOString().slice(0, 16) : '');
    setFormPunchOut(log.punch_out ? new Date(log.punch_out).toISOString().slice(0, 16) : '');
    setFormPunchInNotes(log.punch_in_notes || '');
    setFormPunchOutNotes(log.punch_out_notes || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLog) return;

    const updatedLog = {
      id: selectedLog.id,
      branch: formBranch,
      punch_in: new Date(formPunchIn).toISOString(),
      punch_out: formPunchOut ? new Date(formPunchOut).toISOString() : null,
      punch_in_notes: formPunchInNotes || null,
      punch_out_notes: formPunchOutNotes || null
    };

    const res = await api.saveAttendanceLog(updatedLog);
    if (res.success) {
      setShowEditModal(false);
      loadAttendanceLogs();
    } else {
      alert(res.error || 'Failed to save changes.');
    }
  };

  const openAddModal = () => {
    setFormEmployeeId('');
    setFormBranch('');
    setFormPunchIn(new Date().toISOString().slice(0, 16));
    setFormPunchOut('');
    setFormPunchInNotes('');
    setFormPunchOutNotes('');
    setShowAddModal(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId || !formBranch || !formPunchIn) {
      alert('Employee, Branch, and Clock In time are required.');
      return;
    }

    const newLog = {
      employee_id: formEmployeeId,
      branch: formBranch,
      punch_in: new Date(formPunchIn).toISOString(),
      punch_out: formPunchOut ? new Date(formPunchOut).toISOString() : null,
      punch_in_notes: formPunchInNotes || null,
      punch_out_notes: formPunchOutNotes || null,
      device_id: 'Manual Entry'
    };

    const res = await api.saveAttendanceLog(newLog);
    if (res.success) {
      setShowAddModal(false);
      loadAttendanceLogs();
    } else {
      alert(res.error || 'Failed to add manual record.');
    }
  };

  const exportToExcel = () => {
    const dataToExport = attendanceLogs.map(log => {
      const emp = log.employees || {};
      const empName = `${emp.first_name || ''} ${emp.last_name || ''}`;
      return {
        'Employee ID': emp.employee_id || '',
        'Employee Name': empName,
        'Branch': log.branch || '',
        'Clock In': log.punch_in ? new Date(log.punch_in).toLocaleString() : '',
        'Clock Out': log.punch_out ? new Date(log.punch_out).toLocaleString() : 'Active Shift',
        'Hours Worked': log.hours_worked || 0,
        'Hourly Rate ($)': emp.hourly_rate || 0,
        'Earnings ($)': log.shift_earnings || 0,
        'Clock In Notes': log.punch_in_notes || '',
        'Clock Out Notes': log.punch_out_notes || '',
        'Device ID': log.device_id || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

    // Auto-fit column widths
    const maxLens = dataToExport.reduce((acc: any, row: any) => {
      Object.keys(row).forEach((key) => {
        const valLen = String(row[key] || '').length;
        acc[key] = Math.max(acc[key] || 0, valLen, key.length);
      });
      return acc;
    }, {});
    worksheet['!cols'] = Object.keys(maxLens).map(key => ({ wch: maxLens[key] + 3 }));

    XLSX.writeFile(workbook, `Attendance_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getActiveDuration = (punchInStr: string) => {
    const diff = new Date().getTime() - new Date(punchInStr).getTime();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Loader2 className="spin" size={40} style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0 }}>Attendance Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Monitor active shifts, manage employee timesheets, configure hourly rates, and reset phone pairings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {canManage && (
            <button 
              onClick={openAddModal}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={18} /> Add Manual Log
            </button>
          )}
          <button 
            onClick={exportToExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            Export to Excel
          </button>
          <button 
            onClick={loadAttendanceLogs}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
          >
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px', gap: '8px' }}>
        <button 
          onClick={() => setActiveTab('active')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'active' ? '2px solid var(--primary)' : 'none', color: activeTab === 'active' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Active Shifts ({activeShifts.length})
        </button>
        <button 
          onClick={() => setActiveTab('timesheets')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'timesheets' ? '2px solid var(--primary)' : 'none', color: activeTab === 'timesheets' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Timesheet Logs ({timesheetRecords.length})
        </button>
        <button 
          onClick={() => setActiveTab('employees')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'employees' ? '2px solid var(--primary)' : 'none', color: activeTab === 'employees' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Employee Settings ({employees.length})
        </button>
      </div>

      {/* FILTER BAR (only for timesheets) */}
      {activeTab === 'timesheets' && (
        <form onSubmit={handleFilter} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: 'var(--surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '24px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={filterLabelStyle}>Employee</label>
            <select style={filterInputStyle} value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
              <option value="All">All Employees</option>
              {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={filterLabelStyle}>Branch</label>
            <select style={filterInputStyle} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="All">All Branches</option>
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ width: '150px' }}>
            <label style={filterLabelStyle}>Start Date</label>
            <input type="date" style={filterInputStyle} value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
          </div>
          <div style={{ width: '150px' }}>
            <label style={filterLabelStyle}>End Date</label>
            <input type="date" style={filterInputStyle} value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={16} /> Filter
            </button>
            <button type="button" onClick={handleClearFilters} style={{ padding: '10px 14px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              Clear
            </button>
          </div>
        </form>
      )}

      {/* TAB CONTENT: ACTIVE SHIFTS */}
      {activeTab === 'active' && (
        <div>
          {activeShifts.length === 0 ? (
            <div style={emptyCardStyle}>
              <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>No Active Shifts</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0 0' }}>There are no employees currently clocked in.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
              {activeShifts.map(log => {
                const emp = log.employees || {};
                const empName = `${emp.first_name || ''} ${emp.last_name || ''}`;
                return (
                  <div key={log.id} style={activeCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{empName}</h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>{emp.position} | {emp.department}</p>
                      </div>
                      <span style={{ padding: '4px 10px', backgroundColor: '#e6f4ea', color: '#137333', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', backgroundColor: '#137333', borderRadius: '50%' }}></span> Clocked In
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px', marginBottom: '16px' }}>
                      <div style={cardRowStyle}>
                        <Clock size={16} color="#64748b" />
                        <span style={cardLabelStyle}>Clocked In:</span>
                        <span style={cardValueStyle}>{new Date(log.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(log.punch_in).toLocaleDateString()})</span>
                      </div>
                      <div style={cardRowStyle}>
                        <Clock size={16} color="#64748b" />
                        <span style={cardLabelStyle}>Duration:</span>
                        <span style={{ ...cardValueStyle, fontWeight: 700, color: 'var(--primary)' }}>{getActiveDuration(log.punch_in)}</span>
                      </div>
                      <div style={cardRowStyle}>
                        <MapPin size={16} color="#64748b" />
                        <span style={cardLabelStyle}>Branch Location:</span>
                        <span style={cardValueStyle}>{log.branch}</span>
                      </div>
                      <div style={cardRowStyle}>
                        <Smartphone size={16} color="#64748b" />
                        <span style={cardLabelStyle}>Device Pairing:</span>
                        <span style={{ ...cardValueStyle, fontFamily: 'monospace', fontSize: '12px' }}>{log.device_id ? log.device_id.substring(0, 12) + '...' : 'Unknown'}</span>
                      </div>
                      {emp.salary_type === 'Hourly' && (
                        <div style={{ ...cardRowStyle, backgroundColor: '#f0fdf4', padding: '6px 8px', borderRadius: '6px', marginTop: '4px' }}>
                          <CheckCircle size={16} color="#15803d" />
                          <span style={{ ...cardLabelStyle, color: '#166534' }}>Hourly Rate:</span>
                          <span style={{ ...cardValueStyle, color: '#166534', fontWeight: 600 }}>${emp.hourly_rate}/hr</span>
                        </div>
                      )}
                    </div>

                    {log.punch_in_notes && (
                      <div style={{ backgroundColor: 'var(--background)', padding: '10px', borderRadius: '6px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', borderLeft: '3px solid var(--border)' }}>
                        <strong>Notes:</strong> {log.punch_in_notes}
                      </div>
                    )}

                    {canManage && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => openEditModal(log)}
                          style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600, fontSize: '13px' }}
                        >
                          <Edit size={14} /> Edit / Clock Out
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: TIMESHEET LOGS */}
      {activeTab === 'timesheets' && (
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '16px' }}>Employee</th>
                <th style={{ padding: '16px' }}>Branch</th>
                <th style={{ padding: '16px' }}>Clock In</th>
                <th style={{ padding: '16px' }}>Clock Out</th>
                <th style={{ padding: '16px' }}>Hours</th>
                <th style={{ padding: '16px' }}>Wages</th>
                <th style={{ padding: '16px' }}>Device</th>
                <th style={{ padding: '16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {timesheetRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No completed timesheet records found.
                  </td>
                </tr>
              ) : (
                timesheetRecords.map(log => {
                  const emp = log.employees || {};
                  const empName = `${emp.first_name || ''} ${emp.last_name || ''}`;
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{empName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emp.position}</div>
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-main)' }}>{log.branch}</td>
                      <td style={{ padding: '16px', color: 'var(--text-main)' }}>
                        <div>{new Date(log.punch_in).toLocaleDateString()}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(log.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-main)' }}>
                        <div>{new Date(log.punch_out).toLocaleDateString()}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(log.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td style={{ padding: '16px', fontWeight: 600 }}>{log.hours_worked || 0} hrs</td>
                      <td style={{ padding: '16px' }}>
                        {emp.salary_type === 'Hourly' ? (
                          <span style={{ color: '#137333', fontWeight: 600 }}>${log.shift_earnings || 0}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Salaried ({emp.salary_type})</span>
                        )}
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'monospace' }}>
                        {log.device_id === 'Manual Entry' ? 'Manual Entry' : (log.device_id ? log.device_id.substring(0, 8) + '...' : 'N/A')}
                      </td>
                      <td style={{ padding: '16px' }}>
                        {canManage ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={() => openEditModal(log)} 
                              style={tableIconBtnStyle}
                              title="Edit Record"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteLog(log.id)} 
                              style={{ ...tableIconBtnStyle, color: 'var(--danger)' }}
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Read Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB CONTENT: EMPLOYEE SETTINGS */}
      {activeTab === 'employees' && (
        <div style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-muted)', fontWeight: 600 }}>
                <th style={{ padding: '16px' }}>Employee</th>
                <th style={{ padding: '16px' }}>Salary Type</th>
                <th style={{ padding: '16px' }}>Hourly Rate</th>
                <th style={{ padding: '16px' }}>Device Pairing ID</th>
                <th style={{ padding: '16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No employees found.
                  </td>
                </tr>
              ) : (
                employees.map(emp => {
                  const empName = `${emp.first_name || ''} ${emp.last_name || ''}`;
                  return (
                    <tr key={emp.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{empName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{emp.position} | {emp.branch}</div>
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--text-main)' }}>
                        <span style={{ padding: '4px 8px', backgroundColor: emp.salary_type === 'Hourly' ? '#f0fdf4' : '#f8fafc', color: emp.salary_type === 'Hourly' ? '#166534' : '#475569', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                          {emp.salary_type || 'Monthly'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontWeight: 600, color: emp.salary_type === 'Hourly' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {emp.salary_type === 'Hourly' ? `$${emp.hourly_rate || 0}/hr` : 'N/A'}
                      </td>
                      <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '13px', color: emp.device_id ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {emp.device_id ? (
                          <span style={{ color: '#2563eb', fontWeight: 600 }}>{emp.device_id}</span>
                        ) : (
                          'Not paired (will pair on first punch)'
                        )}
                      </td>
                      <td style={{ padding: '16px' }}>
                        {canManage && emp.device_id && (
                          <button 
                            onClick={() => handleResetDevice(emp.employee_id, empName)}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <RefreshCw size={12} /> Reset Pairing
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && selectedLog && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0' }}>Edit Punch Log</h2>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={filterLabelStyle}>Employee</label>
                <input style={{ ...filterInputStyle, backgroundColor: '#f1f5f9' }} value={`${selectedLog.employees?.first_name} ${selectedLog.employees?.last_name}`} disabled />
              </div>
              <div>
                <label style={filterLabelStyle}>Branch *</label>
                <select style={filterInputStyle} value={formBranch} onChange={e => setFormBranch(e.target.value)} required>
                  <option value="">Select Branch...</option>
                  {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={filterLabelStyle}>Clock In Time *</label>
                  <input type="datetime-local" style={filterInputStyle} value={formPunchIn} onChange={e => setFormPunchIn(e.target.value)} required />
                </div>
                <div>
                  <label style={filterLabelStyle}>Clock Out Time</label>
                  <input type="datetime-local" style={filterInputStyle} value={formPunchOut} onChange={e => setFormPunchOut(e.target.value)} />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Leave empty to keep shift active.</p>
                </div>
              </div>
              <div>
                <label style={filterLabelStyle}>Clock In Notes</label>
                <textarea style={{ ...filterInputStyle, height: '60px', fontFamily: 'inherit' }} value={formPunchInNotes} onChange={e => setFormPunchInNotes(e.target.value)} />
              </div>
              <div>
                <label style={filterLabelStyle}>Clock Out Notes</label>
                <textarea style={{ ...filterInputStyle, height: '60px', fontFamily: 'inherit' }} value={formPunchOutNotes} onChange={e => setFormPunchOutNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MODAL */}
      {showAddModal && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 16px 0' }}>Add Manual Punch Log</h2>
            <form onSubmit={handleSaveAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={filterLabelStyle}>Select Employee *</label>
                <select style={filterInputStyle} value={formEmployeeId} onChange={e => setFormEmployeeId(e.target.value)} required>
                  <option value="">Choose Employee...</option>
                  {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name} ({e.position})</option>)}
                </select>
              </div>
              <div>
                <label style={filterLabelStyle}>Branch *</label>
                <select style={filterInputStyle} value={formBranch} onChange={e => setFormBranch(e.target.value)} required>
                  <option value="">Select Branch...</option>
                  {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={filterLabelStyle}>Clock In Time *</label>
                  <input type="datetime-local" style={filterInputStyle} value={formPunchIn} onChange={e => setFormPunchIn(e.target.value)} required />
                </div>
                <div>
                  <label style={filterLabelStyle}>Clock Out Time</label>
                  <input type="datetime-local" style={filterInputStyle} value={formPunchOut} onChange={e => setFormPunchOut(e.target.value)} />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Leave empty to insert as currently active.</p>
                </div>
              </div>
              <div>
                <label style={filterLabelStyle}>Clock In Notes</label>
                <textarea style={{ ...filterInputStyle, height: '60px', fontFamily: 'inherit' }} value={formPunchInNotes} onChange={e => setFormPunchInNotes(e.target.value)} />
              </div>
              <div>
                <label style={filterLabelStyle}>Clock Out Notes</label>
                <textarea style={{ ...filterInputStyle, height: '60px', fontFamily: 'inherit' }} value={formPunchOutNotes} onChange={e => setFormPunchOutNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Add Log</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Styling Constants
const tabStyle = {
  padding: '12px 16px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  outline: 'none',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

const filterLabelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px'
};

const filterInputStyle = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  backgroundColor: 'white'
};

const emptyCardStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
  backgroundColor: 'var(--surface)',
  border: '1px dashed var(--border)',
  borderRadius: '12px',
  textAlign: 'center' as const
};

const activeCardStyle = {
  backgroundColor: 'var(--surface)',
  borderRadius: '12px',
  border: '1px solid var(--border)',
  padding: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  display: 'flex',
  flexDirection: 'column' as const
};

const cardRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px'
};

const cardLabelStyle = {
  color: 'var(--text-muted)',
  fontWeight: 500,
  width: '110px'
};

const cardValueStyle = {
  color: 'var(--text-main)',
  fontWeight: 500,
  flex: 1
};

const tableIconBtnStyle = {
  background: 'none',
  border: '1px solid var(--border)',
  padding: '6px',
  borderRadius: '6px',
  cursor: 'pointer',
  color: '#475569',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center'
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
  maxWidth: '500px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  maxHeight: '90vh',
  overflowY: 'auto' as const
};
