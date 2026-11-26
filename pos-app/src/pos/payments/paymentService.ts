import { api } from '../../api/client';
import { supabase, getGlobalRestaurantId } from '../../api/supabase';

import type {
  OrderFinancialSummary,
  PaymentRecord,
  PaymentStatus,
  RefundRecord,
  SubmitPaymentParams,
  SubmitRefundParams,
  SupportedCurrency,
  TenderItem
} from './types';

import { COMMERCE_API_BASE } from '../config';

/**
 * Normalizes payment status.
 * If order is completed or delivered but has zero recorded payments in order_payments,
 * it is considered PAID — LEGACY to avoid creating fake payment rows.
 */
export function normalizePaymentStatus(
  order: any,
  payments?: PaymentRecord[]
): PaymentStatus {
  if (!order) return 'UNPAID';

  const rawStatus = (order.payment_status || '').toUpperCase();
  const fulfillment = (order.status || '').toLowerCase();
  const hasRecordedPayments = Boolean(payments && payments.length > 0);

  if (rawStatus === 'REFUNDED') return 'REFUNDED';
  if (rawStatus === 'PARTIALLY_REFUNDED') return 'PARTIALLY_REFUNDED';
  if (rawStatus === 'PARTIALLY_PAID') return 'PARTIALLY_PAID';
  if (rawStatus === 'PAID') return 'PAID';

  // Check legacy completion
  if ((fulfillment === 'completed' || fulfillment === 'delivered') && !hasRecordedPayments) {
    return 'PAID_LEGACY';
  }

  const amountPaid = parseFloat(order.amount_paid || order.tendered_amount || 0);
  const total = parseFloat(order.total_amount || order.total || 0);

  if (amountPaid >= total && total > 0) return 'PAID';
  if (amountPaid > 0) return 'PARTIALLY_PAID';

  return 'UNPAID';
}

/**
 * Fetches financial summary, payment ledger, and refund records.
 * Uses standalone FLOW Supabase ledger (pos_orders, order_tender_receivables, void_receipts)
 * when COMMERCE_API_BASE is empty. Propagates database errors and refuses to fail open.
 */
export async function getFinancialSummary(
  orderId: number,
  baseOrder?: any
): Promise<{
  success: boolean;
  summary: OrderFinancialSummary;
  payments: PaymentRecord[];
  refunds: RefundRecord[];
  error?: string;
}> {
  try {
    if (COMMERCE_API_BASE) {
      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${orderId}/payments`);
      if (res.ok) {
        const data = await res.json();
        const payments: PaymentRecord[] = data.payments || [];
        const refunds: RefundRecord[] = data.refunds || [];
        const rawSummary = data.orderSummary;

        let normalizedStatus: PaymentStatus = rawSummary.paymentStatus;
        if ((rawSummary.fulfillmentStatus === 'completed' || rawSummary.fulfillmentStatus === 'delivered') && payments.length === 0) {
          normalizedStatus = 'PAID_LEGACY';
        }

        return {
          success: true,
          summary: {
            orderId,
            totalAmount: rawSummary.totalAmount,
            amountPaid: rawSummary.amountPaid,
            amountRefunded: rawSummary.amountRefunded,
            netPaid: rawSummary.netPaid,
            amountRemaining: rawSummary.amountRemaining,
            paymentStatus: normalizedStatus,
            fulfillmentStatus: rawSummary.fulfillmentStatus,
            version: rawSummary.version
          },
          payments,
          refunds
        };
      } else {
        throw new Error(`Commerce API payment verification failed (HTTP ${res.status})`);
      }
    }

    // Standalone FLOW Supabase Payment Flow
    // 1. Fetch order from pos_orders
    const { data: dbOrder, error: orderErr } = await supabase
      .from('pos_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr) {
      throw new Error(`Failed to fetch order ${orderId}: ${orderErr.message}`);
    }

    const order = dbOrder || baseOrder;
    if (!order) {
      throw new Error(`Order #${orderId} not found`);
    }

    const totalAmount = parseFloat(order?.total_amount || order?.total || 0);

    // 2. Fetch tender receivables for this order
    const { data: tenders, error: tendersErr } = await supabase
      .from('order_tender_receivables')
      .select('*')
      .eq('pos_order_id', orderId)
      .order('tender_sequence', { ascending: true });

    if (tendersErr) {
      throw new Error(`Failed to fetch tender receivables for order ${orderId}: ${tendersErr.message}`);
    }

    // 3. Fetch completed refund audit records from void_receipts
    const { data: voidRows, error: voidErr } = await supabase
      .from('void_receipts')
      .select('*')
      .eq('order_number', String(orderId))
      .eq('status', 'completed')
      .eq('void_type', 'refund');

    if (voidErr) {
      throw new Error(`Failed to fetch void receipts for order ${orderId}: ${voidErr.message}`);
    }

    const payments: PaymentRecord[] = (tenders || []).map((t: any, idx: number) => {
      const isCard = (t.tender_type || '').toUpperCase().includes('CARD');
      const isAgg = (t.tender_type || '').toUpperCase().includes('MARKETPLACE');
      const isLbp = (t.tender_currency || '').toUpperCase() === 'LBP';
      const method = isCard ? 'Credit Card' : (isLbp ? 'Cash LBP' : 'Cash USD');
      return {
        id: typeof t.id === 'number' ? t.id : (parseInt(String(t.id).replace(/\D/g, ''), 10) || idx + 1),
        operation_id: t.source_tender_key || `tender-${t.id}`,
        order_id: Number(t.pos_order_id || orderId),
        payment_method: method,
        payment_category: isAgg ? 'aggregator' : 'direct',
        currency: (isLbp ? 'LBP' : 'USD') as SupportedCurrency,
        exchange_rate_used: t.exchange_rate_applied ? Number(t.exchange_rate_applied) : null,
        amount_in_currency: Number(t.tendered_amount || t.net_receivable_amount || 0),
        amount_usd: Number(t.net_receivable_amount || 0),
        tendered_amount: Number(t.tendered_amount ?? t.net_receivable_amount ?? 0),
        change_amount: Number(t.change_amount || 0),
        terminal_id: t.terminal_id || order?.terminal_id || null,
        cashier_reference: t.cashier_reference || order?.cashier_name || null,
        external_reference: t.provider_payment_reference || null,
        status: 'completed',
        created_at: t.completed_at || t.created_at || new Date().toISOString()
      };
    });

    const refunds: RefundRecord[] = (voidRows || []).map((r: any, idx: number) => ({
      id: typeof r.id === 'number' ? r.id : (parseInt(String(r.id).replace(/\D/g, ''), 10) || idx + 1),
      operation_id: r.operation_id || `refund-${r.id}`,
      order_id: Number(orderId),
      payment_id: null,
      refund_type: 'partial',
      amount: Number(r.canceled_items?.[0]?.price || 0),
      currency: 'USD',
      payment_method: 'Cash USD',
      reason: r.reason_comment || 'Refund',
      terminal_id: null,
      requested_by_reference: r.created_by || null,
      approved_by_reference: null,
      external_reference: null,
      status: 'completed',
      created_at: r.created_at || new Date().toISOString(),
      completed_at: r.updated_at || r.created_at || null
    }));

    // Financial calculations
    const isLegacy = order && (order.status === 'completed' || order.status === 'delivered') && payments.length === 0;
    let amountPaid = 0;
    if (payments.length > 0) {
      amountPaid = payments.reduce((sum, p) => sum + p.amount_usd, 0);
    } else if (order?.payment_status === 'paid' || isLegacy) {
      amountPaid = totalAmount;
    } else {
      amountPaid = parseFloat(order?.amount_paid || order?.tendered_amount || 0);
    }

    const refundLedgerTotal = refunds.reduce((sum, r) => sum + r.amount, 0);
    const amountRefunded = Math.max(refundLedgerTotal, parseFloat(order?.amount_refunded || 0));
    const netPaid = Math.max(0, amountPaid - amountRefunded);
    const amountRemaining = isLegacy ? 0 : Math.max(0, totalAmount - amountPaid);
    const paymentStatus = normalizePaymentStatus(order, payments);

    return {
      success: true,
      summary: {
        orderId,
        totalAmount,
        amountPaid: isLegacy ? totalAmount : amountPaid,
        amountRefunded,
        netPaid: isLegacy ? totalAmount : netPaid,
        amountRemaining,
        paymentStatus,
        fulfillmentStatus: order?.status,
        version: order?.version,
        invoice_number: order?.invoice_number || undefined,
        invoice_series: order?.invoice_series || undefined
      },
      payments,
      refunds
    };
  } catch (err: any) {
    console.error('Error in getFinancialSummary:', err);
    return {
      success: false,
      summary: {
        orderId,
        totalAmount: parseFloat(baseOrder?.total_amount || 0),
        amountPaid: 0,
        amountRefunded: 0,
        netPaid: 0,
        amountRemaining: parseFloat(baseOrder?.total_amount || 0),
        paymentStatus: 'UNPAID'
      },
      payments: [],
      refunds: [],
      error: err.message || 'Error fetching financial summary'
    };
  }
}

/**
 * Submits a single tender payment.
 * Uses standalone FLOW Supabase flow with create_order_tender_receivable RPC and idempotency.
 * Verifies pos_orders update and recovers safely on duplicate retry without double recording.
 */
export async function submitPayment(
  params: SubmitPaymentParams
): Promise<{
  success: boolean;
  payment?: PaymentRecord;
  summary?: OrderFinancialSummary;
  isDuplicate?: boolean;
  error?: string;
}> {
  try {
    const operationId = params.operationId || params.payment.operationId || (
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9)
    );

    if (COMMERCE_API_BASE) {
      const payload = {
        operation_id: operationId,
        payment_method: params.payment.method,
        payment_category: params.payment.category,
        currency: params.payment.currency,
        exchange_rate_used: params.payment.exchangeRate,
        amount_in_currency: params.payment.currency === 'LBP' ? params.payment.tenderedAmount : params.payment.appliedUsd,
        amount_usd: params.payment.appliedUsd,
        tendered_amount: params.payment.tenderedAmount,
        change_amount: params.payment.changeAmount,
        terminal_id: params.terminalId || 'flow-pos-terminal',
        cashier_reference: params.cashierName || 'Cashier',
        external_reference: params.payment.reference || null
      };

      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to record payment' };
      }

      return {
        success: true,
        payment: data.payment,
        summary: data.orderSummary,
        isDuplicate: Boolean(data.isDuplicate)
      };
    }

    // Standalone FLOW Supabase payment flow:
    // 1. Idempotency & recovery check: see if a tender with this source_tender_key already exists
    const { data: existingTenders, error: fetchTendersErr } = await supabase
      .from('order_tender_receivables')
      .select('*')
      .eq('pos_order_id', params.orderId);

    if (fetchTendersErr) {
      return { success: false, error: `Failed to verify existing tenders: ${fetchTendersErr.message}` };
    }

    const duplicate = (existingTenders || []).find((t: any) => t.source_tender_key === operationId);
    if (duplicate) {
      // The tender receivable is already committed in the database!
      // DO NOT call create_order_tender_receivable again.
      // Reconcile and ensure pos_orders is updated to reflect this and all tenders.
      const { data: order, error: orderErr } = await supabase
        .from('pos_orders')
        .select('*')
        .eq('id', params.orderId)
        .maybeSingle();

      if (orderErr || !order) {
        return { success: false, error: orderErr?.message || 'Order not found during payment recovery' };
      }

      const totalPaid = (existingTenders || []).reduce((sum: number, t: any) => sum + Number(t.net_receivable_amount || 0), 0);
      const totalDue = parseFloat(order.total_amount || order.total || 0);
      const isFullyPaid = totalPaid >= totalDue - 0.001;

      const needsUpdate = order.payment_status !== (isFullyPaid ? 'paid' : (totalPaid > 0 ? 'partially_paid' : 'unpaid'))
        || (isFullyPaid && !order.completed_at)
        || Number(order.amount_paid || 0) < totalPaid - 0.001;

      if (needsUpdate) {
        const orderRecoveryUpdate: any = {
          payment_method: params.payment.method,
          payment_status: isFullyPaid ? 'paid' : 'partially_paid',
          amount_paid: totalPaid,
          updated_at: new Date().toISOString()
        };
        if (isFullyPaid) {
          if (!order.completed_at) orderRecoveryUpdate.completed_at = new Date().toISOString();
          if (!['completed', 'closed', 'delivered'].includes(order.status)) {
            orderRecoveryUpdate.status = (order.order_type === 'dine_in' || order.order_source === 'Tables') ? 'completed' : (order.status === 'preparing' ? 'preparing' : 'completed');
          }
        }
        const { error: recoveryErr } = await supabase
          .from('pos_orders')
          .update(orderRecoveryUpdate)
          .eq('id', params.orderId);

        if (recoveryErr) {
          return {
            success: false,
            error: `Tender recorded, but order recovery update failed: ${recoveryErr.message}`
          };
        }
      }

      // Also ensure inventory is committed if needed
      if (order.inventory_status === 'PENDING' && isFullyPaid) {
        try {
          const { deductPosOrderInventory, resolveCanonicalSalesChannel } = await import('../services/posOrderService');
          const { data: lines } = await supabase.from('pos_order_items').select('*').eq('order_id', params.orderId);
          if (lines && lines.length > 0) {
            const channel = resolveCanonicalSalesChannel(order.order_type, order.order_source);
            await deductPosOrderInventory(
              params.orderId,
              order.branch_id,
              lines,
              order.restaurant_id || getGlobalRestaurantId(),
              params.cashierName || order.cashier_name,
              channel
            );
          }
        } catch (invErr) {
          console.warn('[submitPayment] Recovery inventory commit warning:', invErr);
        }
      }

      // Allocate concept invoice number if fully paid and not yet issued
      if (isFullyPaid && !order.invoice_number) {
        try {
          const { error: seqErr } = await supabase.rpc('allocate_concept_invoice_number', {
            p_order_id: Number(params.orderId),
            p_idempotency_key: operationId || `order-${params.orderId}`,
            p_fiscal_series: 'DEFAULT'
          });
          if (seqErr) {
            console.warn('[submitPayment] Recovery invoice allocation error:', seqErr);
          }
        } catch (seqEx) {
          console.warn('[submitPayment] Recovery invoice allocation exception:', seqEx);
        }
      }

      const fin = await getFinancialSummary(params.orderId);
      if (!fin.success) {
        return { success: false, error: fin.error || 'Failed to get financial summary after payment recovery' };
      }

      const isCard = (duplicate.tender_type || '').toUpperCase().includes('CARD');
      const isLbp = (duplicate.tender_currency || '').toUpperCase() === 'LBP';
      return {
        success: true,
        payment: {
          id: typeof duplicate.id === 'number' ? duplicate.id : 1,
          operation_id: duplicate.source_tender_key,
          order_id: Number(duplicate.pos_order_id || params.orderId),
          payment_method: isCard ? 'Credit Card' : (isLbp ? 'Cash LBP' : 'Cash USD'),
          payment_category: params.payment.category,
          currency: (isLbp ? 'LBP' : 'USD') as SupportedCurrency,
          exchange_rate_used: duplicate.exchange_rate_applied ? Number(duplicate.exchange_rate_applied) : null,
          amount_in_currency: Number(duplicate.tendered_amount || duplicate.net_receivable_amount),
          amount_usd: Number(duplicate.net_receivable_amount),
          tendered_amount: Number(duplicate.tendered_amount),
          change_amount: Number(duplicate.change_amount || 0),
          terminal_id: params.terminalId || null,
          cashier_reference: params.cashierName || null,
          external_reference: params.payment.reference || null,
          status: 'completed',
          created_at: duplicate.completed_at || duplicate.created_at || new Date().toISOString()
        },
        summary: fin.summary,
        isDuplicate: true
      };
    }

    // 2. Query order from pos_orders
    const { data: order, error: orderErr } = await supabase
      .from('pos_orders')
      .select('*')
      .eq('id', params.orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, error: orderErr?.message || 'Order not found' };
    }

    const restaurantId = order.restaurant_id || getGlobalRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
    const branchId = order.branch_id;
    const nextSeq = (existingTenders?.length || 0) + 1;

    // 3. Resolve tender type and collection party
    const methodUpper = (params.payment.method || '').toUpperCase();
    let tenderType = 'CASH';
    let collectionParty = 'RESTAURANT_CASHIER';

    if (methodUpper.includes('CARD') || methodUpper.includes('VISA') || methodUpper.includes('MASTERCARD')) {
      tenderType = 'CREDIT_CARD';
      collectionParty = 'PAYMENT_PROCESSOR';
    } else if (methodUpper.includes('TOTERS') || methodUpper.includes('NOKNOK') || methodUpper.includes('AGGREGATOR')) {
      tenderType = 'MARKETPLACE_COLLECTION';
      collectionParty = 'MARKETPLACE_PLATFORM';
    } else if (methodUpper.includes('WALLET')) {
      tenderType = 'E_WALLET';
      collectionParty = 'PAYMENT_PROCESSOR';
    }

    // 4. Create Order Tender Receivable RPC
    const { data: tenderReceivableId, error: tenderErr } = await supabase.rpc('create_order_tender_receivable', {
      p_restaurant_id: restaurantId,
      p_branch_id: String(branchId),
      p_pos_order_id: Number(params.orderId),
      p_tender_sequence: nextSeq,
      p_source_tender_key: operationId,
      p_business_date: new Date().toISOString().split('T')[0],
      p_completed_at: new Date().toISOString(),
      p_tender_type: tenderType,
      p_tender_currency: params.payment.currency || 'USD',
      p_tendered_amount: Number(params.payment.currency === 'LBP' ? params.payment.tenderedAmount : params.payment.appliedUsd),
      p_change_amount: Number(params.payment.changeAmount || 0),
      p_change_currency: params.payment.currency || 'USD',
      p_net_receivable_amount: Number(params.payment.appliedUsd),
      p_gratuity_amount: 0,
      p_collection_party: collectionParty,
      p_platform_id: null,
      p_provider_payment_reference: params.payment.reference || null,
      p_exchange_rate_applied: Number(params.payment.exchangeRate || 90000)
    });

    if (tenderErr) {
      console.error('[submitPayment] Error recording tender receivable:', tenderErr);
      return { success: false, error: tenderErr.message };
    }

    // 5. Update pos_orders ledger state
    const prevPaid = (existingTenders || []).reduce((sum: number, t: any) => sum + Number(t.net_receivable_amount || 0), 0);
    const totalPaid = prevPaid + params.payment.appliedUsd;
    const totalDue = parseFloat(order.total_amount || order.total || 0);
    const isFullyPaid = totalPaid >= totalDue - 0.001;

    const orderUpdate: any = {
      payment_method: params.payment.method,
      payment_status: isFullyPaid ? 'paid' : 'partially_paid',
      tendered_amount: params.payment.tenderedAmount,
      tendered_currency: params.payment.currency,
      change_amount: params.payment.changeAmount,
      change_currency: params.payment.currency,
      amount_paid: totalPaid,
      updated_at: new Date().toISOString()
    };

    if (isFullyPaid) {
      if (!order.completed_at) {
        orderUpdate.completed_at = new Date().toISOString();
      }
      if (!['completed', 'closed', 'delivered'].includes(order.status)) {
        orderUpdate.status = (order.order_type === 'dine_in' || order.order_source === 'Tables') ? 'completed' : (order.status === 'preparing' ? 'preparing' : 'completed');
      }
    }

    if (params.terminalId && !order.terminal_id) {
      orderUpdate.terminal_id = params.terminalId;
    }
    if (params.cashierName && !order.cashier_name) {
      orderUpdate.cashier_name = params.cashierName;
    }

    const { error: updateOrderErr } = await supabase
      .from('pos_orders')
      .update(orderUpdate)
      .eq('id', params.orderId);

    if (updateOrderErr) {
      console.error('[submitPayment] Tender committed but pos_orders update failed:', updateOrderErr);
      return {
        success: false,
        error: `Tender recorded but failed to update order: ${updateOrderErr.message}`
      };
    }

    // 6. Deduct inventory if pending commit
    if (order.inventory_status === 'PENDING') {
      try {
        const { deductPosOrderInventory, resolveCanonicalSalesChannel } = await import('../services/posOrderService');
        const { data: lines } = await supabase.from('pos_order_items').select('*').eq('order_id', params.orderId);
        if (lines && lines.length > 0) {
          const channel = resolveCanonicalSalesChannel(order.order_type, order.order_source);
          await deductPosOrderInventory(
            params.orderId,
            branchId,
            lines,
            restaurantId,
            params.cashierName || order.cashier_name,
            channel
          );
        }
      } catch (invErr) {
        console.warn('[submitPayment] Inventory commit warning:', invErr);
      }
    }

    // 7. Allocate concept invoice number when fully paid
    if (isFullyPaid && !order.invoice_number) {
      try {
        const { error: seqErr } = await supabase.rpc('allocate_concept_invoice_number', {
          p_order_id: Number(params.orderId),
          p_idempotency_key: operationId || `order-${params.orderId}`,
          p_fiscal_series: 'DEFAULT'
        });
        if (seqErr) {
          console.warn('[submitPayment] Invoice allocation error:', seqErr);
        }
      } catch (seqEx) {
        console.warn('[submitPayment] Invoice allocation exception:', seqEx);
      }
    }

    const fin = await getFinancialSummary(params.orderId);
    if (!fin.success) {
      return {
        success: false,
        error: fin.error || 'Payment recorded, but failed to load financial summary'
      };
    }

    const paymentRecord: PaymentRecord = {
      id: typeof tenderReceivableId === 'number' ? tenderReceivableId : Date.now(),
      operation_id: operationId,
      order_id: params.orderId,
      payment_method: params.payment.method,
      payment_category: params.payment.category,
      currency: params.payment.currency,
      exchange_rate_used: params.payment.exchangeRate || null,
      amount_in_currency: params.payment.currency === 'LBP' ? params.payment.tenderedAmount : params.payment.appliedUsd,
      amount_usd: params.payment.appliedUsd,
      tendered_amount: params.payment.tenderedAmount,
      change_amount: params.payment.changeAmount,
      terminal_id: params.terminalId || null,
      cashier_reference: params.cashierName || null,
      external_reference: params.payment.reference || null,
      status: 'completed',
      created_at: new Date().toISOString()
    };

    return {
      success: true,
      payment: paymentRecord,
      summary: fin.summary,
      isDuplicate: false
    };
  } catch (err: any) {
    console.error('Error submitting payment:', err);
    return { success: false, error: err.message || 'Payment submission failed' };
  }
}

/**
 * Submits multiple tender payments sequentially.
 * Preserves each tender's operation identity across retries.
 */
export async function submitMultiTenderPayments(params: {
  orderId: number;
  tenders: TenderItem[];
  terminalId?: string;
  cashierName?: string;
}): Promise<{
  success: boolean;
  payments: PaymentRecord[];
  summary?: OrderFinancialSummary;
  error?: string;
}> {
  const recordedPayments: PaymentRecord[] = [];
  let latestSummary: OrderFinancialSummary | undefined;

  for (let i = 0; i < params.tenders.length; i++) {
    const tender = params.tenders[i];
    const tenderOpId = tender.operationId || tender.id || `tender-${params.orderId}-${i + 1}`;

    const res = await submitPayment({
      orderId: params.orderId,
      payment: tender,
      terminalId: params.terminalId,
      cashierName: params.cashierName,
      operationId: tenderOpId
    });

    if (!res.success) {
      return {
        success: false,
        payments: recordedPayments,
        summary: latestSummary,
        error: `Payment failed on tender '${tender.method}': ${res.error}`
      };
    }

    if (res.payment) recordedPayments.push(res.payment);
    if (res.summary) latestSummary = res.summary;
  }

  return {
    success: true,
    payments: recordedPayments,
    summary: latestSummary
  };
}

/**
 * Submits a manager-approved refund.
 * Executes two-phase audit logging in FLOW void_receipts,
 * resolves canonical branch ID and restaurant scope,
 * executes recordOrderTenderRefund with split-tender allocation,
 * preserves retry safety, tracks partial completions, and resumes only the remainder.
 */
export async function submitRefundWithFlowAudit(
  params: SubmitRefundParams
): Promise<{
  success: boolean;
  refund?: RefundRecord;
  summary?: OrderFinancialSummary;
  error?: string;
}> {
  try {
    // 1. Manager PIN Validation
    const pinRes = await api.verifyCashierPin(params.managerPin);
    if (!pinRes.success || !pinRes.data) {
      return { success: false, error: 'Invalid Manager PIN.' };
    }

    const user = pinRes.data;
    const isAuthorized = 
      user.role === 'admin' || 
      user.role === 'general_manager' || 
      user.role === 'manager' ||
      (user.admin_permissions && Object.keys(user.admin_permissions).length > 0);

    if (!isAuthorized) {
      return { success: false, error: 'User does not possess Manager or Admin privileges to approve refunds.' };
    }

    const managerName = user.name || 'Manager';
    const operationId = params.operationId || (
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'ref-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9)
    );

    // 2. Resolve canonical restaurant ID and branch ID
    let canonicalRestaurantId = params.restaurantId || getGlobalRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
    let canonicalBranchId = params.branchId;

    const { data: dbOrder, error: orderErr } = await supabase
      .from('pos_orders')
      .select('id, branch_id, restaurant_id, total_amount, payment_status, amount_refunded')
      .eq('id', params.orderId)
      .maybeSingle();

    if (orderErr) {
      return { success: false, error: `Failed to fetch order: ${orderErr.message}` };
    }
    if (!dbOrder) {
      return { success: false, error: `Order #${params.orderId} not found` };
    }

    if (dbOrder.restaurant_id) canonicalRestaurantId = dbOrder.restaurant_id;
    if (!canonicalBranchId && dbOrder.branch_id) canonicalBranchId = dbOrder.branch_id;

    if (!canonicalBranchId && params.branchName) {
      const { data: branchData } = await supabase
        .from('branches')
        .select('id')
        .ilike('name', params.branchName)
        .maybeSingle();
      if (branchData?.id) canonicalBranchId = branchData.id;
    }

    // 3. Check retry safety / idempotency: if this refund operation was already recorded
    const { data: existingAudit, error: auditFetchErr } = await supabase
      .from('void_receipts')
      .select('*')
      .eq('operation_id', operationId)
      .maybeSingle();

    if (auditFetchErr) {
      return { success: false, error: `Failed to verify audit record: ${auditFetchErr.message}` };
    }

    let previouslyRefundedForOp = 0;
    if (existingAudit) {
      const existingCompleted = existingAudit.canceled_items?.[0]?.amount_completed;
      if (typeof existingCompleted === 'number' && existingCompleted > 0) {
        previouslyRefundedForOp = existingCompleted;
      } else if (existingAudit.status === 'completed') {
        previouslyRefundedForOp = Number(existingAudit.canceled_items?.[0]?.price || params.amount);
      }

      if (existingAudit.status === 'completed' || previouslyRefundedForOp >= params.amount - 0.001) {
        const fin = await getFinancialSummary(params.orderId);
        const refundRecord: RefundRecord = {
          id: typeof existingAudit.id === 'number' ? existingAudit.id : 1,
          operation_id: operationId,
          order_id: params.orderId,
          payment_id: params.paymentId || null,
          refund_type: params.refundType,
          amount: params.amount,
          currency: 'USD',
          payment_method: params.paymentMethod || 'Cash USD',
          reason: params.reason,
          terminal_id: params.terminalId || null,
          requested_by_reference: params.cashierName,
          approved_by_reference: managerName,
          external_reference: null,
          status: 'completed',
          created_at: existingAudit.created_at,
          completed_at: existingAudit.updated_at || existingAudit.created_at
        };
        return { success: true, refund: refundRecord, summary: fin.summary };
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().slice(0, 5);

    // 4. PHASE 1: Write pending audit entry into FLOW void_receipts if not yet present
    let voidReceiptId = existingAudit?.id;
    if (!existingAudit) {
      try {
        const { data: auditData, error: auditError } = await supabase
          .from('void_receipts')
          .insert([{
            operation_id: operationId,
            status: 'pending',
            void_type: 'refund',
            branch: params.branchName || 'Cloud Kitchen',
            order_number: String(params.orderId),
            table_number: null,
            receipt_date: todayStr,
            receipt_time: timeStr,
            canceled_items: [{
              name: `Refund: ${params.refundType.toUpperCase()}`,
              qty: 1,
              price: params.amount,
              comment: params.reason,
              total_requested: params.amount,
              amount_completed: 0,
              portions: []
            }],
            reason_comment: params.reason,
            created_by: `${params.cashierName} (Approved by ${managerName})`,
            order_type: 'POS',
            restaurant_id: canonicalRestaurantId,
            created_at: new Date().toISOString()
          }])
          .select('id');

        if (!auditError && auditData && auditData.length > 0) {
          voidReceiptId = auditData[0].id;
        }
      } catch (auditExc) {
        console.warn('FLOW void_receipts audit log warning (proceeding):', auditExc);
      }
    }

    // 5. Direct FLOW standalone Phase 11 refund if COMMERCE_API_BASE is not set
    if (!COMMERCE_API_BASE) {
      const { recordOrderTenderRefund } = await import('../services/posOrderService');
      const amountToExecute = previouslyRefundedForOp > 0
        ? (params.amount - previouslyRefundedForOp)
        : params.amount;

      const refundRes = await recordOrderTenderRefund({
        orderId: params.orderId,
        restaurantId: canonicalRestaurantId,
        branchId: String(canonicalBranchId || params.branchName),
        refundAmount: amountToExecute,
        reason: params.reason,
        operationId
      });

      const newlyRefunded = ('amountRefundedSoFar' in refundRes && typeof refundRes.amountRefundedSoFar === 'number')
        ? refundRes.amountRefundedSoFar
        : 0;
      const totalRefundedNow = previouslyRefundedForOp + newlyRefunded;

      // Handle failure after commit before response arrival:
      // If no open tenders exist but order was already refunded during dropped response
      if (!refundRes.success && newlyRefunded === 0 && previouslyRefundedForOp === 0 && existingAudit) {
        if (parseFloat(dbOrder.amount_refunded || 0) >= params.amount - 0.001) {
          if (voidReceiptId) {
            await supabase
              .from('void_receipts')
              .update({
                status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('id', voidReceiptId);
          }
          const fin = await getFinancialSummary(params.orderId);
          return {
            success: true,
            refund: {
              id: Date.now(),
              operation_id: operationId,
              order_id: params.orderId,
              payment_id: params.paymentId || null,
              refund_type: params.refundType,
              amount: params.amount,
              currency: 'USD',
              payment_method: params.paymentMethod || 'Cash USD',
              reason: params.reason,
              terminal_id: params.terminalId || 'flow-pos-terminal',
              requested_by_reference: params.cashierName,
              approved_by_reference: managerName,
              external_reference: null,
              status: 'completed',
              created_at: new Date().toISOString(),
              completed_at: new Date().toISOString()
            },
            summary: fin.summary
          };
        }
      }

      // Persist any completed portions to pos_orders and void_receipts
      if (newlyRefunded > 0) {
        const currentRefunded = parseFloat(dbOrder.amount_refunded || 0) + newlyRefunded;
        const totalAmt = parseFloat(dbOrder.total_amount || 0);
        const isFull = currentRefunded >= totalAmt - 0.001;

        await supabase
          .from('pos_orders')
          .update({
            amount_refunded: currentRefunded,
            payment_status: isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            updated_at: new Date().toISOString()
          })
          .eq('id', params.orderId);
      }

      // Update void_receipts audit status
      if (voidReceiptId) {
        const isFullCompleted = refundRes.success && totalRefundedNow >= params.amount - 0.001;
        const isPartial = totalRefundedNow > 0 && !isFullCompleted;
        const status = isFullCompleted ? 'completed' : (isPartial ? 'partial' : 'failed');

        await supabase
          .from('void_receipts')
          .update({
            status,
            canceled_items: [{
              name: `Refund: ${params.refundType.toUpperCase()}`,
              qty: 1,
              price: totalRefundedNow > 0 ? totalRefundedNow : params.amount,
              comment: params.reason,
              total_requested: params.amount,
              amount_completed: totalRefundedNow,
              portions: refundRes.completedPortions || []
            }],
            reason_comment: isPartial
              ? `${params.reason} [PARTIAL: $${totalRefundedNow.toFixed(2)} completed of $${params.amount.toFixed(2)}. Remainder failed: ${refundRes.error}]`
              : params.reason,
            updated_at: new Date().toISOString()
          })
          .eq('id', voidReceiptId);
      }

      if (!refundRes.success) {
        const fin = await getFinancialSummary(params.orderId);
        if (totalRefundedNow > 0) {
          return {
            success: false,
            error: `Refund partially completed: $${totalRefundedNow.toFixed(2)} recorded of $${params.amount.toFixed(2)}. Remainder failed: ${refundRes.error}`,
            summary: fin.summary
          };
        }

        const failMessage = refundRes.error === 'NO_OPEN_TENDER'
          ? 'No open tender receivable found for this order to refund'
          : (refundRes.error || 'Refund operation failed');

        return {
          success: false,
          error: failMessage,
          summary: fin.summary
        };
      }

      const fin = await getFinancialSummary(params.orderId);

      const refundRecord: RefundRecord = {
        id: typeof refundRes.refundId === 'number' ? refundRes.refundId : Date.now(),
        operation_id: operationId,
        order_id: params.orderId,
        payment_id: params.paymentId || null,
        refund_type: params.refundType,
        amount: params.amount,
        currency: 'USD',
        payment_method: params.paymentMethod || 'Cash USD',
        reason: params.reason,
        terminal_id: params.terminalId || 'flow-pos-terminal',
        requested_by_reference: params.cashierName,
        approved_by_reference: managerName,
        external_reference: null,
        status: 'completed',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      };

      return {
        success: true,
        refund: refundRecord,
        summary: fin.summary
      };
    }

    // Obsolete OVRLOAD Commerce fallback if COMMERCE_API_BASE is set
    const refundPayload = {
      operation_id: operationId,
      payment_id: params.paymentId || null,
      refund_type: params.refundType,
      amount: params.amount,
      currency: 'USD',
      payment_method: params.paymentMethod || 'Cash USD',
      reason: params.reason,
      terminal_id: params.terminalId || 'flow-pos-terminal',
      requested_by_reference: params.cashierName,
      approved_by_reference: managerName
    };

    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.orderId}/refunds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(refundPayload)
    });

    const data = await res.json();

    if (res.ok && data.success) {
      try {
        const { recordOrderTenderRefund } = await import('../services/posOrderService');
        await recordOrderTenderRefund({
          orderId: params.orderId,
          restaurantId: canonicalRestaurantId,
          branchId: String(canonicalBranchId || params.branchName),
          refundAmount: params.amount,
          reason: params.reason,
          operationId
        });
      } catch (tErr) {
        console.warn('Phase 11 tender refund recording warning:', tErr);
      }
    }

    if (voidReceiptId) {
      await supabase
        .from('void_receipts')
        .update({
          status: (res.ok && data.success) ? 'completed' : 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', voidReceiptId);
    }

    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Refund operation failed' };
    }

    return {
      success: true,
      refund: data.refund,
      summary: data.orderSummary
    };
  } catch (err: any) {
    console.error('Error submitting refund:', err);
    return { success: false, error: err.message || 'Refund processing exception' };
  }
}
