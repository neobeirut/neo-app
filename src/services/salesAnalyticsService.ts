import { supabasePublic } from '../api/supabase';
import { getRestaurantId } from '../api/client';

export const CONCEPT_IDS = {
  NEO: '00000000-0000-0000-0000-000000000001',
  OVRLOAD: '00000000-0000-0000-0000-000000000002',
  WICKD: '00000000-0000-0000-0000-000000000003',
} as const;

export type DatePreset = 'today' | 'yesterday' | 'last7' | 'this_month' | 'all_time' | 'custom';

export interface TimeWindowConfig {
  id: string;
  label: string;
  startHour: number; // 0..23 inclusive
  endHour: number;   // 0..23 inclusive (supports wrap-around e.g. 23..10)
}

export type ConceptTimeWindowsMap = Record<string, TimeWindowConfig[]>;

export const DEFAULT_CONCEPT_TIME_WINDOWS: ConceptTimeWindowsMap = {
  NEO: [
    { id: 'breakfast', label: 'Breakfast / Morning (06:00–11:59)', startHour: 6, endHour: 11 },
    { id: 'lunch', label: 'Lunch (12:00–15:59)', startHour: 12, endHour: 15 },
    { id: 'afternoon', label: 'Afternoon (16:00–18:59)', startHour: 16, endHour: 18 },
    { id: 'dinner', label: 'Dinner / Evening (19:00–05:59)', startHour: 19, endHour: 5 },
  ],
  OVRLOAD: [
    { id: 'lunch', label: 'Lunch (11:00–14:59)', startHour: 11, endHour: 14 },
    { id: 'afternoon', label: 'Afternoon (15:00–17:59)', startHour: 15, endHour: 17 },
    { id: 'dinner', label: 'Dinner (18:00–22:59)', startHour: 18, endHour: 22 },
    { id: 'off_peak', label: 'Off-Peak (23:00–10:59)', startHour: 23, endHour: 10 },
  ],
  WICKD: [
    { id: 'lunch', label: 'Lunch (11:00–14:59)', startHour: 11, endHour: 14 },
    { id: 'afternoon', label: 'Afternoon (15:00–17:59)', startHour: 15, endHour: 17 },
    { id: 'dinner', label: 'Dinner (18:00–22:59)', startHour: 18, endHour: 22 },
    { id: 'off_peak', label: 'Off-Peak (23:00–10:59)', startHour: 23, endHour: 10 },
  ],
};

export interface SalesAnalyticsFilters {
  preset: DatePreset;
  startDate: string; // YYYY-MM-DD (Asia/Beirut) or ''
  endDate: string;   // YYYY-MM-DD (Asia/Beirut) or ''
  conceptId: string; // 'ALL' or concept UUID
  branchId: string;  // 'ALL' or branch UUID
  channel: string;   // 'ALL' or normalized channel name
  invoiceSeries: string; // 'ALL' | 'A' | 'STANDARD' | 'MAIN'
}

export interface SalesKpis {
  gross_sales: number;
  order_count: number;
  avg_order_value: number;
  total_discounts: number;
  discount_pct: number;
  net_product_sales: number;
  delivery_fees: number;
  customer_total: number;
  verified_commission_usd: number;
  unavailable_commission_orders: number;
  net_receivable: number;
}

export interface TrendPoint {
  period_key: string;
  concept_id: string;
  order_count: number;
  net_sales: number;
  customer_total: number;
  avg_order_value: number;
}

export interface HourlyPoint {
  hour: number;
  order_count: number;
  net_sales: number;
  customer_total: number;
}

export interface ChannelPerformanceRow {
  channel: string;
  order_count: number;
  gross_sales: number;
  discounts: number;
  net_product_sales: number;
  delivery_fees: number;
  customer_total: number;
  verified_commission_usd: number;
  unavailable_commission_orders: number;
  net_receivable: number;
  avg_order_value: number;
  pct_of_sales: number;
}

export interface PaymentBreakdownRow {
  payment_method: string;
  provenance_group: 'HISTORICAL_IMPORTED' | 'LIVE_POS';
  order_count: number;
  net_product_sales: number;
  customer_total: number;
}

export interface InvoiceSeriesRow {
  concept_id: string;
  series_code: string;
  order_count: number;
  net_product_sales: number;
  customer_total: number;
  min_invoice: string | null;
  max_invoice: string | null;
}

export interface ProductRankingRow {
  product_key: string;
  product_id: number | null;
  product_name: string;
  category_name: string;
  is_unmapped: boolean;
  quantity_sold: number;
  gross_sales: number;
  discounts_est: number;
  net_sales: number;
  pct_of_sales: number;
}

export interface CategoryPerformanceRow {
  category_name: string;
  quantity_sold: number;
  gross_sales: number;
  discounts_est: number;
  net_sales: number;
  pct_of_sales: number;
}

export interface SalesAnalyticsPayload {
  kpis: SalesKpis;
  previous_kpis: Partial<SalesKpis> | null;
  trends: TrendPoint[];
  hourly: HourlyPoint[];
  channels: ChannelPerformanceRow[];
  payments: PaymentBreakdownRow[];
  invoice_series: InvoiceSeriesRow[];
  products: ProductRankingRow[];
  categories: CategoryPerformanceRow[];
}

export interface OpenCashDrawerSummary {
  open_shifts_count: number;
  expected_cash_usd: number;
  opening_float_usd: number;
}

/**
 * Returns today's YYYY-MM-DD date in Asia/Beirut timezone.
 */
export function getBeirutToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Beirut',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export function resolveDateRangeForPreset(preset: DatePreset, customStart = '', customEnd = ''): { startDate: string; endDate: string } {
  const today = getBeirutToday();
  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday': {
      const yest = addDaysYmd(today, -1);
      return { startDate: yest, endDate: yest };
    }
    case 'last7':
      return { startDate: addDaysYmd(today, -6), endDate: today };
    case 'this_month':
      return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
    case 'custom':
      return { startDate: customStart, endDate: customEnd };
    case 'all_time':
    default:
      return { startDate: '', endDate: '' };
  }
}

export function hourMatchesWindow(hour: number, win: TimeWindowConfig): boolean {
  if (win.startHour <= win.endHour) {
    return hour >= win.startHour && hour <= win.endHour;
  }
  return hour >= win.startHour || hour <= win.endHour;
}

export function conceptIdToCode(conceptId: string | null | undefined): 'NEO' | 'OVRLOAD' | 'WICKD' | 'ALL' {
  if (!conceptId || conceptId === 'ALL') return 'ALL';
  if (conceptId === CONCEPT_IDS.NEO) return 'NEO';
  if (conceptId === CONCEPT_IDS.OVRLOAD) return 'OVRLOAD';
  if (conceptId === CONCEPT_IDS.WICKD) return 'WICKD';
  return 'NEO';
}

function normalizeChannelFromRow(o: any): string {
  const sc = String(o.sales_channel || '').toUpperCase();
  const os = String(o.order_source || '').toLowerCase();
  const ot = String(o.order_type || '').toLowerCase();
  if (sc === 'TOTERS' || os === 'toters') return 'Toters';
  if (sc === 'NOKNOK' || os === 'noknok') return 'NokNok';
  if (sc === 'WHATSAPP' || os === 'whatsapp') return 'WhatsApp';
  if (sc === 'DIRECT_APP' || sc === 'WEBSITE' || sc === 'APP' || os === 'app' || os === 'website' || os === 'direct app') return 'App / Website';
  if (sc === 'POS_PICKUP' || sc === 'PICKUP' || ot === 'pickup') return 'Pickup';
  if (sc === 'POS_DINE_IN' || sc === 'DINE_IN' || ot === 'dine_in') return 'Dine-In';
  if (sc === 'POS' || sc === 'IN_STORE' || sc === 'PHONE' || sc === 'POS_DELIVERY' || os === 'pos' || os === 'in-store' || os === 'phone') return 'POS / In-Store';
  return 'Other';
}

function normalizeSeriesFromRow(o: any): 'A' | 'STANDARD' | 'MAIN' {
  if (String(o.invoice_number || '').startsWith('OVR-A-') || String(o.invoice_series || '').toUpperCase() === 'A' || String(o.fiscal_series || '').toUpperCase() === 'A') {
    return 'A';
  }
  if (String(o.fiscal_series || '').toUpperCase() === 'MAIN') return 'MAIN';
  return 'STANDARD';
}

export const salesAnalyticsService = {
  async getBranches(): Promise<Array<{ id: string; name: string }>> {
    const rid = getRestaurantId();
    const { data, error } = await supabasePublic
      .from('branches')
      .select('id, name')
      .eq('restaurant_id', rid)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as Array<{ id: string; name: string }>;
  },

  async getTimeWindowsConfig(): Promise<ConceptTimeWindowsMap> {
    const rid = getRestaurantId();
    const { data } = await supabasePublic
      .from('restaurants')
      .select('settings')
      .eq('id', rid)
      .maybeSingle();
    const saved = data?.settings?.sales_report_time_windows;
    if (saved && typeof saved === 'object') {
      return {
        NEO: Array.isArray(saved.NEO) && saved.NEO.length ? saved.NEO : DEFAULT_CONCEPT_TIME_WINDOWS.NEO,
        OVRLOAD: Array.isArray(saved.OVRLOAD) && saved.OVRLOAD.length ? saved.OVRLOAD : DEFAULT_CONCEPT_TIME_WINDOWS.OVRLOAD,
        WICKD: Array.isArray(saved.WICKD) && saved.WICKD.length ? saved.WICKD : DEFAULT_CONCEPT_TIME_WINDOWS.WICKD,
      };
    }
    return DEFAULT_CONCEPT_TIME_WINDOWS;
  },

  async saveTimeWindowsConfig(config: ConceptTimeWindowsMap): Promise<void> {
    const rid = getRestaurantId();
    const { data: rest, error: readErr } = await supabasePublic
      .from('restaurants')
      .select('settings')
      .eq('id', rid)
      .single();
    if (readErr) throw new Error(readErr.message);

    const nextSettings = {
      ...(rest?.settings || {}),
      sales_report_time_windows: config,
    };
    const { error: updErr } = await supabasePublic
      .from('restaurants')
      .update({ settings: nextSettings })
      .eq('id', rid);
    if (updErr) throw new Error(updErr.message);
  },

  async getOpenCashDrawerSummary(branchId: string): Promise<OpenCashDrawerSummary> {
    const rid = getRestaurantId();
    let q = supabasePublic
      .from('pos_cash_shifts')
      .select('id, opening_cash_usd, expected_cash_usd, status')
      .eq('restaurant_id', rid)
      .eq('status', 'open');
    if (branchId && branchId !== 'ALL') {
      q = q.eq('branch_id', branchId);
    }
    const { data, error } = await q;
    if (error) {
      return { open_shifts_count: 0, expected_cash_usd: 0, opening_float_usd: 0 };
    }
    const rows = data || [];
    return {
      open_shifts_count: rows.length,
      opening_float_usd: rows.reduce((s, r: any) => s + Number(r.opening_cash_usd || 0), 0),
      expected_cash_usd: rows.reduce((s, r: any) => s + Number(r.expected_cash_usd || r.opening_cash_usd || 0), 0),
    };
  },

  async fetchAnalytics(filters: SalesAnalyticsFilters): Promise<SalesAnalyticsPayload> {
    const rid = getRestaurantId();
    const { data, error } = await supabasePublic.rpc('get_pos_sales_analytics', {
      p_restaurant_id: rid,
      p_start_date: filters.startDate || null,
      p_end_date: filters.endDate || null,
      p_concept_id: filters.conceptId !== 'ALL' ? filters.conceptId : null,
      p_branch_id: filters.branchId !== 'ALL' ? filters.branchId : null,
      p_channel: filters.channel !== 'ALL' ? filters.channel : null,
      p_invoice_series: filters.invoiceSeries !== 'ALL' ? filters.invoiceSeries : null,
    });
    if (error) {
      throw new Error(`Sales analytics RPC failed: ${error.message}`);
    }
    return data as SalesAnalyticsPayload;
  },

  async fetchFilteredOrders(
    filters: SalesAnalyticsFilters,
    page = 1,
    pageSize = 25,
    exportAll = false
  ): Promise<{ rows: any[]; totalCount: number }> {
    const rid = getRestaurantId();
    const collected: any[] = [];
    let from = 0;
    const chunk = 1000;

    while (true) {
      let q = supabasePublic
        .from('pos_orders')
        .select(
          'id, concept_id, branch_id, invoice_number, invoice_series, fiscal_series, order_type, order_source, sales_channel, payment_method, status, is_canceled, subtotal_amount, discount_amount, delivery_fee, total_amount, marketplace_commission_usd, net_receivable_usd, data_provenance, business_date, created_at, completed_at, customer_name'
        )
        .eq('restaurant_id', rid)
        .or('is_canceled.is.null,is_canceled.eq.false')
        .not('status', 'in', '("cancelled","canceled","void","voided","rejected","draft")')
        .order('created_at', { ascending: false })
        .range(from, from + chunk - 1);

      if (filters.conceptId !== 'ALL') {
        q = q.eq('concept_id', filters.conceptId);
      }
      if (filters.branchId !== 'ALL') {
        q = q.eq('branch_id', filters.branchId);
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      collected.push(...data);
      if (data.length < chunk) break;
      from += chunk;
    }

    const filtered = collected
      .map(o => {
        const bizDate =
          o.business_date ||
          new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Beirut',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(o.created_at));
        const normChannel = normalizeChannelFromRow(o);
        const normSeries = normalizeSeriesFromRow(o);
        return { ...o, bizDate, normChannel, normSeries };
      })
      .filter(o => {
        if (filters.startDate && o.bizDate < filters.startDate) return false;
        if (filters.endDate && o.bizDate > filters.endDate) return false;
        if (filters.channel !== 'ALL' && o.normChannel !== filters.channel) return false;
        if (filters.invoiceSeries !== 'ALL' && o.normSeries !== filters.invoiceSeries) return false;
        return true;
      });

    if (exportAll) {
      return { rows: filtered, totalCount: filtered.length };
    }
    const startIdx = (page - 1) * pageSize;
    return {
      rows: filtered.slice(startIdx, startIdx + pageSize),
      totalCount: filtered.length,
    };
  },
};
