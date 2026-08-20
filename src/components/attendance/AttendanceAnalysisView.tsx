/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import {
  Clock, Building, User, Search, Download, CheckCircle2,
  RefreshCw, Loader2, Sliders, TrendingUp, TrendingDown
} from 'lucide-react';
import { reconcileSchedulesAndPunches } from '../../utils/attendanceAnalysis';
import type { ReconciliationRecord } from '../../utils/attendanceAnalysis';
import AttendanceAdjustmentModal from './AttendanceAdjustmentModal';
import AuditTooltip from './AuditTooltip';

interface AttendanceAnalysisViewProps {
  user?: any;
  permissions?: any;
  employees: any[];
  branches: any[];
}

export default function AttendanceAnalysisView({
  user,
  permissions: _permissions,
  employees,
  branches
}: AttendanceAnalysisViewProps) {
  // Date Range state (Default to current week)
  const [dateMode, setDateMode] = useState<'this_week' | 'last_week' | 'this_month' | 'custom'>('this_week');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    const sun = new Date(mon.setDate(mon.getDate() + 6));
    return sun.toISOString().split('T')[0];
  });

  // Filters
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterEmployee, setFilterEmployee] = useState('All');
  const [filterFlag, setFilterFlag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Flexible Per-Restaurant Late Grace Period Threshold
  const [lateGracePeriodMins, setLateGracePeriodMins] = useState(5);

  // Data state
  const [schedules, setSchedules] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Adjustment Modal
  const [selectedRecord, setSelectedRecord] = useState<ReconciliationRecord | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);

  useEffect(() => {
    loadAnalysisData();
  }, [startDate, endDate, filterBranch, filterEmployee]);

  const loadAnalysisData = async () => {
    setLoading(true);
    const [schedRes, attRes] = await Promise.all([
      api.getEmployeeSchedules({
        startDate,
        endDate,
        branch: filterBranch,
        employee_id: filterEmployee
      }),
      api.getAttendanceLogs({
        startDate: `${startDate}T00:00:00Z`,
        endDate: `${endDate}T23:59:59Z`,
        branch: filterBranch,
        employee_id: filterEmployee
      })
    ]);

    if (schedRes.success) setSchedules(schedRes.data || []);
    if (attRes.success) setAttendanceLogs(attRes.data || []);
    setLoading(false);
  };

  // Preset Date Range Handler
  const handleDateModeChange = (mode: 'this_week' | 'last_week' | 'this_month' | 'custom') => {
    setDateMode(mode);
    const now = new Date();

    if (mode === 'this_week') {
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
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    }
  };

  // Reconciled Dataset
  const reconciledRecords = useMemo(() => {
    return reconcileSchedulesAndPunches({
      schedules,
      attendanceLogs,
      employees,
      lateGracePeriodMins
    });
  }, [schedules, attendanceLogs, employees, lateGracePeriodMins]);

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return reconciledRecords.filter((rec) => {
      const name = rec.employee_name.toLowerCase();
      const pos = rec.position.toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch = !query || name.includes(query) || pos.includes(query) || rec.employee_id.toLowerCase().includes(query);
      const matchesBranch = filterBranch === 'All' || rec.branch === filterBranch;
      const matchesEmp = filterEmployee === 'All' || rec.employee_id === filterEmployee;

      let matchesFlag = true;
      if (filterFlag === 'DISCREPANCY') matchesFlag = rec.status === 'DISCREPANCY';
      else if (filterFlag === 'ABSENT') matchesFlag = rec.status === 'ABSENT';
      else if (filterFlag === 'UNSCHEDULED') matchesFlag = rec.status === 'UNSCHEDULED';
      else if (filterFlag === 'LATE') matchesFlag = rec.flags.includes('LATE_ARRIVAL');
      else if (filterFlag === 'MISSING') matchesFlag = rec.flags.includes('MISSING_PUNCH');
      else if (filterFlag === 'OVERTIME') matchesFlag = rec.overtime_hours > 0;

      return matchesSearch && matchesBranch && matchesEmp && matchesFlag;
    });
  }, [reconciledRecords, searchQuery, filterBranch, filterEmployee, filterFlag]);

  // Summary Metrics
  const summaryKPIs = useMemo(() => {
    let scheduledTotal = 0;
    let actualTotal = 0;
    let overtimeTotal = 0;
    let discrepancyCount = 0;
    let absenceCount = 0;

    filteredRecords.forEach((rec) => {
      scheduledTotal += rec.scheduled_hours;
      actualTotal += rec.actual_hours;
      overtimeTotal += rec.overtime_hours;
      if (rec.flags.length > 0) discrepancyCount++;
      if (rec.status === 'ABSENT') absenceCount++;
    });

    const varianceTotal = Math.round((actualTotal - scheduledTotal) * 100) / 100;

    return {
      scheduledTotal: Math.round(scheduledTotal * 100) / 100,
      actualTotal: Math.round(actualTotal * 100) / 100,
      varianceTotal,
      overtimeTotal: Math.round(overtimeTotal * 100) / 100,
      discrepancyCount,
      absenceCount
    };
  }, [filteredRecords]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!filteredRecords.length) {
      alert('No analysis records available to export.');
      return;
    }

    const headers = [
      'Employee ID', 'Employee Name', 'Position', 'Branch', 'Date',
      'Scheduled Shift', 'Scheduled Start', 'Scheduled End', 'Scheduled Hours',
      'Punch In', 'Punch Out', 'Actual Hours', 'Hours Variance', 'Overtime Hours',
      'Discrepancy Flags', 'Status'
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.employee_id}"`,
      `"${r.employee_name}"`,
      `"${r.position}"`,
      `"${r.branch}"`,
      `"${r.date}"`,
      `"${r.scheduled_shift_name || ''}"`,
      `"${r.scheduled_start || ''}"`,
      `"${r.scheduled_end || ''}"`,
      r.scheduled_hours,
      `"${r.actual_punch_in ? new Date(r.actual_punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}"`,
      `"${r.actual_punch_out ? new Date(r.actual_punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}"`,
      r.actual_hours,
      r.variance_hours,
      r.overtime_hours,
      `"${r.flags.join(', ')}"`,
      `"${r.status}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_Analysis_${startDate}_to_${endDate}.csv`);
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

  const btnSecondaryStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-main)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Top Bar & Filters */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          {/* Header Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Clock size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Attendance & Shift Validation Analysis</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Reconcile planned shifts vs actual punches, audit variances, and validate payroll
              </p>
            </div>
          </div>

          {/* Export Action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={handleExportCSV} style={btnSecondaryStyle}>
              <Download size={15} style={{ color: 'var(--primary)' }} />
              <span>Export Payroll CSV</span>
            </button>
            <button onClick={loadAnalysisData} style={{ ...btnSecondaryStyle, padding: '8px 10px' }} title="Refresh Data">
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>

        </div>

        {/* Toolbar Controls */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          
          {/* Date Range Switcher & Inputs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <button
                onClick={() => handleDateModeChange('this_week')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: dateMode === 'this_week' ? 'var(--surface)' : 'transparent',
                  color: dateMode === 'this_week' ? 'var(--primary)' : 'var(--text-muted)'
                }}
              >
                This Week
              </button>
              <button
                onClick={() => handleDateModeChange('last_week')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: dateMode === 'last_week' ? 'var(--surface)' : 'transparent',
                  color: dateMode === 'last_week' ? 'var(--primary)' : 'var(--text-muted)'
                }}
              >
                Last Week
              </button>
              <button
                onClick={() => handleDateModeChange('this_month')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: dateMode === 'this_month' ? 'var(--surface)' : 'transparent',
                  color: dateMode === 'this_month' ? 'var(--primary)' : 'var(--text-muted)'
                }}
              >
                This Month
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateMode('custom');
                }}
                style={inputStyle}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateMode('custom');
                }}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Filters & Flexible Late Grace Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search staff or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '32px', width: '170px' }}
              />
            </div>

            {/* Branch Filter */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px' }}>
              <Building size={14} style={{ color: 'var(--primary)' }} />
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                style={{ ...inputStyle, border: 'none', padding: '7px 0', cursor: 'pointer', fontWeight: 600 }}
              >
                <option value="All">All Branches</option>
                {branches.map((b: any, idx: number) => {
                  const bName = typeof b === 'string' ? b : b.name;
                  return <option key={idx} value={bName}>{bName}</option>;
                })}
              </select>
            </div>

            {/* Employee Filter */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px' }}>
              <User size={14} style={{ color: 'var(--primary)' }} />
              <select
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                style={{ ...inputStyle, border: 'none', padding: '7px 0', cursor: 'pointer', fontWeight: 600 }}
              >
                <option value="All">All Employees</option>
                {employees.filter((e: any) => e.status !== 'Inactive' && e.is_active !== false).map((e: any) => {
                  const empId = e.employee_id || e.id;
                  const fullName = `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.name || empId;
                  return <option key={empId} value={empId}>{fullName}</option>;
                })}
              </select>
            </div>

            {/* Discrepancy Flag Filter */}
            <select
              value={filterFlag}
              onChange={(e) => setFilterFlag(e.target.value)}
              style={{ ...inputStyle, fontWeight: 600 }}
            >
              <option value="All">All Discrepancy Statuses</option>
              <option value="DISCREPANCY">Flagged Discrepancies</option>
              <option value="LATE">Late Arrivals</option>
              <option value="MISSING">Missing Punches</option>
              <option value="ABSENT">Absences</option>
              <option value="UNSCHEDULED">Unscheduled Work</option>
              <option value="OVERTIME">Overtime Hours</option>
            </select>

            {/* Flexible Late Grace Period Selector */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '8px', padding: '0 10px' }} title="Set Late Grace Period for this restaurant">
              <Sliders size={14} style={{ color: '#ea580c' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#9a3412' }}>Grace:</span>
              <select
                value={lateGracePeriodMins}
                onChange={(e) => setLateGracePeriodMins(parseInt(e.target.value, 10))}
                style={{ ...inputStyle, border: 'none', backgroundColor: 'transparent', padding: '7px 0', cursor: 'pointer', fontWeight: 700, color: '#c2410c' }}
              >
                <option value={0}>0 mins (Strict)</option>
                <option value={5}>5 mins Grace</option>
                <option value={10}>10 mins Grace</option>
                <option value={15}>15 mins Grace</option>
              </select>
            </div>

          </div>

        </div>
      </div>

      {/* KPI Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Scheduled Hours</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>{summaryKPIs.scheduledTotal} hrs</div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Actual Worked Hours</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>{summaryKPIs.actualTotal} hrs</div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Hours Variance</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: summaryKPIs.varianceTotal >= 0 ? '#059669' : '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {summaryKPIs.varianceTotal >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            <span>{summaryKPIs.varianceTotal > 0 ? `+${summaryKPIs.varianceTotal}` : summaryKPIs.varianceTotal} hrs</span>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Overtime Worked</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>{summaryKPIs.overtimeTotal} hrs</div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Flagged Discrepancies</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: summaryKPIs.discrepancyCount > 0 ? '#ea580c' : '#059669', marginTop: '4px' }}>
            {summaryKPIs.discrepancyCount}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Absences Detected</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: summaryKPIs.absenceCount > 0 ? '#dc2626' : '#059669', marginTop: '4px' }}>
            {summaryKPIs.absenceCount}
          </div>
        </div>

      </div>

      {/* Main Reconciliation Table */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>Employee / Position</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>Date</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>Scheduled Shift</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>Actual Punch In/Out</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>Sched. Hrs</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>Actual Hrs</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>Variance</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>Discrepancy Flags</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ marginBottom: '8px', color: 'var(--primary)' }} />
                    <p style={{ margin: 0 }}>Reconciling schedules and punch logs...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No attendance records match the selected date range and filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const formatPunch = (isoStr: string | null) => {
                    if (!isoStr) return '--:--';
                    const d = new Date(isoStr);
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  };

                  return (
                    <tr key={rec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      
                      {/* Employee Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {rec.employee_name}
                          <AuditTooltip log={rec.raw_punch || {}} />
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{rec.position} • {rec.branch}</div>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {rec.date}
                      </td>

                      {/* Scheduled Shift */}
                      <td style={{ padding: '12px 16px' }}>
                        {rec.scheduled_start ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{rec.scheduled_shift_name || 'Work Shift'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {rec.scheduled_start} - {rec.scheduled_end} (Break {rec.scheduled_break_mins}m)
                            </div>
                          </div>
                        ) : rec.scheduled_shift_name ? (
                          <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#fffbeb', color: '#b45309', fontWeight: 600 }}>
                            {rec.scheduled_shift_name}
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Unscheduled</span>
                        )}
                      </td>

                      {/* Actual Punch */}
                      <td style={{ padding: '12px 16px' }}>
                        {rec.actual_punch_in ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-main)' }}>
                            <Clock size={14} style={{ color: 'var(--primary)' }} />
                            <span>In: {formatPunch(rec.actual_punch_in)}</span>
                            <span>•</span>
                            <span>Out: {formatPunch(rec.actual_punch_out)}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>No Punch Logged</span>
                        )}
                      </td>

                      {/* Sched Hrs */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>{rec.scheduled_hours}h</td>

                      {/* Actual Hrs */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{rec.actual_hours}h</td>

                      {/* Variance */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: rec.variance_hours >= 0 ? '#059669' : '#dc2626' }}>
                        {rec.variance_hours > 0 ? `+${rec.variance_hours}h` : `${rec.variance_hours}h`}
                      </td>

                      {/* Discrepancy Flags */}
                      <td style={{ padding: '12px 16px' }}>
                        {rec.flags.length === 0 ? (
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '10px', backgroundColor: '#d1fae5', color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> On-Time
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {rec.flags.map((flag, fIdx) => {
                              let bg = '#fff7ed';
                              let border = '#ffedd5';
                              let text = '#c2410c';

                              if (flag === 'ABSENCE') {
                                bg = '#fef2f2';
                                border = '#fecaca';
                                text = '#991b1b';
                              } else if (flag === 'LATE_ARRIVAL') {
                                bg = '#fef3c7';
                                border = '#fde68a';
                                text = '#78350f';
                              }

                              return (
                                <span key={fIdx} style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', backgroundColor: bg, border: `1px solid ${border}`, color: text }}>
                                  {flag.replace(/_/g, ' ')}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setSelectedRecord(rec);
                            setShowAdjustmentModal(true);
                          }}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: 'var(--primary)',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Override / Adjust
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Exception Override Modal */}
      <AttendanceAdjustmentModal
        user={user}
        isOpen={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        record={selectedRecord}
        onSaved={loadAnalysisData}
      />

    </div>
  );
}
