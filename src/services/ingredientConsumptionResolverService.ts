/**
 * FLOW Multi-Concept Enterprise — Ingredient Consumption Resolver Service
 * Authority: B.R.I.M.E. S.A.L. (Ministry of Finance Tax ID: 3870852)
 *
 * Provides granular ingredient-level consumption tracing across:
 * 1. Direct POS menu recipe sales
 * 2. Nested intermediate production recipes (e.g. Parmesan -> Caesar Dressing -> Salad/Wrap)
 * 3. Shared kitchen production batches (WIP/Finished Goods Asset creation)
 * 4. Direct inventory stock write-offs and waste allocations
 *
 * Implements strict anti-double-counting guarantees:
 * - Production batch inputs are capitalized into WIP / Finished Goods assets (is_recognized_cogs = FALSE)
 * - Sales COGS is recognized strictly when finished products are sold through POS (is_recognized_cogs = TRUE)
 * - Unsold intermediate preparations remain company balance sheet assets
 * - Concept eligibility mathematically isolates concepts with verified recipe usage (e.g. NÉO & OVRLOAD)
 *   while excluding non-using concepts (e.g. WICKD = 0% Parmesan usage).
 */

import { supabase } from '../api/supabase';

export type ConsumptionType =
  | 'DIRECT_MENU_SALE'
  | 'NESTED_PRODUCTION_SALE'
  | 'PRODUCTION_BATCH_WIP'
  | 'SUBSTITUTION_ADDON'
  | 'DIRECT_STOCK_LOSS';

export type EvidenceClassification =
  | 'DIRECT_POS_SALE'
  | 'NESTED_BATCH_CHAIN'
  | 'BATCH_WIP_STAGE'
  | 'MODIFIER_EFFECT'
  | 'DIRECT_CAUSE_LOG'
  | 'UNLINKED_SHRINKAGE';

export interface IngredientConsumptionRecord {
  ingredient_id: string;
  ingredient_name: string;
  canonical_unit: string;
  concept_id: string | null;
  concept_code: string;
  concept_name: string;
  consumption_type: ConsumptionType;
  theoretical_quantity: number;
  actual_quantity: number;
  unit_cost: number;
  total_cost: number;
  cost_source: string;
  source_type: 'POS_ORDER' | 'PRODUCTION_BATCH' | 'INVENTORY_MOVEMENT';
  source_id: string;
  source_line_id: string | null;
  source_order_number: string;
  product_id: string | null;
  product_name: string;
  parent_batch_id: string | null;
  recipe_version: string;
  consumed_at: string;
  evidence_classification: EvidenceClassification;
  confidence_score: number;
  is_recognized_cogs: boolean;
}

export interface IngredientConceptEligibility {
  concept_id: string;
  concept_code: string;
  concept_name: string;
  is_eligible: boolean;
  has_active_menu_recipes: boolean;
  has_nested_production_recipes: boolean;
  total_theoretical_quantity: number;
  total_actual_quantity: number;
  recognized_cogs_amount: number;
  wip_or_unrealized_amount: number;
  consumption_ratio: number; // Percentage of total recognized COGS (e.g. 60.0% vs 40.0% vs 0.0%)
  evidence_summary: string;
}

export interface DoubleCountingAuditReport {
  ingredient_id: string;
  ingredient_name: string;
  canonical_unit: string;
  direct_dish_cogs_qty: number;
  direct_dish_cogs_cost: number;
  nested_batch_cogs_qty: number;
  nested_batch_cogs_cost: number;
  total_sales_cogs_qty: number;
  total_sales_cogs_cost: number;
  batch_issued_qty: number;
  batch_issued_cost: number;
  batch_remaining_asset_qty: number;
  batch_remaining_asset_cost: number;
  batch_reconciliation_variance: number;
  remaining_raw_stock_qty: number;
  remaining_raw_stock_cost: number;
  documented_loss_qty: number;
  documented_loss_cost: number;
  is_zero_double_counting_verified: boolean;
}

export interface ResolveParams {
  ingredientId: string;
  startDate?: string;
  endDate?: string;
  branchId?: string;
}

class IngredientConsumptionResolverService {
  /**
   * Resolves detailed itemized consumption records for an ingredient
   */
  async resolveIngredientConsumption(params: ResolveParams): Promise<IngredientConsumptionRecord[]> {
    try {
      const { data, error } = await supabase.rpc('fn_resolve_ingredient_consumption', {
        p_ingredient_id: params.ingredientId,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null,
        p_branch_id: params.branchId || null
      });

      if (error) {
        console.warn('fn_resolve_ingredient_consumption RPC error, falling back to client evaluation:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row,
        theoretical_quantity: parseFloat(row.theoretical_quantity || 0),
        actual_quantity: parseFloat(row.actual_quantity || 0),
        unit_cost: parseFloat(row.unit_cost || 0),
        total_cost: parseFloat(row.total_cost || 0),
        confidence_score: parseFloat(row.confidence_score || 0),
        is_recognized_cogs: Boolean(row.is_recognized_cogs)
      }));
    } catch (err) {
      console.error('Failed to resolve ingredient consumption:', err);
      return [];
    }
  }

  /**
   * Computes verified concept eligibility and normalized consumption ratios for waste allocation
   */
  async getIngredientConceptEligibility(params: ResolveParams): Promise<IngredientConceptEligibility[]> {
    try {
      const { data, error } = await supabase.rpc('fn_get_ingredient_concept_eligibility', {
        p_ingredient_id: params.ingredientId,
        p_branch_id: params.branchId || null,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null
      });

      if (error) {
        console.warn('fn_get_ingredient_concept_eligibility RPC error:', error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        ...row,
        is_eligible: Boolean(row.is_eligible),
        has_active_menu_recipes: Boolean(row.has_active_menu_recipes),
        has_nested_production_recipes: Boolean(row.has_nested_production_recipes),
        total_theoretical_quantity: parseFloat(row.total_theoretical_quantity || 0),
        total_actual_quantity: parseFloat(row.total_actual_quantity || 0),
        recognized_cogs_amount: parseFloat(row.recognized_cogs_amount || 0),
        wip_or_unrealized_amount: parseFloat(row.wip_or_unrealized_amount || 0),
        consumption_ratio: parseFloat(row.consumption_ratio || 0)
      }));
    } catch (err) {
      console.error('Failed to get concept eligibility:', err);
      return [];
    }
  }

  /**
   * Performs an anti-double-counting audit comparing batch asset capitalization vs. sales COGS recognition
   */
  async auditZeroDoubleCounting(params: ResolveParams): Promise<DoubleCountingAuditReport | null> {
    try {
      const { data, error } = await supabase.rpc('fn_audit_zero_double_counting', {
        p_ingredient_id: params.ingredientId,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null
      });

      if (error) {
        console.warn('fn_audit_zero_double_counting RPC error:', error.message);
        return null;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      return {
        ...row,
        direct_dish_cogs_qty: parseFloat(row.direct_dish_cogs_qty || 0),
        direct_dish_cogs_cost: parseFloat(row.direct_dish_cogs_cost || 0),
        nested_batch_cogs_qty: parseFloat(row.nested_batch_cogs_qty || 0),
        nested_batch_cogs_cost: parseFloat(row.nested_batch_cogs_cost || 0),
        total_sales_cogs_qty: parseFloat(row.total_sales_cogs_qty || 0),
        total_sales_cogs_cost: parseFloat(row.total_sales_cogs_cost || 0),
        batch_issued_qty: parseFloat(row.batch_issued_qty || 0),
        batch_issued_cost: parseFloat(row.batch_issued_cost || 0),
        batch_remaining_asset_qty: parseFloat(row.batch_remaining_asset_qty || 0),
        batch_remaining_asset_cost: parseFloat(row.batch_remaining_asset_cost || 0),
        batch_reconciliation_variance: parseFloat(row.batch_reconciliation_variance || 0),
        remaining_raw_stock_qty: parseFloat(row.remaining_raw_stock_qty || 0),
        remaining_raw_stock_cost: parseFloat(row.remaining_raw_stock_cost || 0),
        documented_loss_qty: parseFloat(row.documented_loss_qty || 0),
        documented_loss_cost: parseFloat(row.documented_loss_cost || 0),
        is_zero_double_counting_verified: Boolean(row.is_zero_double_counting_verified)
      };
    } catch (err) {
      console.error('Failed to audit zero double counting:', err);
      return null;
    }
  }
}

export const ingredientConsumptionResolverService = new IngredientConsumptionResolverService();
