import React, { useState, useEffect } from 'react';
import { X, Printer, DollarSign, ShieldCheck, Save, CheckCircle2, Loader2, Bus } from 'lucide-react';
import type { CalculatedPayrollItem } from '../../utils/payrollCalculation';
import { api } from '../../api/client';

interface EmployeePayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CalculatedPayrollItem | null;
  periodName: string;
  month?: number;
  year?: number;
  punchedDays?: number;
  transDailyRate?: number;
  onSaved?: (savedRecord?: any) => void;
  adminName?: string;
  allowSave?: boolean;
}

export default function EmployeePayslipModal({
  isOpen,
  onClose,
  item,
  periodName,
  month,
  year,
  punchedDays,
  transDailyRate,
  onSaved,
  adminName = 'Admin',
  allowSave = true
}: EmployeePayslipModalProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [payrollRecord, setPayrollRecord] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Editable / computed override state
  const [customPunchedDays, setCustomPunchedDays] = useState<number>(0);
  const [customTransDaily, setCustomTransDaily] = useState<number>(0);

  const curDate = new Date();
  const targetMonth = month || (curDate.getMonth() + 1);
  const targetYear = year || curDate.getFullYear();

  useEffect(() => {
    if (isOpen && item?.employee_id) {
      loadDisbursementData();
      
      const pDays = punchedDays !== undefined ? punchedDays : (item.worked_days ?? 0);
      const tRate = transDailyRate !== undefined ? transDailyRate : (item.transportation_daily_rate ?? 0);
      setCustomPunchedDays(pDays);
      setCustomTransDaily(tRate);
    }
  }, [isOpen, item?.employee_id, periodName, month, year, punchedDays, transDailyRate]);

  const loadDisbursementData = async () => {
    if (!item?.employee_id) return;

    const [paymentsRes, loansRes, payrollsRes] = await Promise.all([
      api.getSalaryPayments(targetMonth, targetYear, item.employee_id),
      api.getActiveLoans(item.employee_id),
      api.getPayrolls(targetMonth, targetYear)
    ]);

    if (paymentsRes.success) setPayments(paymentsRes.data || []);
    if (loansRes.success) setActiveLoans(loansRes.data || []);
    if (payrollsRes.success) {
      const match = (payrollsRes.data || []).find((p: any) => String(p.employee_id) === String(item.employee_id));
      setPayrollRecord(match || null);
      if (match) {
        if (match.show_days !== null && match.show_days !== undefined) {
          setCustomPunchedDays(Number(match.show_days));
        }
        if (match.transportation_daily_rate !== null && match.transportation_daily_rate !== undefined) {
          setCustomTransDaily(Number(match.transportation_daily_rate));
        }
      }
    }
  };

  if (!isOpen || !item) return null;

  // Transportation calculation based on punched days
  const effectiveTransportation = Math.round(customPunchedDays * customTransDaily * 100) / 100;

  // Base and additions calculation
  const baseSalary = item.base_rate || item.regular_pay || 0;
  const overtimePay = item.overtime_pay || 0;
  const otherAdditions = (item.bonus || 0) + (item.allowances || 0) + (item.tips || 0) + (item.commission || 0);
  const deductions = item.deductions || 0;

  // Final calculated payroll
  const calculatedFinalPayroll = Math.round((baseSalary + overtimePay + effectiveTransportation + otherAdditions - deductions) * 100) / 100;

  // Total paid advances / cashouts
  const totalPaid = payments.reduce((sum, p) => {
    const rate = Number(p.exchange_rate) || 90000;
    return sum + (Number(p.amount_usd) || 0) + ((Number(p.amount_lbp) || 0) / rate);
  }, 0);

  const activeLoansTotal = activeLoans.reduce((sum, l) => sum + (Number(l.balance) || 0), 0);
  const remainingToPay = Math.round((calculatedFinalPayroll - totalPaid - activeLoansTotal) * 100) / 100;

  const handlePrint = () => {
    window.print();
  };

  const handleSavePayslip = async () => {
    if (!item?.employee_id) return;
    setIsSaving(true);

    const payload = {
      payroll_id: payrollRecord?.payroll_id,
      employee_id: item.employee_id,
      month: targetMonth,
      year: targetYear,
      base_salary: baseSalary,
      working_days: item.scheduled_hours ? Math.max(1, Math.round(item.scheduled_hours / 8)) : 26,
      show_days: customPunchedDays,
      transportation_daily_rate: customTransDaily,
      transportation: effectiveTransportation,
      bonuses: otherAdditions,
      deductions: deductions,
      salary_deduction: item.system_deductions || 0,
      final_salary: calculatedFinalPayroll,
      net_salary: calculatedFinalPayroll,
      status: payrollRecord?.status === '100% Paid' ? '100% Paid' : 'Approved',
      generated_at: new Date().toISOString()
    };

    const res = await api.savePayroll(payload);
    setIsSaving(false);

    if (res.success) {
      setPayrollRecord(res.data);
      if (onSaved) onSaved(res.data);
      alert(`Payslip for ${item.employee_name} successfully SAVED!\nFinal amount to pay: $${calculatedFinalPayroll.toFixed(2)}`);
    } else {
      alert(`Failed to save payslip: ${res.error}`);
    }
  };

  const isSaved = Boolean(payrollRecord?.payroll_id);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '620px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <DollarSign size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Official Employee Payslip</h3>
                {isSaved ? (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} /> Saved
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                    Unsaved Draft
                  </span>
                )}
              </div>
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
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

          {/* Employee Header */}
          <div style={{ padding: '14px 16px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                  <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>Details / Days</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 600 }}>Base Regular Salary</td>
                  <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                    {item.salary_type === 'Hourly' ? `${item.regular_hours} hrs` : 'Monthly base'}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600 }}>${baseSalary.toFixed(2)}</td>
                </tr>

                {overtimePay > 0 && (
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600 }}>Overtime Pay ({item.overtime_rate_multiplier || 1.5}x Multiplier)</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>{item.overtime_hours} hrs</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, color: '#d97706' }}>+${overtimePay.toFixed(2)}</td>
                  </tr>
                )}

                {/* Transportation Allowance - explicitly computed from punched days */}
                <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: '#f0fdf4' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#15803d' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bus size={15} color="#16a34a" />
                      <span>Transportation Allowance</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'center', color: '#15803d', fontWeight: 500 }}>
                    <span style={{ fontWeight: 700 }}>{customPunchedDays}</span> punched days @ ${customTransDaily}/day
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                    +${effectiveTransportation.toFixed(2)}
                  </td>
                </tr>

                {otherAdditions > 0 && (
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600 }}>Other Additions, Tips & Bonuses</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>--</td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                      +${otherAdditions.toFixed(2)}
                    </td>
                  </tr>
                )}

                {deductions > 0 && (
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#dc2626' }}>Absence & Deductions</td>
                    <td style={{ padding: '11px 14px', textAlign: 'center', color: '#dc2626' }}>
                      {item.absent_days > 0 ? `${item.absent_days}d absent ` : ''}
                      {item.unpaid_leave_days > 0 ? `${item.unpaid_leave_days}d unpaid leave` : ''}
                      {item.absent_days === 0 && !item.unpaid_leave_days ? 'Deduction' : ''}
                    </td>
                    <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>-${deductions.toFixed(2)}</td>
                  </tr>
                )}

                <tr style={{ backgroundColor: '#eff6ff' }}>
                  <td style={{ padding: '13px 14px', fontWeight: 700, fontSize: '14px', color: '#1e40af' }}>
                    Final Amount to be Paid
                  </td>
                  <td style={{ padding: '13px 14px', textAlign: 'center', fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>
                    {isSaved ? '✓ Saved in Records' : 'Calculated (Pending Save)'}
                  </td>
                  <td style={{ padding: '13px 14px', textAlign: 'right', fontWeight: 800, fontSize: '17px', color: 'var(--primary)' }}>
                    ${calculatedFinalPayroll.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Transportation Adjustment helper (if manager needs to override punched days) */}
          <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bus size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Punched Days Override:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Days:</span>
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={customPunchedDays}
                  onChange={(e) => setCustomPunchedDays(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width: '56px', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', textAlign: 'center', fontWeight: 700 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Rate ($/day):</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={customTransDaily}
                  onChange={(e) => setCustomTransDaily(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{ width: '56px', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', textAlign: 'center', fontWeight: 700 }}
                />
              </div>
            </div>
          </div>

          {/* Disbursement & Net Remaining Payable */}
          <div style={{ padding: '14px 16px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Disbursement & Remaining Balance</span>
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
            <span>Transportation is automatically reconciled from actual shift punch-in records ({customPunchedDays} days logged).</span>
          </div>

        </div>

        {/* Footer Actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 18px', backgroundColor: '#f1f5f9', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
          >
            Close
          </button>

          {allowSave && (
            <button
              onClick={handleSavePayslip}
              disabled={isSaving}
              style={{
                padding: '9px 20px',
                backgroundColor: isSaved ? '#15803d' : 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : isSaved ? (
                <>
                  <Save size={16} /> Update Saved Payslip (${calculatedFinalPayroll.toFixed(2)})
                </>
              ) : (
                <>
                  <Save size={16} /> Save & Finalize Payslip (${calculatedFinalPayroll.toFixed(2)})
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
