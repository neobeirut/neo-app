/* eslint-disable @typescript-eslint/no-explicit-any */

export type TipsCalculationMode = 'by_department' | 'by_employee';

export interface DepartmentFactorMap {
  [department: string]: number;
}

export const DEFAULT_DEPARTMENT_FACTORS: DepartmentFactorMap = {
  Floor: 7,
  Kitchen: 3
};

export interface TipsDistributionItem {
  id?: string;
  tips_collection_id?: string;
  employee_id: string;
  employee_name: string;
  department?: string;
  sub_department?: string;
  branch?: string;
  actual_hours_worked: number | string;
  expected_hours?: number | string;
  calculated_factor: number | string;
  tip_amount: number | string;
  status?: string;
  points?: number;
  dept_allocated_pool?: number;
}

export interface DepartmentSummary {
  department: string;
  factor: number;
  sharePercentage: number;
  allocatedPool: number;
  employeeCount: number;
  totalPoints: number;
}

export interface CalculationResult {
  items: TipsDistributionItem[];
  mode: TipsCalculationMode;
  totalTips: number;
  departmentSummaries: DepartmentSummary[];
  totalPoints: number;
}

/**
 * Normalizes a department name for grouping
 */
export function normalizeDepartmentName(dept?: string): string {
  if (!dept || !dept.trim()) return 'Floor';
  const clean = dept.trim();
  if (clean.toLowerCase().startsWith('kitchen')) return 'Kitchen';
  if (clean.toLowerCase().startsWith('floor')) return 'Floor';
  if (clean.toLowerCase().startsWith('bar')) return 'Floor';
  if (clean.toLowerCase().startsWith('retail')) return 'Floor';
  return clean;
}

/**
 * Calculate tips distribution either:
 * - Option 1: by_department (departments have tip factor multipliers, then divided among employees in that dept)
 * - Option 2: by_employee (per employee directly based on their individual points)
 */
export function calculateTipsDistribution(
  rawItems: TipsDistributionItem[],
  totalTipsAmount: number | string,
  mode: TipsCalculationMode = 'by_department',
  customDeptFactors?: DepartmentFactorMap
): CalculationResult {
  const totalTips = Math.max(0, parseFloat(String(totalTipsAmount)) || 0);

  if (!rawItems || rawItems.length === 0 || totalTips === 0) {
    return {
      items: (rawItems || []).map(item => ({ ...item, tip_amount: '0.00', points: 0 })),
      mode,
      totalTips,
      departmentSummaries: [],
      totalPoints: 0
    };
  }

  // Ensure every item has normalized department and calculated points
  const itemsWithPoints: TipsDistributionItem[] = rawItems.map(item => {
    const hours = Math.max(0, parseFloat(String(item.actual_hours_worked)) || 0);
    const factor = parseFloat(String(item.calculated_factor)) || 1.0;
    const points = hours * factor;
    const department = normalizeDepartmentName(item.department);
    const sub_department = item.sub_department || '';
    return {
      ...item,
      department,
      sub_department,
      actual_hours_worked: hours,
      calculated_factor: factor,
      points
    };
  });

  if (mode === 'by_employee') {
    // OPTION 2: Like it is now per employee (Global pool)
    const totalPoints = itemsWithPoints.reduce((sum, item) => sum + (item.points || 0), 0);
    const tipPerPoint = totalPoints > 0 ? totalTips / totalPoints : 0;

    let distributedSum = 0;
    const calculatedItems = itemsWithPoints.map((item, index) => {
      if (totalPoints <= 0) {
        return { ...item, tip_amount: '0.00' };
      }
      if (index === itemsWithPoints.length - 1) {
        const lastAmount = Math.max(0, totalTips - distributedSum);
        return { ...item, tip_amount: lastAmount.toFixed(2) };
      }
      const itemAmount = Math.round((item.points || 0) * tipPerPoint * 100) / 100;
      distributedSum += itemAmount;
      return { ...item, tip_amount: itemAmount.toFixed(2) };
    });

    return {
      items: calculatedItems,
      mode: 'by_employee',
      totalTips,
      departmentSummaries: [],
      totalPoints
    };
  }

  // OPTION 1: By departments then by employee
  // 1. Group active items by department
  const deptMap: { [dept: string]: TipsDistributionItem[] } = {};
  itemsWithPoints.forEach(item => {
    const d = item.department || 'Floor';
    if (!deptMap[d]) deptMap[d] = [];
    deptMap[d].push(item);
  });

  const activeDepartments = Object.keys(deptMap);
  const deptFactors: DepartmentFactorMap = {
    ...DEFAULT_DEPARTMENT_FACTORS,
    ...(customDeptFactors || {})
  };

  // Sum factor multipliers for departments that have active staff
  let totalDeptFactorSum = 0;
  activeDepartments.forEach(dept => {
    const factor = Math.max(0.1, deptFactors[dept] !== undefined ? Number(deptFactors[dept]) : 1.0);
    totalDeptFactorSum += factor;
  });

  if (totalDeptFactorSum <= 0) totalDeptFactorSum = 1;

  // 2. Allocate pool to each department
  const departmentSummaries: DepartmentSummary[] = [];
  let allocatedPoolSum = 0;
  const deptAllocatedPools: { [dept: string]: number } = {};

  activeDepartments.forEach((dept, index) => {
    const factor = Math.max(0.1, deptFactors[dept] !== undefined ? Number(deptFactors[dept]) : 1.0);
    let pool = 0;
    if (index === activeDepartments.length - 1) {
      pool = Math.max(0, totalTips - allocatedPoolSum);
    } else {
      pool = Math.round((totalTips * (factor / totalDeptFactorSum)) * 100) / 100;
      allocatedPoolSum += pool;
    }
    deptAllocatedPools[dept] = pool;

    const deptStaff = deptMap[dept];
    const deptPoints = deptStaff.reduce((sum, s) => sum + (s.points || 0), 0);

    departmentSummaries.push({
      department: dept,
      factor,
      sharePercentage: Math.round((factor / totalDeptFactorSum) * 1000) / 10,
      allocatedPool: pool,
      employeeCount: deptStaff.length,
      totalPoints: deptPoints
    });
  });

  // 3. Within each department, divide by employee points
  const finalItems: TipsDistributionItem[] = [];
  activeDepartments.forEach(dept => {
    const deptStaff = deptMap[dept];
    const deptPool = deptAllocatedPools[dept] || 0;
    const deptPoints = deptStaff.reduce((sum, s) => sum + (s.points || 0), 0);
    const deptTipPerPoint = deptPoints > 0 ? deptPool / deptPoints : 0;

    let deptDistributedSum = 0;
    deptStaff.forEach((emp, empIdx) => {
      let empTip = 0;
      if (deptPoints <= 0) {
        empTip = deptStaff.length > 0 ? Math.round((deptPool / deptStaff.length) * 100) / 100 : 0;
      } else if (empIdx === deptStaff.length - 1) {
        empTip = Math.max(0, deptPool - deptDistributedSum);
      } else {
        empTip = Math.round((emp.points || 0) * deptTipPerPoint * 100) / 100;
        deptDistributedSum += empTip;
      }

      finalItems.push({
        ...emp,
        dept_allocated_pool: deptPool,
        tip_amount: empTip.toFixed(2)
      });
    });
  });

  const totalPoints = itemsWithPoints.reduce((sum, item) => sum + (item.points || 0), 0);

  return {
    items: finalItems,
    mode: 'by_department',
    totalTips,
    departmentSummaries,
    totalPoints
  };
}
