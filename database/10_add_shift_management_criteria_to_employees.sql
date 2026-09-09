-- Add shift_management criteria to public.employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS shift_management BOOLEAN DEFAULT true;

