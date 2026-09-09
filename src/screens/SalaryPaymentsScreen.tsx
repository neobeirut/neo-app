/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { 
  DollarSign, Search, Plus, Trash2, RefreshCw, 
  Wallet, Eye, Check, RotateCcw
} from 'lucide-react';
import EmployeePayslipModal from '../components/attendance/EmployeePayslipModal';
import type { CalculatedPayrollItem } from '../utils/payrollCalculation';

interface SalaryPaymentsScreenProps {
  user: any;
  permissions?: any;
}

const MONTHS = [
  { id: 1, name: 'January' }, { id: 2, name: 'February' }, { id: 3, name: 'March' },
  { id: 4, name: 'April' }, { id: 5, name: 'May' }, { id: 6, name: 'June' },
  { id: 7, name: 'July' }, { id: 8, name: 'August' }, { id: 9, name: 'September' },
  { id: 10, name: 'October' }, { id: 11, name: 'November' }, { id: 12, name: 'December' }
];

export default function SalaryPaymentsScreen({ user }: SalaryPaymentsScreenProps) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Loaded Data
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [cashoutCandidates, setCashoutCandidates] = useState<any[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [targetEmployee, setTargetEmployee] = useState<any | null>(null);
  const [paymentAmountUsd, setPaymentAmountUsd] = useState<string>('');
  const [paymentAmountLbp, setPaymentAmountLbp] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string>('90000');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [deductFromLoan, setDeductFromLoan] = useState<boolean>(false);
  const [savingPayment, setSavingPayment] = useState<boolean>(false);

  // Payslip Modal State
  const [showPayslipModal, setShowPayslipModal] = useState<boolean>(false);
  const [selectedPayslipItem, setSelectedPayslipItem] = useState<CalculatedPayrollItem | null>(null);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    loadPeriodData();
  }, [selectedMonth, selectedYear]);

  const loadBaseData = async () => {
    const [empRes, branchRes] = await Promise.all([
      api.getEmployees(),
      api.getBranchesList()
    ]);
    if (empRes.success) {
      const activeEmps = (empRes.data || []).filter((e: any) => {
        const s = (e.status || '').toLowerCase();
        return s !== 'inactive' && s !== 'disabled' && s !== 'terminated' && e.is_payroll_eligible !== false;
      });
      setEmployees(activeEmps);
    }
    if (branchRes.success) {
      const bList = (branchRes.data || []).map((b: any) => typeof b === 'string' ? b : b.name);
      setBranches(bList);
    }
  };

  const loadPeriodData = async () => {
    setLoading(true);
    const [payrollsRes, paymentsRes, loansRes, cashoutRes] = await Promise.all([
      api.getPayrolls(selectedMonth, selectedYear),
      api.getSalaryPayments(selectedMonth, selectedYear),
      api.getActiveLoans(),
      api.getCashoutSalaryCandidates(selectedMonth, selectedYear)
    ]);

    if (payrollsRes.success) setPayrolls(payrollsRes.data || []);
    if (paymentsRes.success) setPayments(paymentsRes.data || []);
    if (loansRes.success) setActiveLoans(loansRes.data || []);
    if (cashoutRes.success) setCashoutCandidates(cashoutRes.data || []);
    setLoading(false);
  };

  const handleSyncCashouts = async () => {
    setSyncing(true);
    const res = await api.syncCashoutSalaryPayments(cashoutCandidates, user?.name || 'Admin', employees);
    setSyncing(false);
    if (res.success) {
      await loadPeriodData();
      alert(`Successfully synced ${res.count} Cashout Salary payments from cash drawers!`);
    } else {
      alert(res.error || 'Failed to sync cashout payments');
    }
  };

  const handleOpenPaymentModal = (emp: any) => {
    setTargetEmployee(emp);
    setPaymentAmountUsd('');
    setPaymentAmountLbp('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Cash');
    setPaymentNotes('');
    setDeductFromLoan(false);
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee) return;

    const usd = parseFloat(paymentAmountUsd) || 0;
    const lbp = parseFloat(paymentAmountLbp) || 0;
    const rate = parseFloat(exchangeRate) || 90000;

    if (usd <= 0 && lbp <= 0) {
      alert('Please enter a valid amount in USD or LBP.');
      return;
    }

    setSavingPayment(true);

    const payload = {
      employee_id: targetEmployee.employee_id,
      month: selectedMonth,
      year: selectedYear,
      payment_date: paymentDate,
      amount_usd: usd,
      amount_lbp: lbp,
      exchange_rate: rate,
      payment_method: paymentMethod,
      notes: paymentNotes.trim() || null,
      created_by: user?.name || 'Admin'
    };

    const res = await api.addSalaryPayment(payload);
    if (!res.success) {
      alert(res.error || 'Failed to save salary payment');
      setSavingPayment(false);
      return;
    }

    if (deductFromLoan) {
      const convertedUsd = usd + (lbp / rate);
      await api.deductFromLoans(targetEmployee.employee_id, convertedUsd, user?.name || 'Admin');
    }

    setSavingPayment(false);
    setShowPaymentModal(false);
    loadPeriodData();
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    const res = await api.deleteSalaryPayment(paymentId);
    if (res.success) {
      loadPeriodData();
    } else {
      alert(res.error || 'Failed to delete payment');
    }
  };

  const handleToggle100PercentPaid = async (empId: string, currentStatus: string, empName: string) => {
    const isCurrently100 = currentStatus === '100% Paid';
    const actionText = isCurrently100 ? 'Revert status to Pending / In-Progress' : 'Mark as 100% FULLY PAID';
    
    if (!confirm(`Are you sure you want to ${actionText} for ${empName}?`)) return;

    const newStatus = isCurrently100 ? 'Draft' : '100% Paid';
    const res = await api.updateSalarySlipStatus(empId, selectedMonth, selectedYear, newStatus, user?.name || 'Admin');
    if (res.success) {
      loadPeriodData();
    } else {
      alert(res.error || 'Failed to update status');
    }
  };

  const handleOpenPayslip = (empData: any) => {
    const payslipItem: CalculatedPayrollItem = {
      employee_id: empData.employee_id,
      employee_name: empData.fullName,
      position: empData.position,
      branch: empData.branch,
      salary_type: empData.salary_type || 'Monthly',
      base_rate: empData.slipAmount,
      scheduled_hours: 0,
      regular_hours: 0,
      actual_hours: 0,
      worked_days: 0,
      absent_days: 0,
      vacation_days: 0,
      sick_days: 0,
      unpaid_leave_days: 0,
      late_count: 0,
      early_out_count: 0,
      regular_pay: empData.slipAmount,
      overtime_hours: 0,
      overtime_rate_multiplier: 1.5,
      overtime_pay: 0,
      system_deductions: 0,
      system_allowances: 0,
      estimated_payroll: empData.slipAmount,
      approved_hours: 0,
      approved_overtime: 0,
      bonus: 0,
      deductions: 0,
      transportation: 0,
      commission: 0,
      allowances: 0,
      tips: 0,
      final_payroll: empData.slipAmount,
      variance_difference: 0,
      manager_notes: ''
    };
    setSelectedPayslipItem(payslipItem);
    setShowPayslipModal(true);
  };

  const combinedRoster = useMemo(() => {
    const payrollMap = new Map<string, any>();
    payrolls.forEach(p => {
      if (p.employee_id) payrollMap.set(String(p.employee_id), p);
    });

    const loansMap = new Map<string, number>();
    activeLoans.forEach(l => {
      const eid = String(l.employee_id);
      const bal = Number(l.balance) || 0;
      loansMap.set(eid, (loansMap.get(eid) || 0) + bal);
    });

    const empPaymentsMap = new Map<string, { cashoutSalary: number; manual: number; total: number; list: any[] }>();
    payments.forEach(p => {
      const eid = String(p.employee_id);
      if (!empPaymentsMap.has(eid)) {
        empPaymentsMap.set(eid, { cashoutSalary: 0, manual: 0, total: 0, list: [] });
      }
      const entry = empPaymentsMap.get(eid)!;
      const rate = Number(p.exchange_rate) || 90000;
      const usdEquiv = Number(p.amount_usd || 0) + (Number(p.amount_lbp || 0) / rate);

      if (p.payment_method === 'Cashout Salary') {
        entry.cashoutSalary += usdEquiv;
      } else {
        entry.manual += usdEquiv;
      }
      entry.total += usdEquiv;
      entry.list.push(p);
    });

    return employees.map(emp => {
      const eid = String(emp.employee_id);
      const pRecord = payrollMap.get(eid);
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown';

      const slipAmount = pRecord ? Number(pRecord.net_salary ?? pRecord.final_salary ?? emp.salary ?? 0) : Number(emp.salary || 0);

      const payData = empPaymentsMap.get(eid) || { cashoutSalary: 0, manual: 0, total: 0, list: [] };
      const activeLoanTotal = loansMap.get(eid) || 0;

      // Formula: Remaining to Pay = Salary Slip Net - Total Paid - Active Loans
      const remainingToPay = Math.round((slipAmount - payData.total - activeLoanTotal) * 100) / 100;

      const is100PaidByAdmin = pRecord?.status === '100% Paid' || pRecord?.status === 'Paid';

      return {
        ...emp,
        fullName,
        slipAmount,
        cashoutSalaryTaken: Math.round(payData.cashoutSalary * 100) / 100,
        manualPaid: Math.round(payData.manual * 100) / 100,
        totalPaid: Math.round(payData.total * 100) / 100,
        activeLoanTotal: Math.round(activeLoanTotal * 100) / 100,
        remainingToPay,
        paymentList: payData.list,
        status: pRecord?.status || 'Draft',
        is100PaidByAdmin,
        paid_at: pRecord?.paid_at,
        paid_by: pRecord?.paid_by
      };
    });
  }, [employees, payrolls, payments, activeLoans]);

  const filteredRoster = useMemo(() => {
    return combinedRoster.filter(item => {
      if (selectedBranch !== 'All' && item.branch !== selectedBranch) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.fullName.toLowerCase().includes(q);
        const matchesPos = (item.position || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPos) return false;
      }
      return true;
    });
  }, [combinedRoster, selectedBranch, searchQuery]);

  const kpiMetrics = useMemo(() => {
    let totalSalary = 0;
    let totalCashoutSalary = 0;
    let totalManual = 0;
    let totalPaid = 0;
    let totalLoans = 0;
    let totalRemaining = 0;
    let count100Paid = 0;

    filteredRoster.forEach(item => {
      totalSalary += item.slipAmount;
      totalCashoutSalary += item.cashoutSalaryTaken;
      totalManual += item.manualPaid;
      totalPaid += item.totalPaid;
      totalLoans += item.activeLoanTotal;
      totalRemaining += item.remainingToPay;
      if (item.is100PaidByAdmin) count100Paid++;
    });

    return {
      totalSalary: Math.round(totalSalary * 100) / 100,
      totalCashoutSalary: Math.round(totalCashoutSalary * 100) / 100,
      totalManual: Math.round(totalManual * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalLoans: Math.round(totalLoans * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      count100Paid,
      totalEmployees: filteredRoster.length
    };
  }, [filteredRoster]);

  const unlinkedCandidatesCount = useMemo(() => {
    return cashoutCandidates.filter(c => !c.already_synced).length;
  }, [cashoutCandidates]);

  const unlinkedCandidatesTotalUsd = useMemo(() => {
    return cashoutCandidates
      .filter(c => !c.already_synced)
      .reduce((sum, c) => sum + (Number(c.amount_usd) || 0) + ((Number(c.amount_lbp) || 0) / 90000), 0);
  }, [cashoutCandidates]);

  const monthName = MONTHS.find(m => m.id === selectedMonth)?.name || '';

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100%' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#eef2ff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Salary Payments</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Track salary slips, drawer cashouts, active loans, and record payments with admin confirmation.
            </p>
          </div>
        </div>

        {/* Period & Branch Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', background: '#fff', fontWeight: 600 }}
          >
            {MONTHS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', background: '#fff', fontWeight: 600 }}
          >
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select 
            value={selectedBranch} 
            onChange={e => setSelectedBranch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', background: '#fff' }}
          >
            <option value="All">All Branches</option>
            {branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <button 
            onClick={loadPeriodData}
            title="Refresh"
            style={{ padding: '8px 12px', backgroundColor: '#fff', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Cashout Salary Sync Alert Banner */}
      {unlinkedCandidatesCount > 0 && (
        <div style={{ padding: '14px 20px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
                Found {unlinkedCandidatesCount} unlinked Cashout Salary advance{unlinkedCandidatesCount > 1 ? 's' : ''} (${unlinkedCandidatesTotalUsd.toFixed(2)}) in {monthName} shift drawers
              </div>
              <div style={{ fontSize: '12px', color: '#b45309' }}>
                Shift cashiers logged cash advances against employee salaries. Click sync to link them automatically to the employee ledgers.
              </div>
            </div>
          </div>
          <button
            onClick={handleSyncCashouts}
            disabled={syncing}
            style={{ padding: '8px 16px', backgroundColor: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Cashouts to Slips'}
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="admin-card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Salary Slips (Earned)</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>${kpiMetrics.totalSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>For {monthName} {selectedYear}</div>
        </div>

        <div className="admin-card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#047857', textTransform: 'uppercase' }}>Total Paid / Advances</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>${kpiMetrics.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px' }}>Cashout: ${kpiMetrics.totalCashoutSalary} • Manual: ${kpiMetrics.totalManual}</div>
        </div>

        <div className="admin-card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>Active Loan Balances</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>${kpiMetrics.totalLoans.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px' }}>Deducted from remaining to pay</div>
        </div>

        <div className="admin-card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#4338ca', textTransform: 'uppercase' }}>Net Remaining to Pay</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: kpiMetrics.totalRemaining > 0 ? '#4f46e5' : '#10b981', marginTop: '6px' }}>
            ${kpiMetrics.totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11px', color: '#4338ca', marginTop: '4px' }}>Salary - Paid - Active Loans</div>
        </div>

        <div className="admin-card" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>100% Paid (Admin Confirmed)</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: kpiMetrics.count100Paid === kpiMetrics.totalEmployees && kpiMetrics.totalEmployees > 0 ? '#059669' : '#0f172a', marginTop: '6px' }}>
            {kpiMetrics.count100Paid} <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>/ {kpiMetrics.totalEmployees}</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Requires explicit admin sign-off</div>
        </div>
      </div>

      {/* Search and Table Container */}
      <div className="admin-card" style={{ borderRadius: '14px', background: '#fff', border: '1px solid var(--border)', overflow: 'hidden' }}>
        
        {/* Search Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Search employee by name or position..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none' }}
            />
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing <strong>{filteredRoster.length}</strong> staff member{filteredRoster.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Roster Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Employee</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Salary Slip</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Cashout Salary</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Manual Paid</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Total Paid</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right', color: '#b45309' }}>Active Loans</th>
                <th style={{ padding: '14px 16px', fontWeight: 700, textAlign: 'right', color: '#4338ca' }}>Remaining to Pay</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Payment Status</th>
                <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading salary payment data...
                  </td>
                </tr>
              ) : filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No payroll-eligible employees found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredRoster.map(item => {
                  return (
                    <tr key={item.employee_id} className="hover-row" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-main)' }}>
                      
                      {/* Employee Info */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.fullName}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {item.position || 'Staff'} • <span style={{ fontWeight: 600 }}>{item.branch || 'Branch'}</span>
                        </div>
                      </td>

                      {/* Salary Slip Net */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700 }}>
                        ${item.slipAmount.toFixed(2)}
                      </td>

                      {/* Cashout Salary Taken */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {item.cashoutSalaryTaken > 0 ? (
                          <span style={{ color: '#d97706', fontWeight: 600 }}>${item.cashoutSalaryTaken.toFixed(2)}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Manual Paid */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {item.manualPaid > 0 ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>${item.manualPaid.toFixed(2)}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Total Paid */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 700, color: item.totalPaid > 0 ? '#059669' : 'inherit' }}>
                        ${item.totalPaid.toFixed(2)}
                      </td>

                      {/* Active Loans */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {item.activeLoanTotal > 0 ? (
                          <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '12px' }}>
                            -${item.activeLoanTotal.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>$0.00</span>
                        )}
                      </td>

                      {/* Net Remaining to Pay */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, fontSize: '14px' }}>
                        <span style={{ color: item.remainingToPay <= 0 ? '#059669' : '#4f46e5' }}>
                          ${item.remainingToPay.toFixed(2)}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {item.is100PaidByAdmin ? (
                          <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} /> 100% Paid
                          </span>
                        ) : item.remainingToPay <= 0 && item.totalPaid > 0 ? (
                          <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }} title="Amount distributed, awaiting admin final confirmation">
                            Pending Admin Sign-off
                          </span>
                        ) : item.totalPaid > 0 ? (
                          <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                            Partially Paid
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                            Unpaid
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          
                          <button
                            onClick={() => handleOpenPaymentModal(item)}
                            style={{ padding: '6px 10px', backgroundColor: '#eef2ff', color: 'var(--primary)', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Add Payment or View History"
                          >
                            <Plus size={13} /> Pay
                          </button>

                          <button
                            onClick={() => handleToggle100PercentPaid(item.employee_id, item.status, item.fullName)}
                            style={{ 
                              padding: '6px 10px', 
                              backgroundColor: item.is100PaidByAdmin ? '#f1f5f9' : '#10b981', 
                              color: item.is100PaidByAdmin ? '#475569' : '#ffffff', 
                              border: item.is100PaidByAdmin ? '1px solid #cbd5e1' : 'none', 
                              borderRadius: '6px', 
                              fontSize: '12px', 
                              fontWeight: 600, 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px' 
                            }}
                            title={item.is100PaidByAdmin ? 'Revert status to Pending' : 'Mark as 100% Paid'}
                          >
                            {item.is100PaidByAdmin ? (
                              <><RotateCcw size={12} /> Reopen</>
                            ) : (
                              <><Check size={12} /> Confirm 100%</>
                            )}
                          </button>

                          <button
                            onClick={() => handleOpenPayslip(item)}
                            style={{ padding: '6px 8px', backgroundColor: '#fff', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}
                            title="View Official Salary Slip"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Payment & History Modal / Drawer */}
      {showPaymentModal && targetEmployee && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Salary Payment & Ledger</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                  {targetEmployee.fullName} • {monthName} {selectedYear}
                </p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            {/* Quick Summary Pill Bar */}
            <div style={{ padding: '16px 24px', backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Salary Slip</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>${targetEmployee.slipAmount.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Paid To Date</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>${targetEmployee.totalPaid.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Loans</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#d97706' }}>${targetEmployee.activeLoanTotal.toFixed(2)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Remaining</div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: targetEmployee.remainingToPay <= 0 ? '#059669' : '#4f46e5' }}>
                  ${targetEmployee.remainingToPay.toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Record New Payment Form */}
              <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} /> Record Payment / Installment
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>USD Amount</label>
                    <input 
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={paymentAmountUsd}
                      onChange={e => setPaymentAmountUsd(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>LBP Amount</label>
                    <input 
                      type="number"
                      step="any"
                      placeholder="0"
                      value={paymentAmountLbp}
                      onChange={e => setPaymentAmountLbp(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Payment Date</label>
                    <input 
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Payment Method</label>
                    <select 
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px', outline: 'none', background: '#fff' }}
                    >
                      <option value="Cash">Cash Handover</option>
                      <option value="Bank Transfer">Bank Transfer (BOB / Whish)</option>
                      <option value="Loan Settlement">Loan Deduction Settlement</option>
                      <option value="Check">Company Check</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Notes / Reference (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. Mid-month installment, final settlement..."
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                {targetEmployee.activeLoanTotal > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <input 
                      type="checkbox"
                      id="deductLoanCheck"
                      checked={deductFromLoan}
                      onChange={e => setDeductFromLoan(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="deductLoanCheck" style={{ fontSize: '12px', fontWeight: 600, color: '#b45309', cursor: 'pointer' }}>
                      Apply this payment towards active loan balance in loans table (current balance: ${targetEmployee.activeLoanTotal})
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingPayment}
                  style={{ marginTop: '4px', padding: '10px 16px', backgroundColor: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: savingPayment ? 'not-allowed' : 'pointer' }}
                >
                  {savingPayment ? 'Recording...' : 'Record Payment'}
                </button>
              </form>

              {/* Payment History Table */}
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  Payments Recorded For This Month ({targetEmployee.paymentList.length})
                </div>

                {targetEmployee.paymentList.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px', fontSize: '13px' }}>
                    No payments or cashout advances recorded yet for this month.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px 12px' }}>Date</th>
                          <th style={{ padding: '8px 12px' }}>Method</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '8px 12px' }}>Notes / Source</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targetEmployee.paymentList.map((p: any) => {
                          const rate = Number(p.exchange_rate) || 90000;
                          const totalUsd = Number(p.amount_usd || 0) + (Number(p.amount_lbp || 0) / rate);
                          const isCashout = p.payment_method === 'Cashout Salary';

                          return (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{p.payment_date}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: isCashout ? '#fef3c7' : '#eef2ff', color: isCashout ? '#b45309' : '#4338ca', fontWeight: 600 }}>
                                  {p.payment_method}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                                ${totalUsd.toFixed(2)}
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                                {p.notes || '-'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDeletePayment(p.id)}
                                  style={{ padding: '4px', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                                  title="Delete payment"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Employee Payslip Modal */}
      <EmployeePayslipModal
        isOpen={showPayslipModal}
        onClose={() => setShowPayslipModal(false)}
        item={selectedPayslipItem}
        periodName={`${monthName} ${selectedYear}`}
      />

    </div>
  );
}
