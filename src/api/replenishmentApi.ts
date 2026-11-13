import { api } from './client';

export interface ReplenishmentPlanningSummary {
  has_data: boolean;
  batch_id?: string;
  batch_number?: string;
  status?: string;
  created_at?: string;
  created_by_name?: string;
  display_horizon_days?: number;
  lookback_days?: number;
  filter_parameters?: {
    horizon_days?: number;
    lookback_days?: number;
    category?: string;
    department?: string;
    supplier_id?: string | null;
    stock_filter?: string;
  };
  ai_summary_insights?: any;
  max_calculation_horizon_days?: number;
  total_items_evaluated?: number;
  total_reorders_recommended?: number;
  total_production_recommended?: number;
  total_production_drafts_created?: number;
  total_estimated_cost_usd?: number;
  total_exceptions_count?: number;
  imminent_stockouts_count?: number;
  timing_gaps_count?: number;
  do_not_reorder_count?: number;
  critical_priority_count?: number;
  low_confidence_count?: number;
  message?: string;
}

export interface ReplenishmentBatchSnapshot {
  batch_id: string;
  batch_number: string;
  branch_id: string;
  status: string;
  display_horizon_days: number;
  lookback_days: number;
  filter_parameters: Record<string, any>;
  total_items_evaluated: number;
  total_reorders_recommended: number;
  total_production_recommended: number;
  total_production_drafts_created: number;
  total_estimated_cost_usd: number;
  total_exceptions_count: number;
  created_by_name: string;
  created_at: string;
}

export interface SupplierCandidate {
  supplier_id: string;
  supplier_name: string;
  purchase_unit: string;
  purchase_unit_price: number;
  pack_size: number;
  base_unit_price: number;
  moq: number;
  lead_time_days: number;
  is_preferred: boolean;
  Composite_score?: number;
  estimated_arrival_date?: string;
  meets_service_date?: boolean;
  meets_stockout_date?: boolean;
}

export interface ReplenishmentRecommendationItem {
  item_rec_id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  item_category: 'RAW_MATERIAL' | 'PREPARATION' | 'RETAIL';
  department: string;
  normalized_department: 'Kitchen' | 'Bakery' | 'Pastry' | 'Bar' | 'Store';
  sourcing_type: 'PURCHASE' | 'PRODUCTION' | 'PURCHASE_OR_PRODUCTION';
  signed_ledger_stock: number;
  usable_stock: number;
  par_level: number;
  target_stock: number;
  reorder_point: number;
  safety_stock: number;
  inventory_position: number;
  daily_demand: number;
  direct_menu_daily_demand: number;
  indirect_prep_daily_demand: number;
  dependent_bom_horizon_demand: number;
  horizon_forecast_demand: number;
  active_consumption_days: number;
  consumption_frequency_pct: number;
  days_on_hand: number | null;
  projected_stockout_date?: string | null;
  days_until_stockout?: number | null;
  confirmed_incoming_po_qty: number;
  confirmed_incoming_production_qty: number;
  tentative_draft_production_qty: number;
  confirmed_incoming_transfer_qty: number;
  committed_production_reservation_qty: number;
  tentative_draft_reservation_qty: number;
  risk_level: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  override_priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | null;
  data_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  action_status: string;
  do_not_reorder_reason?: string | null;
  recommended_order_quantity: number;
  recommended_packs: number;
  pack_size: number;
  moq_packs: number;
  purchase_unit: string;
  base_unit: string;
  lead_time_days: number;
  suggested_order_date?: string | null;
  required_by_date?: string | null;
  suggested_production_date?: string | null;
  timing_gap_detected: boolean;
  bridge_deficit: number;
  recommended_supplier_id?: string | null;
  override_supplier_id?: string | null;
  supplier_name?: string | null;
  supplier_candidates: SupplierCandidate[];
  unit_cost_usd: number;
  estimated_total_cost_usd: number;
  production_recipe_id?: string | null;
  recommended_batch_yield_quantity?: number | null;
  shelf_life_days?: number | null;
  shelf_life_capped: boolean;
  manager_action: 'PENDING' | 'APPROVED' | 'MODIFIED' | 'REJECTED';
  override_quantity?: number | null;
  override_notes?: string | null;
  conversion_status: 'PENDING' | 'CONVERTED' | 'REJECTED';
  created_purchase_order_id?: string | null;
  created_production_batch_id?: string | null;
  created_task_id?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_user_name?: string | null;
  recommendation_explanation?: string | null;
  ai_explanation?: string | null;
  ai_flags: string[];
  exceptions: string[];
}

export interface ConsolidatedBomIngredient {
  item_id: string;
  item_name: string;
  base_unit: string;
  required_base_qty: number;
  usable_stock: number;
  committed_reservation_qty: number;
  available_for_production_qty: number;
  shortage_base_qty: number;
  has_shortage: boolean;
  recommended_supplier_id?: string | null;
  recommended_supplier_name?: string | null;
  purchase_unit: string;
  pack_size: number;
  moq_packs: number;
  recommended_packs: number;
  recommended_order_qty: number;
  unit_cost_usd: number;
  estimated_shortage_po_cost_usd: number;
}

export interface ProductionBomConsolidationPreview {
  preparations: Array<{
    item_id: string;
    recipe_id: string;
    recipe_name: string;
    planned_yield_qty: number;
    yield_unit: string;
    ingredients: Array<{
      item_id: string;
      item_name: string;
      required_base_qty: number;
      base_unit: string;
      waste_percentage: number;
    }>;
  }>;
  consolidated_ingredients: ConsolidatedBomIngredient[];
  shortages_count: number;
}

export const replenishmentApi = {
  generateRecommendations: async (
    branchId: string,
    horizonDays: number = 14,
    options?: {
      lookbackDays?: number;
      category?: string;
      department?: string;
      supplierId?: string;
      stockFilter?: string;
    }
  ) => {
    return api.generateReplenishmentRecommendations({
      branch_id: branchId,
      horizon_days: horizonDays,
      lookback_days: options?.lookbackDays,
      category: options?.category,
      department: options?.department,
      supplier_id: options?.supplierId || undefined,
      stock_filter: options?.stockFilter,
    });
  },

  getSummary: async (branchId: string, batchId?: string) => {
    return api.getReplenishmentPlanningSummary({ branch_id: branchId, batch_id: batchId });
  },

  getBatchesHistory: async (branchId: string, limit: number = 20) => {
    return api.getReplenishmentBatchesHistory({ branch_id: branchId, limit });
  },

  getList: async (
    branchId: string,
    batchId?: string,
    statusFilter?: string,
    extraFilters?: {
      category?: string;
      department?: string;
      supplierId?: string;
      stockFilter?: string;
    }
  ) => {
    return api.getReplenishmentRecommendationsList({
      branch_id: branchId,
      batch_id: batchId,
      status_filter: statusFilter,
      category_filter: extraFilters?.category,
      department_filter: extraFilters?.department,
      supplier_filter: extraFilters?.supplierId || undefined,
      stock_filter: extraFilters?.stockFilter,
    });
  },

  overrideItem: async (params: {
    itemRecId: string;
    action: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'QUANTITY_OVERRIDE' | 'SUPPLIER_OVERRIDE' | 'PRIORITY_OVERRIDE';
    overrideQty?: number;
    overrideSupplierId?: string;
    overridePriority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
    assignedToUserId?: string;
    assignedToUserName?: string;
    requiredByDate?: string;
    notes?: string;
  }) => {
    return api.overrideReplenishmentRecommendationItem({
      item_rec_id: params.itemRecId,
      action: params.action,
      override_qty: params.overrideQty,
      override_supplier_id: params.overrideSupplierId,
      override_priority: params.overridePriority,
      assigned_to_user_id: params.assignedToUserId,
      assigned_to_user_name: params.assignedToUserName,
      required_by_date: params.requiredByDate,
      notes: params.notes,
    });
  },

  convertToPurchaseOrders: async (batchId: string, supplierIds?: string[], itemRecIds?: string[]) => {
    return api.convertReplenishmentBatchToPurchaseOrders({
      batch_id: batchId,
      supplier_ids: supplierIds,
      item_rec_ids: itemRecIds,
    });
  },

  previewProductionBomConsolidation: async (
    branchId: string,
    items: Array<{ item_id: string; recipe_id?: string; quantity: number }>
  ) => {
    return api.previewProductionBomConsolidation({ branch_id: branchId, items });
  },

  createShortageDraftPurchaseOrders: async (params: {
    branchId: string;
    batchId?: string;
    shortageItems: Array<{
      item_id: string;
      supplier_id: string;
      quantity: number;
      pack_size?: number;
      purchase_unit?: string;
      unit_cost_usd?: number;
    }>;
  }) => {
    return api.createShortageDraftPurchaseOrders({
      branch_id: params.branchId,
      batch_id: params.batchId,
      shortage_items: params.shortageItems,
    });
  },

  convertToProductionBatches: async (params: {
    batchId: string;
    items: Array<{
      item_rec_id: string;
      recipe_id?: string;
      quantity?: number;
      priority?: string;
      required_by_date?: string;
      suggested_production_date?: string;
      department?: string;
      assigned_to_user_id?: string;
      assigned_to_user_name?: string;
    }>;
    userId?: string;
    userName?: string;
  }) => {
    return api.convertReplenishmentToProductionBatches({
      batch_id: params.batchId,
      items: params.items,
      user_id: params.userId,
      user_name: params.userName,
    });
  },

  saveAiInsights: async (params: { batchId: string; summary: any; itemInsights: any[] }) => {
    return api.saveReplenishmentAiInsights({
      batch_id: params.batchId,
      summary: params.summary,
      item_insights: params.itemInsights,
    });
  },

  approveProductionBatch: async (params: { batchId: string; userId?: string; userName?: string }) => {
    return api.approveProductionBatch({
      batch_id: params.batchId,
      user_id: params.userId,
      user_name: params.userName,
    });
  },

  getDecisionHistory: async (batchId?: string, itemRecId?: string) => {
    return api.getReplenishmentDecisionHistory({ batch_id: batchId, item_rec_id: itemRecId });
  },
};
