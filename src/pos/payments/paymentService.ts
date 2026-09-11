import { api } from '../../api/client';
import { supabase, getGlobalRestaurantId } from '../../api/supabase';

import type {
  OrderFinancialSummary,
  PaymentRecord,
  PaymentStatus,
  RefundRecord,
  SubmitPaymentParams,
  SubmitRefundParams,
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

  const amountPaid = parseFloat(order.amount_paid || 0);
  const total = parseFloat(order.total_amount || order.total || 0);

  if (amountPaid >= total && total > 0) return 'PAID';
  if (amountPaid > 0) return 'PARTIALLY_PAID';

  return 'UNPAID';
}

/**
 * Fetches financial summary, payment ledger, and refund records from OVRLOAD.
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
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${orderId}/payments`);
    if (!res.ok) {
      // Fallback if endpoint is not responding
      const totalAmount = parseFloat(baseOrder?.total_amount || baseOrder?.total || 0);
      const isLegacy = baseOrder && (baseOrder.status === 'completed' || baseOrder.status === 'delivered');
      const paymentStatus = isLegacy ? 'PAID_LEGACY' : (baseOrder?.payment_status || 'UNPAID');

      return {
        success: true,
        summary: {
          orderId,
          totalAmount,
          amountPaid: isLegacy ? totalAmount : parseFloat(baseOrder?.amount_paid || 0),
          amountRefunded: parseFloat(baseOrder?.amount_refunded || 0),
          netPaid: isLegacy ? totalAmount : Math.max(0, parseFloat(baseOrder?.amount_paid || 0) - parseFloat(baseOrder?.amount_refunded || 0)),
          amountRemaining: isLegacy ? 0 : Math.max(0, totalAmount - parseFloat(baseOrder?.amount_paid || 0)),
          paymentStatus: paymentStatus as PaymentStatus,
          fulfillmentStatus: baseOrder?.status
        },
        payments: [],
        refunds: []
      };
    }

    const data = await res.json();
    const payments: PaymentRecord[] = data.payments || [];
    const refunds: RefundRecord[] = data.refunds || [];
    const rawSummary = data.orderSummary;

    // Check if order is legacy paid
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
      error: err.message
    };
  }
}

/**
 * Submits a single tender payment to OVRLOAD.
 * Generates an immutable operation_id UUID for idempotency.
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
    const operationId = params.operationId || (
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9)
    );

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
  } catch (err: any) {
    console.error('Error submitting payment:', err);
    return { success: false, error: err.message || 'Payment submission failed' };
  }
}

/**
 * Submits multiple tender payments sequentially.
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

  for (const tender of params.tenders) {
    const res = await submitPayment({
      orderId: params.orderId,
      payment: tender,
      terminalId: params.terminalId,
      cashierName: params.cashierName
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
 * then invokes OVRLOAD order_refunds mutation.
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

    const defaultRestaurantId = params.restaurantId || getGlobalRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().slice(0, 5);

    // 2. PHASE 1: Write pending audit entry into FLOW void_receipts
    let voidReceiptId: string | undefined;
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
            comment: params.reason
          }],
          reason_comment: params.reason,
          created_by: `${params.cashierName} (Approved by ${managerName})`,
          order_type: 'POS',
          restaurant_id: defaultRestaurantId,
          created_at: new Date().toISOString()
        }])
        .select('id');

      if (!auditError && auditData && auditData.length > 0) {
        voidReceiptId = auditData[0].id;
      }
    } catch (auditExc) {
      console.warn('FLOW void_receipts audit log warning (proceeding):', auditExc);
    }

    // 3. PHASE 2: Execute OVRLOAD Commerce refund
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

    // 4. PHASE 3: Update FLOW void audit status
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
