-- Add is_tips_eligible criteria to public.employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_tips_eligible BOOLEAN DEFAULT true;

