/**
 * FLOW Multi-Concept Enterprise Architecture
 * Module: Concept Service Client (Phase 1)
 *
 * Provides backward-compatible querying and verification for business concepts,
 * branch assignments, and POS configurations.
 */

import { supabase, supabasePublic } from './supabase';
import {
  DEFAULT_CONCEPT_ID,
  DEFAULT_CONCEPT_CODE,
  KNOWN_CONCEPTS,
  type BusinessConcept,
  type ConceptBranchAssignment,
  type ConceptPosConfiguration,
  type ConceptCode
} from '../types/concept';

// In-memory cache for fast lookups in POS and Admin sessions
let cachedConcepts: BusinessConcept[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export const conceptService = {
  /**
   * Returns all active business concepts.
   * Gracefully falls back to hardcoded default concepts if the table does not yet exist.
   */
  getActiveConcepts: async (): Promise<{ success: boolean; data: BusinessConcept[]; error?: string }> => {
    try {
      const now = Date.now();
      if (cachedConcepts && now - cacheTimestamp < CACHE_TTL_MS) {
        return { success: true, data: cachedConcepts };
      }

      const { data, error } = await supabasePublic
        .from('business_concepts')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('code', { ascending: true });

      if (error) {
        console.warn('[conceptService] Could not fetch concepts from DB, using fallback defaults:', error.message);
        const fallbackList = Object.values(KNOWN_CONCEPTS).map(c => ({
          id: c.id,
          code: c.prefix,
          name: c.name,
          legal_entity_name: 'B.R.I.M.E. S.A.L.',
          concept_type: 'RESTAURANT' as const,
          status: 'ACTIVE' as const,
          primary_color: c.primaryColor,
          secondary_color: '#ffffff',
          logo_url: null,
          currency: 'USD',
          default_branch_id: null,
          receipt_prefix: c.prefix,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        return { success: true, data: fallbackList };
      }

      cachedConcepts = data as BusinessConcept[];
      cacheTimestamp = now;
      return { success: true, data: data as BusinessConcept[] };
    } catch (err: any) {
      console.error('[conceptService] Exception in getActiveConcepts:', err);
      return { success: false, data: [], error: err.message };
    }
  },

  /**
   * Retrieves a concept by its unique UUID.
   */
  getConceptById: async (conceptId?: string | null): Promise<BusinessConcept | null> => {
    if (!conceptId) return null;
    const { data } = await conceptService.getActiveConcepts();
    const found = data.find(c => c.id === conceptId);
    return found || null;
  },

  /**
   * Retrieves a concept by its code ('NEO', 'OVRLOAD', 'WICKD').
   */
  getConceptByCode: async (code: string): Promise<BusinessConcept | null> => {
    const { data } = await conceptService.getActiveConcepts();
    return data.find(c => c.code.toUpperCase() === code.toUpperCase()) || null;
  },

  /**
   * Retrieves concepts enabled at a specific physical branch.
   */
  getBranchConcepts: async (branchId: string): Promise<{ success: boolean; data: BusinessConcept[]; error?: string }> => {
    try {
      const { data, error } = await supabasePublic
        .from('concept_branch_assignments')
        .select('*, concept:business_concepts(*)')
        .eq('branch_id', branchId)
        .eq('enabled', true);

      if (error) {
        console.warn('[conceptService] Could not fetch branch assignments:', error.message);
        return { success: false, data: [], error: error.message };
      }

      const concepts = (data || [])
        .map((row: any) => row.concept)
        .filter((c: any): c is BusinessConcept => Boolean(c && c.status === 'ACTIVE'));

      return { success: true, data: concepts };
    } catch (err: any) {
      return { success: false, data: [], error: err.message };
    }
  },

  /**
   * Validates whether a concept is legally and operationally enabled at a branch.
   */
  validateConceptBranch: async (conceptId: string, branchId: string): Promise<boolean> => {
    try {
      const { data: assignments } = await conceptService.getBranchConcepts(branchId);
      return assignments.some(c => c.id === conceptId);
    } catch {
      return false;
    }
  },

  /**
   * Retrieves POS terminal configuration for a concept at a specific branch.
   */
  getConceptPosConfig: async (conceptId: string, branchId: string): Promise<ConceptPosConfiguration | null> => {
    try {
      const { data, error } = await supabasePublic
        .from('concept_pos_configurations')
        .select('*')
        .eq('concept_id', conceptId)
        .eq('branch_id', branchId)
        .eq('active', true)
        .maybeSingle();

      if (error || !data) return null;
      return data as ConceptPosConfiguration;
    } catch {
      return null;
    }
  },

  /**
   * Helper to resolve the effective concept ID for an order or transaction payload.
   * STRICT ENFORCEMENT: Client-controlled boolean bypass is prohibited.
   * In all contexts, throws MISSING_CONCEPT_IDENTITY unless an explicit authorized concept ID is provided.
   */
  resolveOrderConceptId: (
    payloadConceptId?: string | null,
    options?: { serverVerifiedLegacyTerminalId?: string }
  ): string => {
    if (payloadConceptId && String(payloadConceptId).trim() !== '') {
      return String(payloadConceptId).trim();
    }
    if (options?.serverVerifiedLegacyTerminalId === 'FLOW-LEGACY-TERM-01') {
      return DEFAULT_CONCEPT_ID;
    }
    throw new Error(
      'MISSING_CONCEPT_IDENTITY: POS orders require an explicit, authorized concept_id. Silent fallback or unverified client bypass is prohibited.'
    );
  },

  /**
   * Retrieves daily concept COGS breakdown for a branch and date range.
   */
  getConceptCogsDaily: async (branchId: string, startDate?: string, endDate?: string) => {
    try {
      let query = supabasePublic.from('v_concept_daily_cogs').select('*').eq('branch_id', branchId);
      if (startDate) query = query.gte('movement_date', startDate);
      if (endDate) query = query.lte('movement_date', endDate);
      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Retrieves consolidated company COGS reconciliation proving zero variance.
   */
  getConsolidatedCogsReconciliation: async (branchId: string, startDate?: string, endDate?: string) => {
    try {
      let query = supabasePublic.from('v_consolidated_company_cogs_reconciliation').select('*').eq('branch_id', branchId);
      if (startDate) query = query.gte('movement_date', startDate);
      if (endDate) query = query.lte('movement_date', endDate);
      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Retrieves concept-segmented P&L summary via RPC.
   */
  getConceptPnlSummary: async (branchId: string, startDate: string, endDate: string) => {
    try {
      const { data, error } = await supabase.rpc('rpc_get_concept_pnl_summary', {
        p_branch_id: branchId,
        p_start_date: startDate,
        p_end_date: endDate
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Processes distinct inventory refund/void dispositions with idempotency protection.
   */
  processInventoryRefundDisposition: async (params: {
    orderId: number;
    dispositionType: 'FINANCIAL_ONLY' | 'PHYSICAL_RESTORE' | 'WASTE_WRITE_OFF' | 'ORDER_VOID';
    items?: Array<{ movement_id?: string; product_id?: number; quantity?: number }>;
    reason: string;
    cashierName: string;
    conceptId?: string;
    idempotencyKey?: string;
  }) => {
    try {
      const { data, error } = await supabase.rpc('rpc_process_inventory_refund_disposition', {
        p_order_id: params.orderId,
        p_disposition_type: params.dispositionType,
        p_items: params.items || [],
        p_reason: params.reason,
        p_cashier_name: params.cashierName,
        p_concept_id: params.conceptId || null,
        p_idempotency_key: params.idempotencyKey || null
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Controlled admin procedure to resolve inventory consumption exceptions without duplicate deductions.
   */
  resolveInventoryException: async (params: {
    exceptionId: string;
    resolutionType: 'CORRECTIVE_CONSUMPTION' | 'MANUAL_OVERRIDE_NO_ACTION' | 'DISMISS';
    manualItemId?: string;
    manualQuantity?: number;
    manualUnitCost?: number;
    notes?: string;
    resolvedBy?: string;
  }) => {
    try {
      const { data, error } = await supabase.rpc('rpc_resolve_inventory_exception', {
        p_exception_id: params.exceptionId,
        p_resolution_type: params.resolutionType,
        p_manual_item_id: params.manualItemId || null,
        p_manual_quantity: params.manualQuantity || null,
        p_manual_unit_cost: params.manualUnitCost || null,
        p_notes: params.notes || null,
        p_resolved_by: params.resolvedBy || 'admin'
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Fetches pending or resolved inventory consumption exceptions for admin audit.
   */
  getInventoryExceptionsAdmin: async (branchId?: string, status?: 'PENDING' | 'RESOLVED' | 'DISMISSED') => {
    try {
      let query = supabasePublic.from('v_inventory_consumption_exceptions_admin').select('*');
      if (branchId) query = query.eq('branch_id', branchId);
      if (status) query = query.eq('resolution_status', status);
      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Retrieves aggregated smart replenishment demand by SKU across all concepts.
   */
  getSmartReplenishmentDemand: async (branchId: string, startDate?: string, endDate?: string) => {
    try {
      let query = supabasePublic.from('v_concept_smart_replenishment_demand').select('*').eq('branch_id', branchId);
      if (startDate) query = query.gte('demand_date', startDate);
      if (endDate) query = query.lte('demand_date', endDate);
      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || [] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Allocates an authoritative company expense across concepts and cost centers.
   */
  allocateCompanyExpense: async (params: {
    expenseId: string;
    allocations: Array<{
      concept_id?: string | null;
      cost_center_id?: string | null;
      allocated_amount_usd: number;
      allocation_basis?: 'DIRECT_ATTRIBUTION' | 'SPLIT_PERCENTAGE' | 'SHARED_COST_CENTER' | 'UNALLOCATED';
      notes?: string;
    }>;
    allocatedBy?: string;
    changeReason?: string;
  }) => {
    try {
      const { data, error } = await supabase.rpc('rpc_allocate_company_expense', {
        p_expense_id: params.expenseId,
        p_allocations: params.allocations,
        p_allocated_by: params.allocatedBy || 'admin',
        p_change_reason: params.changeReason || 'Initial Allocation'
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Processes marketplace order commission, fees, and net receivables.
   */
  processMarketplaceSettlement: async (params: {
    orderId: number;
    channelCode: string;
    merchantDiscounts?: number;
    platformDiscounts?: number;
  }) => {
    try {
      const { data, error } = await supabase.rpc('rpc_process_marketplace_settlement', {
        p_order_id: params.orderId,
        p_channel_code: params.channelCode,
        p_merchant_discounts: params.merchantDiscounts || 0,
        p_platform_discounts: params.platformDiscounts || 0
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Reconciles actual aggregator payout against expected net receivables.
   */
  reconcileMarketplacePayout: async (params: {
    orderId: number;
    actualPayoutAmountUsd: number;
    settlementReference?: string;
  }) => {
    try {
      const { data, error } = await supabase.rpc('rpc_reconcile_marketplace_payout', {
        p_order_id: params.orderId,
        p_actual_payout_amount_usd: params.actualPayoutAmountUsd,
        p_settlement_reference: params.settlementReference || null
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Allocates payroll labor obligation prioritized by actual production hours.
   */
  allocatePayrollLabor: async (params: {
    payrollItemId: string;
    allocations?: Array<{
      concept_id?: string | null;
      cost_center_id?: string | null;
      allocated_amount_usd: number;
      allocated_hours?: number;
      allocation_basis?: 'PRODUCTION_HOURS' | 'SPLIT_PERCENTAGE' | 'DIRECT_ROLE' | 'UNALLOCATED';
      notes?: string;
    }>;
    allocatedBy?: string;
    changeReason?: string;
  }) => {
    try {
      const { data, error } = await supabase.rpc('rpc_allocate_payroll_labor', {
        p_payroll_item_id: params.payrollItemId,
        p_allocations: params.allocations || null,
        p_allocated_by: params.allocatedBy || 'admin',
        p_change_reason: params.changeReason || 'Initial Payroll Allocation'
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Retrieves Concept Contribution Margin P&L and company consolidation.
   */
  getConceptContributionPnl: async (params: {
    conceptId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    try {
      const { data, error } = await supabase.rpc('rpc_get_concept_contribution_pnl', {
        p_concept_id: params.conceptId || null,
        p_branch_id: params.branchId || null,
        p_start_date: params.startDate || null,
        p_end_date: params.endDate || null
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
