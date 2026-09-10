export type StatusGroup =
  | 'NEW'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'HELD'
  | 'CANCELLED';

export type ChannelType = 'POS' | 'WhatsApp' | 'App' | 'Toters' | 'NokNok' | 'Other';

export type SlaStatus = 'normal' | 'warning' | 'critical';

export interface SlaConfig {
  warningMinutes: number;
  criticalMinutes: number;
}

export const DEFAULT_SLA_CONFIG: SlaConfig = {
  warningMinutes: 15,
  criticalMinutes: 25
};

export interface FlowPosOrderItem {
  id: string | number;
  productId: string | number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations: string[];
  comment: string | null;
}

export interface FlowPosOrder {
  id: string | number;
  orderNumber: string;
  displayId: string;
  channel: ChannelType;
  rawChannel: string;
  statusGroup: StatusGroup;
  rawStatus: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  orderType: 'pickup' | 'delivery' | 'dine_in';
  subtotalAmount: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'unpaid' | 'partially_paid' | 'refunded' | 'partially_refunded' | 'paid_legacy' | string;
  amountPaid: number;
  amountRefunded: number;
  netPaid: number;
  amountRemaining: number;
  specialInstructions: string;
  voidReason: string | null;
  createdAt: Date;
  createdTimeFormatted: string;
  elapsedMinutes: number;
  slaStatus: SlaStatus;
  cashier: string;
  claimedBy: string | null;
  claimedTerminal: string | null;
  claimedAt: string | null;
  version: number;
  clientOrderToken: string | null;
  items: FlowPosOrderItem[];
  rawOrder: any;
}

export function normalizeChannel(raw?: string | null): ChannelType {
  if (!raw) return 'POS';
  const lower = String(raw).toLowerCase();
  if (lower.includes('what') || lower.includes('wa')) return 'WhatsApp';
  if (lower.includes('toter')) return 'Toters';
  if (lower.includes('nok')) return 'NokNok';
  if (lower.includes('app') || lower.includes('mobile')) return 'App';
  if (lower === 'pos' || lower.includes('pickup') || lower.includes('walk')) return 'POS';
  return 'Other';
}

export function normalizeStatus(raw?: string | null): StatusGroup {
  if (!raw) return 'NEW';
  const lower = String(raw).toLowerCase();
  if (lower === 'pending') return 'NEW';
  if (lower === 'confirmed' || lower === 'accepted') return 'CONFIRMED';
  if (lower === 'preparing') return 'PREPARING';
  if (lower === 'ready' || lower === 'out_for_delivery') return 'READY';
  if (lower === 'completed' || lower === 'delivered') return 'COMPLETED';
  if (lower === 'held') return 'HELD';
  if (lower === 'cancelled' || lower === 'rejected') return 'CANCELLED';
  return 'NEW';
}

export function calculateElapsedMinutes(date: Date): number {
  const diffMs = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (60 * 1000)));
}

export function computeSlaStatus(
  elapsedMinutes: number,
  statusGroup: StatusGroup,
  config: SlaConfig = DEFAULT_SLA_CONFIG
): SlaStatus {
  if (statusGroup === 'COMPLETED' || statusGroup === 'CANCELLED') {
    return 'normal';
  }
  if (elapsedMinutes >= config.criticalMinutes) return 'critical';
  if (elapsedMinutes >= config.warningMinutes) return 'warning';
  return 'normal';
}

export function adaptOvrloadOrder(raw: any, slaConfig: SlaConfig = DEFAULT_SLA_CONFIG): FlowPosOrder {
  const createdDate = raw.created_at ? new Date(raw.created_at) : new Date();
  const elapsed = calculateElapsedMinutes(createdDate);
  const statusGroup = normalizeStatus(raw.status);
  const channel = normalizeChannel(raw.order_source);

  const items: FlowPosOrderItem[] = (raw.items || []).map((i: any, idx: number) => {
    let custs: string[] = [];
    if (i.customizations) {
      if (Array.isArray(i.customizations)) {
        custs = i.customizations.map((c: any) => typeof c === 'string' ? c : (c.ingredient || c.name || String(c)));
      } else if (typeof i.customizations === 'string') {
        try {
          const parsed = JSON.parse(i.customizations);
          if (Array.isArray(parsed)) {
            custs = parsed.map((c: any) => typeof c === 'string' ? c : (c.ingredient || c.name || String(c)));
          } else {
            custs = [i.customizations];
          }
        } catch {
          custs = [i.customizations];
        }
      }
    }

    return {
      id: i.id || ('item-' + idx),
      productId: i.product_id || i.id,
      name: i.product_name || i.name || 'Item',
      quantity: Number(i.quantity || i.qty || 1),
      unitPrice: Number(i.unit_price || i.unit_price_usd || 0),
      totalPrice: Number(i.total_price || (Number(i.unit_price || 0) * Number(i.quantity || 1))),
      customizations: custs,
      comment: i.comment || i.note || null
    };
  });

  const rawOrderType = (raw.order_type || '').toLowerCase();
  const orderType: 'pickup' | 'delivery' | 'dine_in' =
    rawOrderType === 'delivery' ? 'delivery' :
    rawOrderType === 'dine_in' || rawOrderType === 'dinein' ? 'dine_in' : 'pickup';

  const isCompleted = statusGroup === 'COMPLETED';
  const rawPayStatus = String(raw.payment_status || '').toUpperCase();
  const amtPaid = Number(raw.amount_paid || 0);
  const amtRefunded = Number(raw.amount_refunded || 0);
  const totAmt = Number(raw.total_amount || 0);
  const netPaid = Math.max(0, amtPaid - amtRefunded);
  const amtRemaining = Math.max(0, totAmt - amtPaid);

  let pStatus = 'unpaid';
  if (rawPayStatus === 'REFUNDED') {
    pStatus = 'refunded';
  } else if (rawPayStatus === 'PARTIALLY_REFUNDED') {
    pStatus = 'partially_refunded';
  } else if (rawPayStatus === 'PARTIALLY_PAID') {
    pStatus = 'partially_paid';
  } else if (rawPayStatus === 'PAID') {
    pStatus = 'paid';
  } else if (isCompleted || ['Toters', 'NokNok'].includes(channel)) {
    // Legacy completed orders without explicit new ledger rows
    pStatus = (amtPaid > 0 && amtPaid >= totAmt) ? 'paid' : 'paid_legacy';
  } else if (amtPaid >= totAmt && totAmt > 0) {
    pStatus = 'paid';
  } else if (amtPaid > 0) {
    pStatus = 'partially_paid';
  }

  const hours = createdDate.getHours().toString().padStart(2, '0');
  const minutes = createdDate.getMinutes().toString().padStart(2, '0');
  const createdTimeFormatted = hours + ':' + minutes;

  return {
    id: raw.id,
    orderNumber: '#' + raw.id,
    displayId: String(raw.id),
    channel,
    rawChannel: raw.order_source || 'POS',
    statusGroup,
    rawStatus: raw.status || 'pending',
    customerName: raw.customer_name || 'Walk-in',
    customerPhone: raw.customer_phone || '',
    deliveryAddress: raw.delivery_address || '',
    orderType,
    subtotalAmount: Number(raw.subtotal_amount || 0),
    deliveryFee: Number(raw.delivery_fee || 0),
    discountAmount: Number(raw.discount_amount || 0),
    totalAmount: Number(raw.total_amount || 0),
    paymentMethod: raw.payment_method || (channel === 'Toters' ? 'Toters' : channel === 'NokNok' ? 'NokNok' : 'Cash'),
    paymentStatus: pStatus,
    amountPaid: amtPaid,
    amountRefunded: amtRefunded,
    netPaid: netPaid,
    amountRemaining: amtRemaining,
    specialInstructions: raw.special_instructions || '',
    voidReason: raw.void_reason || null,
    createdAt: createdDate,
    createdTimeFormatted,
    elapsedMinutes: elapsed,
    slaStatus: computeSlaStatus(elapsed, statusGroup, slaConfig),
    cashier: raw.cashier || 'Cashier',
    claimedBy: raw.claimed_by || null,
    claimedTerminal: raw.claimed_terminal || null,
    claimedAt: raw.claimed_at || null,
    version: raw.version ? Number(raw.version) : 1,
    clientOrderToken: raw.client_order_token || null,
    items,
    rawOrder: raw
  };
}