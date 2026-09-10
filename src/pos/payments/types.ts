export type PaymentStatus = 
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'PAID_LEGACY';

export type PaymentMethodCategory = 'direct' | 'aggregator';

export type SupportedCurrency = 'USD' | 'LBP';

export interface PaymentRecord {
  id: number;
  operation_id: string;
  order_id: number;
  payment_method: string;
  payment_category: PaymentMethodCategory;
  currency: SupportedCurrency;
  exchange_rate_used: number | null;
  amount_in_currency: number;
  amount_usd: number;
  tendered_amount: number | null;
  change_amount: number | null;
  terminal_id: string | null;
  cashier_reference: string | null;
  external_reference: string | null;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface RefundRecord {
  id: number;
  operation_id: string;
  order_id: number;
  payment_id: number | null;
  refund_type: 'full' | 'partial';
  amount: number;
  currency: string;
  payment_method: string;
  reason: string;
  terminal_id: string | null;
  requested_by_reference: string | null;
  approved_by_reference: string | null;
  external_reference: string | null;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
}

export interface OrderFinancialSummary {
  orderId: number;
  totalAmount: number;
  amountPaid: number;
  amountRefunded: number;
  netPaid: number;
  amountRemaining: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus?: string;
  version?: number;
}

export interface TenderItem {
  id: string;
  method: string;
  category: PaymentMethodCategory;
  currency: SupportedCurrency;
  exchangeRate: number | null;
  tenderedAmount: number;
  appliedUsd: number;
  changeAmount: number;
  reference?: string;
}

export interface SubmitPaymentParams {
  orderId: number;
  payment: TenderItem;
  terminalId?: string;
  cashierName?: string;
  operationId?: string;
}

export interface SubmitRefundParams {
  orderId: number;
  paymentId?: number | null;
  amount: number;
  refundType: 'full' | 'partial';
  reason: string;
  managerPin: string;
  cashierName: string;
  branchName: string;
  restaurantId?: string;
  paymentMethod?: string;
  terminalId?: string;
  operationId?: string;
}
