import { supabase } from './supabase';

export interface CostControlDashboardSummary {
  status: string;
  restaurant_id: string;
  branch_id: string;
  business_date: string;
  snapshot_run: {
    run_id: string;
    run_version: number;
    run_mode: string;
    status: string;
    total_theoretical_sales_cost: number;
    total_actual_productive_cost: number;
    total_productive_usage_variance_cost: number;
    recorded_waste_cost: number;
    production_yield_loss_cost: number;
    total_unexplained_variance_cost: number;
    completed_at: string;
  };
  item_variances: Array<{
    item_id: string;
    item_name: string;
    category: string;
    unit: string;
    moving_wac: number;
    theoretical_cost: number;
    actual_cost: number;
    usage_variance_qty: number;
    usage_variance_cost: number;
    usage_variance_pct: number;
    unexplained_variance_cost: number;
    is_anomaly: boolean;
    max_acceptable_pct: number;
    max_acceptable_dollar: number;
  }>;
  waste_breakdowns: Array<{
    id: string;
    reason_code: string;
    display_name: string;
    waste_source: string;
    classification: string;
    is_avoidable: boolean;
    total_cost: number;
    waste_pct_of_sales: number;
  }>;
  yield_variances: Array<{
    id: string;
    batch_id: string;
    recipe_id: string;
    recipe_name: string;
    output_item_name: string;
    base_scale_factor: number;
    expected_good_output: number;
    actual_good_output: number;
    yield_loss_qty: number;
    yield_loss_cost: number;
    input_ratio_variance_cost: number;
    yield_status: string;
  }>;
  active_alerts: Array<{
    id: string;
    alert_type: string;
    entity_id: string;
    severity: string;
    variance_amount_dollars: number;
    message: string;
    status: string;
    linked_task_id: string | null;
    action_note: string | null;
    created_at: string;
  }>;
}

export interface PnlReconciliationCertificate {
  reconciliation_certificate: {
    restaurant_id: string;
    branch_id: string;
    business_date: string;
    phase9_pnl_benchmark: {
      phase9_realized_food_cost: number;
      phase9_net_sales_revenue: number;
    };
    phase10_sales_food_cost_coverage: {
      theoretical_sales_bom_cost: number;
      actual_sales_productive_cost: number;
      productive_usage_variance_cost: number;
      unreconciled_delta: number;
      reconciliation_status: string;
    };
    phase10_additional_operational_leakage: {
      recorded_waste_cost: number;
      production_yield_loss_cost: number;
      transit_shrinkage_cost: number;
      unexplained_stocktake_shrinkage_cost: number;
      total_additional_leakage: number;
    };
    comprehensive_total_food_usage_cost: number;
    audit_guarantee: string;
  };
  status?: string;
  message?: string;
}

export const costControlApi = {
  getDashboardSummary: async (restaurantId: string, branchId: string, businessDate: string): Promise<CostControlDashboardSummary> => {
    const { data, error } = await supabase.rpc('get_cost_control_dashboard_summary', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_business_date: businessDate
    });
    if (error) {
      console.error('Failed to load cost control dashboard summary:', error);
      throw error;
    }
    return data;
  },

  getPnlReconciliationCertificate: async (restaurantId: string, branchId: string, businessDate: string): Promise<PnlReconciliationCertificate> => {
    const { data, error } = await supabase.rpc('get_cost_control_pnl_reconciliation_certificate', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_business_date: businessDate
    });
    if (error) {
      console.error('Failed to load reconciliation certificate:', error);
      throw error;
    }
    return data;
  },

  rebuildDailySnapshot: async (restaurantId: string, branchId: string, businessDate: string, runMode: string = 'AUTHORITATIVE'): Promise<any> => {
    const { data, error } = await supabase.rpc('rebuild_cost_control_daily_snapshot', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_business_date: businessDate,
      p_run_mode: runMode
    });
    if (error) {
      console.error('Failed to rebuild cost control daily snapshot:', error);
      throw error;
    }
    return data;
  },

  actionAlert: async (restaurantId: string, alertId: string, action: string, notes: string = ''): Promise<any> => {
    const { data, error } = await supabase.rpc('action_cost_control_alert', {
      p_restaurant_id: restaurantId,
      p_alert_id: alertId,
      p_action: action,
      p_action_notes: notes
    });
    if (error) {
      console.error('Failed to action alert:', error);
      throw error;
    }
    return data;
  },

  computeBatchYieldDetails: async (restaurantId: string, batchId: string, businessDate: string): Promise<any> => {
    const { data, error } = await supabase.rpc('compute_production_batch_yield_details', {
      p_restaurant_id: restaurantId,
      p_batch_id: batchId,
      p_business_date: businessDate
    });
    if (error) {
      console.error('Failed to compute batch yield details:', error);
      throw error;
    }
    return data;
  }
};
