import { supabasePublic } from '../api/supabase';
import { KNOWN_CONCEPTS, type ConceptCode } from '../types/concept';

export interface UnifiedOrder {
  id: string | number;
  concept_id: string;
  concept_code: ConceptCode;
  concept_name: string;
  invoice_number?: string;
  invoice_series?: string;
  is_canceled?: boolean;
  cancellation_reason?: string;
  canceled_at?: string;
  canceled_by?: string;
  branch_id: string;
  branch_name: string;
  order_type: 'delivery' | 'pickup' | 'dine_in' | 'takeaway';
  order_source: string;
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'dispatched' | 'delivered' | 'completed' | 'cancelled';
  order_channel_status?: string;
  data_provenance?: string;
  source_system?: string;
  source_order_id?: string;
  customer_name: string;
  customer_phone: string;
  delivery_address?: string;
  special_instructions?: string;
  subtotal_amount: number;
  discount_amount: number;
  delivery_fee: number;
  total_amount: number;
  payment_method: string;
  marketplace_order_ref?: string;
  marketplace_commission_pct?: number;
  marketplace_commission_usd?: number;
  net_receivable_usd?: number;
  created_at: string;
  completed_at?: string | null;
  items_count?: number;
  // Restaurant-specific fields (for NÉO)
  table_number?: string;
  guest_count?: number;
  server_name?: string;
  is_split_bill?: boolean;
  reservation_ref?: string;
  // Driver handover fields (operational vs historical reference)
  driver_name?: string;
  driver_phone?: string;
  driver_handover_status?: 'pending' | 'collected' | 'historical_untracked' | 'not_applicable';
  driver_collected_amount?: number;
  driver_fee_retained?: number;
  items?: UnifiedOrderItem[];
}

export interface UnifiedOrderItem {
  id: string | number;
  product_id?: string | number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  customizations?: string | any[];
  comment?: string;
}

export type OrderDateRange = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

export interface OrderFilters {
  concept?: string; // 'ALL' or ConceptCode
  branch?: string;
  channel?: string;
  status?: string;
  series?: 'All' | 'STANDARD' | 'A';
  search?: string;
  dateRange?: OrderDateRange;
  startDate?: string; // YYYY-MM-DD (Asia/Beirut)
  endDate?: string;   // YYYY-MM-DD (Asia/Beirut)
}

export interface PaginatedOrdersResult {
  orders: UnifiedOrder[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface OrderKpiSummary {
  totalMatchingCount: number;
  activeCount: number;
  grossSales: number;
  totalDiscounts: number;
  totalDeliveryFees: number;
  totalOrderAmount: number;
  netSalesExDelivery: number;
  recordedCommission: number;
  operationalDriverCash: number;
  avgTicket: number;
  seriesACount: number;
  seriesStandardCount: number;
  historicalCount: number;
  liveCount: number;
}

const ORDER_SELECT_COLUMNS = `
  id, concept_id, branch_id, order_type, order_source,
  subtotal_amount, discount_amount, delivery_fee, total_amount,
  payment_method, marketplace_order_ref, marketplace_commission_pct,
  marketplace_commission_usd, net_receivable_usd, status, order_channel_status,
  data_provenance, source_system, source_order_id, items_count,
  created_at, completed_at,
  customer_name, customer_phone, delivery_address, special_instructions,
  invoice_number, invoice_series, is_canceled, cancellation_reason, canceled_at, canceled_by,
  table_label, guest_count, waiter_name
`;

function getBeirutYmd(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const y = parts.find(p => p.type === 'year')?.value || '2026';
  const m = parts.find(p => p.type === 'month')?.value || '01';
  const d = parts.find(p => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/**
 * Converts an Asia/Beirut local wall-clock YYYY-MM-DD + HH:mm:ss.SSS into a UTC ISO string,
 * respecting Asia/Beirut DST transitions without external libraries.
 */
function beirutWallToUtcIso(ymd: string, endOfDay: boolean): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const h = endOfDay ? 23 : 0;
  const min = endOfDay ? 59 : 0;
  const sec = endOfDay ? 59 : 0;
  const ms = endOfDay ? 999 : 0;

  // Initial UTC guess (Beirut is UTC+2 or UTC+3)
  const utcApprox = Date.UTC(y, m - 1, d, h - 2, min, sec, ms);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = fmt.formatToParts(new Date(utcApprox));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0);
  const renderedAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'), ms);
  const targetAsUtc = Date.UTC(y, m - 1, d, h, min, sec, ms);
  const diffMs = targetAsUtc - renderedAsUtc;
  return new Date(utcApprox + diffMs).toISOString();
}

export function resolveBeirutDateBounds(
  dateRange: OrderDateRange = 'today',
  startDate?: string,
  endDate?: string
): { startIso: string | null; endIso: string | null } {
  if (dateRange === 'all') {
    return { startIso: null, endIso: null };
  }

  const todayYmd = getBeirutYmd(new Date());

  if (dateRange === 'today') {
    return {
      startIso: beirutWallToUtcIso(todayYmd, false),
      endIso: beirutWallToUtcIso(todayYmd, true)
    };
  }
  if (dateRange === 'yesterday') {
    const yest = addDaysYmd(todayYmd, -1);
    return {
      startIso: beirutWallToUtcIso(yest, false),
      endIso: beirutWallToUtcIso(yest, true)
    };
  }
  if (dateRange === 'week') {
    const start = addDaysYmd(todayYmd, -6);
    return {
      startIso: beirutWallToUtcIso(start, false),
      endIso: beirutWallToUtcIso(todayYmd, true)
    };
  }
  if (dateRange === 'month') {
    const monthStart = `${todayYmd.slice(0, 7)}-01`;
    return {
      startIso: beirutWallToUtcIso(monthStart, false),
      endIso: beirutWallToUtcIso(todayYmd, true)
    };
  }
  if (dateRange === 'custom') {
    return {
      startIso: startDate ? beirutWallToUtcIso(startDate, false) : null,
      endIso: endDate ? beirutWallToUtcIso(endDate, true) : null
    };
  }

  return { startIso: null, endIso: null };
}

function applyOrderFilters(query: any, filters: OrderFilters) {
  let q = query;

  if (filters.concept && filters.concept !== 'ALL') {
    const meta = KNOWN_CONCEPTS[filters.concept as ConceptCode];
    if (meta) {
      q = q.eq('concept_id', meta.id);
    }
  }

  if (filters.branch && filters.branch !== 'All') {
    q = q.eq('branch_id', filters.branch);
  }

  if (filters.channel && filters.channel !== 'All') {
    const ch = filters.channel;
    if (ch === 'Toters') {
      q = q.ilike('order_source', '%toter%');
    } else if (ch === 'NokNok') {
      q = q.ilike('order_source', '%nok%');
    } else if (ch === 'WhatsApp') {
      q = q.or('order_source.ilike.%whatsapp%,order_source.ilike.%wa%');
    } else if (ch === 'Pickup') {
      q = q.or('order_type.ilike.%pick%,order_type.ilike.%take%,order_source.ilike.%pick%');
    } else if (ch === 'App') {
      q = q.or('order_source.ilike.%app%,order_source.ilike.%web%,order_source.ilike.%online%');
    } else if (ch === 'POS') {
      q = q.or('order_source.ilike.%pos%,order_source.ilike.%in-store%,order_source.ilike.%in_store%');
    }
  }

  if (filters.status && filters.status !== 'All') {
    q = q.eq('status', filters.status.toLowerCase());
  }

  if (filters.series && filters.series !== 'All') {
    q = q.eq('invoice_series', filters.series);
  }

  const { startIso, endIso } = resolveBeirutDateBounds(filters.dateRange, filters.startDate, filters.endDate);
  if (startIso) {
    q = q.gte('created_at', startIso);
  }
  if (endIso) {
    q = q.lte('created_at', endIso);
  }

  if (filters.search && filters.search.trim()) {
    const clean = filters.search.trim().replace(/[,()]/g, ' ').trim();
    if (clean) {
      const numericOnly = clean.replace(/^#/, '');
      const isInt = /^\d+$/.test(numericOnly);
      const clauses = [
        `invoice_number.ilike.%${clean}%`,
        `source_order_id.ilike.%${clean}%`,
        `marketplace_order_ref.ilike.%${clean}%`,
        `customer_name.ilike.%${clean}%`,
        `customer_phone.ilike.%${clean}%`
      ];
      if (isInt) {
        clauses.push(`id.eq.${numericOnly}`);
      }
      q = q.or(clauses.join(','));
    }
  }

  return q;
}

function mapDbOrderRow(o: any, handoverByOrderId: Map<string, any>): UnifiedOrder {
  let cCode: ConceptCode = 'NEO';
  let cName = 'NÉO';
  if (o.concept_id === KNOWN_CONCEPTS.OVRLOAD.id) {
    cCode = 'OVRLOAD';
    cName = 'OVRLOAD';
  } else if (o.concept_id === KNOWN_CONCEPTS.WICKD.id) {
    cCode = 'WICKD';
    cName = 'WICKD';
  }

  const isHistorical = o.data_provenance === 'HISTORICAL_IMPORTED' || o.source_system === 'OVRLOAD_LEGACY';
  const handover = !isHistorical ? handoverByOrderId.get(String(o.id)) : undefined;

  // Extract historical driver phone reference if preserved in special_instructions (never treated as drawer cash)
  let historicalDriverPhone: string | undefined;
  if (isHistorical && o.special_instructions) {
    const m = String(o.special_instructions).match(/driver_phone:([^\s|]+)/i);
    if (m && m[1]) historicalDriverPhone = m[1];
  }

  const subtotal = Number(o.subtotal_amount || 0);
  const discount = Number(o.discount_amount || 0);
  const deliveryFee = Number(o.delivery_fee || 0);
  const total = Number(o.total_amount || 0);
  const commUsd = Number(o.marketplace_commission_usd || 0);

  return {
    id: o.id,
    concept_id: o.concept_id || KNOWN_CONCEPTS[cCode].id,
    concept_code: cCode,
    concept_name: cName,
    invoice_number: o.invoice_number,
    invoice_series: o.invoice_series || (o.invoice_number?.includes('-A-') ? 'A' : 'STANDARD'),
    is_canceled: Boolean(o.is_canceled) || o.status === 'cancelled',
    cancellation_reason: o.cancellation_reason,
    canceled_at: o.canceled_at,
    canceled_by: o.canceled_by,
    branch_id: o.branch_id || 'Badaro',
    branch_name: o.branch_id === '9c214659-9cc7-4f33-b115-cbbb8a823a94' ? 'Badaro' : (o.branch_id || 'Badaro'),
    order_type: o.order_type || (cCode === 'NEO' ? 'dine_in' : 'delivery'),
    order_source: o.order_source || 'POS',
    status: o.status || 'completed',
    order_channel_status: o.order_channel_status || undefined,
    data_provenance: o.data_provenance || undefined,
    source_system: o.source_system || undefined,
    source_order_id: o.source_order_id || undefined,
    customer_name: o.customer_name || 'Walk-in Guest',
    customer_phone: o.customer_phone || '',
    delivery_address: o.delivery_address || '',
    special_instructions: o.special_instructions || '',
    subtotal_amount: subtotal,
    discount_amount: discount,
    delivery_fee: deliveryFee,
    total_amount: total,
    payment_method: o.payment_method || 'Cash',
    marketplace_order_ref: o.marketplace_order_ref || undefined,
    marketplace_commission_pct: o.marketplace_commission_pct != null ? Number(o.marketplace_commission_pct) : 0,
    marketplace_commission_usd: commUsd,
    net_receivable_usd: o.net_receivable_usd != null ? Number(o.net_receivable_usd) : (total - commUsd),
    created_at: o.created_at,
    completed_at: o.completed_at ?? null,
    items_count: o.items_count != null ? Number(o.items_count) : undefined,
    table_number: o.table_label || undefined,
    guest_count: o.guest_count != null ? Number(o.guest_count) : undefined,
    server_name: o.waiter_name || undefined,
    driver_name: handover?.driver_name || (historicalDriverPhone ? 'Legacy Driver' : undefined),
    driver_phone: handover?.driver_phone || historicalDriverPhone,
    driver_handover_status: handover ? 'collected' : (isHistorical ? 'historical_untracked' : 'not_applicable'),
    driver_collected_amount: handover ? Number(handover.food_amount_due || 0) : undefined,
    driver_fee_retained: handover ? Number(handover.driver_delivery_fee || 0) : undefined
  };
}

export const unifiedOrdersService = {
  getOrdersPage: async (
    filters: OrderFilters,
    page: number = 1,
    pageSize: number = 100
  ): Promise<PaginatedOrdersResult> => {
    const safePage = Math.max(1, page);
    const safeSize = Math.max(1, Math.min(200, pageSize));
    const from = (safePage - 1) * safeSize;
    const to = from + safeSize - 1;

    let query = supabasePublic
      .from('pos_orders')
      .select(ORDER_SELECT_COLUMNS, { count: 'exact' });

    query = applyOrderFilters(query, filters)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    const { data: dbOrders, count, error } = await query;
    if (error) {
      throw new Error(`Failed to load orders: ${error.message}`);
    }

    const rows = dbOrders || [];
    const liveIds = rows
      .filter((o: any) => o.data_provenance !== 'HISTORICAL_IMPORTED' && o.source_system !== 'OVRLOAD_LEGACY')
      .map((o: any) => o.id);

    const handoverByOrderId = new Map<string, any>();
    if (liveIds.length > 0) {
      try {
        const { data: handovers } = await supabasePublic
          .from('pos_order_handovers')
          .select('order_id, driver_name, driver_phone, food_amount_due, driver_delivery_fee')
          .in('order_id', liveIds);
        (handovers || []).forEach((h: any) => {
          handoverByOrderId.set(String(h.order_id), h);
        });
      } catch {
        // Non-fatal if handovers table is empty or inaccessible
      }
    }

    return {
      orders: rows.map((o: any) => mapDbOrderRow(o, handoverByOrderId)),
      totalCount: count ?? rows.length,
      page: safePage,
      pageSize: safeSize
    };
  },

  getOrdersKpis: async (filters: OrderFilters): Promise<OrderKpiSummary> => {
    const allRows: any[] = [];
    const chunkSize = 1000;
    let totalMatchingCount = 0;

    for (let offset = 0; ; offset += chunkSize) {
      let q = supabasePublic
        .from('pos_orders')
        .select(
          'id, subtotal_amount, discount_amount, delivery_fee, total_amount, marketplace_commission_usd, status, is_canceled, data_provenance, source_system, invoice_series, invoice_number',
          offset === 0 ? { count: 'exact' } : undefined
        );
      q = applyOrderFilters(q, filters)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + chunkSize - 1);

      const { data, count, error } = await q;
      if (error) {
        throw new Error(`Failed to aggregate order KPIs: ${error.message}`);
      }
      if (offset === 0 && count != null) {
        totalMatchingCount = count;
      }
      const batch = data || [];
      allRows.push(...batch);
      if (batch.length < chunkSize) break;
    }

    let activeCount = 0;
    let grossSales = 0;
    let totalDiscounts = 0;
    let totalDeliveryFees = 0;
    let totalOrderAmount = 0;
    let recordedCommission = 0;
    let seriesACount = 0;
    let seriesStandardCount = 0;
    let historicalCount = 0;
    let liveCount = 0;
    const liveOrderIds: any[] = [];

    for (const o of allRows) {
      const isCanceled = Boolean(o.is_canceled) || String(o.status || '').toLowerCase() === 'cancelled';
      const isHistorical = o.data_provenance === 'HISTORICAL_IMPORTED' || o.source_system === 'OVRLOAD_LEGACY';
      if (isHistorical) historicalCount++;
      else {
        liveCount++;
        liveOrderIds.push(o.id);
      }

      const ser = o.invoice_series || (String(o.invoice_number || '').includes('-A-') ? 'A' : 'STANDARD');
      if (ser === 'A') seriesACount++;
      else seriesStandardCount++;

      if (isCanceled) continue;
      activeCount++;
      grossSales += Number(o.subtotal_amount || 0);
      totalDiscounts += Number(o.discount_amount || 0);
      totalDeliveryFees += Number(o.delivery_fee || 0);
      totalOrderAmount += Number(o.total_amount || 0);
      recordedCommission += Number(o.marketplace_commission_usd || 0);
    }

    // Operational driver cash ONLY from actual pos_order_handovers on non-historical live orders
    let operationalDriverCash = 0;
    if (liveOrderIds.length > 0) {
      try {
        for (let i = 0; i < liveOrderIds.length; i += 500) {
          const slice = liveOrderIds.slice(i, i + 500);
          const { data: handovers } = await supabasePublic
            .from('pos_order_handovers')
            .select('food_amount_due')
            .in('order_id', slice);
          (handovers || []).forEach((h: any) => {
            operationalDriverCash += Number(h.food_amount_due || 0);
          });
        }
      } catch {
        // Non-fatal
      }
    }

    return {
      totalMatchingCount: totalMatchingCount || allRows.length,
      activeCount,
      grossSales,
      totalDiscounts,
      totalDeliveryFees,
      totalOrderAmount,
      netSalesExDelivery: totalOrderAmount - totalDeliveryFees,
      recordedCommission,
      operationalDriverCash,
      avgTicket: activeCount > 0 ? totalOrderAmount / activeCount : 0,
      seriesACount,
      seriesStandardCount,
      historicalCount,
      liveCount
    };
  },

  getAllMatchingOrdersForExport: async (filters: OrderFilters): Promise<UnifiedOrder[]> => {
    const allRows: any[] = [];
    const chunkSize = 1000;

    for (let offset = 0; ; offset += chunkSize) {
      let q = supabasePublic.from('pos_orders').select(ORDER_SELECT_COLUMNS);
      q = applyOrderFilters(q, filters)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + chunkSize - 1);

      const { data, error } = await q;
      if (error) {
        throw new Error(`Failed to export orders: ${error.message}`);
      }
      const batch = data || [];
      allRows.push(...batch);
      if (batch.length < chunkSize) break;
    }

    const emptyHandovers = new Map<string, any>();
    return allRows.map((o: any) => mapDbOrderRow(o, emptyHandovers));
  },

  getOrderItems: async (orderId: string | number): Promise<UnifiedOrderItem[]> => {
    const { data, error } = await supabasePublic
      .from('pos_order_items')
      .select('id, product_id, product_name, quantity, unit_price, total_price, customizations, comment')
      .eq('order_id', orderId)
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Failed to load order items: ${error.message}`);
    }

    return (data || []).map((it: any) => ({
      id: it.id,
      product_id: it.product_id,
      product_name: it.product_name || 'Item',
      quantity: Number(it.quantity || 1),
      unit_price: Number(it.unit_price || 0),
      total_price: Number(it.total_price || 0),
      customizations: it.customizations,
      comment: it.comment
    }));
  },

  // Backward-compatible wrapper returning first page orders
  getOrders: async (filters: OrderFilters): Promise<UnifiedOrder[]> => {
    const res = await unifiedOrdersService.getOrdersPage(filters, 1, 100);
    return res.orders;
  }
};
