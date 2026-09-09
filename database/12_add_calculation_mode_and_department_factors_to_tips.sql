-- Add calculation_mode and department_factors to tips_settings
ALTER TABLE public.tips_settings 
  ADD COLUMN IF NOT EXISTS calculation_mode TEXT DEFAULT 'by_department',
  ADD COLUMN IF NOT EXISTS department_factors JSONB DEFAULT '{"Floor": 7, "Kitchen": 3}'::jsonb;

-- Add calculation_mode and department_factors to tips_collections
ALTER TABLE public.tips_collections 
  ADD COLUMN IF NOT EXISTS calculation_mode TEXT DEFAULT 'by_department',
  ADD COLUMN IF NOT EXISTS department_factors JSONB DEFAULT '{"Floor": 7, "Kitchen": 3}'::jsonb;

-- Add department to tips_distribution
ALTER TABLE public.tips_distribution 
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Floor';
