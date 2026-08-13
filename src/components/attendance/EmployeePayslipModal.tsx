/* eslint-disable @typescript-eslint/no-explicit-any */
import { X, Printer, DollarSign, ShieldCheck } from 'lucide-react';
import type { CalculatedPayrollItem } from '../../utils/payrollCalculation';

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
  if (!isOpen || !item) return null;

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
