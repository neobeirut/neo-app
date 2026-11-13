import { supabase } from './supabase';

export interface ConceptPnlRow {
  concept_id: string;
  concept_code: string;
  concept_name: string;
  period_year: number;
  period_month: number;
  // 1. Sales & Revenue
  gross_sales_usd: number;
  merchant_discounts_usd: number;
  net_sales_usd: number;
  order_count: number;
  average_ticket_usd: number;
  // 2. Level 1: Gross Profit
  product_cogs_usd: number;
  packaging_cogs_usd: number;
  total_direct_cogs_usd: number;
  gross_profit_usd: number;
  gross_profit_margin_pct: number;
  // 3. Level 2: Contribution Profit
  marketplace_commissions_usd: number;
  payment_processing_fees_usd: number;
  direct_operational_waste_usd: number;
  approved_shared_waste_allocation_usd: number;
  total_recognized_waste_loss_usd: number;
  other_direct_concept_opex_usd: number;
  contribution_profit_usd: number;
  contribution_margin_pct: number;
  // 4. Level 3: Fully Allocated Operating Result
  dedicated_concept_labor_usd: number;
  allocated_shared_kitchen_labor_usd: number;
  allocated_facility_expenses_usd: number;
  allocated_utilities_usd: number;
  allocated_equipment_overhead_usd: number;
  other_shared_overhead_usd: number;
  total_shared_overhead_usd: number;
  concept_operating_result_usd: number;
  concept_operating_margin_pct: number;
  cost_data_status?: string;
  data_provenance?: string;
}

export interface ChannelProfitabilityRow {
  concept_id: string;
  concept_code: string;
  concept_name: string;
  period_year: number;
  period_month: number;
  sales_channel: string;
  order_count: number;
  gross_sales_usd: number;
  merchant_discounts_usd: number;
  platform_funded_promos_usd?: number;
  net_sales_usd: number;
  average_ticket_usd: number;
  recognized_product_cogs_usd?: number;
  packaging_cogs_usd?: number;
  total_direct_cogs_usd?: number;
  channel_gross_profit_usd?: number;
  channel_gross_margin_pct?: number;
  channel_commissions_usd: number;
  channel_platform_fees_usd: number;
  total_platform_deductions_usd?: number;
  net_revenue_after_platform_fees_usd?: number;
  channel_direct_contribution_usd: number;
  channel_contribution_margin_pct: number;
  expected_receivables_usd: number;
  actual_settlement_usd: number;
  settlement_discrepancy_usd: number;
  cost_data_status?: string;
  data_provenance?: string;
}

export interface InventoryWorkingCapitalRow {
  branch_id: string;
  department: string;
  concept_affiliation: string;
  inventory_type: string;
  item_id: string;
  item_name: string;
  unit: string;
  current_stock: number;
  unit_cost: number;
  working_capital_usd: number;
  asset_status: string;
}

export interface ConsolidatedStatementRow {
  legal_entity_name: string;
  mof_tax_number: string;
  period_year: number;
  period_month: number;
  total_gross_sales_usd: number;
  total_discounts_usd: number;
  total_net_revenue_usd: number;
  total_orders_count: number;
  total_food_cogs_usd: number;
  total_food_gross_profit_usd?: number;
  total_packaging_cogs_usd: number;
  total_refund_restoration_credits_usd: number;
  total_net_cogs_usd: number;
  total_gross_profit_usd: number;
  total_production_waste_usd: number;
  total_sales_waste_usd: number;
  total_waste_expense_usd: number;
  total_commissions_usd: number;
  total_platform_fees_usd: number;
  total_refund_adjustments_usd: number;
  total_marketplace_selling_costs_usd: number;
  consolidated_contribution_margin_usd: number;
  total_direct_labor_usd: number;
  total_shared_kitchen_labor_usd: number;
  total_labor_expense_usd: number;
  total_direct_opex_usd: number;
  total_shared_overhead_usd: number;
  combined_concept_operating_profit_usd: number;
  total_corporate_unallocated_usd: number;
  company_fully_allocated_operating_result_usd: number;
}

export interface ReconciliationAuditRow {
  exception_domain: string;
  record_id: string;
  concept_name: string;
  reference_document: string;
  exception_reason: string;
  status: string;
  recorded_at: string;
}

export interface CorporateReserveRow {
  reserve_category: string;
  source_table: string;
  reference_id: string;
  payee: string;
  line_item: string;
  amount_usd: number;
  audit_justification: string;
  audit_date: string;
}

export interface InventoryValuationBridgeRow {
  opening_inventory_valuation_usd: number;
  goods_received_purchases_usd: number;
  open_wip_capitalized_usd: number;
  cogs_recognized_reductions_usd: number;
  waste_and_shrinkage_reductions_usd: number;
  closing_inventory_valuation_usd: number;
  balance_sheet_inventory_status: string;
}

// Canonical Demonstration Fixtures for November 2026
const CANONICAL_DEMO_CONCEPTS: ConceptPnlRow[] = [
  {
    concept_id: '00000000-0000-0000-0000-000000000001',
    concept_code: 'NEO',
    concept_name: 'NÉO',
    period_year: 2026,
    period_month: 11,
    gross_sales_usd: 250.00,
    merchant_discounts_usd: 10.00,
    net_sales_usd: 240.00,
    order_count: 10,
    average_ticket_usd: 24.00,
    product_cogs_usd: 76.80,
    packaging_cogs_usd: 0.00,
    total_direct_cogs_usd: 76.80,
    gross_profit_usd: 163.20,
    gross_profit_margin_pct: 68.00,
    marketplace_commissions_usd: 0.00,
    payment_processing_fees_usd: 0.00,
    direct_operational_waste_usd: 0.00,
    approved_shared_waste_allocation_usd: 13.33,
    total_recognized_waste_loss_usd: 13.33,
    other_direct_concept_opex_usd: 0.00,
    contribution_profit_usd: 149.87,
    contribution_margin_pct: 62.45,
    dedicated_concept_labor_usd: 400.00,
    allocated_shared_kitchen_labor_usd: 250.00,
    allocated_facility_expenses_usd: 500.00,
    allocated_utilities_usd: 200.00,
    allocated_equipment_overhead_usd: 0.00,
    other_shared_overhead_usd: 0.00,
    total_shared_overhead_usd: 1350.00,
    concept_operating_result_usd: -1200.13,
    concept_operating_margin_pct: -500.05,
    cost_data_status: 'SYNTHETIC_BENCHMARK',
    data_provenance: 'SYNTHETIC_STAGING_FIXTURE'
  },
  {
    concept_id: '00000000-0000-0000-0000-000000000002',
    concept_code: 'OVRLOAD',
    concept_name: 'OVRLOAD',
    period_year: 2026,
    period_month: 11,
    gross_sales_usd: 180.00,
    merchant_discounts_usd: 5.00,
    net_sales_usd: 175.00,
    order_count: 8,
    average_ticket_usd: 21.88,
    product_cogs_usd: 52.50,
    packaging_cogs_usd: 0.00,
    total_direct_cogs_usd: 52.50,
    gross_profit_usd: 122.50,
    gross_profit_margin_pct: 70.00,
    marketplace_commissions_usd: 26.25,
    payment_processing_fees_usd: 3.50,
    direct_operational_waste_usd: 0.00,
    approved_shared_waste_allocation_usd: 6.67,
    total_recognized_waste_loss_usd: 6.67,
    other_direct_concept_opex_usd: 0.00,
    contribution_profit_usd: 86.08,
    contribution_margin_pct: 49.19,
    dedicated_concept_labor_usd: 350.00,
    allocated_shared_kitchen_labor_usd: 200.00,
    allocated_facility_expenses_usd: 300.00,
    allocated_utilities_usd: 175.00,
    allocated_equipment_overhead_usd: 0.00,
    other_shared_overhead_usd: 0.00,
    total_shared_overhead_usd: 1025.00,
    concept_operating_result_usd: -938.92,
    concept_operating_margin_pct: -536.53,
    cost_data_status: 'SYNTHETIC_BENCHMARK',
    data_provenance: 'SYNTHETIC_STAGING_FIXTURE'
  },
  {
    concept_id: '00000000-0000-0000-0000-000000000003',
    concept_code: 'WICKD',
    concept_name: 'WICKD',
    period_year: 2026,
    period_month: 11,
    gross_sales_usd: 95.00,
    merchant_discounts_usd: 7.00,
    net_sales_usd: 88.00,
    order_count: 6,
    average_ticket_usd: 14.67,
    product_cogs_usd: 26.40,
    packaging_cogs_usd: 2.00,
    total_direct_cogs_usd: 28.40,
    gross_profit_usd: 59.60,
    gross_profit_margin_pct: 67.73,
    marketplace_commissions_usd: 8.80,
    payment_processing_fees_usd: 1.60,
    direct_operational_waste_usd: 15.00,
    approved_shared_waste_allocation_usd: 0.00,
    total_recognized_waste_loss_usd: 15.00,
    other_direct_concept_opex_usd: 50.00,
    contribution_profit_usd: -15.80,
    contribution_margin_pct: -17.95,
    dedicated_concept_labor_usd: 200.00,
    allocated_shared_kitchen_labor_usd: 150.00,
    allocated_facility_expenses_usd: 200.00,
    allocated_utilities_usd: 125.00,
    allocated_equipment_overhead_usd: 0.00,
    other_shared_overhead_usd: 0.00,
    total_shared_overhead_usd: 675.00,
    concept_operating_result_usd: -690.80,
    concept_operating_margin_pct: -785.00,
    cost_data_status: 'SYNTHETIC_BENCHMARK',
    data_provenance: 'SYNTHETIC_STAGING_FIXTURE'
  }
];

const CANONICAL_DEMO_CONSOLIDATED: ConsolidatedStatementRow = {
  legal_entity_name: 'B.R.I.M.E. S.A.L.',
  mof_tax_number: '3870852',
  period_year: 2026,
  period_month: 11,
  total_gross_sales_usd: 525.00,
  total_discounts_usd: 22.00,
  total_net_revenue_usd: 503.00,
  total_orders_count: 24,
  total_food_cogs_usd: 155.70,
  total_food_gross_profit_usd: 347.30, // Net Sales ($503.00) - Direct Food COGS ($155.70)
  total_packaging_cogs_usd: 2.00,      // Explicit packaging expense for delivery/takeaway
  total_refund_restoration_credits_usd: 0.00,
  total_net_cogs_usd: 157.70,          // Direct Food ($155.70) + Packaging ($2.00)
  total_gross_profit_usd: 345.30,      // Level 1 Net Direct Gross Profit ($347.30 - $2.00)
  total_production_waste_usd: 0.00,
  total_sales_waste_usd: 35.00,
  total_waste_expense_usd: 35.00,
  total_commissions_usd: 35.05,
  total_platform_fees_usd: 5.10,
  total_refund_adjustments_usd: 0.00,
  total_marketplace_selling_costs_usd: 40.15,
  consolidated_contribution_margin_usd: 220.15,
  total_direct_labor_usd: 950.00,
  total_shared_kitchen_labor_usd: 600.00,
  total_labor_expense_usd: 1550.00,
  total_direct_opex_usd: 50.00,
  total_shared_overhead_usd: 1500.00,
  combined_concept_operating_profit_usd: -2829.85,
  total_corporate_unallocated_usd: 330.00,
  company_fully_allocated_operating_result_usd: -3159.85
};

const CANONICAL_DEMO_CHANNELS: ChannelProfitabilityRow[] = [
  {
    concept_id: '00000000-0000-0000-0000-000000000001',
    concept_code: 'NEO',
    concept_name: 'NÉO',
    period_year: 2026,
    period_month: 11,
    sales_channel: 'POS_DINE_IN',
    order_count: 10,
    gross_sales_usd: 250.00,
    merchant_discounts_usd: 10.00,
    platform_funded_promos_usd: 0.00,
    net_sales_usd: 240.00,
    average_ticket_usd: 24.00,
    recognized_product_cogs_usd: 76.80,
    packaging_cogs_usd: 0.00,
    total_direct_cogs_usd: 76.80,
    channel_gross_profit_usd: 163.20,
    channel_gross_margin_pct: 68.00,
    channel_commissions_usd: 0.00,
    channel_platform_fees_usd: 0.00,
    total_platform_deductions_usd: 0.00,
    net_revenue_after_platform_fees_usd: 240.00,
    channel_direct_contribution_usd: 163.20,
    channel_contribution_margin_pct: 68.00,
    expected_receivables_usd: 240.00,
    actual_settlement_usd: 240.00,
    settlement_discrepancy_usd: 0.00,
    cost_data_status: 'SYNTHETIC_BENCHMARK',
    data_provenance: 'SYNTHETIC_STAGING_FIXTURE'
  },
  {
    concept_id: '00000000-0000-0000-0000-000000000002',
    concept_code: 'OVRLOAD',
    concept_name: 'OVRLOAD',
    period_year: 2026,
    period_month: 11,
    sales_channel: 'TOTERS',
    order_count: 8,
    gross_sales_usd: 180.00,
    merchant_discounts_usd: 5.00,
    platform_funded_promos_usd: 0.00,
    net_sales_usd: 175.00,
    average_ticket_usd: 21.88,
    recognized_product_cogs_usd: 52.50,
    packaging_cogs_usd: 0.00,
    total_direct_cogs_usd: 52.50,
    channel_gross_profit_usd: 122.50,
    channel_gross_margin_pct: 70.00,
    channel_commissions_usd: 26.25,
    channel_platform_fees_usd: 3.50,
    total_platform_deductions_usd: 29.75,
    net_revenue_after_platform_fees_usd: 145.25,
    channel_direct_contribution_usd: 92.75,
    channel_contribution_margin_pct: 53.00,
    expected_receivables_usd: 145.25,
    actual_settlement_usd: 145.25,
    settlement_discrepancy_usd: 0.00,
    cost_data_status: 'SYNTHETIC_BENCHMARK',
    data_provenance: 'SYNTHETIC_STAGING_FIXTURE'
  },
  {
    concept_id: '00000000-0000-0000-0000-000000000003',
    concept_code: 'WICKD',
    concept_name: 'WICKD',
    period_year: 2026,
    period_month: 11,
    sales_channel: 'NOKNOK',
    order_count: 6,
    gross_sales_usd: 95.00,
    merchant_discounts_usd: 7.00,
    platform_funded_promos_usd: 6.00,
    net_sales_usd: 88.00,
    average_ticket_usd: 14.67,
    recognized_product_cogs_usd: 26.40,
    packaging_cogs_usd: 2.00,
    total_direct_cogs_usd: 28.40,
    channel_gross_profit_usd: 59.60,
    channel_gross_margin_pct: 67.73,
    channel_commissions_usd: 8.80,
    channel_platform_fees_usd: 1.60,
    total_platform_deductions_usd: 10.40,
    net_revenue_after_platform_fees_usd: 77.60,
    channel_direct_contribution_usd: 49.20,
    channel_contribution_margin_pct: 55.91,
    expected_receivables_usd: 83.60,
    actual_settlement_usd: 83.60,
    settlement_discrepancy_usd: 0.00,
    cost_data_status: 'SYNTHETIC_BENCHMARK',
    data_provenance: 'SYNTHETIC_STAGING_FIXTURE'
  }
];

const CANONICAL_DEMO_WORKING_CAPITAL: InventoryWorkingCapitalRow[] = [
  { branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94', department: 'Produce', concept_affiliation: 'SHARED_COMPANY', inventory_type: 'RAW_MATERIAL', item_id: 'a0000001', item_name: 'Fresh Romaine Lettuce', unit: 'head', current_stock: 19.0, unit_cost: 1.50, working_capital_usd: 28.50, asset_status: 'ACTIVE_ASSET' },
  { branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94', department: 'Dairy', concept_affiliation: 'SHARED_COMPANY', inventory_type: 'RAW_MATERIAL', item_id: 'a0000002', item_name: 'European Unsalted Butter 82%', unit: 'kg', current_stock: 15.0, unit_cost: 4.00, working_capital_usd: 60.00, asset_status: 'ACTIVE_ASSET' },
  { branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94', department: 'Bakery Prep', concept_affiliation: 'SHARED_COMPANY', inventory_type: 'RAW_MATERIAL', item_id: 'a0000003', item_name: 'French Wheat Flour T55', unit: 'kg', current_stock: 30.0, unit_cost: 1.50, working_capital_usd: 45.00, asset_status: 'ACTIVE_ASSET' },
  { branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94', department: 'Dairy', concept_affiliation: 'SHARED_COMPANY', inventory_type: 'RAW_MATERIAL', item_id: 'a0000004', item_name: 'Parmigiano Reggiano DOP 24M', unit: 'kg', current_stock: 2.6, unit_cost: 20.00, working_capital_usd: 52.00, asset_status: 'ACTIVE_ASSET' },
  { branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94', department: 'Meat', concept_affiliation: 'SHARED_COMPANY', inventory_type: 'RAW_MATERIAL', item_id: 'a0000005', item_name: 'Angus Beef Patty 150g', unit: 'kg', current_stock: 100.0, unit_cost: 15.00, working_capital_usd: 1500.00, asset_status: 'ACTIVE_ASSET' },
  { branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94', department: 'Kitchen Prep', concept_affiliation: 'SHARED_COMPANY', inventory_type: 'WORK_IN_PROGRESS', item_id: 'w0000001', item_name: 'WIP Batch #BATCH-MONTH-END-WIP', unit: 'pcs', current_stock: 50.0, unit_cost: 0.50, working_capital_usd: 25.00, asset_status: 'ACTIVE_ASSET' },
  { branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94', department: 'Bakery', concept_affiliation: 'NEO', inventory_type: 'FINISHED_GOOD', item_id: 'f0000001', item_name: 'NÉO French Butter Croissant', unit: 'pcs', current_stock: 30.0, unit_cost: 2.00, working_capital_usd: 60.00, asset_status: 'ACTIVE_ASSET' },
  { branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94', department: 'Bakery', concept_affiliation: 'OVRLOAD', inventory_type: 'FINISHED_GOOD', item_id: 'f0000002', item_name: 'Artisanal Brioche Buns (Baked)', unit: 'pcs', current_stock: 120.0, unit_cost: 0.50, working_capital_usd: 60.00, asset_status: 'ACTIVE_ASSET' },
  { branch_id: '9c214659-9cc7-4f33-b115-cbbb8a823a94', department: 'Supplies', concept_affiliation: 'SHARED_COMPANY', inventory_type: 'CONSUMABLE', item_id: 'c0000001', item_name: 'Bar Cleaning Degreaser Spec', unit: 'unit', current_stock: 3.0, unit_cost: 15.00, working_capital_usd: 45.00, asset_status: 'ACTIVE_ASSET' }
];

const CANONICAL_DEMO_RESERVE: CorporateReserveRow[] = [
  { reserve_category: 'CORPORATE_OPERATING_EXPENSE', source_table: 'company_expenses', reference_id: 'e1111111-0004', payee: 'PwC Lebanon Advisory', line_item: 'Corporate Audit & Statutory Tax Compliance', amount_usd: 300.00, audit_justification: 'Statutory compliance not attributable to individual concepts', audit_date: '2026-11-01' },
  { reserve_category: 'UNALLOCATED_INVENTORY_LOSS', source_table: 'waste_logs', reference_id: 'wst-storage-01', payee: 'Central Facility Storage', line_item: 'Unallocated cold storage temperature spike loss', amount_usd: 30.00, audit_justification: 'Shared central inventory shortage not traceable to single kitchen station', audit_date: '2026-11-01' }
];

export const multiConceptFinancialApi = {
  isDemoDataActive: (): boolean => {
    return typeof window !== 'undefined' && localStorage.getItem('flow_demo_data_active') === 'true';
  },

  getExecutiveDashboard: async (year: number, month: number): Promise<{
    consolidated: ConsolidatedStatementRow | null;
    concepts: ConceptPnlRow[];
  }> => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('flow_demo_data_active') === 'true';
    if (isDemo) {
      return {
        consolidated: CANONICAL_DEMO_CONSOLIDATED,
        concepts: CANONICAL_DEMO_CONCEPTS
      };
    }

    try {
      const { data: consData } = await supabase
        .from('v_company_consolidated_financial_statement')
        .select('*')
        .eq('period_year', year)
        .eq('period_month', month);

      const { data: concData } = await supabase
        .from('v_concept_3level_pnl')
        .select('*')
        .eq('period_year', year)
        .eq('period_month', month);

      return {
        consolidated: consData && consData.length > 0 ? consData[0] : null,
        concepts: concData || []
      };
    } catch (e) {
      console.warn('Live query error in live mode:', e);
      return {
        consolidated: null,
        concepts: []
      };
    }
  },

  getConceptComparison: async (year: number, month: number): Promise<ConceptPnlRow[]> => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('flow_demo_data_active') === 'true';
    if (isDemo) return CANONICAL_DEMO_CONCEPTS;

    try {
      const { data } = await supabase
        .from('v_concept_3level_pnl')
        .select('*')
        .eq('period_year', year)
        .eq('period_month', month);

      return data || [];
    } catch (e) {
      console.warn('Live getConceptComparison error:', e);
      return [];
    }
  },

  getChannelProfitability: async (year: number, month: number, conceptId?: string): Promise<ChannelProfitabilityRow[]> => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('flow_demo_data_active') === 'true';
    if (isDemo) {
      if (conceptId && conceptId !== 'ALL') {
        return CANONICAL_DEMO_CHANNELS.filter(c => c.concept_id === conceptId || c.concept_code === conceptId);
      }
      return CANONICAL_DEMO_CHANNELS;
    }

    try {
      let query = supabase
        .from('v_concept_channel_profitability')
        .select('*')
        .eq('period_year', year)
        .eq('period_month', month);

      if (conceptId && conceptId !== 'ALL') {
        query = query.or(`concept_id.eq.${conceptId},concept_code.eq.${conceptId}`);
      }

      const { data } = await query;
      return data || [];
    } catch (e) {
      console.warn('Live getChannelProfitability error:', e);
      return [];
    }
  },

  getInventoryWorkingCapital: async (branchId?: string): Promise<InventoryWorkingCapitalRow[]> => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('flow_demo_data_active') === 'true';
    if (isDemo) return CANONICAL_DEMO_WORKING_CAPITAL;

    try {
      let query = supabase
        .from('v_concept_inventory_working_capital')
        .select('*');

      if (branchId && branchId !== 'All') {
        query = query.eq('branch_id', branchId);
      }

      const { data } = await query;
      return data || [];
    } catch (e) {
      console.warn('Live getInventoryWorkingCapital error:', e);
      return [];
    }
  },

  getReconciliationAudit: async (): Promise<ReconciliationAuditRow[]> => {
    try {
      const { data } = await supabase
        .from('v_reconciliation_audit_exceptions')
        .select('*')
        .order('recorded_at', { ascending: false });

      if (data && data.length > 0) return data;
    } catch {}
    return [];
  },

  getExpenseAllocationReconciliation: async (year: number, month: number): Promise<any> => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('flow_demo_data_active') === 'true';
    if (isDemo) return CANONICAL_DEMO_CONSOLIDATED;

    try {
      const { data } = await supabase
        .from('v_company_consolidated_financial_statement')
        .select('*')
        .eq('period_year', year)
        .eq('period_month', month);

      return data && data.length > 0 ? data[0] : null;
    } catch (e) {
      console.warn('Live getExpenseAllocationReconciliation error:', e);
      return null;
    }
  },

  getAccountingPeriods: async (branchId: string): Promise<any[]> => {
    try {
      const { data } = await supabase
        .from('accounting_periods')
        .select('*')
        .eq('branch_id', branchId)
        .order('start_date', { ascending: false });

      if (data && data.length > 0) return data;
    } catch {}
    return [];
  },

  closeAccountingPeriod: async (periodCode: string, branchId: string, forceClose: boolean, userId: string): Promise<any> => {
    const { data, error } = await supabase.rpc('rpc_close_accounting_period', {
      p_period_code: periodCode,
      p_branch_id: branchId,
      p_force_close: forceClose,
      p_calling_user_id: userId
    });

    if (error) {
      console.error('Error closing accounting period:', error);
      throw error;
    }
    return data;
  },

  reopenAccountingPeriod: async (periodCode: string, branchId: string, reason: string, userId: string): Promise<any> => {
    const { data, error } = await supabase.rpc('rpc_reopen_accounting_period', {
      p_period_code: periodCode,
      p_branch_id: branchId,
      p_reopen_reason: reason,
      p_calling_user_id: userId
    });

    if (error) {
      console.error('Error reopening accounting period:', error);
      throw error;
    }
    return data;
  },

  validatePrecloseChecklist: async (branchId: string, periodDate: string): Promise<any> => {
    try {
      const { data } = await supabase.rpc('rpc_validate_period_preclose_checklist', {
        p_branch_id: branchId,
        p_period_date: periodDate
      });
      return data;
    } catch {
      return null;
    }
  },

  getCorporateReserveBreakdown: async (): Promise<CorporateReserveRow[]> => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('flow_demo_data_active') === 'true';
    if (isDemo) return CANONICAL_DEMO_RESERVE;

    try {
      const { data } = await supabase
        .from('v_corporate_reserve_breakdown')
        .select('*');

      return data || [];
    } catch (e) {
      console.warn('Live getCorporateReserveBreakdown error:', e);
      return [];
    }
  },

  getInventoryValuationBridge: async (): Promise<InventoryValuationBridgeRow | null> => {
    const isDemo = typeof window !== 'undefined' && localStorage.getItem('flow_demo_data_active') === 'true';
    if (isDemo) {
      return {
        opening_inventory_valuation_usd: 0.00,
        goods_received_purchases_usd: 2000.00,
        open_wip_capitalized_usd: 25.00,
        cogs_recognized_reductions_usd: 157.70,
        waste_and_shrinkage_reductions_usd: 35.00,
        closing_inventory_valuation_usd: 1916.00,
        balance_sheet_inventory_status: 'RECONCILED_BALANCED'
      };
    }

    try {
      const { data } = await supabase
        .from('v_inventory_valuation_bridge')
        .select('*');

      if (data && data.length > 0) return data[0];
    } catch (e) {
      console.warn('Live getInventoryValuationBridge error:', e);
    }
    return {
      opening_inventory_valuation_usd: 0.00,
      goods_received_purchases_usd: 0.00,
      open_wip_capitalized_usd: 0.00,
      cogs_recognized_reductions_usd: 0.00,
      waste_and_shrinkage_reductions_usd: 0.00,
      closing_inventory_valuation_usd: 0.00,
      balance_sheet_inventory_status: 'NO_ACTIVITY'
    };
  },

  seedDemoData: async (_year: number, _month: number, _branchId: string): Promise<boolean> => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('flow_demo_data_active', 'true');
    }
    return true;
  },

  clearDemoData: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('flow_demo_data_active');
    }
  },

  setDemoMode: (active: boolean) => {
    if (typeof window !== 'undefined') {
      if (active) {
        localStorage.setItem('flow_demo_data_active', 'true');
      } else {
        localStorage.removeItem('flow_demo_data_active');
      }
    }
  }
};
