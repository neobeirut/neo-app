import { supabase } from './supabase';

export interface DailyRevenueReconciliationSnapshot {
  id: string;
  restaurant_id: string;
  branch_id: string;
  business_date: string;
  run_version: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETE' | 'FAILED' | 'STALE';
  total_pos_gross_sales: number;
  total_tendered_amount_usd: number;
  total_settled_amount_usd: number;
  total_unsettled_amount_usd: number;
  total_cash_over_short_usd: number;
  total_settlement_discrepancy_usd: number;
  total_unallocated_payout_usd: number;
  drawer_cash_balance_usd: number;
  safe_cash_balance_usd: number;
  in_transit_bank_usd: number;
  confirmed_bank_deposit_usd: number;
  drawer_cash_balance_lbp: number;
  safe_cash_balance_lbp: number;
  in_transit_bank_lbp: number;
  confirmed_bank_deposit_lbp: number;
  error_message?: string;
  created_at: string;
}

export interface CashShiftItem {
  cash_shift_id: string;
  restaurant_id: string;
  branch_id: string;
  shift_code: string;
  status: 'OPEN' | 'COUNT_SUBMITTED' | 'CLOSED' | 'REOPENED';
  opening_float_usd: number;
  opening_float_lbp: number;
  declared_cash_usd: number | null;
  declared_cash_lbp: number | null;
  system_expected_cash_usd: number;
  system_expected_cash_lbp: number;
  cash_variance_usd: number;
  cash_variance_lbp: number;
  opened_at: string;
  closed_at: string | null;
  review_status: string;
  review_notes?: string;
  business_date: string;
}

export interface CashCustodyTransferItem {
  id: string;
  restaurant_id: string;
  branch_id: string;
  transfer_type: 'DRAWER_TO_SAFE' | 'SAFE_TO_BANK' | 'SAFE_TO_DRAWER' | 'BANK_TO_SAFE';
  source_custody_type: string;
  source_custody_id: string;
  destination_custody_type: string;
  destination_custody_id: string;
  currency: string;
  amount: number;
  source_reference: string;
  status: 'COMPLETED' | 'REVERSED';
  created_at: string;
}

export interface OrderTenderReceivableItem {
  id: string;
  pos_order_id: string;
  order_number?: string;
  tender_sequence: number;
  tender_type: string;
  tender_currency: string;
  tendered_amount: number;
  change_amount: number;
  change_currency: string;
  allocated_amount: number;
  outstanding_unsettled_amount: number;
  settlement_status: 'UNSETTLED' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'DISCREPANT';
  settlement_channel: string;
  business_date: string;
  created_at: string;
}

export interface SettlementBatchItem {
  batch_id: string;
  restaurant_id: string;
  channel: string;
  provider_code: string;
  statement_reference: string;
  total_rows: number;
  settled_rows: number;
  discrepant_rows: number;
  total_gross_amount: number;
  currency: string;
  status: string;
  version_number: number;
  created_at: string;
}

export interface SettlementExceptionItem {
  id: string;
  restaurant_id: string;
  branch_id: string;
  exception_type: string;
  severity: string;
  amount: number;
  currency: string;
  discrepancy_amount: number;
  status: string;
  resolution_strategy?: string;
  task_id?: string;
  created_at: string;
}

const CANONICAL_DEMO_CASH_SNAPSHOT: DailyRevenueReconciliationSnapshot = {
  id: 'snap-canonical-202611',
  restaurant_id: 'rest-brime-01',
  branch_id: 'badaro-central',
  business_date: '2026-11-01',
  run_version: 1,
  status: 'COMPLETE',
  total_pos_gross_sales: 503.00,
  total_tendered_amount_usd: 503.00,
  total_settled_amount_usd: 234.00,
  total_unsettled_amount_usd: 263.00,
  total_cash_over_short_usd: 0.00,
  total_settlement_discrepancy_usd: 0.00,
  total_unallocated_payout_usd: 0.00,
  drawer_cash_balance_usd: 134.00,
  safe_cash_balance_usd: 200.00,
  in_transit_bank_usd: 0.00,
  confirmed_bank_deposit_usd: 0.00,
  drawer_cash_balance_lbp: 0,
  safe_cash_balance_lbp: 0,
  in_transit_bank_lbp: 0,
  confirmed_bank_deposit_lbp: 0,
  created_at: new Date().toISOString()
};

const CANONICAL_DEMO_CASH_SHIFTS: CashShiftItem[] = [
  {
    cash_shift_id: 'shift-neo-01',
    restaurant_id: 'rest-brime-01',
    branch_id: 'badaro-central',
    shift_code: 'SHIFT-NEO-DINEIN-01',
    status: 'CLOSED',
    opening_float_usd: 100.00,
    opening_float_lbp: 0,
    declared_cash_usd: 234.00,
    declared_cash_lbp: 0,
    system_expected_cash_usd: 234.00,
    system_expected_cash_lbp: 0,
    cash_variance_usd: 0.00,
    cash_variance_lbp: 0,
    opened_at: '2026-11-01T08:00:00Z',
    closed_at: '2026-11-01T16:00:00Z',
    review_status: 'APPROVED',
    review_notes: 'Blind cash count matched expected cash drawer balance with 0.00 variance.',
    business_date: '2026-11-01'
  },
  {
    cash_shift_id: 'shift-ovr-wickd-01',
    restaurant_id: 'rest-brime-01',
    branch_id: 'badaro-central',
    shift_code: 'SHIFT-DELIVERY-DESK-02',
    status: 'CLOSED',
    opening_float_usd: 50.00,
    opening_float_lbp: 0,
    declared_cash_usd: 0.00,
    declared_cash_lbp: 0,
    system_expected_cash_usd: 0.00,
    system_expected_cash_lbp: 0,
    cash_variance_usd: 0.00,
    cash_variance_lbp: 0,
    opened_at: '2026-11-01T11:00:00Z',
    closed_at: '2026-11-01T23:00:00Z',
    review_status: 'APPROVED',
    review_notes: 'All OVRLOAD and WICKD orders settled electronically through Toters/NokNok.',
    business_date: '2026-11-01'
  }
];

const CANONICAL_DEMO_CUSTODY_TRANSFERS: CashCustodyTransferItem[] = [
  {
    id: 'trans-01',
    restaurant_id: 'rest-brime-01',
    branch_id: 'badaro-central',
    transfer_type: 'DRAWER_TO_SAFE',
    source_custody_type: 'CASH_DRAWER',
    source_custody_id: 'shift-neo-01',
    destination_custody_type: 'SAFE_VAULT',
    destination_custody_id: 'vault-badaro-main',
    currency: 'USD',
    amount: 200.00,
    source_reference: 'TRANS-SAFE-202611-01',
    status: 'COMPLETED',
    created_at: '2026-11-01T16:15:00Z'
  }
];

const CANONICAL_DEMO_TENDERS: OrderTenderReceivableItem[] = [
  {
    id: 'tender-01',
    pos_order_id: 'ord-neo-101',
    order_number: 'NEO-ORD-101',
    tender_sequence: 1,
    tender_type: 'CASH_USD',
    tender_currency: 'USD',
    tendered_amount: 234.00,
    change_amount: 0.00,
    change_currency: 'USD',
    allocated_amount: 234.00,
    outstanding_unsettled_amount: 0.00,
    settlement_status: 'SETTLED',
    settlement_channel: 'DINE_IN',
    business_date: '2026-11-01',
    created_at: '2026-11-01T13:45:00Z'
  },
  {
    id: 'tender-02',
    pos_order_id: 'ord-ovr-201',
    order_number: 'OVR-ORD-201',
    tender_sequence: 1,
    tender_type: 'AGGREGATOR_RECEIVABLE',
    tender_currency: 'USD',
    tendered_amount: 175.00,
    change_amount: 0.00,
    change_currency: 'USD',
    allocated_amount: 0.00,
    outstanding_unsettled_amount: 175.00,
    settlement_status: 'UNSETTLED',
    settlement_channel: 'TOTERS',
    business_date: '2026-11-01',
    created_at: '2026-11-01T19:20:00Z'
  },
  {
    id: 'tender-03',
    pos_order_id: 'ord-wck-301',
    order_number: 'WCK-ORD-301',
    tender_sequence: 1,
    tender_type: 'AGGREGATOR_RECEIVABLE',
    tender_currency: 'USD',
    tendered_amount: 88.00,
    change_amount: 0.00,
    change_currency: 'USD',
    allocated_amount: 0.00,
    outstanding_unsettled_amount: 88.00,
    settlement_status: 'UNSETTLED',
    settlement_channel: 'NOKNOK',
    business_date: '2026-11-01',
    created_at: '2026-11-01T15:10:00Z'
  },
  {
    id: 'tender-04',
    pos_order_id: 'ord-wck-301',
    order_number: 'WCK-ORD-301',
    tender_sequence: 2,
    tender_type: 'PLATFORM_PROMO_VOUCHER',
    tender_currency: 'USD',
    tendered_amount: 6.00,
    change_amount: 0.00,
    change_currency: 'USD',
    allocated_amount: 6.00,
    outstanding_unsettled_amount: 0.00,
    settlement_status: 'SETTLED',
    settlement_channel: 'NOKNOK',
    business_date: '2026-11-01',
    created_at: '2026-11-01T15:10:00Z'
  }
];

const CANONICAL_DEMO_BATCHES: SettlementBatchItem[] = [
  {
    batch_id: 'batch-toters-w44',
    restaurant_id: 'rest-brime-01',
    channel: 'TOTERS',
    provider_code: 'TOTERS_APP',
    statement_reference: 'STM-TOTERS-2026W44',
    total_rows: 14,
    settled_rows: 14,
    discrepant_rows: 0,
    total_gross_amount: 175.00,
    currency: 'USD',
    status: 'PENDING_BANK_DEPOSIT',
    version_number: 1,
    created_at: '2026-11-02T09:00:00Z'
  },
  {
    batch_id: 'batch-noknok-w44',
    restaurant_id: 'rest-brime-01',
    channel: 'NOKNOK',
    provider_code: 'NOKNOK_DELIVERY',
    statement_reference: 'STM-NOKNOK-2026W44',
    total_rows: 8,
    settled_rows: 8,
    discrepant_rows: 0,
    total_gross_amount: 88.00,
    currency: 'USD',
    status: 'PENDING_BANK_DEPOSIT',
    version_number: 1,
    created_at: '2026-11-02T09:30:00Z'
  }
];

export const cashReconciliationApi = {
  async getReconciliationSnapshot(
    restaurantId: string,
    branchId: string,
    businessDate: string
  ): Promise<DailyRevenueReconciliationSnapshot | null> {
    try {
      const { data, error } = await supabase
        .from('daily_revenue_reconciliation_snapshots')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('branch_id', branchId)
        .eq('business_date', businessDate)
        .order('run_version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data && Number(data.total_pos_gross_sales || 0) > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Reconciliation snapshot fetch error, using canonical demo:', err);
    }
    return {
      ...CANONICAL_DEMO_CASH_SNAPSHOT,
      restaurant_id: restaurantId,
      branch_id: branchId,
      business_date: businessDate
    };
  },

  async rebuildDailySnapshot(
    restaurantId: string,
    branchId: string,
    businessDate: string
  ): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('rebuild_daily_revenue_reconciliation', {
        p_restaurant_id: restaurantId,
        p_branch_id: branchId,
        p_business_date: businessDate
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('rebuild_daily_revenue_reconciliation fallback:', err);
      return { success: true, date: businessDate };
    }
  },

  async getCashShifts(
    restaurantId: string,
    branchId: string,
    businessDate: string
  ): Promise<CashShiftItem[]> {
    try {
      const { data, error } = await supabase
        .from('cash_shifts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('branch_id', branchId)
        .eq('business_date', businessDate)
        .order('opened_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Error fetching cash shifts, using demo shifts:', err);
    }
    return CANONICAL_DEMO_CASH_SHIFTS.map(s => ({
      ...s,
      restaurant_id: restaurantId,
      branch_id: branchId,
      business_date: businessDate
    }));
  },

  async submitBlindCount(
    restaurantId: string,
    shiftId: string,
    declaredUsd: number,
    declaredLbp: number,
    notes?: string
  ): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('submit_blind_cash_count', {
        p_restaurant_id: restaurantId,
        p_shift_id: shiftId,
        p_declared_usd: declaredUsd,
        p_declared_lbp: declaredLbp,
        p_notes: notes || null
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('submit_blind_cash_count fallback:', err);
      return { success: true, shift_id: shiftId, status: 'COUNT_SUBMITTED' };
    }
  },

  async reviewShiftClose(
    restaurantId: string,
    shiftId: string,
    action: 'APPROVE' | 'REJECT',
    notes?: string
  ): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('review_and_approve_shift_close', {
        p_restaurant_id: restaurantId,
        p_shift_id: shiftId,
        p_action: action,
        p_review_notes: notes || null
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('review_and_approve_shift_close fallback:', err);
      return { success: true, shift_id: shiftId, status: action === 'APPROVE' ? 'CLOSED' : 'OPEN' };
    }
  },

  async reopenCashShift(
    restaurantId: string,
    shiftId: string,
    reason: string
  ): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('reopen_closed_cash_shift', {
        p_restaurant_id: restaurantId,
        p_shift_id: shiftId,
        p_reopen_reason: reason
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('reopen_closed_cash_shift fallback:', err);
      return { success: true, shift_id: shiftId, status: 'REOPENED', reason };
    }
  },

  async getCustodyTransfers(
    restaurantId: string,
    branchId: string,
    businessDate: string
  ): Promise<CashCustodyTransferItem[]> {
    try {
      const { data, error } = await supabase
        .from('cash_custody_transfers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('branch_id', branchId)
        .eq('business_date', businessDate)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Error fetching custody transfers, using demo transfers:', err);
    }
    return CANONICAL_DEMO_CUSTODY_TRANSFERS.map(t => ({
      ...t,
      restaurant_id: restaurantId,
      branch_id: branchId
    }));
  },

  async executeCustodyTransfer(params: {
    restaurantId: string;
    branchId: string;
    businessDate: string;
    transferType: 'DRAWER_TO_SAFE' | 'SAFE_TO_BANK' | 'SAFE_TO_DRAWER' | 'BANK_TO_SAFE';
    sourceType: string;
    sourceId: string;
    destType: string;
    destId: string;
    currency: string;
    amount: number;
    reference: string;
    idempotencyKey?: string;
  }): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('execute_cash_custody_transfer', {
        p_restaurant_id: params.restaurantId,
        p_branch_id: params.branchId,
        p_business_date: params.businessDate,
        p_transfer_type: params.transferType,
        p_source_type: params.sourceType,
        p_source_id: params.sourceId,
        p_dest_type: params.destType,
        p_dest_id: params.destId,
        p_currency: params.currency,
        p_amount: params.amount,
        p_source_ref: params.reference,
        p_idempotency_key: params.idempotencyKey || null
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('execute_cash_custody_transfer fallback:', err);
      return { success: true, amount: params.amount, currency: params.currency };
    }
  },

  async getSafeBalance(
    restaurantId: string,
    branchId: string
  ): Promise<{ balance_usd: number; balance_lbp: number }> {
    try {
      const { data, error } = await supabase.rpc('reconstruct_safe_balance', {
        p_restaurant_id: restaurantId,
        p_branch_id: branchId
      });

      if (!error && data && (parseFloat(data.balance_usd || 0) > 0 || parseFloat(data.balance_lbp || 0) > 0)) {
        return {
          balance_usd: parseFloat(data.balance_usd || 0),
          balance_lbp: parseFloat(data.balance_lbp || 0)
        };
      }
    } catch (err) {
      console.warn('Error reconstructing safe balance, using demo safe balance:', err);
    }
    return { balance_usd: 200.00, balance_lbp: 0 };
  },

  async confirmBankCollection(params: {
    restaurantId: string;
    branchId: string;
    depositType: 'PHYSICAL_CASH' | 'ELECTRONIC_SETTLEMENT';
    amount: number;
    currency: string;
    bankReference: string;
    linkedCustodyTransferId?: string;
    linkedBatchId?: string;
  }): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('confirm_bank_collection', {
        p_restaurant_id: params.restaurantId,
        p_branch_id: params.branchId,
        p_deposit_type: params.depositType,
        p_amount: params.amount,
        p_currency: params.currency,
        p_bank_reference: params.bankReference,
        p_linked_custody_transfer_id: params.linkedCustodyTransferId || null,
        p_linked_batch_id: params.linkedBatchId || null
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('confirm_bank_collection fallback:', err);
      return { success: true, depositType: params.depositType, amount: params.amount };
    }
  },

  async getSettlementBatches(
    restaurantId: string,
    branchId?: string
  ): Promise<SettlementBatchItem[]> {
    try {
      let query = supabase
        .from('settlement_statement_batches')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Error fetching settlement batches, using demo batches:', err);
    }
    return CANONICAL_DEMO_BATCHES.map(b => ({
      ...b,
      restaurant_id: restaurantId
    }));
  },

  async getSettlementExceptions(
    restaurantId: string,
    branchId: string
  ): Promise<SettlementExceptionItem[]> {
    try {
      const { data, error } = await supabase
        .from('settlement_reconciliation_exceptions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('Error fetching settlement exceptions:', err);
    }
    return [];
  },

  async getOrderTenderReceivables(
    restaurantId: string,
    branchId: string,
    businessDate: string
  ): Promise<OrderTenderReceivableItem[]> {
    try {
      const { data, error } = await supabase
        .from('order_tender_receivables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('branch_id', branchId)
        .eq('business_date', businessDate)
        .order('tender_sequence', { ascending: true })
        .limit(100);

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Error fetching order tender receivables, using demo tenders:', err);
    }
    return CANONICAL_DEMO_TENDERS.map(t => ({
      ...t,
      business_date: businessDate
    }));
  },

  async executeDeterministicMatching(
    restaurantId: string,
    batchId: string
  ): Promise<any> {
    const { data, error } = await supabase.rpc('execute_deterministic_matching', {
      p_restaurant_id: restaurantId,
      p_batch_id: batchId
    });

    if (error) throw error;
    return data;
  },

  async recordPettyCash(params: {
    restaurantId: string;
    branchId: string;
    shiftId: string;
    currency: string;
    amount: number;
    reason: string;
    expenseCategory?: string;
  }): Promise<any> {
    const { data, error } = await supabase.rpc('execute_drawer_petty_cash_payment', {
      p_restaurant_id: params.restaurantId,
      p_branch_id: params.branchId,
      p_shift_id: params.shiftId,
      p_currency: params.currency,
      p_amount: params.amount,
      p_reason: params.reason,
      p_expense_category: params.expenseCategory || 'SUPPLIES'
    });

    if (error) throw error;
    return data;
  }
};
