-- Migration 13: Add sub_department to employees & tips_distribution
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS sub_department TEXT;

ALTER TABLE public.tips_distribution 
  ADD COLUMN IF NOT EXISTS sub_department TEXT;

-- Synchronize sequence for sub_departments
SELECT setval(
  COALESCE(pg_get_serial_sequence('public.sub_departments', 'id'), 'sub_departments_id_seq'),
  GREATEST(COALESCE((SELECT MAX(id) FROM public.sub_departments), 0) + 1, 2000)
);

-- Pre-populate linked sub-departments for Floor and Kitchen
DO $$
DECLARE
  resto RECORD;
  max_id INT;
BEGIN
  FOR resto IN SELECT DISTINCT restaurant_id FROM public.departments WHERE restaurant_id IS NOT NULL LOOP
    -- Floor Sub-Departments
    IF NOT EXISTS (SELECT 1 FROM public.sub_departments WHERE department_name = 'Floor' AND name = 'Bar' AND restaurant_id = resto.restaurant_id) THEN
      INSERT INTO public.sub_departments (department_name, name, restaurant_id) VALUES ('Floor', 'Bar', resto.restaurant_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sub_departments WHERE department_name = 'Floor' AND name = 'Retail' AND restaurant_id = resto.restaurant_id) THEN
      INSERT INTO public.sub_departments (department_name, name, restaurant_id) VALUES ('Floor', 'Retail', resto.restaurant_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sub_departments WHERE department_name = 'Floor' AND name = 'Service' AND restaurant_id = resto.restaurant_id) THEN
      INSERT INTO public.sub_departments (department_name, name, restaurant_id) VALUES ('Floor', 'Service', resto.restaurant_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sub_departments WHERE department_name = 'Floor' AND name = 'Host / Cashier' AND restaurant_id = resto.restaurant_id) THEN
      INSERT INTO public.sub_departments (department_name, name, restaurant_id) VALUES ('Floor', 'Host / Cashier', resto.restaurant_id);
    END IF;

    -- Kitchen Sub-Departments
    IF NOT EXISTS (SELECT 1 FROM public.sub_departments WHERE department_name = 'Kitchen' AND name = 'Hot Kitchen' AND restaurant_id = resto.restaurant_id) THEN
      INSERT INTO public.sub_departments (department_name, name, restaurant_id) VALUES ('Kitchen', 'Hot Kitchen', resto.restaurant_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sub_departments WHERE department_name = 'Kitchen' AND name = 'Cold Kitchen / Prep' AND restaurant_id = resto.restaurant_id) THEN
      INSERT INTO public.sub_departments (department_name, name, restaurant_id) VALUES ('Kitchen', 'Cold Kitchen / Prep', resto.restaurant_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sub_departments WHERE department_name = 'Kitchen' AND name = 'Bakery & Pastry' AND restaurant_id = resto.restaurant_id) THEN
      INSERT INTO public.sub_departments (department_name, name, restaurant_id) VALUES ('Kitchen', 'Bakery & Pastry', resto.restaurant_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sub_departments WHERE department_name = 'Kitchen' AND name = 'Stewarding / Dishwashing' AND restaurant_id = resto.restaurant_id) THEN
      INSERT INTO public.sub_departments (department_name, name, restaurant_id) VALUES ('Kitchen', 'Stewarding / Dishwashing', resto.restaurant_id);
    END IF;
  END LOOP;
END $$;

-- Migrate existing employees who had Bar or Retail as department to Floor with sub_department
UPDATE public.employees 
SET department = 'Floor', sub_department = 'Bar' 
WHERE LOWER(TRIM(department)) = 'bar' AND (sub_department IS NULL OR sub_department = '');

UPDATE public.employees 
SET department = 'Floor', sub_department = 'Retail' 
WHERE LOWER(TRIM(department)) = 'retail' AND (sub_department IS NULL OR sub_department = '');

UPDATE public.employees 
SET sub_department = 'Service' 
WHERE LOWER(TRIM(department)) = 'floor' AND (sub_department IS NULL OR sub_department = '');