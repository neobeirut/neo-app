-- Migration: Create Payroll Finalization Tables (Phase 3)

-- 1. Create Payroll Periods Table
CREATE TABLE IF NOT EXISTS payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id TEXT,
  period_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  branch TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'approved', 'locked'
  total_regular_hours NUMERIC(10,2) DEFAULT 0,
  total_overtime_hours NUMERIC(10,2) DEFAULT 0,
  total_net_pay NUMERIC(12,2) DEFAULT 0,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Employee Payroll Items Table
CREATE TABLE IF NOT EXISTS employee_payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id UUID REFERENCES payroll_periods(id) ON DELETE CASCADE,
  restaurant_id TEXT,
  employee_id TEXT NOT NULL,
  salary_type TEXT NOT NULL DEFAULT 'Hourly', -- 'Hourly', 'Monthly'
  base_rate NUMERIC(10,2) DEFAULT 0,
  regular_hours NUMERIC(8,2) DEFAULT 0,
  regular_pay NUMERIC(10,2) DEFAULT 0,
  overtime_hours NUMERIC(8,2) DEFAULT 0,
  overtime_rate_multiplier NUMERIC(4,2) DEFAULT 1.5,
  overtime_pay NUMERIC(10,2) DEFAULT 0,
  deductions NUMERIC(10,2) DEFAULT 0,
  additions NUMERIC(10,2) DEFAULT 0,
  net_pay NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying by date range, branch, and status
CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON payroll_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_items_emp ON employee_payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payroll_items_period ON employee_payroll_items(payroll_period_id);
