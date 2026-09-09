-- Migration 14: Create dedicated staff_departments and staff_sections tables for employees / HR
-- Scoped explicitly to restaurant_id

CREATE TABLE IF NOT EXISTS public.staff_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_staff_departments_resto_name UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_staff_departments_resto ON public.staff_departments(restaurant_id);

CREATE TABLE IF NOT EXISTS public.staff_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.staff_departments(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_staff_sections_resto_dept_name UNIQUE (restaurant_id, department_name, name)
);

CREATE INDEX IF NOT EXISTS idx_staff_sections_resto ON public.staff_sections(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_sections_resto_dept ON public.staff_sections(restaurant_id, department_name);

-- Seed default departments and sections for each existing restaurant
DO $$
DECLARE
  resto RECORD;
  floor_id UUID;
  kitchen_id UUID;
  mgmt_id UUID;
  dept_rec RECORD;
BEGIN
  FOR resto IN SELECT id FROM public.restaurants LOOP
    -- 1. Floor Department
    INSERT INTO public.staff_departments (restaurant_id, name, color, display_order)
    VALUES (resto.id, 'Floor', '#3b82f6', 1)
    ON CONFLICT (restaurant_id, name) DO UPDATE SET color = EXCLUDED.color
    RETURNING id INTO floor_id;

    -- Floor Sections
    INSERT INTO public.staff_sections (restaurant_id, department_id, department_name, name, display_order)
    VALUES 
      (resto.id, floor_id, 'Floor', 'Bar', 1),
      (resto.id, floor_id, 'Floor', 'Retail', 2),
      (resto.id, floor_id, 'Floor', 'Service', 3),
      (resto.id, floor_id, 'Floor', 'Host / Cashier', 4)
    ON CONFLICT (restaurant_id, department_name, name) DO NOTHING;

    -- 2. Kitchen Department
    INSERT INTO public.staff_departments (restaurant_id, name, color, display_order)
    VALUES (resto.id, 'Kitchen', '#f97316', 2)
    ON CONFLICT (restaurant_id, name) DO UPDATE SET color = EXCLUDED.color
    RETURNING id INTO kitchen_id;

    -- Kitchen Sections
    INSERT INTO public.staff_sections (restaurant_id, department_id, department_name, name, display_order)
    VALUES 
      (resto.id, kitchen_id, 'Kitchen', 'Hot Kitchen', 1),
      (resto.id, kitchen_id, 'Kitchen', 'Cold Kitchen / Prep', 2),
      (resto.id, kitchen_id, 'Kitchen', 'Bakery & Pastry', 3),
      (resto.id, kitchen_id, 'Kitchen', 'Stewarding / Dishwashing', 4)
    ON CONFLICT (restaurant_id, department_name, name) DO NOTHING;

    -- 3. Management Department
    INSERT INTO public.staff_departments (restaurant_id, name, color, display_order)
    VALUES (resto.id, 'Management', '#8b5cf6', 3)
    ON CONFLICT (restaurant_id, name) DO UPDATE SET color = EXCLUDED.color
    RETURNING id INTO mgmt_id;

    -- Management Sections
    INSERT INTO public.staff_sections (restaurant_id, department_id, department_name, name, display_order)
    VALUES 
      (resto.id, mgmt_id, 'Management', 'General Management', 1),
      (resto.id, mgmt_id, 'Management', 'Floor Supervisors', 2),
      (resto.id, mgmt_id, 'Management', 'Head Chefs', 3),
      (resto.id, mgmt_id, 'Management', 'Admin & Finance', 4)
    ON CONFLICT (restaurant_id, department_name, name) DO NOTHING;

    -- 4. Automatically import any distinct employee departments already in use for this restaurant
    FOR dept_rec IN 
      SELECT DISTINCT TRIM(department) AS dept_name 
      FROM public.employees 
      WHERE restaurant_id = resto.id 
        AND department IS NOT NULL 
        AND TRIM(department) != ''
    LOOP
      INSERT INTO public.staff_departments (restaurant_id, name, color, display_order)
      VALUES (resto.id, dept_rec.dept_name, '#10b981', 10)
      ON CONFLICT (restaurant_id, name) DO NOTHING;
    END LOOP;

  END LOOP;
END $$;
