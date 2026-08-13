-- Migration: Add Shift Swap columns to employee_leave_requests table
ALTER TABLE public.employee_leave_requests
  ADD COLUMN IF NOT EXISTS peer_employee_id TEXT,
  ADD COLUMN IF NOT EXISTS peer_agreed_at TIMESTAMPTZ;
