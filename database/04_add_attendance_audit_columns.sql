-- Migration: Add audit columns to employee_attendance for tracking punch modifications
ALTER TABLE employee_attendance
  ADD COLUMN IF NOT EXISTS modified_by text,
  ADD COLUMN IF NOT EXISTS modified_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS modification_reason text;
