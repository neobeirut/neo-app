export type StatusGroup =
  | 'NEW'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'HELD'
  | 'PREORDERED'
  | 'CANCELLED';

export type ChannelType = 'POS' | 'Tables' | 'WhatsApp' | 'App' | 'Toters' | 'NokNok' | 'Other';

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
  tableLabel?: string | null;
  isTableOrder: boolean;
  guestCount?: number;
  waiterName?: string | null;
  isPaidInAdvance?: boolean;
  isBillRequested?: boolean;
  billRequestedAt?: string | null;
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
  orderSource?: string;
  isMigration?: boolean;
  isScheduled?: boolean;
  scheduledFor?: string | null;
  scheduledTimeDisplay?: string | null;
  scheduledNotes?: string | null;
  isFutureScheduled?: boolean;
  conceptCode?: 'NEO' | 'OVRLOAD' | 'WICKD' | string;
  conceptName?: string;
  conceptColor?: string;
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
  if (lower === 'held' || lower === 'bill_requested') return 'HELD';
  if (
    lower === 'cancelled' ||
    lower === 'canceled' ||
    lower === 'rejected' ||
    lower === 'void' ||
    lower === 'voided'
  ) {
    return 'CANCELLED';
  }
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
  const baseStatusGroup = normalizeStatus(raw.status);
  const channel = normalizeChannel(raw.order_source);

  const isScheduled = Boolean(
    raw.is_scheduled ||
    raw.scheduled_for ||
    (raw.special_instructions && String(raw.special_instructions).includes('SCHEDULED'))
  );
  const scheduledFor = raw.scheduled_for || null;
  const scheduledTimeDisplay = raw.scheduled_time_display || null;
  const scheduledNotes = raw.scheduled_notes || raw.scheduled_note || null;

  let isFutureSched = false;
  if (isScheduled && scheduledFor) {
    const sDate = new Date(String(scheduledFor).replace(' ', 'T'));
    if (!isNaN(sDate.getTime())) {
      const now = new Date();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      isFutureSched = sDate.getTime() > endOfToday.getTime();
    }
  }

  const statusGroup: StatusGroup = (isScheduled && baseStatusGroup !== 'COMPLETED' && baseStatusGroup !== 'CANCELLED')
    ? 'PREORDERED'
    : baseStatusGroup;

  const rawItems = raw.items || raw.pos_order_items || [];
  const items: FlowPosOrderItem[] = rawItems.map((i: any, idx: number) => {
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
  const rawCustName = String(raw.customer_name || '');
  let rawTableLabel = raw.table_label || null;
  if (!rawTableLabel && (rawCustName.toLowerCase().startsWith('table ') || rawCustName.toLowerCase().startsWith('table-'))) {
    rawTableLabel = rawCustName.replace(/table\s*[-#]?/i, '').trim();
  }

  const isTableOrder = Boolean(rawTableLabel) || rawOrderType === 'dine_in' || rawOrderType === 'dinein';

  const orderType: 'pickup' | 'delivery' | 'dine_in' =
    rawOrderType === 'delivery' ? 'delivery' :
    isTableOrder ? 'dine_in' : 'pickup';

  const isCompleted = statusGroup === 'COMPLETED';
  const rawPayStatus = String(raw.payment_status || '').toUpperCase();
  const amtPaid = Number(raw.amount_paid || raw.tendered_amount || 0);
  const amtRefunded = Number(raw.amount_refunded || 0);
  const totAmt = Number(raw.total_amount || 0);
  const netPaid = Math.max(0, amtPaid - amtRefunded);
  const amtRemaining = Math.max(0, totAmt - amtPaid);

  const isExplicitAdvance =
    Boolean(raw.special_instructions && raw.special_instructions.includes('PAID_IN_ADVANCE')) ||
    raw.status === 'paid_in_advance';

  const isPaidInAdvance = isExplicitAdvance || (raw.status === 'paid' && !isCompleted);

  const isBillRequested =
    raw.status === 'bill_requested' ||
    Boolean(raw.bill_requested_at) ||
    Boolean(raw.special_instructions && raw.special_instructions.includes('[BILL_PRINTED]'));

  let pStatus = 'unpaid';
  if (rawPayStatus === 'REFUNDED') {
    pStatus = 'refunded';
  } else if (rawPayStatus === 'PARTIALLY_REFUNDED') {
    pStatus = 'partially_refunded';
  } else if (rawPayStatus === 'PARTIALLY_PAID') {
    pStatus = 'partially_paid';
  } else if (rawPayStatus === 'PAID' || isPaidInAdvance) {
    pStatus = 'paid';
  } else if (isCompleted || ['Toters', 'NokNok'].includes(channel)) {
    // Legacy completed orders without explicit new ledger rows
    pStatus = (amtPaid > 0 && amtPaid >= totAmt) ? 'paid' : 'paid_legacy';
  } else if (amtPaid >= totAmt && totAmt > 0 && !['held', 'preparing', 'new', 'pending', 'open', 'bill_requested'].includes(raw.status)) {
    pStatus = 'paid';
  } else if (amtPaid > 0 && !['held', 'preparing', 'new', 'pending', 'open', 'bill_requested'].includes(raw.status)) {
    pStatus = 'partially_paid';
  }

  let finalChannel = channel;
  if (isTableOrder && (finalChannel === 'POS' || finalChannel === 'Other')) {
    finalChannel = 'Tables';
  }

  const hours = createdDate.getHours().toString().padStart(2, '0');
  const minutes = createdDate.getMinutes().toString().padStart(2, '0');
  const createdTimeFormatted = hours + ':' + minutes;

  // Multi-Concept resolution
  let conceptCode: 'NEO' | 'OVRLOAD' | 'WICKD' = 'OVRLOAD';
  let conceptName = 'OVRLOAD';
  let conceptColor = '#e11d48';

  const cId = String(raw.concept_id || raw.concept || '').toLowerCase();
  const rawSrc = String(raw.order_source || '').toLowerCase();
  const rawInst = String(raw.special_instructions || '').toLowerCase();

  if (cId.includes('00000000-0000-0000-0000-000000000003') || cId.includes('wickd') || rawSrc.includes('wickd') || rawInst.includes('wickd')) {
    conceptCode = 'WICKD';
    conceptName = 'WICKD';
    conceptColor = '#7c3aed';
  } else if (cId.includes('00000000-0000-0000-0000-000000000001') || cId.includes('neo') || Boolean(raw.table_code || raw.table_label || raw.table_number) || (raw.order_type || '').toLowerCase() === 'dine_in') {
    conceptCode = 'NEO';
    conceptName = 'NÉO';
    conceptColor = '#1e5c4f';
  } else {
    // Delivery, pickup, WhatsApp, Toters, NokNok orders belong to OVRLOAD by default
    conceptCode = 'OVRLOAD';
    conceptName = 'OVRLOAD';
    conceptColor = '#e11d48';
  }

  const derivedItemsTotal = items.reduce((sum, it) => sum + (it.totalPrice || (it.unitPrice * it.quantity) || 0), 0);
  const rawDeliveryFee = Number(raw.delivery_fee ?? raw.deliveryFee ?? 0);
  const rawDiscount = Number(raw.discount_amount ?? raw.discount ?? raw.discountAmount ?? 0);
  let resolvedSubtotal = Number(raw.subtotal_amount ?? raw.subtotal ?? raw.subtotalAmount ?? 0);
  let resolvedTotal = Number(raw.total_amount ?? raw.total ?? raw.totalAmount ?? 0);

  if (resolvedSubtotal <= 0 && resolvedTotal > 0) {
    resolvedSubtotal = Math.max(0, resolvedTotal - rawDeliveryFee + rawDiscount);
  }
  if (resolvedSubtotal <= 0 && derivedItemsTotal > 0) {
    resolvedSubtotal = derivedItemsTotal;
  }
  if (resolvedTotal <= 0 && resolvedSubtotal > 0) {
    resolvedTotal = Math.max(0, resolvedSubtotal + rawDeliveryFee - rawDiscount);
  }

  return {
    id: raw.id,
    orderNumber: '#' + raw.id,
    displayId: String(raw.id),
    channel: finalChannel,
    rawChannel: raw.order_source || 'POS',
    statusGroup,
    rawStatus: raw.status || 'pending',
    customerName: raw.customer_name || (isTableOrder && rawTableLabel ? `Table ${rawTableLabel}` : 'Walk-in'),
    customerPhone: raw.customer_phone || '',
    deliveryAddress: raw.delivery_address || '',
    orderType,
    tableLabel: rawTableLabel,
    isTableOrder,
    guestCount: Number(raw.guest_count || 1),
    waiterName: raw.waiter_name || raw.waiter_reference || null,
    isPaidInAdvance,
    isBillRequested,
    billRequestedAt: raw.bill_requested_at || null,
    subtotalAmount: resolvedSubtotal,
    deliveryFee: rawDeliveryFee,
    discountAmount: rawDiscount,
    totalAmount: resolvedTotal,
    paymentMethod: raw.payment_method || (channel === 'Toters' ? 'Toters' : channel === 'NokNok' ? 'NokNok' : 'Cash'),
    paymentStatus: pStatus,
    amountPaid: amtPaid,
    amountRefunded: amtRefunded,
    netPaid: netPaid,
    amountRemaining: amtRemaining,
    specialInstructions: raw.special_instructions || '',
    voidReason: raw.void_reason || (raw.special_instructions && raw.special_instructions.toLowerCase().includes('void') ? raw.special_instructions : null),
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
    orderSource: raw.order_source || null,
    isMigration: raw.order_source === 'SYNTHETIC_MIGRATION' || (raw.special_instructions && raw.special_instructions.includes('GENERATED_MIGRATION')),
    isScheduled,
    scheduledFor,
    scheduledTimeDisplay,
    scheduledNotes,
    isFutureScheduled: isFutureSched,
    conceptCode,
    conceptName,
    conceptColor,
    items,
    rawOrder: raw
  };
}