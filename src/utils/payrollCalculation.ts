/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReconciliationRecord } from './attendanceAnalysis';

export interface CalculatedPayrollItem {
  employee_id: string;
  employee_name: string;
  position: string;
  branch: string;
  salary_type: 'Hourly' | 'Monthly';
  base_rate: number;
  
  // Attendance Summary (Factual Record)
  scheduled_hours: number;
  regular_hours: number;
  actual_hours: number;
  worked_days: number;
  absent_days: number;
  vacation_days: number;
  sick_days: number;
  unpaid_leave_days: number;
  late_count: number;
  early_out_count: number;

  // Flow Automatic Calculation
  regular_pay: number;
  overtime_hours: number;
  overtime_rate_multiplier: number;
  overtime_pay: number;
  system_deductions: number;
  system_allowances: number;
  estimated_payroll: number;

  // Manager Approval & Adjustments
  approved_hours: number;
  approved_overtime: number;
  bonus: number;
  deductions: number;
  transportation: number;
  commission: number;
  allowances: number;
  tips: number;
  final_payroll: number;
  variance_difference: number;
  manager_notes: string;
}

export const isEmployeeActive = (emp: any): boolean => {
  if (!emp) return false;
  const status = (emp.status || '').toString().trim().toLowerCase();
  if (status === 'inactive' || status === 'disabled' || status === 'archived' || status === 'terminated') return false;
  if (emp.is_active === false || emp.is_active === 0 || emp.is_active === 'false') return false;
  if (emp.active === false || emp.active === 0 || emp.active === 'false') return false;
  return true;
};

export function computePayrollFromAnalysis({
  reconciledRecords,
  employees,
  overtimeMultiplier = 1.5
}: {
  reconciledRecords: ReconciliationRecord[];
  employees: any[];
  overtimeMultiplier?: number;
}): CalculatedPayrollItem[] {
  const activeEmployees = (employees || []).filter(isEmployeeActive);
  const empMap = new Map<string, any>();
  activeEmployees.forEach((emp) => {
    if (emp.employee_id) empMap.set(String(emp.employee_id), emp);
    if (emp.id) empMap.set(String(emp.id), emp);
  });

  // Group reconciliation records by employee_id
  const empRecordsMap = new Map<string, ReconciliationRecord[]>();
  reconciledRecords.forEach((rec) => {
    const key = String(rec.employee_id);
    if (!empRecordsMap.has(key)) {
      empRecordsMap.set(key, []);
    }
    empRecordsMap.get(key)!.push(rec);
  });

  const payrollItems: CalculatedPayrollItem[] = [];
  const processedEmpIds = new Set<string>();

  const processEmployee = (empObj: any, records: ReconciliationRecord[]) => {
    const empId = String(empObj.employee_id || empObj.id);
    if (empObj.employee_id) processedEmpIds.add(String(empObj.employee_id));
    if (empObj.id) processedEmpIds.add(String(empObj.id));
    processedEmpIds.add(empId);

    // If employee is explicitly not eligible for payroll, exclude from payroll completely
    if (empObj.is_payroll_eligible === false) {
      return;
    }

    const rawFullName = `${empObj.first_name || ''} ${empObj.last_name || ''}`.trim();
    const empName = rawFullName || empObj.name || empObj.full_name || records[0]?.employee_name || empId;
    const pos = empObj.position || records[0]?.position || 'Staff';
    const branch = empObj.branch || records[0]?.branch || 'Main';

    const salaryType: 'Hourly' | 'Monthly' = empObj.salary_type === 'Monthly' ? 'Monthly' : 'Hourly';

    let baseRate = 0;
    if (salaryType === 'Hourly') {
      const parsed = parseFloat(empObj.hourly_rate);
      baseRate = !isNaN(parsed) ? parsed : 0;
    } else {
      const parsed = parseFloat(empObj.salary);
      baseRate = !isNaN(parsed) ? parsed : 0;
    }

    let scheduledHours = 0;
    let actualHours = 0;
    let totalRegHours = 0;
    let totalOtHours = 0;
    let workedDays = 0;
    let absentDays = 0;
    let vacationDays = 0;
    let sickDays = 0;
    let unpaidLeaveDays = 0;
    let lateCount = 0;
    let earlyOutCount = 0;

    records.forEach((r) => {
      scheduledHours += r.scheduled_hours;
      actualHours += r.actual_hours;
      totalRegHours += Math.min(r.scheduled_hours, r.actual_hours);
      totalOtHours += r.overtime_hours;

      const shiftNameLower = (r.scheduled_shift_name || '').toLowerCase();
      const assignType = (r.raw_schedule?.assignment_type || '').toLowerCase();

      if (r.actual_punch_in) workedDays++;
      if (r.status === 'ABSENT') absentDays++;
      if (shiftNameLower.includes('unpaid') || assignType === 'unpaid_leave') unpaidLeaveDays++;
      else if (shiftNameLower.includes('vacation') || assignType === 'vacation') vacationDays++;
      else if (shiftNameLower.includes('sick') || assignType === 'sick_leave') sickDays++;
      if (r.flags.includes('LATE_ARRIVAL')) lateCount++;
      if (r.flags.includes('EARLY_DEPARTURE')) earlyOutCount++;
    });

    const isAttendanceTracked = empObj.track_attendance !== false;
    const effectiveAbsentDays = isAttendanceTracked ? absentDays : 0;

    scheduledHours = Math.round(scheduledHours * 100) / 100;
    actualHours = Math.round(actualHours * 100) / 100;
    totalRegHours = Math.round(totalRegHours * 100) / 100;
    totalOtHours = Math.round(totalOtHours * 100) / 100;

    let regularPay = 0;
    let overtimePay = 0;
    let systemDeductions = 0;
    const systemAllowances = 0;

    if (salaryType === 'Hourly') {
      regularPay = Math.round((totalRegHours * baseRate) * 100) / 100;
      const otRate = baseRate * overtimeMultiplier;
      overtimePay = Math.round((totalOtHours * otRate) * 100) / 100;
    } else {
      // Monthly Salaried calculation: deduct absent days AND unpaid leave days from base salary
      // If attendance is not tracked (fixed salary, no punch in/out), absent days are not penalized
      const dailyRate = Math.round((baseRate / 26) * 100) / 100;
      const hourlyEquivalent = Math.round((dailyRate / 9) * 100) / 100;

      regularPay = baseRate;
      overtimePay = Math.round((totalOtHours * (hourlyEquivalent * overtimeMultiplier)) * 100) / 100;
      systemDeductions = Math.round(((effectiveAbsentDays + unpaidLeaveDays) * dailyRate) * 100) / 100;
    }

    const estimatedPayroll = Math.round((regularPay + overtimePay + systemAllowances - systemDeductions) * 100) / 100;

    payrollItems.push({
      employee_id: empId,
      employee_name: empName,
      position: pos,
      branch,
      salary_type: salaryType,
      base_rate: baseRate,

      scheduled_hours: scheduledHours,
      regular_hours: totalRegHours,
      actual_hours: actualHours,
      worked_days: workedDays,
      absent_days: effectiveAbsentDays,
      vacation_days: vacationDays,
      sick_days: sickDays,
      unpaid_leave_days: unpaidLeaveDays,
      late_count: lateCount,
      early_out_count: earlyOutCount,

      regular_pay: regularPay,
      overtime_hours: totalOtHours,
      overtime_rate_multiplier: overtimeMultiplier,
      overtime_pay: overtimePay,
      system_deductions: systemDeductions,
      system_allowances: systemAllowances,
      estimated_payroll: estimatedPayroll,

      // Default Manager Overrides (initialized to estimated values)
      approved_hours: totalRegHours,
      approved_overtime: totalOtHours,
      bonus: 0,
      deductions: systemDeductions,
      transportation: 0,
      commission: 0,
      allowances: systemAllowances,
      tips: 0,
      final_payroll: estimatedPayroll,
      variance_difference: 0,
      manager_notes: ''
    });
  };

  // 1. Process all active employees from employees prop
  activeEmployees.forEach((emp) => {
    const empId = String(emp.employee_id || emp.id);
    const records = empRecordsMap.get(empId) ||
      (emp.employee_id ? empRecordsMap.get(String(emp.employee_id)) : undefined) ||
      (emp.id ? empRecordsMap.get(String(emp.id)) : undefined) || [];

    processEmployee(emp, records);
  });

  // 2. Process any remaining reconciliation records for employees not in activeEmployees
  empRecordsMap.forEach((records, empId) => {
    if (processedEmpIds.has(String(empId))) return;
    const empObj = empMap.get(String(empId));
    if (empObj && !isEmployeeActive(empObj)) return; // Skip inactive employees

    const fallbackEmp = empObj || {
      employee_id: empId,
      first_name: records[0]?.employee_name || empId,
      position: records[0]?.position || 'Staff',
      branch: records[0]?.branch || 'Main',
      salary_type: 'Hourly',
      hourly_rate: 0,
      salary: 0
    };

    processEmployee(fallbackEmp, records);
  });

  return payrollItems;
}
