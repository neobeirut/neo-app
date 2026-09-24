import { supabase } from './supabase';

export interface MenuProductProfitability {
  id: string;
  product_id: number;
  product_name: string;
  channel: string;
  bom_fingerprint: string;
  gross_units_sold: number;
  units_returned: number;
  net_units: number;
  gross_sales_revenue: number;
  total_discounts: number;
  net_sales_revenue: number;
  average_net_unit_price: number;
  theoretical_unit_food_cost: number;
  theoretical_food_cost_pct: number | null;
  realized_unit_food_cost: number;
  realized_food_cost_pct: number | null;
  total_cost_variance: number;
  unit_packaging_cost: number;
  total_packaging_cost: number;
  realized_total_variable_cost: number;
  realized_contribution_margin: number;
  unit_contribution_margin: number | null;
  contribution_margin_pct: number | null;
  menu_engineering_category: 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG' | 'UNCLASSIFIED';
}

export interface MarginScenarioResult {
  product_id: number;
  proposed_price: number;
  simulated_theoretical_food_cost: number;
  modeled_packaging_cost: number;
  simulated_total_variable_cost: number;
  simulated_contribution_margin: number;
  simulated_food_cost_pct: number | null;
  simulated_contribution_margin_pct: number | null;
  variance_vs_current_food_cost: number;
}

export interface RecipeCostAlert {
  id: string;
  product_id: number;
  product_name: string;
  alert_type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  current_value: number;
  threshold_value: number;
  status: string;
  created_at: string;
}

export const menuProfitabilityApi = {
  getDailySnapshots: async (restaurantId: string, branchId: string, date: string): Promise<MenuProductProfitability[]> => {
    const { data, error } = await supabase
      .from('product_daily_profitability_snapshots')
      .select(`
        *,
        product:products (id, name)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('branch_id', branchId)
      .eq('snapshot_date', date)
      .order('gross_units_sold', { ascending: false });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      product_name: row.product?.name || `Product #${row.product_id}`
    }));
  },

  getRecipeCostDetails: async (restaurantId: string, branchId: string, productId: number) => {
    const { data, error } = await supabase.rpc('compute_recipe_theoretical_cost', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_product_id: productId,
      p_as_of: new Date().toISOString()
    });
    if (error) throw error;
    return data;
  },

  simulateMarginScenario: async (
    restaurantId: string,
    branchId: string,
    productId: number,
    proposedPrice: number,
    componentOverrides: any[] = [],
    channel: string = 'DINE_IN'
  ): Promise<MarginScenarioResult> => {
    const { data, error } = await supabase.rpc('simulate_margin_scenario', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_product_id: productId,
      p_proposed_price: proposedPrice,
      p_component_overrides: componentOverrides,
      p_channel: channel
    });
    if (error) throw error;
    return data;
  },

  getActiveAlerts: async (restaurantId: string, branchId?: string): Promise<RecipeCostAlert[]> => {
    let query = supabase
      .from('recipe_cost_alerts')
      .select(`
        *,
        product:products (name)
      `)
      .eq('restaurant_id', restaurantId)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      product_name: row.product?.name || `Product #${row.product_id}`
    }));
  },

  getPackagingMaterials: async (restaurantId: string) => {
    const { data, error } = await supabase
      .from('packaging_materials')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');
    if (error) throw error;
    return data || [];
  },

  savePackagingSpecification: async (
    restaurantId: string,
    productId: number,
    channel: string,
    packagingMaterialId: string,
    quantity: number
  ) => {
    const { data, error } = await supabase.rpc('mutate_product_packaging_specification', {
      p_restaurant_id: restaurantId,
      p_product_id: productId,
      p_channel: channel,
      p_packaging_material_id: packagingMaterialId,
      p_quantity: quantity,
      p_effective_date: new Date().toISOString()
    });
    if (error) throw error;
    return data;
  },

  rebuildDailySnapshots: async (restaurantId: string, branchId: string, date: string) => {
    const { data, error } = await supabase.rpc('rebuild_product_daily_profitability_snapshots', {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId,
      p_snapshot_date: date
    });
    if (error) throw error;
    return data;
  }
};
