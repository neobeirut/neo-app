-- Migration: Create Shift Management Tables (Phase 1)

-- 1. Create Shift Templates Table
CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id TEXT,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL, -- e.g. "08:00"
  end_time TEXT NOT NULL,   -- e.g. "16:00"
  break_duration_mins INT DEFAULT 30,
  position TEXT,
  branch TEXT,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Employee Schedules Table
CREATE TABLE IF NOT EXISTS employee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id TEXT,
  employee_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  date DATE NOT NULL,
  assignment_type TEXT NOT NULL DEFAULT 'shift', -- 'shift', 'day_off', 'vacation', 'sick_leave'
  shift_template_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL,
  shift_name TEXT,
  start_time TEXT, -- e.g. "08:00"
  end_time TEXT,   -- e.g. "16:00"
  break_duration_mins INT DEFAULT 0,
  position TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'published'
  notes TEXT,
  published_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying by date range, employee, branch, and status
CREATE INDEX IF NOT EXISTS idx_employee_schedules_date ON employee_schedules(date);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_emp_date ON employee_schedules(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_branch_date ON employee_schedules(branch, date);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_status ON employee_schedules(status);
