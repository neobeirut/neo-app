import { supabasePublic, DEFAULT_RESTAURANT_ID } from '../api/supabase';
import { KNOWN_CONCEPTS, type ConceptCode } from '../types/concept';

export interface LiveDailyFilters {
  date: string; // YYYY-MM-DD (Asia/Beirut)
  branchId: string; // 'ALL' or flow branch UUID / name
  conceptId: string; // 'ALL' or concept UUID
  restaurantId?: string;
}

export interface LiveDailyOrder {
  id: number | string;
  invoice_number: string | null;
  invoice_series: string | null;
  concept_id: string | null;
  concept_code: string;
  concept_name: string;
  branch_id: string | null;
  branch_name: string;
  order_type: string;
  order_source: string;
  channel: string;
  status: string;
  is_canceled: boolean;
  cancellation_reason: string | null;
  is_scheduled: boolean;
  scheduled_for: string | null;
  table_label: string | null;
  guest_count: number | null;
  waiter_name: string | null;
  cashier_name: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  payment_method: string;
  tendered_amount: number;
  subtotal_amount: number;
  discount_amount: number;
  delivery_fee: number;
  total_amount: number;
  exchange_rate: number;
  items_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface LiveDailyOrderItem {
  id: number | string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  customizations?: any;
  comment?: string | null;
}

export interface LiveDailyOpenTable {
  id: string;
  branch_id: string;
  branch_name: string;
  table_code: string;
  guest_count: number;
  status: string;
  opened_at: string;
  order_id: number | null;
  total_amount: number;
  is_paid_in_advance: boolean;
  waiter_name: string | null;
}

export interface LiveDailyShift {
  id: string;
  date: string;
  branch: string;
  branch_id: string | null;
  shift: string;
  status: string;
  user_name: string | null;
  closed_by: string | null;
  opening_usd: number;
  opening_lbp: number;
  actual_usd: number | null;
  actual_lbp: number | null;
  expected_cash_usd: number | null;
  variance_usd: number | null;
  sales_lbp: number | null;
  rate: number;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  concept_id: string | null;
}

export interface LiveDailyPayment {
  id: string;
  date: string;
  branch: string;
  shift: string | null;
  type: string;
  supplier: string | null;
  amount_usd: number;
  amount_lbp: number;
  status: string | null;
  has_invoice: boolean;
  user_name: string | null;
  created_at: string;
}

export interface LiveDailyVoid {
  id: string;
  branch: string;
  order_type: string | null;
  order_number: string | null;
  table_number: string | null;
  receipt_date: string | null;
  receipt_time: string | null;
  canceled_items: Array<{ name: string; qty: number; price: number | null }>;
  reason_comment: string;
  created_by: string | null;
  created_at: string;
}

export interface BreakdownRow {
  key: string;
  count: number;
  amount_usd: number;
  share_pct: number;
}

export interface LiveDailyReportData {
  date: string;
  fetchedAt: string;
  exchangeRate: number;
  branches: Array<{ id: string; name: string; externalId?: string }>;
  orders: LiveDailyOrder[];
  openTables: LiveDailyOpenTable[];
  shifts: LiveDailyShift[];
  dailyPayments: LiveDailyPayment[];
  voidReceipts: LiveDailyVoid[];
  kpis: {
    completedOrdersCount: number;
    openOrdersCount: number;
    canceledOrdersCount: number;
    grossSalesUsd: number;
    netSalesUsd: number;
    totalDiscountsUsd: number;
    totalDeliveryFeesUsd: number;
    avgTicketUsd: number;
    openTablesCount: number;
    openTablesValueUsd: number;
    openNonTableOrdersCount: number;
    openNonTableOrdersValueUsd: number;
    canceledValueUsd: number;
    voidReceiptsCount: number;
    cashInUsd: number;
    cashInLbp: number;
    supplierPayoutsUsd: number;
    supplierPayoutsLbp: number;
    cashOutUsd: number;
    cashOutLbp: number;
  };
  paymentBreakdown: BreakdownRow[];
  channelBreakdown: BreakdownRow[];
  conceptBreakdown: BreakdownRow[];
}

export function getBeirutTodayYmd(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year')?.value || '2026';
  const m = parts.find(p => p.type === 'month')?.value || '01';
  const d = parts.find(p => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

function getBeirutDayBoundsUtc(ymd: string): { startIso: string; endIso: string } {
  // Compute Asia/Beirut offset on the requested date dynamically (handles EET +02:00 / EEST +03:00)
  const probe = new Date(`${ymd}T12:00:00Z`);
  const tzPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Beirut',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(probe)
    .find(p => p.type === 'timeZoneName')?.value || 'GMT+2';

  const match = tzPart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  const sign = match?.[1] === '-' ? -1 : 1;
  const hrs = Number(match?.[2] ?? 2);
  const mins = Number(match?.[3] ?? 0);
  const offsetMs = sign * (hrs * 60 + mins) * 60 * 1000;

  const startUtcMs = Date.parse(`${ymd}T00:00:00.000Z`) - offsetMs;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

function resolveConceptMeta(conceptId?: string | null): { code: string; name: string } {
  const id = conceptId || '00000000-0000-0000-0000-000000000001';
  const found = Object.values(KNOWN_CONCEPTS).find((c: any) => c.id === id);
  if (found) return { code: found.code as ConceptCode, name: found.name };
  if (id === '00000000-0000-0000-0000-000000000002') return { code: 'OVRLOAD', name: 'OVRLOAD' };
  if (id === '00000000-0000-0000-0000-000000000003') return { code: 'WICKD', name: 'WICKD' };
  return { code: 'NEO', name: 'NÉO' };
}

function normalizeChannel(row: any): string {
  const src = String(row.order_source || '').toLowerCase();
  const type = String(row.order_type || '').toLowerCase();
  if (src.includes('toters')) return 'Toters';
  if (src.includes('noknok')) return 'NokNok';
  if (src.includes('whatsapp')) return 'WhatsApp';
  if (src.includes('web') || src.includes('app') || src.includes('online')) return 'App / Website';
  if (row.table_label || type === 'dine_in' || type === 'dine-in') return 'Dine-In';
  if (type === 'delivery') return 'Delivery';
  if (type === 'pickup' || type === 'takeaway') return 'Takeaway / Pickup';
  return 'POS / In-Store';
}

function normalizePaymentMethod(raw?: string | null): string {
  const v = String(raw || '').trim();
  if (!v) return 'Unpaid / Pending';
  const lower = v.toLowerCase();
  if (lower === 'pending' || lower === 'unpaid') return 'Unpaid / Pending';
  if (lower.includes('whish') || lower.includes('wish') || lower.includes('wallet')) return 'Whish / E-Wallet';
  if (lower.includes('card') || lower.includes('visa') || lower.includes('master') || lower.includes('pos_terminal')) return 'Credit Card';
  if (lower.includes('account') || lower.includes('credit')) return 'On Account / Credit';
  if (lower.includes('lbp') || lower.includes('l.l')) return 'Cash LBP';
  if (lower.includes('cash') || lower.includes('usd')) return 'Cash USD';
  if (lower.includes('toters')) return 'Toters';
  if (lower.includes('noknok')) return 'NokNok';
  return v;
}

function isCanceledOrder(o: any): boolean {
  if (o.is_canceled === true) return true;
  const st = String(o.status || '').toLowerCase();
  return ['cancelled', 'canceled', 'void', 'voided', 'refunded'].includes(st);
}

function isSettledOrder(o: any): boolean {
  if (isCanceledOrder(o)) return false;
  const st = String(o.status || '').toLowerCase();
  if (['completed', 'closed', 'delivered', 'paid'].includes(st)) return true;
  const tendered = Number(o.tendered_amount) || 0;
  const total = Number(o.total_amount) || 0;
  const pm = String(o.payment_method || '').toLowerCase();
  return tendered > 0 && total > 0 && tendered >= total && !['pending', 'unpaid', ''].includes(pm);
}

function buildBreakdown(map: Map<string, { count: number; amount_usd: number }>, totalUsd: number): BreakdownRow[] {
  return Array.from(map.entries())
    .map(([key, val]) => ({
      key,
      count: val.count,
      amount_usd: Math.round(val.amount_usd * 100) / 100,
      share_pct: totalUsd > 0 ? Math.round((val.amount_usd / totalUsd) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount_usd - a.amount_usd);
}

export async function fetchLiveDailyReport(filters: LiveDailyFilters): Promise<LiveDailyReportData> {
  const restaurantId = filters.restaurantId || DEFAULT_RESTAURANT_ID;
  const date = filters.date || getBeirutTodayYmd();
  const { startIso, endIso } = getBeirutDayBoundsUtc(date);

  // 1. Load branches & commerce_branch_links to map UUID <-> external integer branch IDs <-> names
  const [branchesRes, linksRes, rateRes] = await Promise.all([
    supabasePublic.from('branches').select('id, name').eq('restaurant_id', restaurantId).order('name'),
    supabasePublic.from('commerce_branch_links').select('flow_branch_id, external_branch_id').eq('restaurant_id', restaurantId),
    supabasePublic.from('exchange_rates').select('rate').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(1),
  ]);

  const branchList = (branchesRes.data || []) as Array<{ id: string; name: string }>;
  const linksList = (linksRes.data || []) as Array<{ flow_branch_id: string; external_branch_id: string | number }>;
  const exchangeRate = Number(rateRes.data?.[0]?.rate) || 90000;

  const branchNameById = new Map<string, string>();
  const externalByFlowId = new Map<string, string>();
  const flowByExternalId = new Map<string, string>();

  branchList.forEach(b => {
    branchNameById.set(String(b.id), b.name);
  });
  linksList.forEach(l => {
    if (l.flow_branch_id && l.external_branch_id != null) {
      externalByFlowId.set(String(l.flow_branch_id), String(l.external_branch_id));
      flowByExternalId.set(String(l.external_branch_id), String(l.flow_branch_id));
      const bName = branchNameById.get(String(l.flow_branch_id));
      if (bName) branchNameById.set(String(l.external_branch_id), bName);
    }
  });

  const branches = branchList.map(b => ({
    id: String(b.id),
    name: b.name,
    externalId: externalByFlowId.get(String(b.id)),
  }));

  // Resolve branch filter identifiers (both flow UUID and external ID + branch name)
  let allowedBranchIds: string[] | null = null;
  let selectedBranchName: string | null = null;
  if (filters.branchId && filters.branchId !== 'ALL') {
    const ext = externalByFlowId.get(filters.branchId);
    allowedBranchIds = [filters.branchId, ...(ext ? [ext] : [])];
    selectedBranchName = branchNameById.get(filters.branchId) || null;
  }

  // 2. Fetch orders, open tables, shifts, daily payments, and void receipts in parallel
  const fetchOrders = async (): Promise<any[]> => {
    const all: any[] = [];
    for (let offset = 0; ; offset += 1000) {
      let q = supabasePublic
        .from('pos_orders')
        .select(
          'id, invoice_number, invoice_series, concept_id, branch_id, order_type, order_source, status, is_canceled, cancellation_reason, is_scheduled, scheduled_for, table_label, guest_count, waiter_name, cashier_name, customer_name, customer_phone, payment_method, tendered_amount, subtotal_amount, discount_amount, delivery_fee, total_amount, exchange_rate, items_count, created_at, completed_at'
        )
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })
        .range(offset, offset + 999);

      if (allowedBranchIds) q = q.in('branch_id', allowedBranchIds);
      if (filters.conceptId && filters.conceptId !== 'ALL') {
        if (filters.conceptId === '00000000-0000-0000-0000-000000000001') {
          q = q.or(`concept_id.eq.${filters.conceptId},concept_id.is.null`);
        } else {
          q = q.eq('concept_id', filters.conceptId);
        }
      }

      const { data, error } = await q;
      if (error) {
        console.warn('[liveDailyReport] pos_orders query warning:', error.message);
        break;
      }
      all.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return all;
  };

  const fetchOpenTables = async (): Promise<any[]> => {
    let q = supabasePublic
      .from('pos_table_sessions')
      .select(`
        id, branch_id, commerce_order_id, guest_count, status, opened_at, assigned_waiter_name_snapshot,
        tables:pos_table_session_tables(table:pos_tables(table_code), is_primary)
      `)
      .eq('restaurant_id', restaurantId)
      .in('status', ['opening', 'occupied', 'bill_requested', 'closing'])
      .order('opened_at', { ascending: false });
    if (allowedBranchIds) q = q.in('branch_id', allowedBranchIds);
    const { data, error } = await q;
    if (error) {
      console.warn('[liveDailyReport] pos_table_sessions query warning:', error.message);
      return [];
    }
    return data || [];
  };

  const fetchShifts = async (): Promise<any[]> => {
    let q = supabasePublic
      .from('shift_cash')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .ilike('date', `${date}%`)
      .order('created_at', { ascending: false });
    if (selectedBranchName) {
      q = q.ilike('branch', `%${selectedBranchName}%`);
    }
    const { data, error } = await q;
    if (error) {
      console.warn('[liveDailyReport] shift_cash query warning:', error.message);
      return [];
    }
    return data || [];
  };

  const fetchDailyPayments = async (): Promise<any[]> => {
    let q = supabasePublic
      .from('daily_payments')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: false });
    if (selectedBranchName) {
      q = q.ilike('branch', `%${selectedBranchName}%`);
    }
    const { data, error } = await q;
    if (error) {
      console.warn('[liveDailyReport] daily_payments query warning:', error.message);
      return [];
    }
    return data || [];
  };

  const fetchVoids = async (): Promise<any[]> => {
    let q = supabasePublic
      .from('void_receipts')
      .select('*')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: false });
    if (selectedBranchName) {
      q = q.ilike('branch', `%${selectedBranchName}%`);
    }
    const { data, error } = await q;
    if (error) {
      console.warn('[liveDailyReport] void_receipts query warning:', error.message);
      return [];
    }
    return data || [];
  };

  const [rawOrders, rawTables, rawShifts, rawPayments, rawVoids] = await Promise.all([
    fetchOrders(),
    fetchOpenTables(),
    fetchShifts(),
    fetchDailyPayments(),
    fetchVoids(),
  ]);

  // 3. Normalize Orders
  const ordersMap = new Map<number, any>();
  const orders: LiveDailyOrder[] = rawOrders.map(r => {
    ordersMap.set(Number(r.id), r);
    const conceptMeta = resolveConceptMeta(r.concept_id);
    const bName = branchNameById.get(String(r.branch_id || '')) || String(r.branch_id || 'Branch');
    return {
      id: r.id,
      invoice_number: r.invoice_number || null,
      invoice_series: r.invoice_series || null,
      concept_id: r.concept_id || '00000000-0000-0000-0000-000000000001',
      concept_code: conceptMeta.code,
      concept_name: conceptMeta.name,
      branch_id: r.branch_id ? String(r.branch_id) : null,
      branch_name: bName,
      order_type: r.order_type || 'dine_in',
      order_source: r.order_source || 'pos',
      channel: normalizeChannel(r),
      status: r.status || 'pending',
      is_canceled: isCanceledOrder(r),
      cancellation_reason: r.cancellation_reason || null,
      is_scheduled: Boolean(r.is_scheduled),
      scheduled_for: r.scheduled_for || null,
      table_label: r.table_label || null,
      guest_count: r.guest_count != null ? Number(r.guest_count) : null,
      waiter_name: r.waiter_name || null,
      cashier_name: r.cashier_name || null,
      customer_name: r.customer_name || null,
      customer_phone: r.customer_phone || null,
      payment_method: normalizePaymentMethod(r.payment_method),
      tendered_amount: Number(r.tendered_amount) || 0,
      subtotal_amount: Number(r.subtotal_amount) || Number(r.total_amount) || 0,
      discount_amount: Number(r.discount_amount) || 0,
      delivery_fee: Number(r.delivery_fee) || 0,
      total_amount: Number(r.total_amount) || 0,
      exchange_rate: Number(r.exchange_rate) || exchangeRate,
      items_count: Number(r.items_count) || 0,
      created_at: r.created_at,
      completed_at: r.completed_at || null,
    };
  });

  // Fetch any missing orders linked to open tables (e.g. opened earlier)
  const missingTableOrderIds = rawTables
    .map(t => Number(t.commerce_order_id))
    .filter(id => Number.isFinite(id) && id > 0 && !ordersMap.has(id));

  if (missingTableOrderIds.length > 0) {
    const { data: extraOrders } = await supabasePublic
      .from('pos_orders')
      .select('id, total_amount, status, payment_method, tendered_amount, waiter_name')
      .in('id', missingTableOrderIds);
    (extraOrders || []).forEach((o: any) => ordersMap.set(Number(o.id), o));
  }

  // 4. Normalize Open Tables
  const openTables: LiveDailyOpenTable[] = rawTables.map(t => {
    const primary = (t.tables || []).find((x: any) => x.is_primary)?.table?.table_code || t.tables?.[0]?.table?.table_code || 'Table';
    const linked = t.commerce_order_id ? ordersMap.get(Number(t.commerce_order_id)) : null;
    const paidAdv = linked ? isSettledOrder(linked) : false;
    return {
      id: t.id,
      branch_id: String(t.branch_id || ''),
      branch_name: branchNameById.get(String(t.branch_id || '')) || 'Branch',
      table_code: primary,
      guest_count: Number(t.guest_count) || 1,
      status: t.status || 'occupied',
      opened_at: t.opened_at,
      order_id: t.commerce_order_id ? Number(t.commerce_order_id) : null,
      total_amount: linked ? Number(linked.total_amount) || 0 : 0,
      is_paid_in_advance: paidAdv,
      waiter_name: t.assigned_waiter_name_snapshot || linked?.waiter_name || null,
    };
  });

  // 5. Normalize Shifts
  const shifts: LiveDailyShift[] = rawShifts.map(s => ({
    id: s.id,
    date: String(s.date || '').slice(0, 10),
    branch: s.branch || branchNameById.get(String(s.branch_id || '')) || 'Branch',
    branch_id: s.branch_id || null,
    shift: s.shift || 'AM',
    status: s.status || 'open',
    user_name: s.user_name || null,
    closed_by: s.closed_by || null,
    opening_usd: Number(s.opening_usd) || 0,
    opening_lbp: Number(s.opening_lbp) || 0,
    actual_usd: s.actual_usd != null ? Number(s.actual_usd) : null,
    actual_lbp: s.actual_lbp != null ? Number(s.actual_lbp) : null,
    expected_cash_usd: s.expected_cash_usd != null ? Number(s.expected_cash_usd) : null,
    variance_usd: s.variance_usd != null ? Number(s.variance_usd) : (s.difference_usd != null ? Number(s.difference_usd) : null),
    sales_lbp: s.sales_lbp != null ? Number(s.sales_lbp) : null,
    rate: Number(s.rate) || exchangeRate,
    opened_at: s.opened_at || null,
    closed_at: s.closed_at || null,
    created_at: s.created_at,
    concept_id: s.concept_id || null,
  }));

  // 6. Normalize Daily Payments
  const dailyPayments: LiveDailyPayment[] = rawPayments.map(p => ({
    id: p.id,
    date: p.date,
    branch: p.branch || 'Branch',
    shift: p.shift || null,
    type: p.type || 'Other',
    supplier: p.supplier || null,
    amount_usd: Number(p.amount_usd) || 0,
    amount_lbp: Number(p.amount_lbp) || 0,
    status: p.status || null,
    has_invoice: Boolean(p.has_invoice),
    user_name: p.user_name || null,
    created_at: p.created_at,
  }));

  // 7. Normalize Voids
  const voidReceipts: LiveDailyVoid[] = rawVoids.map(v => ({
    id: v.id,
    branch: v.branch || 'Branch',
    order_type: v.order_type || null,
    order_number: v.order_number || null,
    table_number: v.table_number || null,
    receipt_date: v.receipt_date || null,
    receipt_time: v.receipt_time || null,
    canceled_items: Array.isArray(v.canceled_items) ? v.canceled_items : [],
    reason_comment: v.reason_comment || '',
    created_by: v.created_by || null,
    created_at: v.created_at,
  }));

  // 8. Compute KPIs & Breakdowns
  let completedOrdersCount = 0;
  let openOrdersCount = 0;
  let canceledOrdersCount = 0;
  let grossSalesUsd = 0;
  let netSalesUsd = 0;
  let totalDiscountsUsd = 0;
  let totalDeliveryFeesUsd = 0;
  let canceledValueUsd = 0;
  let openNonTableOrdersCount = 0;
  let openNonTableOrdersValueUsd = 0;

  const paymentMap = new Map<string, { count: number; amount_usd: number }>();
  const channelMap = new Map<string, { count: number; amount_usd: number }>();
  const conceptMap = new Map<string, { count: number; amount_usd: number }>();

  const bump = (map: Map<string, { count: number; amount_usd: number }>, key: string, amt: number) => {
    const cur = map.get(key) || { count: 0, amount_usd: 0 };
    cur.count += 1;
    cur.amount_usd += amt;
    map.set(key, cur);
  };

  const activeTableOrderIds = new Set(openTables.map(t => t.order_id).filter(Boolean));

  orders.forEach(o => {
    if (o.is_canceled) {
      canceledOrdersCount += 1;
      canceledValueUsd += o.total_amount;
      return;
    }

    if (isSettledOrder(o)) {
      completedOrdersCount += 1;
      grossSalesUsd += o.subtotal_amount || o.total_amount;
      netSalesUsd += o.total_amount;
      totalDiscountsUsd += o.discount_amount;
      totalDeliveryFeesUsd += o.delivery_fee;
      bump(paymentMap, o.payment_method, o.total_amount);
      bump(channelMap, o.channel, o.total_amount);
      bump(conceptMap, o.concept_name, o.total_amount);
    } else {
      openOrdersCount += 1;
      const isTableOrd = Boolean(o.table_label) || activeTableOrderIds.has(Number(o.id));
      if (!isTableOrd) {
        openNonTableOrdersCount += 1;
        openNonTableOrdersValueUsd += o.total_amount;
      }
    }
  });

  const openTablesValueUsd = openTables.reduce((sum, t) => sum + t.total_amount, 0);

  const isCashOutType = (t: string) =>
    t === 'CashOut' || t === 'Cashout Loan' || t === 'Cashout Bank' || t === 'Cashout Salary';

  let cashInUsd = 0;
  let cashInLbp = 0;
  let supplierPayoutsUsd = 0;
  let supplierPayoutsLbp = 0;
  let cashOutUsd = 0;
  let cashOutLbp = 0;

  dailyPayments.forEach(p => {
    if (p.type === 'CashIn') {
      cashInUsd += p.amount_usd;
      cashInLbp += p.amount_lbp;
    } else if ((p.type === 'Supplier' || p.type === 'Delivery') && p.status !== 'Unpaid') {
      supplierPayoutsUsd += p.amount_usd;
      supplierPayoutsLbp += p.amount_lbp;
    } else if (isCashOutType(p.type)) {
      cashOutUsd += p.amount_usd;
      cashOutLbp += p.amount_lbp;
    }
  });

  return {
    date,
    fetchedAt: new Date().toISOString(),
    exchangeRate,
    branches,
    orders,
    openTables,
    shifts,
    dailyPayments,
    voidReceipts,
    kpis: {
      completedOrdersCount,
      openOrdersCount,
      canceledOrdersCount,
      grossSalesUsd: Math.round(grossSalesUsd * 100) / 100,
      netSalesUsd: Math.round(netSalesUsd * 100) / 100,
      totalDiscountsUsd: Math.round(totalDiscountsUsd * 100) / 100,
      totalDeliveryFeesUsd: Math.round(totalDeliveryFeesUsd * 100) / 100,
      avgTicketUsd: completedOrdersCount > 0 ? Math.round((netSalesUsd / completedOrdersCount) * 100) / 100 : 0,
      openTablesCount: openTables.length,
      openTablesValueUsd: Math.round(openTablesValueUsd * 100) / 100,
      openNonTableOrdersCount,
      openNonTableOrdersValueUsd: Math.round(openNonTableOrdersValueUsd * 100) / 100,
      canceledValueUsd: Math.round(canceledValueUsd * 100) / 100,
      voidReceiptsCount: voidReceipts.length,
      cashInUsd: Math.round(cashInUsd * 100) / 100,
      cashInLbp: Math.round(cashInLbp),
      supplierPayoutsUsd: Math.round(supplierPayoutsUsd * 100) / 100,
      supplierPayoutsLbp: Math.round(supplierPayoutsLbp),
      cashOutUsd: Math.round(cashOutUsd * 100) / 100,
      cashOutLbp: Math.round(cashOutLbp),
    },
    paymentBreakdown: buildBreakdown(paymentMap, netSalesUsd),
    channelBreakdown: buildBreakdown(channelMap, netSalesUsd),
    conceptBreakdown: buildBreakdown(conceptMap, netSalesUsd),
  };
}

export async function fetchOrderLineItems(orderId: number | string): Promise<LiveDailyOrderItem[]> {
  const { data, error } = await supabasePublic
    .from('pos_order_items')
    .select('id, product_name, quantity, unit_price, total_price, customizations, comment')
    .eq('order_id', orderId)
    .order('id', { ascending: true });

  if (error) {
    console.warn('[liveDailyReport] pos_order_items query warning:', error.message);
    return [];
  }
  return (data || []).map((i: any) => ({
    id: i.id,
    product_name: i.product_name || 'Item',
    quantity: Number(i.quantity) || 1,
    unit_price: Number(i.unit_price) || 0,
    total_price: Number(i.total_price) || 0,
    customizations: i.customizations,
    comment: i.comment || null,
  }));
}
