import { api } from './client';

export interface ReplenishmentPlanningSummary {
  has_data: boolean;
  batch_id?: string;
  batch_number?: string;
  status?: string;
  created_at?: string;
  display_horizon_days?: number;
  max_calculation_horizon_days?: number;
  total_items_evaluated?: number;
  total_reorders_recommended?: number;
  total_production_recommended?: number;
  total_estimated_cost_usd?: number;
  total_exceptions_count?: number;
  imminent_stockouts_count?: number;
  timing_gaps_count?: number;
  do_not_reorder_count?: number;
  message?: string;
}

export interface ReplenishmentRecommendationItem {
  item_rec_id: string;
  item_id: string;
  item_name: string;
  department: string;
  sourcing_type: 'PURCHASE' | 'PRODUCTION' | 'PURCHASE_OR_PRODUCTION';
  usable_stock: number;
  inventory_position: number;
  daily_demand: number;
  days_on_hand: number;
  risk_level: string;
  action_status: string;
  recommended_order_quantity: number;
  recommended_packs: number;
  purchase_unit: string;
  base_unit: string;
  suggested_order_date?: string;
  timing_gap_detected: boolean;
  bridge_deficit: number;
  supplier_name?: string;
  unit_cost_usd: number;
  estimated_total_cost_usd: number;
  manager_action: 'PENDING' | 'APPROVED' | 'MODIFIED' | 'REJECTED';
  override_quantity?: number;
  conversion_status: 'PENDING' | 'CONVERTED' | 'REJECTED';
  created_purchase_order_id?: string;
  exceptions: string[];
}

export const replenishmentApi = {
  generateRecommendations: async (branchId: string, horizonDays: number = 14) => {
    return api.generateReplenishmentRecommendations({ branch_id: branchId, horizon_days: horizonDays });
  },

  getSummary: async (branchId: string, batchId?: string) => {
    return api.getReplenishmentPlanningSummary({ branch_id: branchId, batch_id: batchId });
  },

  getList: async (branchId: string, batchId?: string, statusFilter?: string) => {
    return api.getReplenishmentRecommendationsList({ branch_id: branchId, batch_id: batchId, status_filter: statusFilter });
  },

  overrideItem: async (params: {
    itemRecId: string;
    action: 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'QUANTITY_OVERRIDE' | 'SUPPLIER_OVERRIDE';
    overrideQty?: number;
    overrideSupplierId?: string;
    notes?: string;
  }) => {
    return api.overrideReplenishmentRecommendationItem({
      item_rec_id: params.itemRecId,
      action: params.action,
      override_qty: params.overrideQty,
      override_supplier_id: params.overrideSupplierId,
      notes: params.notes,
    });
  },

  convertToPurchaseOrders: async (batchId: string, supplierIds?: string[]) => {
    return api.convertReplenishmentBatchToPurchaseOrders({ batch_id: batchId, supplier_ids: supplierIds });
  },

  getDecisionHistory: async (batchId?: string, itemRecId?: string) => {
    return api.getReplenishmentDecisionHistory({ batch_id: batchId, item_rec_id: itemRecId });
  },
};
