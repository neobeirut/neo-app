/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ReconciliationRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  position: string;
  branch: string;
  date: string;
  scheduled_shift_name: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  scheduled_break_mins: number;
  scheduled_hours: number;
  actual_punch_in: string | null;
  actual_punch_out: string | null;
  actual_hours: number;
  variance_hours: number;
  overtime_hours: number;
  flags: ('LATE_ARRIVAL' | 'EARLY_DEPARTURE' | 'MISSING_PUNCH' | 'ABSENCE' | 'UNSCHEDULED_WORK' | 'WRONG_BRANCH')[];
  status: 'ON_TIME' | 'DISCREPANCY' | 'ABSENT' | 'UNSCHEDULED' | 'LEAVE';
  raw_schedule: any | null;
  raw_punch: any | null;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function computeHoursDuration(startTimeStr: string, endTimeStr: string, breakMins: number = 0): number {
  if (!startTimeStr || !endTimeStr) return 0;
  let startMin = parseTimeToMinutes(startTimeStr);
  let endMin = parseTimeToMinutes(endTimeStr);
  if (endMin <= startMin) endMin += 1440; // Overnight

  const netMins = Math.max(0, endMin - startMin - breakMins);
  return Math.round((netMins / 60) * 100) / 100;
}

export function computePunchDuration(punchInIso: string | null, punchOutIso: string | null): number {
  if (!punchInIso || !punchOutIso) return 0;
  const inTime = new Date(punchInIso).getTime();
  const outTime = new Date(punchOutIso).getTime();
  if (isNaN(inTime) || isNaN(outTime) || outTime <= inTime) return 0;

  const diffMs = outTime - inTime;
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;
}

export function reconcileSchedulesAndPunches({
  schedules,
  attendanceLogs,
  employees,
  lateGracePeriodMins = 5
}: {
  schedules: any[];
  attendanceLogs: any[];
  employees: any[];
  lateGracePeriodMins?: number;
}): ReconciliationRecord[] {
  const records: ReconciliationRecord[] = [];

  const empMap = new Map<string, any>();
  employees.forEach((emp) => {
    const id = emp.employee_id || emp.id;
    if (id) empMap.set(id, emp);
  });

  // Group schedules by employee_id + date
  const scheduleKeyMap = new Map<string, any[]>();
  schedules.forEach((s) => {
    const key = `${s.employee_id}_${s.date}`;
    if (!scheduleKeyMap.has(key)) scheduleKeyMap.set(key, []);
    scheduleKeyMap.get(key)!.push(s);
  });

  // Group attendance logs by employee_id + date
  const logKeyMap = new Map<string, any[]>();
  attendanceLogs.forEach((log) => {
    let dateStr = log.date;
    if (!dateStr && log.punch_in) {
      dateStr = new Date(log.punch_in).toISOString().split('T')[0];
    }
    if (dateStr) {
      const key = `${log.employee_id}_${dateStr}`;
      if (!logKeyMap.has(key)) logKeyMap.set(key, []);
      logKeyMap.get(key)!.push(log);
    }
  });

  // Collect all unique keys (employee_id + date pairs)
  const allKeys = new Set<string>([...scheduleKeyMap.keys(), ...logKeyMap.keys()]);

  allKeys.forEach((key) => {
    const [empId, dateStr] = key.split('_');
    const empObj = empMap.get(empId);
    const empName = empObj
      ? `${empObj.first_name || ''} ${empObj.last_name || ''}`.trim() || empObj.name || empId
      : empId;
    const pos = empObj?.position || 'Staff';
    const branch = empObj?.branch || 'Main';

    const empSchedules = scheduleKeyMap.get(key) || [];
    const empPunches = logKeyMap.get(key) || [];

    const workShift = empSchedules.find((s) => s.assignment_type === 'shift');
    const leaveShift = empSchedules.find((s) => s.assignment_type !== 'shift');
    const punch = empPunches[0] || null;

    const flags: ('LATE_ARRIVAL' | 'EARLY_DEPARTURE' | 'MISSING_PUNCH' | 'ABSENCE' | 'UNSCHEDULED_WORK' | 'WRONG_BRANCH')[] = [];

    let scheduledHours = 0;
    let actualHours = 0;
    let varianceHours = 0;
    let overtimeHours = 0;
    let status: 'ON_TIME' | 'DISCREPANCY' | 'ABSENT' | 'UNSCHEDULED' | 'LEAVE' = 'ON_TIME';

    if (leaveShift) {
      status = 'LEAVE';
    } else if (workShift && !punch) {
      // Scheduled but NO punch -> ABSENT
      flags.push('ABSENCE');
      scheduledHours = computeHoursDuration(workShift.start_time, workShift.end_time, workShift.break_duration_mins || 0);
      actualHours = 0;
      varianceHours = -scheduledHours;
      status = 'ABSENT';
    } else if (!workShift && punch) {
      // NO schedule but punch logged -> UNSCHEDULED WORK
      flags.push('UNSCHEDULED_WORK');
      scheduledHours = 0;
      actualHours = computePunchDuration(punch.punch_in, punch.punch_out);
      varianceHours = actualHours;
      overtimeHours = actualHours;
      status = 'UNSCHEDULED';

      if (punch.punch_in && !punch.punch_out) {
        flags.push('MISSING_PUNCH');
      }
    } else if (workShift && punch) {
      // Both schedule & punch exist -> Reconcile times and flags!
      scheduledHours = computeHoursDuration(workShift.start_time, workShift.end_time, workShift.break_duration_mins || 0);
      actualHours = computePunchDuration(punch.punch_in, punch.punch_out);
      varianceHours = Math.round((actualHours - scheduledHours) * 100) / 100;
      overtimeHours = Math.max(0, varianceHours);

      // Check Missing Punch
      if (punch.punch_in && !punch.punch_out) {
        flags.push('MISSING_PUNCH');
      }

      // Check Late Arrival
      if (punch.punch_in && workShift.start_time) {
        const punchInDate = new Date(punch.punch_in);
        const punchInMinutes = punchInDate.getHours() * 60 + punchInDate.getMinutes();
        const scheduledStartMinutes = parseTimeToMinutes(workShift.start_time);

        if (punchInMinutes > scheduledStartMinutes + lateGracePeriodMins) {
          flags.push('LATE_ARRIVAL');
        }
      }

      // Check Early Departure
      if (punch.punch_out && workShift.end_time) {
        const punchOutDate = new Date(punch.punch_out);
        const punchOutMinutes = punchOutDate.getHours() * 60 + punchOutDate.getMinutes();
        const scheduledEndMinutes = parseTimeToMinutes(workShift.end_time);

        if (punchOutMinutes < scheduledEndMinutes - 5) {
          flags.push('EARLY_DEPARTURE');
        }
      }

      // Check Wrong Branch
      if (punch.branch && workShift.branch && punch.branch !== workShift.branch) {
        flags.push('WRONG_BRANCH');
      }

      status = flags.length > 0 ? 'DISCREPANCY' : 'ON_TIME';
    }

    records.push({
      id: `${empId}_${dateStr}`,
      employee_id: empId,
      employee_name: empName,
      position: pos,
      branch: workShift?.branch || punch?.branch || branch,
      date: dateStr,
      scheduled_shift_name: workShift ? workShift.shift_name : leaveShift ? (leaveShift.shift_name || leaveShift.assignment_type.replace('_', ' ').toUpperCase()) : null,
      scheduled_start: workShift?.start_time || null,
      scheduled_end: workShift?.end_time || null,
      scheduled_break_mins: workShift?.break_duration_mins || 0,
      scheduled_hours: scheduledHours,
      actual_punch_in: punch?.punch_in || null,
      actual_punch_out: punch?.punch_out || null,
      actual_hours: actualHours,
      variance_hours: varianceHours,
      overtime_hours: overtimeHours,
      flags,
      status,
      raw_schedule: workShift || leaveShift || null,
      raw_punch: punch
    });
  });

  return records.sort((a, b) => b.date.localeCompare(a.date));
}
