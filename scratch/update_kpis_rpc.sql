-- Drop old get_dashboard_kpis function
DROP FUNCTION IF EXISTS public.get_dashboard_kpis(DATE, TEXT, TEXT);

-- Create new get_dashboard_kpis RPC function with p_restaurant_id parameter
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_date DATE,
  p_branch TEXT,
  p_dept TEXT,
  p_restaurant_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orders_pending_count INT;
  v_purchasing_pending_count INT;
  v_unavailable_count INT;
  v_waste_count INT;
  v_complaints_count INT;
  v_reservations_count INT;
  v_next_reservation_time TEXT;
  v_cash_am_count INT;
  v_cash_pm_count INT;
  v_cash_diff_count INT;
  v_cash_status_text TEXT;
  v_cash_status TEXT; -- 'success', 'warning', 'danger', 'neutral'
  v_checklist_percentage INT;
  v_checklist_status TEXT;
  v_active_checklist_count INT;
  v_checklist_submissions_count INT;
  
  -- Alerts temp counts
  v_orders_not_sent INT;
  v_purchasing_partially_received INT;
  v_complaints_open INT;
  v_items_below_par INT;
  v_checklists_overdue INT;
  
  v_alerts TEXT[] := '{}';
  v_result JSONB;
BEGIN
  -- 1. Pending Orders
  SELECT COUNT(DISTINCT id)
  INTO v_orders_pending_count
  FROM public.orders
  WHERE branch = p_branch
    AND status IN ('Draft', 'Submitted', 'Submitted_Draft', 'Sent')
    AND (p_dept = 'All' OR to_department = p_dept)
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  -- 2. Purchasing Pending
  SELECT COUNT(DISTINCT id)
  INTO v_purchasing_pending_count
  FROM public.purchasing_requests
  WHERE branch = p_branch
    AND status IN ('Submitted', 'Ordered', 'Partially Received')
    AND (p_dept = 'All' OR department = p_dept)
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  -- 3. Unavailable Items Today
  WITH unavail_items AS (
    SELECT DISTINCT (item_obj->>'name') as item_name
    FROM public.menu_86 m
    LEFT JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(m.items) = 'array' THEN m.items ELSE '[]'::jsonb END
    ) as item_obj ON TRUE
    WHERE m.branch = p_branch
      AND m.date = p_date
      AND (p_restaurant_id IS NULL OR m.restaurant_id = p_restaurant_id)
  ),
  unavail_with_dept AS (
    SELECT item_name,
      COALESCE(
        (SELECT department FROM public.items WHERE name = item_name AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id) LIMIT 1),
        (SELECT ms.department FROM public.menu_recipes mr JOIN public.menu_sections ms ON mr.section_id = ms.id WHERE mr.item_name = item_name AND (p_restaurant_id IS NULL OR mr.restaurant_id = p_restaurant_id) LIMIT 1),
        'Kitchen'
      ) as resolved_dept
    FROM unavail_items
    WHERE item_name IS NOT NULL
  )
  SELECT COUNT(*)
  INTO v_unavailable_count
  FROM unavail_with_dept
  WHERE (p_dept = 'All' OR resolved_dept = p_dept);

  -- 4. Waste Today
  SELECT COALESCE(COUNT(DISTINCT waste_id), 0)
  INTO v_waste_count
  FROM public.waste_logs
  WHERE branch = p_branch
    AND date::date = p_date
    AND (p_dept = 'All' OR department = p_dept OR department = 'All')
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  -- 5. Open Client Complaints
  SELECT COUNT(*)
  INTO v_complaints_count
  FROM public."ClientComplaints"
  WHERE "Branch" = p_branch
    AND "Status" NOT IN ('Resolved', 'Closed')
    AND (p_dept = 'All' OR "Department" = p_dept)
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  -- 6. Reservations Today (Count all for that date)
  SELECT COUNT(*)
  INTO v_reservations_count
  FROM public.reservations
  WHERE branch = p_branch
    AND reservation_date = p_date
    AND status <> 'Cancelled'
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  -- Earliest upcoming reservation time (Only if selected date is today/future)
  SELECT SUBSTRING(MIN(reservation_time)::text FROM 1 FOR 5)
  INTO v_next_reservation_time
  FROM public.reservations
  WHERE branch = p_branch
    AND reservation_date = p_date
    AND status <> 'Cancelled'
    AND (
      p_date > CURRENT_DATE 
      OR (p_date = CURRENT_DATE AND reservation_time >= CURRENT_TIME::time)
    )
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  -- 7. Daily Cash Status
  SELECT 
    COUNT(*) FILTER (WHERE shift = 'AM'),
    COUNT(*) FILTER (WHERE shift = 'PM'),
    COALESCE(SUM(CASE WHEN difference_usd <> 0 THEN 1 ELSE 0 END), 0)
  INTO v_cash_am_count, v_cash_pm_count, v_cash_diff_count
  FROM public.shift_cash
  WHERE date = p_date AND branch = p_branch
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  IF v_cash_am_count = 0 AND v_cash_pm_count = 0 THEN
    v_cash_status_text := 'Missing';
    v_cash_status := 'danger';
  ELSIF v_cash_diff_count > 0 THEN
    v_cash_status_text := 'Difference detected';
    v_cash_status := 'danger';
  ELSIF v_cash_am_count > 0 AND v_cash_pm_count > 0 THEN
    v_cash_status_text := 'Complete';
    v_cash_status := 'success';
  ELSIF v_cash_am_count > 0 AND v_cash_pm_count = 0 THEN
    v_cash_status_text := 'Afternoon pending';
    v_cash_status := 'warning';
  ELSE
    v_cash_status_text := 'Morning missing';
    v_cash_status := 'warning';
  END IF;

  -- 8. Checklist Completion Percentage
  DECLARE
    v_total_tasks INT := 0;
    v_completed_tasks INT := 0;
  BEGIN
    WITH active_checklists AS (
      SELECT id, name, 
             CASE WHEN jsonb_typeof(tasks) = 'array' THEN jsonb_array_length(tasks) ELSE 0 END as task_count
      FROM public.checklists
      WHERE is_active = true
        AND branch = p_branch
        AND (p_dept = 'All' OR department = p_dept)
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
    ),
    latest_submissions AS (
      SELECT DISTINCT ON (checklist_id) checklist_id, responses
      FROM public.checklist_submissions
      WHERE branch = p_branch
        AND (p_dept = 'All' OR department = p_dept)
        AND date_submitted::date = p_date
        AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
      ORDER BY checklist_id, date_submitted DESC
    ),
    completion_stats AS (
      SELECT 
        ac.id,
        ac.task_count,
        COALESCE(
          (
            SELECT count(*)
            FROM jsonb_each(
              CASE WHEN jsonb_typeof(ls.responses) = 'object' THEN ls.responses ELSE '{}'::jsonb END
            ) AS r
            WHERE r.value IS NOT NULL 
              AND r.value <> 'false'::jsonb 
              AND r.value <> '""'::jsonb 
              AND r.value <> 'null'::jsonb
          ), 0
        ) as completed_count
      FROM active_checklists ac
      LEFT JOIN latest_submissions ls ON ac.id = ls.checklist_id
    )
    SELECT 
      COALESCE(SUM(task_count), 0),
      COALESCE(SUM(completed_count), 0)
    INTO v_total_tasks, v_completed_tasks
    FROM completion_stats;

    IF v_total_tasks > 0 THEN
      v_checklist_percentage := ROUND((v_completed_tasks::numeric / v_total_tasks::numeric) * 100);
    ELSE
      v_checklist_percentage := 0;
    END IF;

    -- Calculate checklists overdue
    SELECT COUNT(*)
    INTO v_checklists_overdue
    FROM public.checklists c
    WHERE c.is_active = true
      AND c.branch = p_branch
      AND (p_dept = 'All' OR c.department = p_dept)
      AND (p_restaurant_id IS NULL OR c.restaurant_id = p_restaurant_id)
      AND NOT EXISTS (
        SELECT 1 
        FROM public.checklist_submissions cs
        WHERE cs.checklist_id = c.id
          AND cs.branch = p_branch
          AND cs.date_submitted::date = p_date
          AND (p_restaurant_id IS NULL OR cs.restaurant_id = p_restaurant_id)
      );
  END;

  -- Calculate Alerts
  -- 1. Orders not sent
  SELECT COUNT(DISTINCT id)
  INTO v_orders_not_sent
  FROM public.orders
  WHERE branch = p_branch
    AND status IN ('Draft', 'Submitted', 'Submitted_Draft')
    AND (p_dept = 'All' OR to_department = p_dept)
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  IF v_orders_not_sent > 0 THEN
    v_alerts := array_append(v_alerts, v_orders_not_sent || ' orders still not sent');
  END IF;

  -- 2. Purchasing partially received
  SELECT COUNT(DISTINCT id)
  INTO v_purchasing_partially_received
  FROM public.purchasing_requests
  WHERE branch = p_branch
    AND status = 'Partially Received'
    AND (p_dept = 'All' OR department = p_dept)
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  IF v_purchasing_partially_received > 0 THEN
    v_alerts := array_append(v_alerts, v_purchasing_partially_received || ' purchasing orders partially received');
  END IF;

  -- 3. Complaints open
  SELECT COUNT(*)
  INTO v_complaints_open
  FROM public."ClientComplaints"
  WHERE "Branch" = p_branch
    AND "Status" NOT IN ('Resolved', 'Closed')
    AND (p_dept = 'All' OR "Department" = p_dept)
    AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id);

  IF v_complaints_open > 0 THEN
    v_alerts := array_append(v_alerts, v_complaints_open || ' complaints waiting for follow-up');
  END IF;

  -- 4. Items below par level
  WITH latest_counts AS (
    SELECT DISTINCT ON (item) item, count_qty, par_level
    FROM public.inventory_counts
    WHERE branch = p_branch
      AND (p_dept = 'All' OR department = p_dept)
      AND (p_restaurant_id IS NULL OR restaurant_id = p_restaurant_id)
    ORDER BY item, date DESC, created_at DESC
  )
  SELECT COUNT(*)
  INTO v_items_below_par
  FROM latest_counts
  WHERE count_qty < par_level;

  IF v_items_below_par > 0 THEN
    v_alerts := array_append(v_alerts, v_items_below_par || ' items below par level');
  END IF;

  -- 5. Afternoon cash not submitted
  IF v_cash_status_text = 'Afternoon pending' THEN
    v_alerts := array_append(v_alerts, 'Afternoon cash not submitted');
  ELSIF v_cash_status_text = 'Missing' THEN
    v_alerts := array_append(v_alerts, 'Morning and Afternoon cash not submitted');
  ELSIF v_cash_status_text = 'Morning missing' THEN
    v_alerts := array_append(v_alerts, 'Morning cash not submitted');
  END IF;

  -- 6. Checklists overdue
  IF v_checklists_overdue > 0 THEN
    v_alerts := array_append(v_alerts, v_checklists_overdue || ' checklist' || CASE WHEN v_checklists_overdue > 1 THEN 's' ELSE '' END || ' overdue');
  END IF;

  -- Build final JSON result
  v_result := jsonb_build_object(
    'orders', jsonb_build_object(
      'pendingCount', v_orders_pending_count,
      'status', CASE WHEN v_orders_pending_count > 0 THEN 'warning' ELSE 'success' END
    ),
    'purchasing', jsonb_build_object(
      'pendingCount', v_purchasing_pending_count,
      'status', CASE WHEN v_purchasing_pending_count > 0 THEN 'warning' ELSE 'success' END
    ),
    'unavailableItems', jsonb_build_object(
      'todayCount', v_unavailable_count,
      'status', CASE WHEN v_unavailable_count > 0 THEN 'alert' ELSE 'success' END
    ),
    'waste', jsonb_build_object(
      'todayCount', v_waste_count,
      'status', 'neutral'
    ),
    'complaints', jsonb_build_object(
      'openCount', v_complaints_count,
      'status', CASE WHEN v_complaints_count > 0 THEN 'alert' ELSE 'success' END
    ),
    'reservations', jsonb_build_object(
      'todayCount', v_reservations_count,
      'nextTime', COALESCE(v_next_reservation_time, ''),
      'status', 'neutral'
    ),
    'dailyCash', jsonb_build_object(
      'statusText', v_cash_status_text,
      'status', v_cash_status
    ),
    'checklists', jsonb_build_object(
      'completionPercent', v_checklist_percentage,
      'status', CASE WHEN v_checklist_percentage = 100 THEN 'success' WHEN v_checklist_percentage >= 50 THEN 'warning' ELSE 'danger' END
    ),
    'alerts', to_jsonb(v_alerts)
  );

  RETURN v_result;
END;
$$;
