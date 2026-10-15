-- Add operational status, closure reason, closed until timestamp, and weekday schedule JSON to public.branches
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS operational_status VARCHAR(50) DEFAULT 'open';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS closure_reason VARCHAR(100);
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS closed_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS weekday_schedule JSONB;

-- Ensure default operational_status for existing rows
UPDATE public.branches 
SET operational_status = 'open' 
WHERE operational_status IS NULL;
