-- 1. Add settings JSONB column to public.restaurants table if it doesn't exist
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"enabled_sections": []}'::jsonb;

-- 2. Populate existing restaurants with default enabled sections (all sections enabled by default)
UPDATE public.restaurants 
SET settings = '{"enabled_sections": [
  "orders", "client_orders", "reservations", "checklists", "shift_submissions", "tasks",
  "catalog", "purchasing", "suppliers", "waste", "missing_items", "voids", 
  "employees", "tips", "permissions", "signin_logs", "complaints", "specials", 
  "finance", "branch_management", "news", "sops", "menu"
]}'::jsonb
WHERE settings IS NULL OR settings->'enabled_sections' IS NULL OR jsonb_array_length(settings->'enabled_sections') = 0;

-- 3. Create public.complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ComplaintID" TEXT NOT NULL UNIQUE,
  "Branch" TEXT NOT NULL,
  "LoggedBy" TEXT,
  "ClientName" TEXT NOT NULL,
  "ClientPhone" TEXT,
  "ClientEmail" TEXT,
  "OrderType" TEXT DEFAULT 'Dine-In',
  "TableNumber" TEXT,
  "OrderNumber" TEXT,
  "Category" TEXT NOT NULL,
  "SubCategory" TEXT,
  "Severity" TEXT DEFAULT 'Low',
  "Description" TEXT NOT NULL,
  "ItemInvolved" TEXT,
  "StaffInvolved" TEXT,
  "Department" TEXT,
  "ImmediateAction" TEXT,
  "CompensationAmount" NUMERIC DEFAULT 0,
  "Status" TEXT DEFAULT 'New',
  "AttachmentURLs" TEXT[] DEFAULT '{}',
  "RootCause" TEXT,
  "InternalNotes" TEXT,
  "TrainingRequired" BOOLEAN DEFAULT false,
  "SupplierIssue" BOOLEAN DEFAULT false,
  "RecurringProblem" BOOLEAN DEFAULT false,
  "Resolution" TEXT,
  "CustomerSatisfied" TEXT,
  "ResolvedBy" TEXT,
  "ResolutionDate" TIMESTAMPTZ,
  "DateCreated" TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Create access policies
CREATE POLICY "Enable read access for all authenticated users" ON public.complaints
  FOR SELECT USING (true);

CREATE POLICY "Enable write access for all authenticated users" ON public.complaints
  FOR ALL USING (true);

