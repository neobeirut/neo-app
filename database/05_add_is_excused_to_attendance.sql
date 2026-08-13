-- Migration: Add is_excused and notes columns to employee_attendance
ALTER TABLE employee_attendance
  ADD COLUMN IF NOT EXISTS is_excused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;
