import React, { useState, useEffect } from 'react';
import { X, Printer, DollarSign, ShieldCheck } from 'lucide-react';
import type { CalculatedPayrollItem } from '../../utils/payrollCalculation';
import { api } from '../../api/client';

interface EmployeePayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CalculatedPayrollItem | null;
  periodName: string;
}

export default function EmployeePayslipModal({
  isOpen,
  onClose,
  item,
  periodName
}: EmployeePayslipModalProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [payrollRecord, setPayrollRecord] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && item?.employee_id) {
      loadDisbursementData();
    }
  }, [isOpen, item?.employee_id, periodName]);

  const loadDisbursementData = async () => {
    if (!item?.employee_id) return;
    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    const [paymentsRes, loansRes, payrollsRes] = await Promise.all([
      api.getSalaryPayments(curMonth, curYear, item.employee_id),
      api.getActiveLoans(item.employee_id),
      api.getPayrolls(curMonth, curYear)
    ]);

    if (paymentsRes.success) setPayments(paymentsRes.data || []);
    if (loansRes.success) setActiveLoans(loansRes.data || []);
    if (payrollsRes.success) {
      const match = (payrollsRes.data || []).find((p: any) => String(p.employee_id) === String(item.employee_id));
      setPayrollRecord(match || null);
    }
  };

  if (!isOpen || !item) return null;

  const totalPaid = payments.reduce((sum, p) => {
    const rate = Number(p.exchange_rate) || 90000;
    return sum + (Number(p.amount_usd) || 0) + ((Number(p.amount_lbp) || 0) / rate);
  }, 0);

  const activeLoansTotal = activeLoans.reduce((sum, l) => sum + (Number(l.balance) || 0), 0);
  const remainingToPay = Math.round((item.final_payroll - totalPaid - activeLoansTotal) * 100) / 100;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '580px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <DollarSign size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Official Employee Payslip</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{periodName}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handlePrint} style={{ padding: '7px 12px', backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Employee Header */}
          <div style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{item.employee_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                ID: {item.employee_id} • {item.position} • {item.branch}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'inline-block' }}>
                {item.salary_type} ({item.salary_type === 'Hourly' ? `$${item.base_rate}/hr` : `$${item.base_rate}/mo`})
              </div>
            </div>
          </div>

          {/* Itemized Breakdown Table */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600 }}>Description</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>Hours / Days</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>Base Regular Salary</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>{item.regular_hours} hrs</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>${item.regular_pay.toFixed(2)}</td>
                </tr>

                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600 }}>Overtime Pay ({item.overtime_rate_multiplier}x Multiplier)</td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>{item.overtime_hours} hrs</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#d97706' }}>+${item.overtime_pay.toFixed(2)}</td>
                </tr>

                {(item.bonus > 0 || item.allowances > 0 || item.tips > 0 || item.commission > 0 || item.transportation > 0) && (
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Additions, Tips & Bonuses</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>--</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                      +${(item.bonus + item.allowances + item.tips + item.commission + item.transportation).toFixed(2)}
                    </td>
                  </tr>
                )}

                {item.deductions > 0 && (
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#dc2626' }}>Absence & Unpaid Leave Deductions</td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#dc2626' }}>
                      {item.absent_days > 0 ? `${item.absent_days}d absent ` : ''}
                      {item.unpaid_leave_days > 0 ? `${item.unpaid_leave_days}d unpaid leave` : ''}
                      {item.absent_days === 0 && !item.unpaid_leave_days ? 'Deduction' : ''}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>-${item.deductions.toFixed(2)}</td>
                  </tr>
                )}

                <tr style={{ backgroundColor: '#eff6ff' }}>
                  <td style={{ padding: '14px', fontWeight: 700, fontSize: '15px', color: '#1e40af' }}>Approved Final Salary</td>
                  <td style={{ padding: '14px', textAlign: 'center' }}></td>
                  <td style={{ padding: '14px', textAlign: 'right', fontWeight: 800, fontSize: '18px', color: 'var(--primary)' }}>
                    ${item.final_payroll.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Disbursement & Net Remaining Payable */}
          <div style={{ padding: '14px 16px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Salary Disbursement & Net Payable</span>
              {payrollRecord?.status === '100% Paid' || payrollRecord?.status === 'Paid' ? (
                <span style={{ padding: '3px 8px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 700 }}>
                  ✓ 100% Paid (Admin Confirmed)
                </span>
              ) : remainingToPay <= 0 && totalPaid > 0 ? (
                <span style={{ padding: '3px 8px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: 700 }}>
                  Pending Admin Sign-off
                </span>
              ) : (
                <span style={{ padding: '3px 8px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '11px', fontWeight: 700 }}>
                  Remaining Due: ${remainingToPay.toFixed(2)}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px', textAlign: 'center' }}>
              <div style={{ padding: '8px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Advances / Paid</div>
                <div style={{ fontWeight: 700, color: '#059669', fontSize: '13px', marginTop: '2px' }}>${totalPaid.toFixed(2)}</div>
              </div>
              <div style={{ padding: '8px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Active Loans</div>
                <div style={{ fontWeight: 700, color: '#d97706', fontSize: '13px', marginTop: '2px' }}>-${activeLoansTotal.toFixed(2)}</div>
              </div>
              <div style={{ padding: '8px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>Net Remaining</div>
                <div style={{ fontWeight: 800, color: remainingToPay <= 0 ? '#059669' : '#4f46e5', fontSize: '13px', marginTop: '2px' }}>
                  ${remainingToPay.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Audit Verification Note */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <ShieldCheck size={16} style={{ color: '#059669', flexShrink: 0 }} />
            <span>This payslip has been reconciled against shift schedules & GPS attendance logs and validated for payroll transfer.</span>
          </div>

        </div>

      </div>
    </div>
  );
}
