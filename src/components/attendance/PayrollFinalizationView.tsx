/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import {
  DollarSign, Building, User, Search, Download, Lock, CheckCircle2,
  Loader2, Sliders, Eye
} from 'lucide-react';
import { reconcileSchedulesAndPunches } from '../../utils/attendanceAnalysis';
import { computePayrollFromAnalysis } from '../../utils/payrollCalculation';
import type { CalculatedPayrollItem } from '../../utils/payrollCalculation';
import EmployeePayslipModal from './EmployeePayslipModal';

interface PayrollFinalizationViewProps {
  user?: any;
  permissions?: any;
  employees: any[];
  branches: any[];
}

export default function PayrollFinalizationView({
  user,
  permissions: _permissions,
  employees,
  branches
}: PayrollFinalizationViewProps) {
  // Pay Period state
  const [periodName, setPeriodName] = useState('July 2026 Payroll');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  });

  // Filters & Settings
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterEmployee, setFilterEmployee] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.5);

  // Raw data from DB
  const [schedules, setSchedules] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [savedPeriods, setSavedPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);

  // Payslip Modal state
  const [selectedPayslipItem, setSelectedPayslipItem] = useState<CalculatedPayrollItem | null>(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, filterBranch]);

  const loadData = async () => {
    setLoading(true);
    const [schedRes, attRes, periodRes] = await Promise.all([
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
      }),
      api.getPayrollPeriods(filterBranch)
    ]);

    if (schedRes.success) setSchedules(schedRes.data || []);
    if (attRes.success) setAttendanceLogs(attRes.data || []);
    if (periodRes.success) {
      setSavedPeriods(periodRes.data || []);
      const existing = (periodRes.data || []).find((p: any) => p.start_date === startDate && p.end_date === endDate);
      setSelectedPeriod(existing || null);
    }
    setLoading(false);
  };

  // Reconciled Analysis Records
  const reconciledRecords = useMemo(() => {
    return reconcileSchedulesAndPunches({
      schedules,
      attendanceLogs,
      employees,
      lateGracePeriodMins: 5
    });
  }, [schedules, attendanceLogs, employees]);

  // Computed Payroll Items
  const calculatedItems = useMemo(() => {
    return computePayrollFromAnalysis({
      reconciledRecords,
      employees,
      overtimeMultiplier
    });
  }, [reconciledRecords, employees, overtimeMultiplier]);

  // Filtered Payroll Items
  const filteredPayrollItems = useMemo(() => {
    return calculatedItems.filter((item) => {
      const name = item.employee_name.toLowerCase();
      const pos = item.position.toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch = !query || name.includes(query) || pos.includes(query) || item.employee_id.toLowerCase().includes(query);
      const matchesBranch = filterBranch === 'All' || item.branch === filterBranch;
      const matchesEmp = filterEmployee === 'All' || item.employee_id === filterEmployee;

      return matchesSearch && matchesBranch && matchesEmp;
    });
  }, [calculatedItems, searchQuery, filterBranch, filterEmployee]);

  // Summary Metrics
  const summaryKPIs = useMemo(() => {
    let totalRegHours = 0;
    let totalOtHours = 0;
    let totalRegPay = 0;
    let totalOtPay = 0;
    let totalDeductions = 0;
    let totalAdditions = 0;
    let totalNetPay = 0;

    filteredPayrollItems.forEach((item) => {
      totalRegHours += item.regular_hours;
      totalOtHours += item.overtime_hours;
      totalRegPay += item.regular_pay;
      totalOtPay += item.overtime_pay;
      totalDeductions += item.deductions;
      totalAdditions += item.allowances + item.bonus;
      totalNetPay += item.final_payroll;
    });

    return {
      totalRegHours: Math.round(totalRegHours * 100) / 100,
      totalOtHours: Math.round(totalOtHours * 100) / 100,
      totalRegPay: Math.round(totalRegPay * 100) / 100,
      totalOtPay: Math.round(totalOtPay * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalAdditions: Math.round(totalAdditions * 100) / 100,
      totalNetPay: Math.round(totalNetPay * 100) / 100
    };
  }, [filteredPayrollItems]);

  // Lock Payroll Handler
  const handleLockPayroll = async () => {
    if (!confirm(`Are you sure you want to approve and LOCK payroll for ${periodName}? Locked periods cannot be retroactively modified.`)) return;

    setLocking(true);
    // 1. Save or update payroll period record
    const periodPayload = {
      id: selectedPeriod?.id,
      period_name: periodName,
      start_date: startDate,
      end_date: endDate,
      branch: filterBranch === 'All' ? null : filterBranch,
      status: 'locked',
      total_regular_hours: summaryKPIs.totalRegHours,
      total_overtime_hours: summaryKPIs.totalOtHours,
      total_net_pay: summaryKPIs.totalNetPay,
      locked_at: new Date().toISOString(),
      locked_by: user?.name || 'Manager'
    };

    const periodRes = await api.savePayrollPeriod(periodPayload);
    if (!periodRes.success) {
      alert(`Error locking payroll: ${periodRes.error}`);
      setLocking(false);
      return;
    }

    // 2. Save items batch
    const periodId = periodRes.data?.id || selectedPeriod?.id;
    if (periodId) {
      const itemsPayload = filteredPayrollItems.map((item) => ({
        payroll_period_id: periodId,
        employee_id: item.employee_id,
        salary_type: item.salary_type,
        base_rate: item.base_rate,
        regular_hours: item.regular_hours,
        regular_pay: item.regular_pay,
        overtime_hours: item.overtime_hours,
        overtime_rate_multiplier: item.overtime_rate_multiplier,
        overtime_pay: item.overtime_pay,
        deductions: item.deductions,
        allowances: item.allowances,
        net_pay: item.final_payroll,
        notes: item.manager_notes
      }));

      await api.saveEmployeePayrollItemsBatch(itemsPayload);
    }

    setLocking(false);
    alert('Payroll period has been successfully LOCKED and APPROVED!');
    await loadData();
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!filteredPayrollItems.length) {
      alert('No payroll items to export.');
      return;
    }

    const headers = [
      'Employee ID', 'Employee Name', 'Position', 'Branch', 'Salary Type',
      'Base Rate', 'Regular Hours', 'Regular Pay', 'Overtime Hours',
      'Overtime Rate Multiplier', 'Overtime Pay', 'Deductions', 'Additions', 'Net Payable Salary'
    ];

    const rows = filteredPayrollItems.map((item) => [
      `"${item.employee_id}"`,
      `"${item.employee_name}"`,
      `"${item.position}"`,
      `"${item.branch}"`,
      `"${item.salary_type}"`,
      item.base_rate,
      item.regular_hours,
      item.regular_pay,
      item.overtime_hours,
      item.overtime_rate_multiplier,
      item.overtime_pay,
      item.deductions,
      item.allowances + item.bonus,
      item.final_payroll
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Payroll_${periodName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`);
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

  const isLocked = selectedPeriod?.status === 'locked';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Top Header Card */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Payroll Calculation & Period Locking</h2>
                {isLocked ? (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> LOCKED & APPROVED
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    DRAFT (UNLOCKED)
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Finalize salary computations, overtime multipliers, deductions, and approve payroll
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={handleExportCSV} style={btnSecondaryStyle}>
              <Download size={15} style={{ color: 'var(--primary)' }} />
              <span>Export Bank CSV</span>
            </button>

            {!isLocked ? (
              <button
                onClick={handleLockPayroll}
                disabled={locking || !filteredPayrollItems.length}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)'
                }}
              >
                {locking ? <Loader2 size={15} className="spin" /> : <Lock size={15} />}
                <span>Approve & Lock Payroll</span>
              </button>
            ) : (
              <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={16} /> Locked by {selectedPeriod?.locked_by || 'Manager'}
              </div>
            )}
          </div>

        </div>

        {/* Toolbar Controls */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          
          {/* Period Name & Date Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {savedPeriods.length > 0 && (
              <select
                onChange={(e) => {
                  const p = savedPeriods.find((sp: any) => sp.id === e.target.value);
                  if (p) {
                    setSelectedPeriod(p);
                    setPeriodName(p.period_name);
                    setStartDate(p.start_date);
                    setEndDate(p.end_date);
                  }
                }}
                value={selectedPeriod?.id || ''}
                style={{ ...inputStyle, fontWeight: 700, backgroundColor: '#eff6ff', color: 'var(--primary)' }}
              >
                <option value="">Select Existing Period...</option>
                {savedPeriods.map((sp: any) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.period_name} ({sp.status.toUpperCase()})
                  </option>
                ))}
              </select>
            )}

            <input
              type="text"
              value={periodName}
              onChange={(e) => setPeriodName(e.target.value)}
              placeholder="Pay Period Name"
              style={{ ...inputStyle, fontWeight: 700, width: '190px' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Filters & Overtime Rate Multiplier Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search staff or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '32px', width: '160px' }}
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
                {employees.map((e: any) => {
                  const empId = e.employee_id || e.id;
                  const fullName = `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.name || empId;
                  return <option key={empId} value={empId}>{fullName}</option>;
                })}
              </select>
            </div>

            {/* Overtime Multiplier Selector */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '0 10px' }} title="Set Overtime Rate Multiplier">
              <Sliders size={14} style={{ color: '#d97706' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400e' }}>OT Multiplier:</span>
              <select
                value={overtimeMultiplier}
                onChange={(e) => setOvertimeMultiplier(parseFloat(e.target.value))}
                style={{ ...inputStyle, border: 'none', backgroundColor: 'transparent', padding: '7px 0', cursor: 'pointer', fontWeight: 700, color: '#b45309' }}
              >
                <option value={1.0}>1.0x (Standard)</option>
                <option value={1.25}>1.25x Rate</option>
                <option value={1.5}>1.5x Rate (Standard Overtime)</option>
                <option value={2.0}>2.0x Double Rate</option>
              </select>
            </div>

          </div>

        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Regular Hours</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>{summaryKPIs.totalRegHours} hrs</div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Overtime Hours</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>{summaryKPIs.totalOtHours} hrs</div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Overtime Pay</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706', marginTop: '4px' }}>${summaryKPIs.totalOtPay.toFixed(2)}</div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Deductions</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}>-${summaryKPIs.totalDeductions.toFixed(2)}</div>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', boxShadow: 'var(--shadow)', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>Total Net Payable Salary</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            ${summaryKPIs.totalNetPay.toFixed(2)}
          </div>
        </div>

      </div>

      {/* Main Payroll Grid Table */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>Employee / Position</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)' }}>Salary Type & Base</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>Reg Hrs / Pay</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>OT Hrs / Pay</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>Deductions</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center' }}>Additions</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--primary)', textAlign: 'right' }}>Net Payable</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-main)', textAlign: 'right' }}>Payslip Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ marginBottom: '8px', color: 'var(--primary)' }} />
                    <p style={{ margin: 0 }}>Computing payroll calculations...</p>
                  </td>
                </tr>
              ) : filteredPayrollItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No payroll data calculated for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredPayrollItems.map((item) => (
                  <tr key={item.employee_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    
                    {/* Employee */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{item.employee_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.position} • {item.branch}</div>
                    </td>

                    {/* Salary Type */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: 'var(--primary)' }}>
                        {item.salary_type} ({item.salary_type === 'Hourly' ? `$${item.base_rate}/h` : `$${item.base_rate}/m`})
                      </span>
                    </td>

                    {/* Reg Hrs / Pay */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                        {item.salary_type === 'Monthly' ? (item.regular_hours > 0 ? `${item.regular_hours} hrs` : 'Base Salary') : `${item.regular_hours} hrs`}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>${item.regular_pay.toFixed(2)}</div>
                    </td>

                    {/* OT Hrs / Pay */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, color: item.overtime_hours > 0 ? '#d97706' : 'var(--text-main)' }}>
                        {item.overtime_hours} hrs
                      </div>
                      <div style={{ fontSize: '11px', color: item.overtime_pay > 0 ? '#d97706' : 'var(--text-muted)' }}>
                        +${item.overtime_pay.toFixed(2)} ({item.overtime_rate_multiplier}x)
                      </div>
                    </td>

                    {/* Deductions */}
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: item.deductions > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                      {item.deductions > 0 ? `-$${item.deductions.toFixed(2)}` : '$0.00'}
                    </td>

                    {/* Additions */}
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: (item.allowances + item.bonus) > 0 ? '#059669' : 'var(--text-muted)' }}>
                      {(item.allowances + item.bonus) > 0 ? `+$${(item.allowances + item.bonus).toFixed(2)}` : '$0.00'}
                    </td>

                    {/* Net Payable */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '14px', color: 'var(--primary)' }}>
                      ${item.final_payroll.toFixed(2)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setSelectedPayslipItem(item);
                          setShowPayslipModal(true);
                        }}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--border)',
                          color: 'var(--text-main)',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={13} style={{ color: 'var(--primary)' }} />
                        <span>Payslip</span>
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Payslip Modal Drawer */}
      <EmployeePayslipModal
        isOpen={showPayslipModal}
        onClose={() => setShowPayslipModal(false)}
        item={selectedPayslipItem}
        periodName={periodName}
      />

    </div>
  );
}
