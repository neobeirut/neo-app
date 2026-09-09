-- Migration: Add Payroll and Attendance criteria flags to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_payroll_eligible BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_attendance BOOLEAN DEFAULT true;

-- Ensure default values for existing rows
UPDATE public.employees SET is_payroll_eligible = true WHERE is_payroll_eligible IS NULL;
UPDATE public.employees SET track_attendance = true WHERE track_attendance IS NULL;
