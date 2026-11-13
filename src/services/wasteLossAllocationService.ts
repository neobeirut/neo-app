/**
 * FLOW Multi-Concept Enterprise — Four-Tier Waste & Stock Loss Allocation Service
 * Authority: B.R.I.M.E. S.A.L. (Ministry of Finance Tax ID: 3870852)
 *
 * Implements the 4-Tier Loss Attribution Hierarchy:
 * - Priority 1: Direct Concept Attribution (100% charged to verified responsible concept)
 * - Priority 2: Production-Based Attribution (absorbed normal shrinkage vs. isolated abnormal waste)
 * - Priority 3: Shared Ingredient Ratio Allocation (management estimates based on verified BOM consumption, requires manager approval)
 * - Priority 4: Shared / Unallocated Corporate Reserve (retained as corporate loss with zero concept leakage)
 */

import { supabase } from '../api/supabase';

export type WasteAttributionPriority =
  | 'PRIORITY_1_DIRECT'
  | 'PRIORITY_2_PRODUCTION'
  | 'PRIORITY_3_INGREDIENT_RATIO'
  | 'PRIORITY_4_SHARED_UNALLOCATED';

export type WasteAllocationMethod =
  | 'DIRECT_CAUSE'
  | 'PRODUCTION_BATCH_YIELD'
  | 'CONSUMPTION_RATIO_ESTIMATE'
  | 'UNALLOCATED_CORPORATE_RESERVE';

export interface WasteConceptAllocationItem {
  id: string;
  waste_log_id: string;
  concept_id: string | null;
  concept_code: string;
  allocated_quantity: number;
  allocated_amount: number;
  allocation_percentage: number;
  attribution_priority: WasteAttributionPriority;
  allocation_basis_notes: string;
  approving_manager: string | null;
  approval_status: 'APPROVED' | 'PENDING' | 'REJECTED';
  created_at: string;
}

export interface WasteReconciliationSnapshot {
  total_company_waste_cost: number;
  neo_allocated_loss: number;
  ovrload_allocated_loss: number;
  wickd_allocated_loss: number;
  unallocated_corporate_reserve_loss: number;
  approved_loss_cost: number;
  pending_approval_loss_cost: number;
  reconciliation_variance: number;
  is_waste_reconciliation_balanced: boolean;
}

export interface DirectWasteParams {
  restaurantId: string;
  branchId: string;
  itemId: string;
  quantity: number;
  conceptId: string;
  reason: string;
  supportingEvidence?: string;
  createdBy?: string;
}

export interface ProposeShortageParams {
  restaurantId: string;
  branchId: string;
  itemId: string;
  missingQuantity: number;
  reason: string;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
}

export interface UnallocatedLossParams {
  restaurantId: string;
  branchId: string;
  itemId: string;
  missingQuantity: number;
  reason: string;
  createdBy?: string;
}

class WasteLossAllocationService {
  /**
   * Priority 1: Records directly attributable waste to a specific concept (e.g. expired WICKD roll, damaged OVRLOAD wrap)
   */
  async recordDirectConceptWaste(params: DirectWasteParams) {
    try {
      const { data, error } = await supabase.rpc('record_direct_concept_waste', {
        p_restaurant_id: params.restaurantId,
        p_branch_id: params.branchId,
        p_item_id: params.itemId,
        p_quantity: params.quantity,
        p_concept_id: params.conceptId,
        p_reason: params.reason,
        p_supporting_evidence: params.supportingEvidence || null,
        p_created_by: params.createdBy || 'Staff'
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to record direct concept waste:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Priority 3: Proposes proportional allocations for unexplained shortages of shared ingredients (e.g. Parmesan, Flour)
   * Status is set to PENDING_APPROVAL and strictly excludes ineligible concepts (0.00%).
   */
  async proposeIngredientShortageAllocation(params: ProposeShortageParams) {
    try {
      const { data, error } = await supabase.rpc('propose_ingredient_shortage_allocations', {
        p_restaurant_id: params.restaurantId,
        p_branch_id: params.branchId,
        p_item_id: params.itemId,
        p_missing_quantity: params.missingQuantity,
        p_reason: params.reason,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_created_by: params.createdBy || 'Auditor'
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to propose ingredient shortage allocation:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Approves a pending management estimate allocation with formal manager sign-off
   */
  async approveWasteAllocation(wasteLogId: string, managerName: string) {
    try {
      const { data, error } = await supabase.rpc('approve_waste_allocation', {
        p_waste_log_id: wasteLogId,
        p_manager_name: managerName
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to approve waste allocation:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Priority 4: Records unidentified stock shortages as company-wide unallocated operating losses
   */
  async recordUnallocatedCorporateLoss(params: UnallocatedLossParams) {
    try {
      const { data, error } = await supabase.rpc('record_unallocated_corporate_loss', {
        p_restaurant_id: params.restaurantId,
        p_branch_id: params.branchId,
        p_item_id: params.itemId,
        p_missing_quantity: params.missingQuantity,
        p_reason: params.reason,
        p_created_by: params.createdBy || 'Auditor'
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err: any) {
      console.error('Failed to record unallocated corporate loss:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Reconciles total company losses = NÉO + OVRLOAD + WICKD + Unallocated Reserve
   */
  async reconcileCompanyWasteAndLosses(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<WasteReconciliationSnapshot | null> {
    try {
      const { data, error } = await supabase.rpc('fn_reconcile_company_waste_and_losses', {
        p_branch_id: params?.branchId || null,
        p_start_date: params?.startDate || null,
        p_end_date: params?.endDate || null
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      return {
        total_company_waste_cost: parseFloat(row.total_company_waste_cost || 0),
        neo_allocated_loss: parseFloat(row.neo_allocated_loss || 0),
        ovrload_allocated_loss: parseFloat(row.ovrload_allocated_loss || 0),
        wickd_allocated_loss: parseFloat(row.wickd_allocated_loss || 0),
        unallocated_corporate_reserve_loss: parseFloat(row.unallocated_corporate_reserve_loss || 0),
        approved_loss_cost: parseFloat(row.approved_loss_cost || 0),
        pending_approval_loss_cost: parseFloat(row.pending_approval_loss_cost || 0),
        reconciliation_variance: parseFloat(row.reconciliation_variance || 0),
        is_waste_reconciliation_balanced: Boolean(row.is_waste_reconciliation_balanced)
      };
    } catch (err) {
      console.error('Failed to reconcile company waste and losses:', err);
      return null;
    }
  }
}

export const wasteLossAllocationService = new WasteLossAllocationService();
