-- 1. Create inventory_stock_balances table
CREATE TABLE IF NOT EXISTS public.inventory_stock_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID,
  branch TEXT NOT NULL,
  location TEXT NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  department TEXT,
  sub_department TEXT,
  unit TEXT,
  current_stock NUMERIC DEFAULT 0,
  par_level NUMERIC DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create inventory_counts table (Stocktake header)
CREATE TABLE IF NOT EXISTS public.inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID,
  count_number TEXT,
  branch TEXT NOT NULL,
  location TEXT NOT NULL,
  department TEXT DEFAULT 'All',
  date TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'Completed', -- Draft, Completed, Approved
  counted_by TEXT,
  notes TEXT,
  total_variance_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create inventory_count_items table (Stocktake line items)
CREATE TABLE IF NOT EXISTS public.inventory_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  restaurant_id UUID,
  item_id UUID,
  item_name TEXT NOT NULL,
  department TEXT,
  unit TEXT,
  par_level NUMERIC DEFAULT 0,
  expected_qty NUMERIC DEFAULT 0,
  count_qty NUMERIC DEFAULT 0,
  variance_qty NUMERIC DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  variance_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create inventory_adjustments table (Manual Stock In/Out Data Entry)
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID,
  branch TEXT NOT NULL,
  location TEXT NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  adjustment_type TEXT NOT NULL, -- Stock In, Waste/Damage, Recount Correction, Direct Inflow, Internal Use, Expiry
  quantity NUMERIC NOT NULL,
  unit TEXT,
  unit_cost NUMERIC DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create inventory_transfers table (Stock Transfer header)
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID,
  transfer_number TEXT,
  from_branch TEXT NOT NULL,
  from_location TEXT NOT NULL,
  to_branch TEXT NOT NULL,
  to_location TEXT NOT NULL,
  status TEXT DEFAULT 'Completed', -- Pending, Completed, Cancelled
  transfer_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create inventory_transfer_items table
CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  restaurant_id UUID,
  item_id UUID,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT,
  unit_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Enable all access for authenticated users" ON public.inventory_stock_balances FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.inventory_counts FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.inventory_count_items FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.inventory_adjustments FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.inventory_transfers FOR ALL USING (true);
CREATE POLICY "Enable all access for authenticated users" ON public.inventory_transfer_items FOR ALL USING (true);
