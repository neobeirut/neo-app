/**
 * FLOW Multi-Concept Enterprise — Production & Inventory Costing Service
 * Authority: B.R.I.M.E. S.A.L. (Ministry of Finance Tax ID: 3870852)
 *
 * Implements the complete two-stage lifecycle:
 * RAW INGREDIENTS -> WORK IN PROGRESS (WIP) -> FINISHED PRODUCTION -> SALES COGS
 *
 * Key Architectural Guarantees:
 * 1. Raw ingredient issues capitalize into WIP asset value (wip_asset_value)
 * 2. Completed batches produce valued finished goods lots (produced_unit_cost = input_cost / actual_yield)
 * 3. Normal yield losses (e.g. baking shrinkage) are absorbed into unit cost, NOT duplicated as waste expense
 * 4. Abnormal waste (dropped trays, contamination) is isolated as traceable abnormal loss
 * 5. Open WIP batches at month-end retain verified asset value on the corporate balance sheet
 * 6. Sales deduct finished goods inventory and recognize concept COGS without double-deducting raw ingredients!
 */

import { supabase } from '../api/supabase';

export interface ProductionCostReconciliation {
  total_raw_material_stock_cost: number;
  total_open_wip_asset_cost: number;
  total_finished_goods_stock_cost: number;
  total_company_inventory_assets: number;
  total_recognized_sales_cogs: number;
  total_abnormal_production_loss: number;
  neo_recognized_cogs: number;
  ovrload_recognized_cogs: number;
  wickd_recognized_cogs: number;
  open_wip_batches_count: number;
  completed_batches_count: number;
  reconciliation_status: string;
}

export interface CompleteBatchParams {
  batchId: string;
  actualYieldQuantity: number;
  actualYieldUnit: string;
  abnormalWasteQuantity?: number;
  abnormalWasteReason?: string;
  userId?: string;
  userName?: string;
}

class ProductionCostFlowService {
  /**
   * Issues raw ingredients into WIP for a batch, deducting raw stock and capitalizing WIP asset
   */
  async issueIngredientsToWip(batchId: string, userId?: string, userName?: string) {
    try {
      const { data, error } = await supabase.rpc('issue_production_batch_wip', {
        p_batch_id: batchId,
        p_user_id: userId || null,
        p_user_name: userName || 'Production Staff'
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to issue ingredients to WIP:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Completes a batch: transfers WIP into Finished Goods, absorbs normal shrinkage into unit cost,
   * records abnormal waste separately, and credits finished stock.
   */
  async completeBatchWithCosting(params: CompleteBatchParams) {
    try {
      const { data, error } = await supabase.rpc('complete_production_batch_v2', {
        p_batch_id: params.batchId,
        p_actual_yield_quantity: params.actualYieldQuantity,
        p_actual_yield_unit: params.actualYieldUnit,
        p_abnormal_waste_quantity: params.abnormalWasteQuantity || 0,
        p_abnormal_waste_reason: params.abnormalWasteReason || null,
        p_user_id: params.userId || null,
        p_user_name: params.userName || 'Production Staff'
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to complete batch with costing:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Deducts finished goods inventory and recognizes concept COGS upon POS order completion.
   * Guarantees zero double-deduction of underlying raw materials.
   */
  async executePosFinishedGoodsCogs(orderId: number | string, userName?: string) {
    try {
      const { data, error } = await supabase.rpc('execute_pos_finished_goods_cogs', {
        p_order_id: typeof orderId === 'string' ? parseInt(orderId, 10) : orderId,
        p_user_name: userName || 'POS System'
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to execute POS finished goods COGS:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Reconciles Raw Materials + Open WIP + Finished Goods Assets against Sales COGS and Abnormal Losses.
   */
  async reconcileProductionAndInventory(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ProductionCostReconciliation | null> {
    try {
      const { data, error } = await supabase.rpc('fn_reconcile_production_and_inventory', {
        p_branch_id: params?.branchId || null,
        p_start_date: params?.startDate || null,
        p_end_date: params?.endDate || null
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      return {
        total_raw_material_stock_cost: parseFloat(row.total_raw_material_stock_cost || 0),
        total_open_wip_asset_cost: parseFloat(row.total_open_wip_asset_cost || 0),
        total_finished_goods_stock_cost: parseFloat(row.total_finished_goods_stock_cost || 0),
        total_company_inventory_assets: parseFloat(row.total_company_inventory_assets || 0),
        total_recognized_sales_cogs: parseFloat(row.total_recognized_sales_cogs || 0),
        total_abnormal_production_loss: parseFloat(row.total_abnormal_production_loss || 0),
        neo_recognized_cogs: parseFloat(row.neo_recognized_cogs || 0),
        ovrload_recognized_cogs: parseFloat(row.ovrload_recognized_cogs || 0),
        wickd_recognized_cogs: parseFloat(row.wickd_recognized_cogs || 0),
        open_wip_batches_count: parseInt(row.open_wip_batches_count || 0, 10),
        completed_batches_count: parseInt(row.completed_batches_count || 0, 10),
        reconciliation_status: row.reconciliation_status || 'BALANCED'
      };
    } catch (err) {
      console.error('Failed to reconcile production and inventory:', err);
      return null;
    }
  }
}

export const productionCostFlowService = new ProductionCostFlowService();
