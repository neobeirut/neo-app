import type { CalculatedPayrollItem } from './payrollCalculation';

export type ReportType =
  | 'SHIFT_SCHEDULE'
  | 'ATTENDANCE'
  | 'PLANNED_VS_ACTUAL'
  | 'LATE_ARRIVALS'
  | 'ABSENCES'
  | 'MISSING_PUNCHES'
  | 'OVERTIME'
  | 'ESTIMATED_PAYROLL'
  | 'FINAL_PAYROLL'
  | 'PAYROLL_ADJUSTMENTS'
  | 'LABOR_COST_BRANCH'
  | 'LABOR_COST_DEPARTMENT'
  | 'MONTHLY_SUMMARY';

export interface ReportMeta {
  id: ReportType;
  title: string;
  category: 'ROSTER' | 'ATTENDANCE' | 'PAYROLL' | 'ANALYTICS';
  description: string;
}

export const REPORT_TYPES_LIST: ReportMeta[] = [
  { id: 'SHIFT_SCHEDULE', title: 'Shift Schedule', category: 'ROSTER', description: 'Planned roster schedules per employee, date, and branch' },
  { id: 'ATTENDANCE', title: 'Attendance Logs', category: 'ATTENDANCE', description: 'Actual clock-in/out timestamps, duration, and branch logs' },
  { id: 'PLANNED_VS_ACTUAL', title: 'Planned vs Actual Hours', category: 'ATTENDANCE', description: 'Scheduled hours vs actual worked hours and variance' },
  { id: 'LATE_ARRIVALS', title: 'Late Arrivals', category: 'ATTENDANCE', description: 'Audit of tardiness incidents and late arrival minutes' },
  { id: 'ABSENCES', title: 'Absences', category: 'ATTENDANCE', description: 'Tracking of unexcused vs excused absent days' },
  { id: 'MISSING_PUNCHES', title: 'Missing Punches', category: 'ATTENDANCE', description: 'Incomplete punch-in / punch-out records' },
  { id: 'OVERTIME', title: 'Overtime', category: 'PAYROLL', description: 'Overtime hours worked, rate multipliers, and overtime pay' },
  { id: 'ESTIMATED_PAYROLL', title: 'Estimated Payroll', category: 'PAYROLL', description: 'Flow auto-calculated estimated salaries before manager review' },
  { id: 'FINAL_PAYROLL', title: 'Final Payroll', category: 'PAYROLL', description: 'Approved manager final payable salary totals' },
  { id: 'PAYROLL_ADJUSTMENTS', title: 'Payroll Adjustments', category: 'PAYROLL', description: 'Audit log of manager overrides (Bonus, Tips, Transportation, Deductions)' },
  { id: 'LABOR_COST_BRANCH', title: 'Labor Cost by Branch', category: 'ANALYTICS', description: 'Aggregate labor cost and hours breakdown by restaurant branch' },
  { id: 'LABOR_COST_DEPARTMENT', title: 'Labor Cost by Department', category: 'ANALYTICS', description: 'Aggregate labor cost and hours breakdown by position/department' },
  { id: 'MONTHLY_SUMMARY', title: 'Monthly Payroll Summary', category: 'ANALYTICS', description: 'Executive monthly overview with KPI metrics and totals' }
];

export interface LaborCostGroup {
  group_name: string;
  employee_count: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_estimated_payroll: number;
  total_final_payroll: number;
  variance_difference: number;
}

export function generateLaborCostByBranch(payrollItems: CalculatedPayrollItem[]): LaborCostGroup[] {
  const map = new Map<string, CalculatedPayrollItem[]>();
  payrollItems.forEach((item) => {
    const branch = item.branch || 'Main';
    if (!map.has(branch)) map.set(branch, []);
    map.get(branch)!.push(item);
  });

  const result: LaborCostGroup[] = [];
  map.forEach((items, branch) => {
    let regHrs = 0;
    let otHrs = 0;
    let estPay = 0;
    let finalPay = 0;

    items.forEach((i) => {
      regHrs += i.regular_hours;
      otHrs += i.overtime_hours;
      estPay += i.estimated_payroll;
      finalPay += i.final_payroll;
    });

    result.push({
      group_name: branch,
      employee_count: items.length,
      total_regular_hours: Math.round(regHrs * 100) / 100,
      total_overtime_hours: Math.round(otHrs * 100) / 100,
      total_estimated_payroll: Math.round(estPay * 100) / 100,
      total_final_payroll: Math.round(finalPay * 100) / 100,
      variance_difference: Math.round((finalPay - estPay) * 100) / 100
    });
  });

  return result;
}

export function generateLaborCostByDepartment(payrollItems: CalculatedPayrollItem[]): LaborCostGroup[] {
  const map = new Map<string, CalculatedPayrollItem[]>();
  payrollItems.forEach((item) => {
    const pos = item.position || 'General Staff';
    if (!map.has(pos)) map.set(pos, []);
    map.get(pos)!.push(item);
  });

  const result: LaborCostGroup[] = [];
  map.forEach((items, pos) => {
    let regHrs = 0;
    let otHrs = 0;
    let estPay = 0;
    let finalPay = 0;

    items.forEach((i) => {
      regHrs += i.regular_hours;
      otHrs += i.overtime_hours;
      estPay += i.estimated_payroll;
      finalPay += i.final_payroll;
    });

    result.push({
      group_name: pos,
      employee_count: items.length,
      total_regular_hours: Math.round(regHrs * 100) / 100,
      total_overtime_hours: Math.round(otHrs * 100) / 100,
      total_estimated_payroll: Math.round(estPay * 100) / 100,
      total_final_payroll: Math.round(finalPay * 100) / 100,
      variance_difference: Math.round((finalPay - estPay) * 100) / 100
    });
  });

  return result;
}
