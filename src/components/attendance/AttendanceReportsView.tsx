/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import {
  FileText, Building, User, Search, Download, Printer, RefreshCw, Loader2
} from 'lucide-react';
import { reconcileSchedulesAndPunches } from '../../utils/attendanceAnalysis';
import { computePayrollFromAnalysis } from '../../utils/payrollCalculation';
import { REPORT_TYPES_LIST, generateLaborCostByBranch, generateLaborCostByDepartment } from '../../utils/reportsEngine';
import type { ReportType } from '../../utils/reportsEngine';
import AuditTooltip from './AuditTooltip';

interface AttendanceReportsViewProps {
  user?: any;
  permissions?: any;
  employees: any[];
  branches: any[];
}

export default function AttendanceReportsView({
  user: _user,
  permissions: _permissions,
  employees,
  branches
}: AttendanceReportsViewProps) {
  // Selected Report
  const [activeReport, setActiveReport] = useState<ReportType>('SHIFT_SCHEDULE');

  // Filters State
  const [dateMode, setDateMode] = useState<'today' | 'this_week' | 'last_week' | 'this_month' | 'custom'>('this_month');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const [filterBranch, setFilterBranch] = useState('All');
  const [filterEmployee, setFilterEmployee] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // DB Raw Data
  const [schedules, setSchedules] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate, filterBranch, filterEmployee]);

  const loadReportData = async () => {
    setLoading(true);
    const [schedRes, attRes] = await Promise.all([
      api.getEmployeeSchedules({ startDate, endDate, branch: filterBranch, employee_id: filterEmployee }),
      api.getAttendanceLogs({ startDate: `${startDate}T00:00:00Z`, endDate: `${endDate}T23:59:59Z`, branch: filterBranch, employee_id: filterEmployee })
    ]);

    if (schedRes.success) setSchedules(schedRes.data || []);
    if (attRes.success) setAttendanceLogs(attRes.data || []);
    setLoading(false);
  };

  // Preset Date Range Handler
  const handleDateModeChange = (mode: 'today' | 'this_week' | 'last_week' | 'this_month' | 'custom') => {
    setDateMode(mode);
    const now = new Date();

    if (mode === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (mode === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diff));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setStartDate(mon.toISOString().split('T')[0]);
      setEndDate(sun.toISOString().split('T')[0]);
    } else if (mode === 'last_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const lastMon = new Date(now.setDate(diff));
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      setStartDate(lastMon.toISOString().split('T')[0]);
      setEndDate(lastSun.toISOString().split('T')[0]);
    } else if (mode === 'this_month') {
      const year = now.getFullYear();
      const month = now.getMonth();
      setStartDate(new Date(year, month, 1).toISOString().split('T')[0]);
      setEndDate(new Date(year, month + 1, 0).toISOString().split('T')[0]);
    }
  };

  // Reconciled Datasets
  const reconciledRecords = useMemo(() => {
    return reconcileSchedulesAndPunches({
      schedules,
      attendanceLogs,
      employees,
      lateGracePeriodMins: 5
    });
  }, [schedules, attendanceLogs, employees]);

  const payrollItems = useMemo(() => {
    return computePayrollFromAnalysis({
      reconciledRecords,
      employees,
      overtimeMultiplier: 1.5
    });
  }, [reconciledRecords, employees]);

  const activeMeta = useMemo(() => {
    return REPORT_TYPES_LIST.find((r) => r.id === activeReport) || REPORT_TYPES_LIST[0];
  }, [activeReport]);

  const handlePrint = () => {
    window.print();
  };

  // Unified Employee Lookup Map
  const empLookupMap = useMemo(() => {
    const map = new Map<string, any>();
    (employees || []).forEach((e: any) => {
      if (e.employee_id) map.set(String(e.employee_id), e);
      if (e.id) map.set(String(e.id), e);
    });
    (attendanceLogs || []).forEach((l: any) => {
      if (l.employees) {
        if (l.employees.employee_id) map.set(String(l.employees.employee_id), l.employees);
        if (l.employees.id) map.set(String(l.employees.id), l.employees);
        if (l.employee_id) map.set(String(l.employee_id), l.employees);
      }
    });
    (schedules || []).forEach((s: any) => {
      if (s.employees) {
        if (s.employees.employee_id) map.set(String(s.employees.employee_id), s.employees);
        if (s.employees.id) map.set(String(s.employees.id), s.employees);
        if (s.employee_id) map.set(String(s.employee_id), s.employees);
      }
    });
    return map;
  }, [employees, attendanceLogs, schedules]);

  const getEmployeeDisplayName = (empId: string, empObj?: any) => {
    const emp = empObj || empLookupMap.get(String(empId));
    if (emp) {
      const full = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
      if (full) return full;
      if (emp.name) return emp.name;
      if (emp.full_name) return emp.full_name;
    }
    return empId;
  };

  // Filter Search Logic
  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) return schedules;
    const q = searchQuery.toLowerCase();
    return schedules.filter((s) => {
      const name = getEmployeeDisplayName(s.employee_id, s.employees);
      return (
        name.toLowerCase().includes(q) ||
        (s.position || '').toLowerCase().includes(q) ||
        (s.shift_name || '').toLowerCase().includes(q)
      );
    });
  }, [schedules, searchQuery, empLookupMap]);

  const filteredAttendanceLogs = useMemo(() => {
    if (!searchQuery.trim()) return attendanceLogs;
    const q = searchQuery.toLowerCase();
    return attendanceLogs.filter((l) => {
      const name = getEmployeeDisplayName(l.employee_id, l.employees);
      return (
        name.toLowerCase().includes(q) ||
        (l.branch || '').toLowerCase().includes(q)
      );
    });
  }, [attendanceLogs, searchQuery, empLookupMap]);

  const filteredReconciled = useMemo(() => {
    if (!searchQuery.trim()) return reconciledRecords;
    const q = searchQuery.toLowerCase();
    return reconciledRecords.filter((r) =>
      r.employee_name.toLowerCase().includes(q) ||
      r.position.toLowerCase().includes(q) ||
      r.branch.toLowerCase().includes(q)
    );
  }, [reconciledRecords, searchQuery]);

  const filteredPayrollItems = useMemo(() => {
    if (!searchQuery.trim()) return payrollItems;
    const q = searchQuery.toLowerCase();
    return payrollItems.filter((p) =>
      p.employee_name.toLowerCase().includes(q) ||
      p.position.toLowerCase().includes(q) ||
      p.branch.toLowerCase().includes(q)
    );
  }, [payrollItems, searchQuery]);

  // CSV Export Generator
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeReport === 'SHIFT_SCHEDULE') {
      headers = ['Employee ID', 'Employee Name', 'Position', 'Branch', 'Date', 'Shift Name', 'Start Time', 'End Time', 'Break (mins)', 'Status'];
      rows = filteredSchedules.map((s) => [
        `"${s.employee_id}"`,
        `"${getEmployeeDisplayName(s.employee_id, s.employees)}"`,
        `"${s.position || ''}"`,
        `"${s.branch || ''}"`,
        `"${s.date}"`,
        `"${s.shift_name || ''}"`,
        `"${s.start_time || ''}"`,
        `"${s.end_time || ''}"`,
        s.break_duration_mins || 0,
        `"${s.status || ''}"`
      ]);
    } else if (activeReport === 'ATTENDANCE') {
      headers = ['Log ID', 'Employee ID', 'Employee Name', 'Branch', 'Date', 'Punch In', 'Punch Out', 'Worked Hours', 'Excused Status'];
      rows = filteredAttendanceLogs.map((l) => [
        `"${l.id}"`,
        `"${l.employee_id}"`,
        `"${getEmployeeDisplayName(l.employee_id, l.employees)}"`,
        `"${l.branch || ''}"`,
        `"${l.date || ''}"`,
        `"${l.punch_in ? new Date(l.punch_in).toLocaleString() : ''}"`,
        `"${l.punch_out ? new Date(l.punch_out).toLocaleString() : ''}"`,
        l.punch_in && l.punch_out ? (Math.round(((new Date(l.punch_out).getTime() - new Date(l.punch_in).getTime()) / 3600000) * 100) / 100) : 0,
        `"${l.is_excused ? 'Yes' : 'No'}"`
      ]);
    } else if (activeReport === 'PLANNED_VS_ACTUAL' || activeReport === 'LATE_ARRIVALS' || activeReport === 'ABSENCES' || activeReport === 'MISSING_PUNCHES') {
      headers = ['Employee ID', 'Employee Name', 'Position', 'Branch', 'Date', 'Scheduled Shift', 'Scheduled Hours', 'Punch In', 'Punch Out', 'Actual Hours', 'Variance (hrs)', 'Flags'];
      
      let dataset = filteredReconciled;
      if (activeReport === 'LATE_ARRIVALS') dataset = dataset.filter((r) => r.flags.includes('LATE_ARRIVAL'));
      if (activeReport === 'ABSENCES') dataset = dataset.filter((r) => r.status === 'ABSENT');
      if (activeReport === 'MISSING_PUNCHES') dataset = dataset.filter((r) => r.flags.includes('MISSING_PUNCH'));

      rows = dataset.map((r) => [
        `"${r.employee_id}"`,
        `"${r.employee_name}"`,
        `"${r.position}"`,
        `"${r.branch}"`,
        `"${r.date}"`,
        `"${r.scheduled_shift_name || ''}"`,
        r.scheduled_hours,
        `"${r.actual_punch_in ? new Date(r.actual_punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}"`,
        `"${r.actual_punch_out ? new Date(r.actual_punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}"`,
        r.actual_hours,
        r.variance_hours,
        `"${r.flags.join(', ')}"`
      ]);
    } else if (activeReport === 'LABOR_COST_BRANCH') {
      headers = ['Branch Name', 'Employee Count', 'Total Regular Hours', 'Total Overtime Hours', 'Total Estimated Payroll ($)', 'Total Final Payroll ($)', 'Variance ($)'];
      const branchData = generateLaborCostByBranch(filteredPayrollItems);
      rows = branchData.map((b) => [
        `"${b.group_name}"`, b.employee_count, b.total_regular_hours, b.total_overtime_hours, b.total_estimated_payroll, b.total_final_payroll, b.variance_difference
      ]);
    } else if (activeReport === 'LABOR_COST_DEPARTMENT') {
      headers = ['Department / Position', 'Employee Count', 'Total Regular Hours', 'Total Overtime Hours', 'Total Estimated Payroll ($)', 'Total Final Payroll ($)', 'Variance ($)'];
      const deptData = generateLaborCostByDepartment(filteredPayrollItems);
      rows = deptData.map((d) => [
        `"${d.group_name}"`, d.employee_count, d.total_regular_hours, d.total_overtime_hours, d.total_estimated_payroll, d.total_final_payroll, d.variance_difference
      ]);
    } else {
      // Payroll Reports
      headers = ['Employee ID', 'Employee Name', 'Position', 'Branch', 'Salary Type', 'Base Rate', 'Scheduled Hrs', 'Actual Hrs', 'Unpaid Leave Days', 'Overtime Hrs', 'OT Pay ($)', 'Estimated Payroll ($)', 'Approved Bonus ($)', 'Approved Deductions ($)', 'Final Payroll ($)', 'Manager Notes'];
      rows = filteredPayrollItems.map((p) => [
        `"${p.employee_id}"`, `"${p.employee_name}"`, `"${p.position}"`, `"${p.branch}"`, `"${p.salary_type}"`, p.base_rate, p.scheduled_hours, p.actual_hours, p.unpaid_leave_days, p.overtime_hours, p.overtime_pay, p.estimated_payroll, p.bonus, p.deductions, p.final_payroll, `"${p.manager_notes || ''}"`
      ]);
    }

    if (!rows.length) {
      alert('No data available to export for this report.');
      return;
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeMeta.title.replace(/\s+/g, '_')}_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inputStyle: React.CSSProperties = {
    padding: '7px 12px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    color: 'var(--text-main)',
    outline: 'none'
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', width: '100%', boxSizing: 'border-box' }}>

      {/* Sidebar Selector: 13 Report Types */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0' }}>Reports Center</h3>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>13 Operational & Financial Reports</p>
        </div>

        {['ROSTER', 'ATTENDANCE', 'PAYROLL', 'ANALYTICS'].map((cat) => {
          const categoryReports = REPORT_TYPES_LIST.filter((r) => r.category === cat);
          if (!categoryReports.length) return null;

          return (
            <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '4px' }}>
                {cat} Reports
              </div>

              {categoryReports.map((meta) => {
                const isSelected = activeReport === meta.id;
                return (
                  <button
                    key={meta.id}
                    onClick={() => setActiveReport(meta.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {meta.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Main Report View Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Header Banner & Filters */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <FileText size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>{activeMeta.title}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{activeMeta.description}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={handleExportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                <Download size={15} style={{ color: 'var(--primary)' }} />
                <span>Export CSV / Excel</span>
              </button>

              <button onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                <Printer size={15} />
                <span>Print PDF</span>
              </button>

              <button onClick={loadReportData} style={{ padding: '8px 10px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }} title="Refresh Report Data">
                <RefreshCw size={15} className={loading ? 'spin' : ''} />
              </button>
            </div>

          </div>

          {/* Filter Bar Controls */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            
            {/* Date Presets & Date Inputs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <button onClick={() => handleDateModeChange('today')} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: dateMode === 'today' ? 'var(--surface)' : 'transparent', color: dateMode === 'today' ? 'var(--primary)' : 'var(--text-muted)' }}>Today</button>
                <button onClick={() => handleDateModeChange('this_week')} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: dateMode === 'this_week' ? 'var(--surface)' : 'transparent', color: dateMode === 'this_week' ? 'var(--primary)' : 'var(--text-muted)' }}>This Week</button>
                <button onClick={() => handleDateModeChange('last_week')} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: dateMode === 'last_week' ? 'var(--surface)' : 'transparent', color: dateMode === 'last_week' ? 'var(--primary)' : 'var(--text-muted)' }}>Last Week</button>
                <button onClick={() => handleDateModeChange('this_month')} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', backgroundColor: dateMode === 'this_month' ? 'var(--surface)' : 'transparent', color: dateMode === 'this_month' ? 'var(--primary)' : 'var(--text-muted)' }}>This Month</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDateMode('custom'); }} style={inputStyle} />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
                <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDateMode('custom'); }} style={inputStyle} />
              </div>
            </div>

            {/* Branch & Search Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
                <input type="text" placeholder="Search report..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...inputStyle, paddingLeft: '32px', width: '160px' }} />
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px' }}>
                <Building size={14} style={{ color: 'var(--primary)' }} />
                <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={{ ...inputStyle, border: 'none', padding: '7px 0', cursor: 'pointer', fontWeight: 600 }}>
                  <option value="All">All Branches</option>
                  {branches.map((b: any, idx: number) => {
                    const bName = typeof b === 'string' ? b : b.name;
                    return <option key={idx} value={bName}>{bName}</option>;
                  })}
                </select>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px' }}>
                <User size={14} style={{ color: 'var(--primary)' }} />
                <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} style={{ ...inputStyle, border: 'none', padding: '7px 0', cursor: 'pointer', fontWeight: 600 }}>
                  <option value="All">All Employees</option>
                  {employees.filter((e: any) => e.status !== 'Inactive' && e.is_active !== false).map((e: any) => {
                    const empId = e.employee_id || e.id;
                    const fullName = `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.name || empId;
                    return <option key={empId} value={empId}>{fullName}</option>;
                  })}
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* Report Data Table Grid - Tailored Table per Report Type */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div style={{ overflowX: 'auto' }}>
            
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={28} className="spin" style={{ color: 'var(--primary)', marginBottom: '8px' }} />
                <p style={{ margin: 0 }}>Generating {activeMeta.title} report...</p>
              </div>
            ) : activeReport === 'SHIFT_SCHEDULE' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Employee</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Position / Branch</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Shift Name</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Scheduled Hours</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Break (mins)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map((s, idx) => (
                    <tr key={s.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{getEmployeeDisplayName(s.employee_id, s.employees)}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{s.position} • {s.branch}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{s.date}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>{s.shift_name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{s.start_time} - {s.end_time}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{s.break_duration_mins || 0}m</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', backgroundColor: s.status === 'published' ? '#dcfce7' : '#fffbeb', color: s.status === 'published' ? '#15803d' : '#b45309' }}>
                          {(s.status || 'published').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeReport === 'ATTENDANCE' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Employee</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Branch Location</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Punch In Time</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Punch Out Time</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Worked Duration</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Excused</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendanceLogs.map((l, idx) => {
                    const empName = getEmployeeDisplayName(l.employee_id, l.employees);
                    const durationHrs = l.punch_in && l.punch_out ? Math.round(((new Date(l.punch_out).getTime() - new Date(l.punch_in).getTime()) / 3600000) * 100) / 100 : 0;
                    return (
                      <tr key={l.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {empName}
                          <AuditTooltip log={l} />
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{l.branch || 'Main'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.date}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#059669', fontWeight: 600 }}>{l.punch_in ? new Date(l.punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{l.punch_out ? new Date(l.punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{durationHrs}h</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '8px', backgroundColor: l.is_excused ? '#dcfce7' : '#f1f5f9', color: l.is_excused ? '#15803d' : '#64748b' }}>
                            {l.is_excused ? 'EXCUSED' : 'NORMAL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : activeReport === 'PLANNED_VS_ACTUAL' || activeReport === 'LATE_ARRIVALS' || activeReport === 'ABSENCES' || activeReport === 'MISSING_PUNCHES' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Employee</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Position / Branch</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Scheduled Hrs</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Actual Hrs</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Variance</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Discrepancy Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReconciled
                    .filter((r) => {
                      if (activeReport === 'LATE_ARRIVALS') return r.flags.includes('LATE_ARRIVAL');
                      if (activeReport === 'ABSENCES') return r.status === 'ABSENT';
                      if (activeReport === 'MISSING_PUNCHES') return r.flags.includes('MISSING_PUNCH');
                      return true;
                    })
                    .map((r, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.employee_name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{r.position} • {r.branch}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.date}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>{r.scheduled_hours}h</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{r.actual_hours}h</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: r.variance_hours >= 0 ? '#059669' : '#dc2626' }}>
                          {r.variance_hours >= 0 ? `+${r.variance_hours}h` : `${r.variance_hours}h`}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {r.flags.length > 0 ? (
                            r.flags.map((f, i) => (
                              <span key={i} style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', marginRight: '4px' }}>
                                {f.replace('_', ' ')}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>✓ MATCH</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : activeReport === 'OVERTIME' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Employee</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Position / Branch</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Salary Type</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Base Rate</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Regular Hours</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'center', color: '#d97706' }}>Overtime Hours</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>OT Multiplier</th>
                    <th style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'right', color: '#d97706' }}>Total Overtime Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayrollItems.map((p) => (
                    <tr key={p.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{p.employee_name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{p.position} • {p.branch}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.salary_type}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>${p.base_rate}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.regular_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: '#d97706' }}>{p.overtime_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{p.overtime_rate_multiplier}x</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: '#d97706' }}>+${p.overtime_pay.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeReport === 'PAYROLL_ADJUSTMENTS' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Employee</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Position / Branch</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Approved OT (hrs)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center', color: '#059669' }}>Bonus ($)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center', color: '#dc2626' }}>Deductions ($)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Transport ($)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Commission ($)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Allowances ($)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Tips ($)</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Manager Audit Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayrollItems.map((p) => (
                    <tr key={p.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{p.employee_name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{p.position} • {p.branch}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#b45309' }}>{p.approved_overtime}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>+${p.bonus.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>-${p.deductions.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>${p.transportation.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>${p.commission.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>${p.allowances.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>${p.tips.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{p.manager_notes || 'No manager notes'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeReport === 'LABOR_COST_BRANCH' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Branch Name</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Staff Count</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Regular Hours</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Overtime Hours</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Estimated Payroll</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right', color: 'var(--primary)' }}>Final Approved Payroll</th>
                  </tr>
                </thead>
                <tbody>
                  {generateLaborCostByBranch(filteredPayrollItems).map((b, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{b.group_name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{b.employee_count}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{b.total_regular_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>{b.total_overtime_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>${b.total_estimated_payroll.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>${b.total_final_payroll.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeReport === 'LABOR_COST_DEPARTMENT' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Department / Position</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Staff Count</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Regular Hours</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Overtime Hours</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Estimated Payroll</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right', color: 'var(--primary)' }}>Final Approved Payroll</th>
                  </tr>
                </thead>
                <tbody>
                  {generateLaborCostByDepartment(filteredPayrollItems).map((d, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{d.group_name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{d.employee_count}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{d.total_regular_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>{d.total_overtime_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>${d.total_estimated_payroll.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>${d.total_final_payroll.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              // Default Payroll Summary (ESTIMATED_PAYROLL, FINAL_PAYROLL, MONTHLY_SUMMARY)
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Employee</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Position / Branch</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Sched. Hrs</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Actual Hrs</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>OT Hrs</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Estimated Payroll</th>
                    <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right', color: 'var(--primary)' }}>Final Payroll</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayrollItems.map((p) => (
                    <tr key={p.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{p.employee_name}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{p.position} • {p.branch}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>{p.scheduled_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{p.actual_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>{p.overtime_hours}h</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>${p.estimated_payroll.toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>${p.final_payroll.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
