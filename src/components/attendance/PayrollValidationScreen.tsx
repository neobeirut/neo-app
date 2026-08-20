/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import {
  DollarSign, Building, User, Search, Download, Lock, Unlock,
  Loader2, Sliders, ShieldCheck, ChevronDown, ChevronUp, FileText, Eye
} from 'lucide-react';
import { reconcileSchedulesAndPunches } from '../../utils/attendanceAnalysis';
import { computePayrollFromAnalysis } from '../../utils/payrollCalculation';
import type { CalculatedPayrollItem } from '../../utils/payrollCalculation';
import EmployeePayslipModal from './EmployeePayslipModal';

interface PayrollValidationScreenProps {
  user?: any;
  permissions?: any;
  employees: any[];
  branches: any[];
}

export default function PayrollValidationScreen({
  user,
  permissions: _permissions,
  employees,
  branches
}: PayrollValidationScreenProps) {
  // Period & Filter State
  const [periodName, setPeriodName] = useState('July 2026 Payroll Review');
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
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.5);

  // DB Data
  const [schedules, setSchedules] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [savedPeriods, setSavedPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Manager Override state per employee (key: employee_id)
  const [adjustments, setAdjustments] = useState<Record<string, {
    approved_hours?: number;
    approved_overtime?: number;
    bonus?: number;
    deductions?: number;
    transportation?: number;
    commission?: number;
    allowances?: number;
    tips?: number;
    final_payroll?: number;
    manager_notes?: string;
  }>>({});

  // Accordion Expand state per employee
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});

  // Payslip Modal state
  const [selectedPayslipItem, setSelectedPayslipItem] = useState<CalculatedPayrollItem | null>(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);

  useEffect(() => {
    loadValidationData();
  }, [startDate, endDate, filterBranch]);

  const loadValidationData = async () => {
    setLoading(true);
    const [schedRes, attRes, periodRes] = await Promise.all([
      api.getEmployeeSchedules({ startDate, endDate, branch: filterBranch, employee_id: filterEmployee }),
      api.getAttendanceLogs({ startDate: `${startDate}T00:00:00Z`, endDate: `${endDate}T23:59:59Z`, branch: filterBranch, employee_id: filterEmployee }),
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

  // Reconciled analysis records
  const reconciledRecords = useMemo(() => {
    return reconcileSchedulesAndPunches({
      schedules,
      attendanceLogs,
      employees,
      lateGracePeriodMins: 5
    });
  }, [schedules, attendanceLogs, employees]);

  // Base calculated payroll items from Flow's auto algorithm
  const baseCalculatedItems = useMemo(() => {
    return computePayrollFromAnalysis({
      reconciledRecords,
      employees,
      overtimeMultiplier
    });
  }, [reconciledRecords, employees, overtimeMultiplier]);

  // Combined Items (System Calculation + Manager Live Adjustments)
  const evaluatedItems = useMemo(() => {
    return baseCalculatedItems.map((item) => {
      const adj = adjustments[item.employee_id] || {};

      const approvedHours = adj.approved_hours !== undefined ? adj.approved_hours : item.approved_hours;
      const approvedOvertime = adj.approved_overtime !== undefined ? adj.approved_overtime : item.approved_overtime;
      const bonus = adj.bonus !== undefined ? adj.bonus : item.bonus;
      const deductions = adj.deductions !== undefined ? adj.deductions : item.deductions;
      const transportation = adj.transportation !== undefined ? adj.transportation : item.transportation;
      const commission = adj.commission !== undefined ? adj.commission : item.commission;
      const allowances = adj.allowances !== undefined ? adj.allowances : item.allowances;
      const tips = adj.tips !== undefined ? adj.tips : item.tips;
      const notes = adj.manager_notes !== undefined ? adj.manager_notes : item.manager_notes;

      // Compute Live Final Payroll based on salary type and adjustments
      let computedFinalPay = 0;
      if (item.salary_type === 'Hourly') {
        const regPay = approvedHours * item.base_rate;
        const otPay = approvedOvertime * (item.base_rate * item.overtime_rate_multiplier);
        computedFinalPay = regPay + otPay + bonus + transportation + commission + allowances + tips - deductions;
      } else {
        // Monthly
        const dailyRate = item.base_rate / 26;
        const hourlyEquivalent = dailyRate / 9;
        const otPay = approvedOvertime * (hourlyEquivalent * item.overtime_rate_multiplier);
        computedFinalPay = item.base_rate + otPay + bonus + transportation + commission + allowances + tips - deductions;
      }

      const finalPay = adj.final_payroll !== undefined ? adj.final_payroll : Math.round(computedFinalPay * 100) / 100;
      const varianceDiff = Math.round((finalPay - item.estimated_payroll) * 100) / 100;

      return {
        ...item,
        approved_hours: approvedHours,
        approved_overtime: approvedOvertime,
        bonus,
        deductions,
        transportation,
        commission,
        allowances,
        tips,
        final_payroll: finalPay,
        variance_difference: varianceDiff,
        manager_notes: notes
      };
    });
  }, [baseCalculatedItems, adjustments]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return evaluatedItems.filter((item) => {
      const name = item.employee_name.toLowerCase();
      const pos = item.position.toLowerCase();
      const query = searchQuery.toLowerCase();

      const matchesSearch = !query || name.includes(query) || pos.includes(query) || item.employee_id.toLowerCase().includes(query);
      const matchesBranch = filterBranch === 'All' || item.branch === filterBranch;
      const matchesEmp = filterEmployee === 'All' || item.employee_id === filterEmployee;

      return matchesSearch && matchesBranch && matchesEmp;
    });
  }, [evaluatedItems, searchQuery, filterBranch, filterEmployee]);

  // Side-by-Side Total Summaries
  const totals = useMemo(() => {
    let estTotal = 0;
    let finalTotal = 0;
    let diffTotal = 0;

    filteredItems.forEach((item) => {
      estTotal += item.estimated_payroll;
      finalTotal += item.final_payroll;
      diffTotal += item.variance_difference;
    });

    return {
      estTotal: Math.round(estTotal * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
      diffTotal: Math.round(diffTotal * 100) / 100
    };
  }, [filteredItems]);

  const handleAdjustmentChange = (empId: string, field: string, val: any) => {
    setAdjustments((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: val
      }
    }));
  };

  const toggleExpand = (empId: string) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  // Phase 5: Approve & Lock Payroll
  const handleApprovePayroll = async () => {
    if (!confirm(`Are you sure you want to approve and LOCK payroll for ${periodName}? Total Final Payable Salary is $${totals.finalTotal.toFixed(2)}.`)) return;

    setSaving(true);
    const periodPayload = {
      id: selectedPeriod?.id,
      period_name: periodName,
      start_date: startDate,
      end_date: endDate,
      branch: filterBranch === 'All' ? null : filterBranch,
      status: 'locked',
      total_estimated_payroll: totals.estTotal,
      total_final_payroll: totals.finalTotal,
      total_variance: totals.diffTotal,
      approved_at: new Date().toISOString(),
      approved_by: user?.name || 'Store Manager'
    };

    const periodRes = await api.savePayrollPeriod(periodPayload);
    if (!periodRes.success) {
      alert(`Error approving payroll: ${periodRes.error}`);
      setSaving(false);
      return;
    }

    const periodId = periodRes.data?.id || selectedPeriod?.id;
    if (periodId) {
      const itemsPayload = filteredItems.map((item) => ({
        payroll_period_id: periodId,
        employee_id: item.employee_id,
        salary_type: item.salary_type,
        base_rate: item.base_rate,
        scheduled_hours: item.scheduled_hours,
        regular_hours: item.regular_hours,
        regular_pay: item.regular_pay,
        worked_days: item.worked_days,
        absent_days: item.absent_days,
        vacation_days: item.vacation_days,
        sick_days: item.sick_days,
        unpaid_leave_days: item.unpaid_leave_days,
        late_count: item.late_count,
        early_out_count: item.early_out_count,
        overtime_hours: item.overtime_hours,
        overtime_rate_multiplier: item.overtime_rate_multiplier,
        overtime_pay: item.overtime_pay,
        estimated_payroll: item.estimated_payroll,
        approved_hours: item.approved_hours,
        approved_overtime: item.approved_overtime,
        bonus: item.bonus,
        deductions: item.deductions,
        transportation: item.transportation,
        commission: item.commission,
        allowances: item.allowances,
        tips: item.tips,
        final_payroll: item.final_payroll,
        variance_difference: item.variance_difference,
        manager_notes: item.manager_notes
      }));

      await api.saveEmployeePayrollItemsBatch(itemsPayload);
    }

    setSaving(false);
    alert('Payroll period successfully APPROVED and LOCKED!');
    await loadValidationData();
  };

  // Save Draft Adjustments
  const handleSaveDraft = async () => {
    setSaving(true);
    const periodPayload = {
      id: selectedPeriod?.id,
      period_name: periodName,
      start_date: startDate,
      end_date: endDate,
      branch: filterBranch === 'All' ? null : filterBranch,
      status: 'draft',
      total_estimated_payroll: totals.estTotal,
      total_final_payroll: totals.finalTotal,
      total_variance: totals.diffTotal
    };

    const periodRes = await api.savePayrollPeriod(periodPayload);
    if (!periodRes.success) {
      alert(`Error saving draft adjustments: ${periodRes.error}`);
      setSaving(false);
      return;
    }

    const periodId = periodRes.data?.id || selectedPeriod?.id;
    if (periodId) {
      const itemsPayload = filteredItems.map((item) => ({
        payroll_period_id: periodId,
        employee_id: item.employee_id,
        salary_type: item.salary_type,
        base_rate: item.base_rate,
        scheduled_hours: item.scheduled_hours,
        regular_hours: item.regular_hours,
        regular_pay: item.regular_pay,
        worked_days: item.worked_days,
        absent_days: item.absent_days,
        vacation_days: item.vacation_days,
        sick_days: item.sick_days,
        unpaid_leave_days: item.unpaid_leave_days,
        late_count: item.late_count,
        early_out_count: item.early_out_count,
        overtime_hours: item.overtime_hours,
        overtime_rate_multiplier: item.overtime_rate_multiplier,
        overtime_pay: item.overtime_pay,
        estimated_payroll: item.estimated_payroll,
        approved_hours: item.approved_hours,
        approved_overtime: item.approved_overtime,
        bonus: item.bonus,
        deductions: item.deductions,
        transportation: item.transportation,
        commission: item.commission,
        allowances: item.allowances,
        tips: item.tips,
        final_payroll: item.final_payroll,
        variance_difference: item.variance_difference,
        manager_notes: item.manager_notes
      }));

      await api.saveEmployeePayrollItemsBatch(itemsPayload);
    }

    setSaving(false);
    alert('Draft payroll adjustments saved successfully!');
    await loadValidationData();
  };

  // Reopen Payroll Period (Admin Only)
  const handleReopenPayroll = async () => {
    if (!selectedPeriod?.id) return;
    if (!confirm('Reopen this locked payroll period for edits?')) return;

    setSaving(true);
    const res = await api.savePayrollPeriod({
      id: selectedPeriod.id,
      status: 'draft',
      approved_at: null,
      approved_by: null
    });
    setSaving(false);

    if (res.success) {
      alert('Payroll period reopened successfully.');
      await loadValidationData();
    } else {
      alert(`Error reopening payroll: ${res.error}`);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredItems.length) {
      alert('No payroll items available to export.');
      return;
    }

    const headers = [
      'Employee ID', 'Employee Name', 'Position', 'Branch', 'Salary Type', 'Base Rate',
      'Scheduled Hours', 'Actual Hours', 'Worked Days', 'Absent Days', 'Vacation Days', 'Sick Days', 'Unpaid Leave Days', 'Late Arrivals', 'Early Departures',
      'Estimated Payroll ($)', 'Approved Hours', 'Approved OT', 'Bonus ($)', 'Deductions ($)', 'Transportation ($)', 'Commission ($)', 'Allowances ($)', 'Tips ($)',
      'Final Payroll ($)', 'Difference ($)', 'Manager Notes'
    ];

    const rows = filteredItems.map((item) => [
      `"${item.employee_id}"`,
      `"${item.employee_name}"`,
      `"${item.position}"`,
      `"${item.branch}"`,
      `"${item.salary_type}"`,
      item.base_rate,
      item.scheduled_hours,
      item.actual_hours,
      item.worked_days,
      item.absent_days,
      item.vacation_days,
      item.sick_days,
      item.unpaid_leave_days,
      item.late_count,
      item.early_out_count,
      item.estimated_payroll,
      item.approved_hours,
      item.approved_overtime,
      item.bonus,
      item.deductions,
      item.transportation,
      item.commission,
      item.allowances,
      item.tips,
      item.final_payroll,
      item.variance_difference,
      `"${item.manager_notes || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Payroll_Validation_${periodName.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px',
    color: 'var(--text-main)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  };

  const isLocked = selectedPeriod?.status === 'locked';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }}>

      {/* Top Header Banner */}
      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', boxShadow: 'var(--shadow)', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803d' }}>
              <DollarSign size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Payroll Validation Review & Approval</h2>
                {isLocked ? (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> APPROVED & LOCKED
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    DRAFT REVIEW
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Review factual attendance summaries, Flow auto calculations, and finalize side-by-side payable salaries
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={handleExportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
              <Download size={15} style={{ color: 'var(--primary)' }} />
              <span>Export CSV</span>
            </button>

            {!isLocked ? (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={saving || !filteredItems.length}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 16px',
                    backgroundColor: '#ffffff',
                    color: 'var(--primary)',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow)'
                  }}
                >
                  {saving ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
                  <span>Save Draft Adjustments</span>
                </button>

                <button
                  onClick={handleApprovePayroll}
                  disabled={saving || !filteredItems.length}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)'
                  }}
                >
                  {saving ? <Loader2 size={15} className="spin" /> : <Lock size={15} />}
                  <span>Approve Payroll</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleReopenPayroll}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Unlock size={14} /> Reopen Payroll (Admin)
              </button>
            )}
          </div>

        </div>

        {/* Toolbar Controls */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          
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
                <option value="">Select Saved Period...</option>
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
              placeholder="Period Name"
              style={{ ...inputStyle, fontWeight: 700, width: '200px' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>to</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px' }}>
              <Building size={14} style={{ color: 'var(--primary)' }} />
              <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={{ ...inputStyle, border: 'none', padding: '6px 0', cursor: 'pointer', fontWeight: 600 }}>
                <option value="All">All Branches</option>
                {branches.map((b: any, idx: number) => {
                  const bName = typeof b === 'string' ? b : b.name;
                  return <option key={idx} value={bName}>{bName}</option>;
                })}
              </select>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0 10px' }}>
              <User size={14} style={{ color: 'var(--primary)' }} />
              <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} style={{ ...inputStyle, border: 'none', padding: '6px 0', cursor: 'pointer', fontWeight: 600 }}>
                <option value="All">All Employees</option>
                {employees.filter((e: any) => e.status !== 'Inactive' && e.is_active !== false).map((e: any) => {
                  const empId = e.employee_id || e.id;
                  const fullName = `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.name || empId;
                  return <option key={empId} value={empId}>{fullName}</option>;
                })}
              </select>
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '0 10px' }}>
              <Sliders size={14} style={{ color: '#d97706' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400e' }}>OT Multiplier:</span>
              <select value={overtimeMultiplier} onChange={(e) => setOvertimeMultiplier(parseFloat(e.target.value))} style={{ ...inputStyle, border: 'none', backgroundColor: 'transparent', padding: '6px 0', cursor: 'pointer', fontWeight: 700, color: '#b45309' }}>
                <option value={1.0}>1.0x Rate</option>
                <option value={1.25}>1.25x Rate</option>
                <option value={1.5}>1.5x Rate (Standard)</option>
                <option value={2.0}>2.0x Double Rate</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* Side-by-Side Dual Display Total KPI Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        
        {/* Estimated Payroll Total */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Estimated Payroll (System Auto)</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#475569', marginTop: '4px' }}>
            ${totals.estTotal.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Automated calculation based on logs</div>
        </div>

        {/* Final Payroll Total */}
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius)', padding: '18px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af' }}>Final Approved Payroll (Manager Approved)</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            ${totals.finalTotal.toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: '#2563eb', marginTop: '4px' }}>Total payable salary after manager review</div>
        </div>

        {/* Net Variance / Difference */}
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Net Variance Difference</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: totals.diffTotal > 0 ? '#059669' : totals.diffTotal < 0 ? '#dc2626' : '#64748b', marginTop: '4px' }}>
            {totals.diffTotal > 0 ? `+$${totals.diffTotal.toFixed(2)}` : `$${totals.diffTotal.toFixed(2)}`}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Final Payroll - Estimated Payroll</div>
        </div>

      </div>

      {/* Main Employee Review List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <Loader2 size={28} className="spin" style={{ color: 'var(--primary)', marginBottom: '8px' }} />
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading employee attendance & payroll review records...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            No employee records match the selected period and branch filters.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isExpanded = !!expandedEmployees[item.employee_id];

            return (
              <div key={item.employee_id} style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                
                {/* Employee Header Bar & Side-by-Side Summary */}
                <div
                  onClick={() => toggleExpand(item.employee_id)}
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    cursor: 'pointer',
                    backgroundColor: isExpanded ? '#f8fafc' : 'transparent',
                    borderBottom: isExpanded ? '1px solid var(--border)' : 'none'
                  }}
                >
                  {/* Left Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>{item.employee_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        ID: {item.employee_id} • {item.position} • {item.branch} • <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.salary_type} (${item.base_rate})</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side-by-Side Comparison */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    
                    {/* Side-by-Side Box */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#f1f5f9', padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>Estimated Payroll</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#475569' }}>${item.estimated_payroll.toFixed(2)}</div>
                      </div>

                      <div style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 300 }}>vs</div>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800, color: '#1e40af' }}>Final Payroll</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>${item.final_payroll.toFixed(2)}</div>
                      </div>

                      {item.variance_difference !== 0 && (
                        <div style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', backgroundColor: item.variance_difference > 0 ? '#d1fae5' : '#fee2e2', color: item.variance_difference > 0 ? '#065f46' : '#991b1b' }}>
                          {item.variance_difference > 0 ? `+$${item.variance_difference.toFixed(2)}` : `-$${Math.abs(item.variance_difference).toFixed(2)}`}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPayslipItem(item);
                        setShowPayslipModal(true);
                      }}
                      style={{ padding: '6px 12px', backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Eye size={14} style={{ color: 'var(--primary)' }} /> Payslip
                    </button>

                  </div>
                </div>

                {/* Expandable Review Details: Attendance Summary + Flow Auto Calc + Manager Adjustments */}
                {isExpanded && (
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', backgroundColor: '#ffffff', width: '100%', boxSizing: 'border-box' }}>
                    
                    {/* 1. Attendance Summary (Factual Record) */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', backgroundColor: '#f8fafc', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={16} style={{ color: 'var(--primary)' }} /> 1. Attendance Summary (Factual Record)
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>Scheduled Hours:</span> <strong style={{ color: 'var(--text-main)' }}>{item.scheduled_hours}h</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Actual Hours:</span> <strong style={{ color: 'var(--primary)' }}>{item.actual_hours}h</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Worked Days:</span> <strong>{item.worked_days} d</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Absent Days:</span> <strong style={{ color: item.absent_days > 0 ? '#dc2626' : 'var(--text-main)' }}>{item.absent_days} d</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Vacation Days:</span> <strong>{item.vacation_days} d</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Sick Leave:</span> <strong>{item.sick_days} d</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Unpaid Leave:</span> <strong style={{ color: item.unpaid_leave_days > 0 ? '#dc2626' : 'var(--text-main)' }}>{item.unpaid_leave_days} d</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Late Arrivals:</span> <strong style={{ color: item.late_count > 0 ? '#ea580c' : 'var(--text-main)' }}>{item.late_count}</strong></div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Early Departures:</span> <strong style={{ color: item.early_out_count > 0 ? '#ea580c' : 'var(--text-main)' }}>{item.early_out_count}</strong></div>
                      </div>
                    </div>

                    {/* 2. Flow Automatic Calculation */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', backgroundColor: '#f8fafc', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <DollarSign size={16} style={{ color: '#059669' }} /> 2. Flow Auto Calculation
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Base Salary Rate:</span>
                          <strong>${item.base_rate} ({item.salary_type})</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Regular Pay:</span>
                          <strong>${item.regular_pay.toFixed(2)} ({item.regular_hours}h)</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Overtime Pay ({item.overtime_rate_multiplier}x):</span>
                          <strong style={{ color: '#d97706' }}>+${item.overtime_pay.toFixed(2)} ({item.overtime_hours}h)</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>System Deductions:</span>
                          <strong style={{ color: '#dc2626' }}>-${item.system_deductions.toFixed(2)}</strong>
                        </div>

                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                          <span>Estimated Payroll:</span>
                          <span style={{ color: '#475569' }}>${item.estimated_payroll.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Manager Approval & Adjustments */}
                    <div style={{ border: '1px solid #bfdbfe', borderRadius: '10px', padding: '16px', backgroundColor: '#eff6ff', boxSizing: 'border-box', overflow: 'hidden' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={16} /> 3. Manager Payroll Adjustments
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', display: 'block' }}>Approved Overtime (hrs)</label>
                          <input type="number" step="0.1" disabled={isLocked} value={item.approved_overtime} onChange={(e) => handleAdjustmentChange(item.employee_id, 'approved_overtime', parseFloat(e.target.value) || 0)} style={{ ...inputStyle, borderColor: '#fde68a', backgroundColor: '#fffbeb', fontWeight: 700 }} />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>Bonus ($)</label>
                          <input type="number" step="0.01" disabled={isLocked} value={item.bonus} onChange={(e) => handleAdjustmentChange(item.employee_id, 'bonus', parseFloat(e.target.value) || 0)} style={inputStyle} />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>Deductions ($)</label>
                          <input type="number" step="0.01" disabled={isLocked} value={item.deductions} onChange={(e) => handleAdjustmentChange(item.employee_id, 'deductions', parseFloat(e.target.value) || 0)} style={inputStyle} />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>Transportation ($)</label>
                          <input type="number" step="0.01" disabled={isLocked} value={item.transportation} onChange={(e) => handleAdjustmentChange(item.employee_id, 'transportation', parseFloat(e.target.value) || 0)} style={inputStyle} />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>Commission ($)</label>
                          <input type="number" step="0.01" disabled={isLocked} value={item.commission} onChange={(e) => handleAdjustmentChange(item.employee_id, 'commission', parseFloat(e.target.value) || 0)} style={inputStyle} />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>Allowances ($)</label>
                          <input type="number" step="0.01" disabled={isLocked} value={item.allowances} onChange={(e) => handleAdjustmentChange(item.employee_id, 'allowances', parseFloat(e.target.value) || 0)} style={inputStyle} />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>Tips ($)</label>
                          <input type="number" step="0.01" disabled={isLocked} value={item.tips} onChange={(e) => handleAdjustmentChange(item.employee_id, 'tips', parseFloat(e.target.value) || 0)} style={inputStyle} />
                        </div>
                      </div>

                      <div style={{ marginTop: '10px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block' }}>Manager Notes</label>
                        <input type="text" disabled={isLocked} value={item.manager_notes} onChange={(e) => handleAdjustmentChange(item.employee_id, 'manager_notes', e.target.value)} placeholder="Reason for salary adjustments..." style={{ ...inputStyle, width: '100%' }} />
                      </div>

                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e40af' }}>Approved Final Salary:</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>${item.final_payroll.toFixed(2)}</span>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
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
