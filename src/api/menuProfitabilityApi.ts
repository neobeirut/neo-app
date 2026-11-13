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
  getDailySnapshots: async (
    restaurantId: string, 
    branchId?: string | null, 
    startDate?: string, 
    endDate?: string
  ): Promise<MenuProductProfitability[]> => {
    const params: any = {
      p_restaurant_id: restaurantId,
      p_branch_id: branchId || null
    };
    if (startDate) params.p_start_date = startDate;
    if (endDate) params.p_end_date = endDate;

    const { data, error } = await supabase.rpc('get_product_profitability_report', params);

    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      id: `${row.product_id}-${row.channel}-${row.snapshot_date}`,
      product_name: row.product_name || `Product #${row.product_id}`,
      gross_units_sold: Number(row.gross_units_sold || 0),
      units_returned: Number(row.units_returned || 0),
      net_units: Number(row.net_units || 0),
      gross_sales_revenue: Number(row.gross_sales_revenue || 0),
      total_discounts: Number(row.total_discounts || 0),
      net_sales_revenue: Number(row.net_sales_revenue || 0),
      average_net_unit_price: Number(row.average_net_unit_price || 0),
      theoretical_total_food_cost: row.theoretical_total_food_cost !== null && row.theoretical_total_food_cost !== undefined ? Number(row.theoretical_total_food_cost) : null,
      theoretical_unit_food_cost: row.theoretical_unit_food_cost !== null && row.theoretical_unit_food_cost !== undefined ? Number(row.theoretical_unit_food_cost) : null,
      theoretical_food_cost_pct: row.theoretical_food_cost_pct !== null && row.theoretical_food_cost_pct !== undefined ? Number(row.theoretical_food_cost_pct) : null,
      realized_total_food_cost: Number(row.realized_total_food_cost || 0),
      realized_unit_food_cost: Number(row.realized_unit_food_cost || 0),
      realized_food_cost_pct: row.realized_food_cost_pct !== null && row.realized_food_cost_pct !== undefined ? Number(row.realized_food_cost_pct) : null,
      total_cost_variance: row.total_cost_variance !== null && row.total_cost_variance !== undefined ? Number(row.total_cost_variance) : 0,
      total_packaging_cost: Number(row.total_packaging_cost || 0),
      unit_packaging_cost: Number(row.unit_packaging_cost || 0),
      realized_total_variable_cost: Number(row.realized_total_variable_cost || 0),
      realized_contribution_margin: Number(row.realized_contribution_margin || 0),
      unit_contribution_margin: row.unit_contribution_margin !== null && row.unit_contribution_margin !== undefined ? Number(row.unit_contribution_margin) : null,
      contribution_margin_pct: row.contribution_margin_pct !== null && row.contribution_margin_pct !== undefined ? Number(row.contribution_margin_pct) : null
    }));
  },

  getRecipeCostDetails: async (restaurantId: string, branchId: string, productId: number) => {
    const { data, error } = await supabase.rpc('get_product_recipe_cost_detail', {
      p_restaurant_id: restaurantId,
      p_product_id: productId,
      p_branch_id: branchId
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
    try {
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
      if (error) {
        console.warn('getActiveAlerts warning:', error.message);
        return [];
      }
      return (data || []).map((row: any) => ({
        ...row,
        product_name: row.product?.name || `Product #${row.product_id}`
      }));
    } catch (e) {
      console.warn('getActiveAlerts error:', e);
      return [];
    }
  },

  getPackagingSpecifications: async (restaurantId: string, productId?: number) => {
    let query = supabase
      .from('product_packaging_specifications')
      .select(`
        *,
        packaging_material:packaging_materials (name, unit, current_cost_usd),
        product:products (name)
      `)
      .eq('restaurant_id', restaurantId)
      .is('effective_to', null)
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
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
