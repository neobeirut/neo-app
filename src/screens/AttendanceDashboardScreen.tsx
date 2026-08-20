/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import ShiftManagementView from '../components/attendance/ShiftManagementView';
import AttendanceAnalysisView from '../components/attendance/AttendanceAnalysisView';
import PayrollValidationScreen from '../components/attendance/PayrollValidationScreen';
import AttendanceReportsView from '../components/attendance/AttendanceReportsView';
import LeaveRequestsView from '../components/attendance/LeaveRequestsView';
import LaborIntelligenceView from '../components/attendance/LaborIntelligenceView';
import AuditTooltip from '../components/attendance/AuditTooltip';
import { 
  Loader2, Clock, MapPin, Smartphone, RefreshCw, 
  Trash2, Edit, Plus, Search, CheckCircle, ChevronDown, ChevronUp
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

  const [activeTab, setActiveTab] = useState<'schedule' | 'analysis' | 'payroll' | 'reports' | 'leave' | 'labor_intelligence' | 'active' | 'timesheets' | 'employees'>('schedule');
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
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  // Modals State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});

  // Edit / Add Form State
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formPunchIn, setFormPunchIn] = useState('');
  const [formPunchOut, setFormPunchOut] = useState('');
  const [formPunchInNotes, setFormPunchInNotes] = useState('');
  const [formPunchOutNotes, setFormPunchOutNotes] = useState('');

  // GPS Punch State
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [gpsPunching, setGpsPunching] = useState(false);
  const [gpsEmployeeId, setGpsEmployeeId] = useState('');
  const [gpsTargetBranch, setGpsTargetBranch] = useState('');

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleExecuteGpsPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpsEmployeeId || !gpsTargetBranch) {
      alert('Please select an employee and target branch.');
      return;
    }

    setGpsPunching(true);

    if (!navigator.geolocation) {
      setGpsPunching(false);
      alert('Access Denied: Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        const branchObj = branches.find((b: any) => (typeof b === 'string' ? b : b.name) === gpsTargetBranch);

        if (branchObj && typeof branchObj === 'object' && branchObj.latitude != null && branchObj.longitude != null) {
          const dist = calculateDistance(latitude, longitude, Number(branchObj.latitude), Number(branchObj.longitude));
          const allowedRadius = branchObj.radius_meters || 200;

          if (dist > allowedRadius) {
            setGpsPunching(false);
            alert(`Access Denied: Location verification Failed.\n\nYou are ${Math.round(dist)}m away from ${gpsTargetBranch}. You must be within ${allowedRadius}m of the branch to punch shift.`);
            return;
          }
        }

        const now = new Date().toISOString();
        const activeShift = attendanceLogs.find(l => l.employee_id === gpsEmployeeId && !l.punch_out);

        if (activeShift) {
          const res = await api.saveAttendanceLog({
            id: activeShift.id,
            restaurant_id: user?.restaurant_id || activeShift.restaurant_id,
            employee_id: gpsEmployeeId,
            branch: activeShift.branch,
            punch_in: activeShift.punch_in,
            punch_out: now,
            punch_out_notes: `GPS Verified (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            device_id: activeShift.device_id || 'Web Admin (GPS)'
          });
          if (res.success) {
            alert(`📍 GPS Verified! Punch Out recorded for ${activeShift.branch}.`);
            setShowGpsModal(false);
            loadAttendanceLogs();
          } else {
            alert(`Failed to punch out: ${res.error}`);
          }
        } else {
          const res = await api.saveAttendanceLog({
            restaurant_id: user?.restaurant_id,
            employee_id: gpsEmployeeId,
            branch: gpsTargetBranch,
            punch_in: now,
            punch_in_notes: `GPS Verified (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            device_id: 'Web Admin (GPS)'
          });
          if (res.success) {
            alert(`📍 GPS Verified! Punch In recorded for ${gpsTargetBranch}.`);
            setShowGpsModal(false);
            loadAttendanceLogs();
          } else {
            alert(`Failed to punch in: ${res.error}`);
          }
        }
        setGpsPunching(false);
      },
      (error) => {
        setGpsPunching(false);
        alert(`Access Denied: Location verification Failed (${error.message}). Please allow GPS location permissions in your browser.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [empRes, branchRes] = await Promise.all([
        api.getEmployees(),
        api.getBranchesList()
      ]);
      if (empRes.success) {
        const activeEmps = (empRes.data || []).filter((e: any) => e.status !== 'Inactive' && e.is_active !== false);
        setEmployees(activeEmps);
      }
      if (branchRes.success && branchRes.data) setBranches(branchRes.data);

      await loadAttendanceLogs();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      loadInitialData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMonthYearChange = (month: string, year: string) => {
    setFilterMonth(month);
    setFilterYear(year);

    if (!month) {
      setFilterStartDate('');
      setFilterEndDate('');
      return;
    }

    const firstDay = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
    const lastDayStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    setFilterStartDate(firstDay);
    setFilterEndDate(lastDayStr);
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
    setFilterMonth('');
    setFilterYear(String(new Date().getFullYear()));
    // We fetch logs with cleared params immediately
    api.getAttendanceLogs({}).then(res => {
      if (res.success) setAttendanceLogs(res.data || []);
    });
  };

  // Derived state: active shifts (logs where punch_out is null and employee is active)
  const activeShifts = useMemo(() => {
    return attendanceLogs.filter(log => !log.punch_out && (!log.employees || (log.employees.status !== 'Inactive' && log.employees.is_active !== false)));
  }, [attendanceLogs]);

  // Derived state: grouped timesheets for expandable accordion view
  const groupedTimesheets = useMemo(() => {
    const groups: Record<string, {
      employee: any;
      logs: any[];
      totalContractHours: number;
      totalActualHours: number;
      totalEarnings: number;
    }> = {};

    attendanceLogs.forEach(log => {
      const emp = log.employees;
      if (!emp || emp.status === 'Inactive' || emp.is_active === false) return; // Skip if no employee info or inactive
      const empId = emp.employee_id;
      
      if (!groups[empId]) {
        groups[empId] = {
          employee: emp,
          logs: [],
          totalContractHours: 0,
          totalActualHours: 0,
          totalEarnings: 0
        };
      }

      // Calculate hourly wage for this employee
      const wage = emp.salary_type === 'Hourly' 
        ? (parseFloat(emp.hourly_rate) || 0)
        : (parseFloat(emp.salary) || 0) / ((parseFloat(emp.working_days_per_week) || 6) * 4.333 * (parseFloat(emp.default_daily_hours) || 9));

      const contractHours = parseFloat(emp.default_daily_hours) || 9;
      
      // Calculate actual hours worked for this punch
      const actualHours = log.punch_out
        ? (parseFloat(log.hours_worked) || 0)
        : Math.max(0, Math.round(((new Date().getTime() - new Date(log.punch_in).getTime()) / 3600000) * 100) / 100);

      // Calculate earnings for this punch
      const shiftEarnings = actualHours * wage;

      groups[empId].logs.push({
        ...log,
        computedWage: wage,
        contractHours,
        actualHours,
        shiftEarnings
      });

      groups[empId].totalContractHours += contractHours;
      groups[empId].totalActualHours += actualHours;
      groups[empId].totalEarnings += shiftEarnings;
    });

    // Return as array sorted by employee first name
    return Object.values(groups).sort((a, b) => {
      const nameA = `${a.employee.first_name || ''} ${a.employee.last_name || ''}`.toLowerCase();
      const nameB = `${b.employee.first_name || ''} ${b.employee.last_name || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [attendanceLogs]);

  const toggleEmployeeExpanded = (employeeId: string) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  const toggleAllExpanded = (expand: boolean) => {
    const nextState: Record<string, boolean> = {};
    if (expand) {
      groupedTimesheets.forEach(g => {
        nextState[g.employee.employee_id] = true;
      });
    }
    setExpandedEmployees(nextState);
  };

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

    let finalPunchOutNotes = formPunchOutNotes || null;
    const empName = selectedLog.employees 
      ? `${selectedLog.employees.first_name || ''} ${selectedLog.employees.last_name || ''}` 
      : 'Unknown Employee';

    // Detect manual clock out addition or updates
    if (!selectedLog.punch_out && formPunchOut) {
      const logMsg = `[System] Clock out manually added by ${user.name || 'Manager'} on ${new Date().toLocaleString()}`;
      finalPunchOutNotes = formPunchOutNotes 
        ? `${formPunchOutNotes}\n${logMsg}`
        : logMsg;

      await api.logActivity(
        user.name || 'Manager',
        'Manual Clock Out Added',
        `Added clock out for ${empName} on shift ${selectedLog.id}. Clock out time: ${new Date(formPunchOut).toLocaleString()}`
      );
    } else if (selectedLog.punch_out && formPunchOut && new Date(selectedLog.punch_out).getTime() !== new Date(formPunchOut).getTime()) {
      const logMsg = `[System] Clock out manually updated by ${user.name || 'Manager'} on ${new Date().toLocaleString()}`;
      finalPunchOutNotes = formPunchOutNotes 
        ? `${formPunchOutNotes}\n${logMsg}`
        : logMsg;

      await api.logActivity(
        user.name || 'Manager',
        'Manual Clock Out Updated',
        `Updated clock out for ${empName} on shift ${selectedLog.id} from ${new Date(selectedLog.punch_out).toLocaleString()} to ${new Date(formPunchOut).toLocaleString()}`
      );
    }

    const managerName = user?.name || user?.email || 'Store Manager';
    const auditReason = `Punch timestamp updated by ${managerName} on ${new Date().toLocaleString()}`;

    const updatedLog = {
      id: selectedLog.id,
      branch: formBranch,
      punch_in: new Date(formPunchIn).toISOString(),
      punch_out: formPunchOut ? new Date(formPunchOut).toISOString() : null,
      punch_in_notes: formPunchInNotes || null,
      punch_out_notes: finalPunchOutNotes,
      modified_by: managerName,
      modified_at: new Date().toISOString(),
      modification_reason: auditReason
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

    const logMsg = `[System] Shift manually created by ${user.name || 'Manager'} on ${new Date().toLocaleString()}`;
    const finalPunchInNotes = formPunchInNotes 
      ? `${formPunchInNotes}\n${logMsg}`
      : logMsg;

    let finalPunchOutNotes = formPunchOutNotes || null;
    if (formPunchOut) {
      finalPunchOutNotes = formPunchOutNotes 
        ? `${formPunchOutNotes}\n${logMsg}`
        : logMsg;
    }

    const selectedEmp = employees.find(e => e.employee_id === formEmployeeId);
    const empName = selectedEmp 
      ? `${selectedEmp.first_name || ''} ${selectedEmp.last_name || ''}`
      : 'Unknown Employee';

    const detailsStr = `Manually created shift for ${empName} on branch ${formBranch}. Clock In: ${new Date(formPunchIn).toLocaleString()}${formPunchOut ? `, Clock Out: ${new Date(formPunchOut).toLocaleString()}` : ''}`;

    await api.logActivity(
      user.name || 'Manager',
      'Manual Shift Created',
      detailsStr
    );

    const managerName = user?.name || user?.email || 'Store Manager';

    const newLog = {
      restaurant_id: user?.restaurant_id,
      employee_id: formEmployeeId,
      branch: formBranch,
      punch_in: new Date(formPunchIn).toISOString(),
      punch_out: formPunchOut ? new Date(formPunchOut).toISOString() : null,
      punch_in_notes: finalPunchInNotes,
      punch_out_notes: finalPunchOutNotes,
      device_id: 'Manual Entry',
      modified_by: managerName,
      modified_at: new Date().toISOString(),
      modification_reason: `Manual shift created by ${managerName}`
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
    const activeLogs = attendanceLogs.filter(
      (log) => !log.employees || (log.employees.status !== 'Inactive' && log.employees.is_active !== false)
    );
    const dataToExport = activeLogs.map(log => {
      const emp = log.employees || {};
      const empName = `${emp.first_name || ''} ${emp.last_name || ''}`;

      const wage = emp.salary_type === 'Hourly' 
        ? (parseFloat(emp.hourly_rate) || 0)
        : (parseFloat(emp.salary) || 0) / ((parseFloat(emp.working_days_per_week) || 6) * 4.333 * (parseFloat(emp.default_daily_hours) || 9));

      const contractHours = parseFloat(emp.default_daily_hours) || 9;
      
      const actualHours = log.punch_out
        ? (parseFloat(log.hours_worked) || 0)
        : Math.max(0, Math.round(((new Date().getTime() - new Date(log.punch_in).getTime()) / 3600000) * 100) / 100);

      const shiftEarnings = actualHours * wage;

      return {
        'Employee ID': emp.employee_id || '',
        'Employee Name': empName,
        'Position': emp.position || '',
        'Branch': log.branch || '',
        'Clock In': log.punch_in ? new Date(log.punch_in).toLocaleString() : '',
        'Clock Out': log.punch_out ? new Date(log.punch_out).toLocaleString() : 'Active Shift',
        'Hourly Wage ($/hr)': parseFloat(wage.toFixed(2)),
        'Contract Daily Hours': parseFloat(contractHours.toFixed(2)),
        'Hours Worked (Actual)': parseFloat(actualHours.toFixed(2)),
        'Earnings ($)': parseFloat(shiftEarnings.toFixed(2)),
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
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0 }}>Attendance Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Monitor active shifts, manage employee timesheets, configure hourly rates, and reset phone pairings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button 
            onClick={() => {
              setGpsEmployeeId(user.employee_id || (employees.length > 0 ? employees[0].employee_id : ''));
              setGpsTargetBranch(user.branch && user.branch !== 'All' ? user.branch : 'Badaro');
              setShowGpsModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            <MapPin size={18} /> GPS Verified Punch
          </button>
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
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
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
          onClick={() => setActiveTab('schedule')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'schedule' ? '2px solid var(--primary)' : 'none', color: activeTab === 'schedule' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Shift Planning
        </button>
        <button 
          onClick={() => setActiveTab('analysis')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'analysis' ? '2px solid var(--primary)' : 'none', color: activeTab === 'analysis' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Shift vs Attendance Analysis
        </button>
        <button 
          onClick={() => setActiveTab('payroll')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'payroll' ? '2px solid var(--primary)' : 'none', color: activeTab === 'payroll' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Payroll Validation & Approval
        </button>
        <button 
          onClick={() => setActiveTab('reports')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'reports' ? '2px solid var(--primary)' : 'none', color: activeTab === 'reports' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Reports & Analytics
        </button>
        <button 
          onClick={() => setActiveTab('leave')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'leave' ? '2px solid var(--primary)' : 'none', color: activeTab === 'leave' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Leave Requests
        </button>
        <button 
          onClick={() => setActiveTab('labor_intelligence')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'labor_intelligence' ? '2px solid var(--primary)' : 'none', color: activeTab === 'labor_intelligence' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Labor Intelligence (Cost & Sales)
        </button>
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
          Timesheet Logs ({attendanceLogs.length})
        </button>
        <button 
          onClick={() => setActiveTab('employees')} 
          style={{ ...tabStyle, borderBottom: activeTab === 'employees' ? '2px solid var(--primary)' : 'none', color: activeTab === 'employees' ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          Employee Settings ({employees.length})
        </button>
      </div>

      {/* SHIFT MANAGEMENT VIEW */}
      {activeTab === 'schedule' && (
        <ShiftManagementView
          user={user}
          permissions={permissions}
          employees={employees}
          branches={branches}
        />
      )}

      {/* ATTENDANCE & SHIFT VALIDATION ANALYSIS VIEW */}
      {activeTab === 'analysis' && (
        <AttendanceAnalysisView
          user={user}
          permissions={permissions}
          employees={employees}
          branches={branches}
        />
      )}

      {/* PAYROLL VALIDATION REVIEW & PERIOD LOCKING VIEW */}
      {activeTab === 'payroll' && (
        <PayrollValidationScreen
          user={user}
          permissions={permissions}
          employees={employees}
          branches={branches}
        />
      )}

      {/* REPORTS CENTER VIEW */}
      {activeTab === 'reports' && (
        <AttendanceReportsView
          user={user}
          permissions={permissions}
          employees={employees}
          branches={branches}
        />
      )}

      {/* EMPLOYEE LEAVE REQUESTS VIEW */}
      {activeTab === 'leave' && (
        <LeaveRequestsView
          user={user}
          employees={employees}
        />
      )}

      {/* LABOR COST FORECASTING & LABOR % VS SALES INTELLIGENCE VIEW */}
      {activeTab === 'labor_intelligence' && (
        <LaborIntelligenceView
          user={user}
          employees={employees}
          branches={branches}
        />
      )}

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
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={filterLabelStyle}>Month</label>
            <select 
              style={filterInputStyle} 
              value={filterMonth} 
              onChange={e => handleMonthYearChange(e.target.value, filterYear)}
            >
              <option value="">Custom / Date Range...</option>
              <option value="01">January</option>
              <option value="02">February</option>
              <option value="03">March</option>
              <option value="04">April</option>
              <option value="05">May</option>
              <option value="06">June</option>
              <option value="07">July</option>
              <option value="08">August</option>
              <option value="09">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>
          <div style={{ width: '100px' }}>
            <label style={filterLabelStyle}>Year</label>
            <select 
              style={filterInputStyle} 
              value={filterYear} 
              onChange={e => handleMonthYearChange(filterMonth, e.target.value)}
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
          <div style={{ width: '140px' }}>
            <label style={filterLabelStyle}>Start Date</label>
            <input 
              type="date" 
              style={filterInputStyle} 
              value={filterStartDate} 
              onChange={e => {
                setFilterStartDate(e.target.value);
                setFilterMonth('');
              }} 
            />
          </div>
          <div style={{ width: '140px' }}>
            <label style={filterLabelStyle}>End Date</label>
            <input 
              type="date" 
              style={filterInputStyle} 
              value={filterEndDate} 
              onChange={e => {
                setFilterEndDate(e.target.value);
                setFilterMonth('');
              }} 
            />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Showing {groupedTimesheets.length} employee{groupedTimesheets.length !== 1 ? 's' : ''} with punch records.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                onClick={() => toggleAllExpanded(true)}
                style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Expand All
              </button>
              <button 
                type="button" 
                onClick={() => toggleAllExpanded(false)}
                style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Grouped Accordion List */}
          {groupedTimesheets.length === 0 ? (
            <div style={emptyCardStyle}>
              <Clock size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>No Records Found</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: '4px 0 0 0' }}>No timesheet records match the selected filters.</p>
            </div>
          ) : (
            groupedTimesheets.map(group => {
              const emp = group.employee;
              const empName = `${emp.first_name || ''} ${emp.last_name || ''}`;
              const isExpanded = !!expandedEmployees[emp.employee_id];
              const initials = `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`.toUpperCase();

              return (
                <div 
                  key={emp.employee_id} 
                  style={{ 
                    backgroundColor: 'var(--surface)', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border)', 
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    marginBottom: '12px'
                  }}
                >
                  {/* Header Accordion Bar */}
                  <div 
                    onClick={() => toggleEmployeeExpanded(emp.employee_id)}
                    style={{ 
                      padding: '16px 20px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: isExpanded ? '#f8fafc' : 'var(--surface)',
                      borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                      transition: 'background-color 0.2s',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 300px' }}>
                      {isExpanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
                      
                      {/* Initials Badge */}
                      <div style={initialsBadgeStyle}>
                        {initials}
                      </div>

                      <div>
                        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>{empName}</h4>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {emp.position || 'No Position'} • {emp.branch || 'No Branch'}
                        </span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={statBoxStyle}>
                        <span style={statLabelStyle}>Punches</span>
                        <span style={statValueStyle}>{group.logs.length}</span>
                      </div>
                      <div style={statBoxStyle}>
                        <span style={statLabelStyle}>Contract Hours</span>
                        <span style={statValueStyle}>{group.totalContractHours.toFixed(2)} hrs</span>
                      </div>
                      <div style={statBoxStyle}>
                        <span style={statLabelStyle}>Actual Hours</span>
                        <span style={statValueStyle}>{group.totalActualHours.toFixed(2)} hrs</span>
                      </div>
                      <div style={statBoxStyle}>
                        <span style={statLabelStyle}>Actual Earnings</span>
                        <span style={{ ...statValueStyle, color: '#137333', fontWeight: 700 }}>
                          ${group.totalEarnings.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Table Details */}
                  {isExpanded && (
                    <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-muted)', fontWeight: 600 }}>
                            <th style={{ padding: '12px 16px' }}>Employee</th>
                            <th style={{ padding: '12px 16px' }}>Date</th>
                            <th style={{ padding: '12px 16px' }}>Branch</th>
                            <th style={{ padding: '12px 16px' }}>Position</th>
                            <th style={{ padding: '12px 16px' }}>Shift</th>
                            <th style={{ padding: '12px 16px' }}>IN</th>
                            <th style={{ padding: '12px 16px' }}>OUT</th>
                            <th style={{ padding: '12px 16px' }}>Wage</th>
                            <th style={{ padding: '12px 16px' }}>Total (from employee data)</th>
                            <th style={{ padding: '12px 16px' }}>Total (total from In/Out)</th>
                            <th style={{ padding: '12px 16px' }}>Sum</th>
                            <th style={{ padding: '12px 16px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.logs.map(log => {
                            const logDateStr = new Date(log.punch_in).toLocaleDateString();
                            const punchInTimeStr = new Date(log.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const punchOutTimeStr = log.punch_out 
                              ? new Date(log.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '';
                            const punchOutDateStr = log.punch_out
                              ? new Date(log.punch_out).toLocaleDateString()
                              : '';

                            return (
                              <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)' }}>
                                  {empName}
                                  <AuditTooltip log={log} />
                                </td>
                                <td style={{ padding: '12px 16px' }}>{logDateStr}</td>
                                <td style={{ padding: '12px 16px' }}>{log.branch}</td>
                                <td style={{ padding: '12px 16px' }}>{emp.position || '-'}</td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>-</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <div>{punchInTimeStr}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{logDateStr}</div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  {log.punch_out ? (
                                    <>
                                      <div>{punchOutTimeStr}</div>
                                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{punchOutDateStr}</div>
                                    </>
                                  ) : (
                                    (() => {
                                      const isPastDate = new Date(log.punch_in).toDateString() !== new Date().toDateString();
                                      if (isPastDate) {
                                        return (
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); openEditModal(log); }}
                                            style={{
                                              padding: '4px 10px',
                                              backgroundColor: '#fee2e2',
                                              color: '#991b1b',
                                              border: '1px solid #fca5a5',
                                              borderRadius: '6px',
                                              fontSize: '11px',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              transition: 'all 0.2s',
                                              outline: 'none'
                                            }}
                                            title="Missing clock out. Click to add manually."
                                          >
                                            OUT
                                          </button>
                                        );
                                      }
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openEditModal(log); }}
                                          style={{
                                            padding: '4px 10px',
                                            backgroundColor: '#e6f4ea',
                                            color: '#137333',
                                            border: '1px solid #c2e7d9',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            outline: 'none'
                                          }}
                                          title="Employee currently clocked in. Click to edit/clock out."
                                        >
                                          Active
                                        </button>
                                      );
                                    })()
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                                  ${log.computedWage.toFixed(2)}/hr
                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({emp.salary_type})</div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>{log.contractHours.toFixed(2)} hrs</td>
                                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.actualHours.toFixed(2)} hrs</td>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: '#137333' }}>
                                  ${log.shiftEarnings.toFixed(2)}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  {canManage ? (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); openEditModal(log); }} 
                                        style={tableIconBtnStyle}
                                        title="Edit Record"
                                      >
                                        <Edit size={13} />
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id); }} 
                                        style={{ ...tableIconBtnStyle, color: 'var(--danger)' }}
                                        title="Delete Record"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Read Only</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                            <td colSpan={8} style={{ padding: '12px 16px', textAlign: 'right' }}>Total:</td>
                            <td style={{ padding: '12px 16px' }}>{group.totalContractHours.toFixed(2)} hrs</td>
                            <td style={{ padding: '12px 16px' }}>{group.totalActualHours.toFixed(2)} hrs</td>
                            <td style={{ padding: '12px 16px', color: '#137333', fontSize: '14px' }}>${group.totalEarnings.toFixed(2)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
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
                <th style={{ padding: '16px' }}>Wage / Salary Details</th>
                <th style={{ padding: '16px' }}>Pairing Status</th>
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
                  const computedWage = emp.salary_type === 'Hourly' 
                    ? (parseFloat(emp.hourly_rate) || 0)
                    : (parseFloat(emp.salary) || 0) / ((parseFloat(emp.working_days_per_week) || 6) * 4.333 * (parseFloat(emp.default_daily_hours) || 9));

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
                      <td style={{ padding: '16px', color: 'var(--text-main)' }}>
                        {emp.salary_type === 'Hourly' ? (
                          <div style={{ fontWeight: 600 }}>${(parseFloat(emp.hourly_rate) || 0).toFixed(2)}/hr</div>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 600 }}>${(parseFloat(emp.salary) || 0).toFixed(2)}/mo</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Equiv: ${computedWage.toFixed(2)}/hr
                            </div>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px' }}>
                        {emp.device_id ? (
                          <span style={{ padding: '4px 8px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                            Active Pairing
                          </span>
                        ) : (
                          <span style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }}>
                            Not Paired (Sync on first punch)
                          </span>
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
                <select 
                  style={{ ...filterInputStyle, backgroundColor: '#f1f5f9' }} 
                  value={formBranch} 
                  onChange={e => setFormBranch(e.target.value)} 
                  required
                  disabled={true}
                >
                  <option value="">Select Branch...</option>
                  {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Branch cannot be changed for existing punch logs.
                </p>
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
                <select 
                  style={{ ...filterInputStyle, backgroundColor: formPunchOut ? '#f1f5f9' : 'white' }} 
                  value={formBranch} 
                  onChange={e => setFormBranch(e.target.value)} 
                  required
                  disabled={!!formPunchOut}
                >
                  <option value="">Select Branch...</option>
                  {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                </select>
                {formPunchOut && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Branch cannot be changed for clocked-out shifts.
                  </p>
                )}
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

      {/* GPS PUNCH MODAL */}
      {showGpsModal && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ padding: '8px', backgroundColor: '#e0f2fe', borderRadius: '8px', color: '#0284c7' }}>
                <MapPin size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>GPS Verified Shift Punch</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Location verification is active. Your GPS position will be checked against branch coordinates.
                </p>
              </div>
            </div>

            <form onSubmit={handleExecuteGpsPunch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={filterLabelStyle}>Select Employee *</label>
                <select style={filterInputStyle} value={gpsEmployeeId} onChange={e => setGpsEmployeeId(e.target.value)} required>
                  <option value="">Choose Employee...</option>
                  {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name} ({e.position})</option>)}
                </select>
              </div>

              <div>
                <label style={filterLabelStyle}>Target Branch Location *</label>
                <select style={filterInputStyle} value={gpsTargetBranch} onChange={e => setGpsTargetBranch(e.target.value)} required>
                  <option value="">Select Branch...</option>
                  {branches.map((b: any) => {
                    const name = typeof b === 'string' ? b : b.name;
                    return <option key={name} value={name}>{name}</option>;
                  })}
                </select>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: '#475569' }}>
                📍 <strong>GPS Check Rule:</strong> When you click <em>Verify GPS & Punch</em>, your browser will request your live position. If your distance is within the branch geofence (200m), the punch will be recorded.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowGpsModal(false)} 
                  disabled={gpsPunching}
                  style={{ padding: '8px 16px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={gpsPunching}
                  style={{ padding: '8px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {gpsPunching ? <Loader2 size={16} className="spin" /> : <MapPin size={16} />}
                  {gpsPunching ? 'Verifying Location...' : 'Verify GPS & Punch'}
                </button>
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

const initialsBadgeStyle = {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: '14px',
  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
};

const statBoxStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'flex-start',
  minWidth: '90px'
};

const statLabelStyle = {
  fontSize: '10px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  marginBottom: '2px'
};

const statValueStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--text-main)'
};
