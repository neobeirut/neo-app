import { supabase } from './supabase';

export interface StoreOperatingPnlReport {
  branch_id: string;
  period_start: string;
  period_end: string;
  gross_sales_revenue: number;
  discounts_and_promotions: number;
  net_sales_revenue: number;
  realized_food_cost: number;
  modeled_packaging_cost: number;
  product_contribution_margin: number;
  channel_commissions: number;
  payment_processing_fees: number;
  direct_variable_selling_costs: number;
  contribution_after_channel_costs: number;
  direct_operating_labor_cost: number;
  store_prime_contribution: number;
  prime_cost: number;
  prime_cost_percentage: number | null;
  controllable_operating_expenses: number;
  controllable_operating_profit: number;
  fixed_store_operating_expenses: number;
  store_management_overhead_labor: number;
  store_operating_profit: number;
  store_operating_margin_percentage: number | null;
  break_even_sales_volume: number | null;
  total_operating_hours: number;
  target_prime_cost_pct: number | null;
  target_operating_margin_pct: number | null;
  calculation_lifecycle: 'RUNNING' | 'COMPLETE' | 'FAILED' | 'STALE';
  management_close_status: 'OPEN' | 'PROVISIONAL' | 'CLOSED' | 'REOPENED';
}

export interface LiveProvisionalPnl {
  mode: 'LIVE_PROVISIONAL';
  business_date: string;
  gross_sales_revenue: number;
  discounts: number;
  net_sales_revenue: number;
  realized_food_cost: number;
  modeled_packaging_cost: number;
  direct_operating_labor_cost: number;
  prime_cost: number;
  controllable_operating_expenses: number;
  fixed_store_operating_expenses: number;
  store_management_overhead_labor: number;
  store_operating_profit: number;
  completeness_flags: string[];
}

export interface OperatingScenarioSimulation {
  business_date: string;
  simulated_net_sales: number;
  simulated_realized_food_cost: number;
  simulated_direct_operating_labor: number;
  simulated_prime_cost: number;
  simulated_prime_cost_percentage: number | null;
  simulated_controllable_expenses: number;
  simulated_store_operating_profit: number;
  simulated_store_operating_margin_percentage: number | null;
  simulated_break_even_sales_volume: number | null;
  delta_operating_profit: number;
}

export const storeOperatingPnlApi = {
  getPnlReport: async (restaurantId: string, branchId: string, startDate: string, endDate: string): Promise<StoreOperatingPnlReport | null> => {
    const { data, error } = await supabase.rpc('get_store_operating_pnl_report', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_start_date: startDate,
      p_end_date: endDate
    });
    if (error) {
      console.error('Failed to load store operating P&L report:', error);
      throw error;
    }
    return (data && data.length > 0) ? data[0] : null;
  },

  getLiveProvisionalPnl: async (restaurantId: string, branchId: string, date?: string): Promise<LiveProvisionalPnl> => {
    const { data, error } = await supabase.rpc('get_live_provisional_pnl', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_business_date: date || new Date().toISOString().split('T')[0]
    });
    if (error) {
      console.error('Failed to load live provisional P&L:', error);
      throw error;
    }
    return data;
  },

  rebuildDailySnapshot: async (restaurantId: string, branchId: string, date: string): Promise<any> => {
    const { data, error } = await supabase.rpc('rebuild_store_daily_operating_pnl_snapshots', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_business_date: date
    });
    if (error) {
      console.error('Failed to rebuild daily store operating P&L snapshot:', error);
      throw error;
    }
    return data;
  },

  managePeriodClose: async (
    restaurantId: string, 
    branchId: string, 
    periodType: 'DAILY' | 'MONTHLY',
    periodStart: string,
    periodEnd: string,
    action: 'CLOSE' | 'REOPEN' | 'SET_PROVISIONAL',
    reason?: string
  ): Promise<any> => {
    const { data, error } = await supabase.rpc('manage_store_period_closure', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_period_type: periodType,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_action: action,
      p_reason: reason || null
    });
    if (error) {
      console.error('Failed to manage store period closure:', error);
      throw error;
    }
    return data;
  },

  simulateScenario: async (
    restaurantId: string,
    branchId: string,
    date: string,
    salesDelta: number,
    foodDelta: number,
    laborDelta: number,
    ctrlDelta: number
  ): Promise<OperatingScenarioSimulation> => {
    const { data, error } = await supabase.rpc('simulate_store_operating_scenario', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_business_date: date,
      p_sales_volume_delta_pct: salesDelta,
      p_food_cost_delta_pct: foodDelta,
      p_labor_cost_delta_pct: laborDelta,
      p_controllable_delta_pct: ctrlDelta
    });
    if (error) {
      console.error('Failed to simulate scenario:', error);
      throw error;
    }
    return data;
  }
};
