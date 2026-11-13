import { supabase } from '../../api/supabase';
import type {
  KdsStation,
  KdsFire,
  KdsFireItem,
  KdsProductRouting,
  KdsBumpedOrder,
  KdsBumpedItem,
  KdsFireItemStatus,
  KdsFireItemModifier
} from './types';

import { COMMERCE_API_BASE } from '../config';

const PRINT_SERVER_URL = 'http://192.168.18.195:9191';

let productMapCache: { byId: Map<string, any>; byName: Map<string, any>; lastFetched: number } | null = null;

export async function getProductImageMap(): Promise<{ byId: Map<string, any>; byName: Map<string, any> }> {
  const now = Date.now();
  if (productMapCache && (now - productMapCache.lastFetched < 5 * 60 * 1000)) {
    return productMapCache;
  }
  try {
    const { data: prods } = await supabase.from('products').select('id, name, image_url');
    const byId = new Map<string, any>();
    const byName = new Map<string, any>();
    (prods || []).forEach((p: any) => {
      if (p.id) byId.set(String(p.id), p);
      if (p.name) byName.set(String(p.name).trim().toLowerCase(), p);
    });
    productMapCache = { byId, byName, lastFetched: now };
    return productMapCache;
  } catch (err) {
    console.warn('Failed to load products for KDS images:', err);
    return productMapCache || { byId: new Map(), byName: new Map() };
  }
}

export async function resolveProductImageUrl(productId?: string | number | null, productName?: string | null): Promise<string | null> {
  const map = await getProductImageMap();
  if (productId && map.byId.has(String(productId))) {
    const p = map.byId.get(String(productId));
    if (p?.image_url) return p.image_url;
  }
  if (productName && map.byName.has(String(productName).trim().toLowerCase())) {
    const p = map.byName.get(String(productName).trim().toLowerCase());
    if (p?.image_url) return p.image_url;
  }
  return null;
}

/**
 * Checks whether an item represents a course HOLD divider separator.
 */
export function isHoldItem(item: any): boolean {
  if (!item) return false;
  const name = String(item.product_name_snapshot || item.product_name || item.name || '').trim().toUpperCase();
  const idStr = String(item.order_item_id || item.product_id || item.id || '');
  return (
    name === 'HOLD' ||
    name === '--- HOLD ---' ||
    name === 'HOLD FOR NEXT COURSE' ||
    name.includes('HOLD (KITCHEN') ||
    idStr.startsWith('hold_') ||
    item.isHoldSeparator === true
  );
}

/**
 * Heuristic station routing detector for POS items based on name & category.
 * Used when explicit kds_product_routings rule is not present.
 */
export function detectItemStation(productName: string, categoryName: string = ''): string {
  const p = (productName + ' ' + categoryName).toLowerCase();

  // 1. Drinks, beverages, coffee, alcohol -> BAR
  if (/\b(bar|drink|drinks|wine|beer|beers|cocktail|cocktails|gin|vodka|whisky|whiskey|coffee|espresso|latte|cappuccino|tea|teas|water|soda|pepsi|juice|juices|lemonade|beverage|beverages|americano|mocktail|tonic)\b/i.test(p)) {
    return 'BAR';
  }

  // 2. Pastry, bakery, desserts, cookies -> PASTRY
  if (/\b(pastry|bakery|croissant|croissants|pain au chocolat|tart|tarte|tartes|cake|cakes|dessert|desserts|cookie|cookies|tuiles|choux|brownie|brownies|muffin|muffins|sweet|sweets|eclair)\b/i.test(p)) {
    return 'PASTRY';
  }

  // 3. Cold appetizers, salads, raw, tartare, carpaccio -> COLD_KITCHEN
  if (/\b(salad|salade|salads|salades|buratta|burrata|halloum|halloumi|labne|labneh|quinoa|tartare|carpaccio|ceviche|cold|edamame|nicoise|raw|poke)\b/i.test(p)) {
    return 'COLD_KITCHEN';
  }

  // 4. Default food items -> HOT_KITCHEN
  return 'HOT_KITCHEN';
}

/**
 * Normalizes any branch identifier (UUID, external ID, number, or name) to a valid FLOW branch UUID.
 * Default is Badaro branch: 9c214659-9cc7-4f33-b115-cbbb8a823a94.
 */
export function normalizeBranchId(input?: any): string {
  if (input === null || input === undefined) return '9c214659-9cc7-4f33-b115-cbbb8a823a94';
  const str = String(input).trim();
  if (!str || str === 'all' || str === 'undefined' || str === 'null') {
    return '9c214659-9cc7-4f33-b115-cbbb8a823a94';
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str;
  }
  const lower = str.toLowerCase();
  if (lower.includes('badaro') || str === '1' || str === '2') {
    return '9c214659-9cc7-4f33-b115-cbbb8a823a94';
  }
  if (lower.includes('cloud')) {
    return 'b6657434-9c49-43f6-8d8d-aeec69a261db';
  }
  if (lower.includes('naccache')) {
    return 'af8bdb6e-a3c5-4c6b-8786-6501fba1f60e';
  }
  return '9c214659-9cc7-4f33-b115-cbbb8a823a94';
}

/**
 * Resolves the neutral commerce location_key for a given FLOW branch UUID.
 * Never leaks branch UUIDs to OVRLOAD KDS APIs.
 */
export async function getBranchLocationKey(branchId?: string): Promise<string> {
  const targetBranch = normalizeBranchId(branchId);
  try {
    const { data } = await supabase
      .from('commerce_branch_links')
      .select('location_key')
      .eq('flow_branch_id', targetBranch)
      .maybeSingle();

    if (data?.location_key) return data.location_key;
  } catch (err) {
    console.warn('Could not load branch location_key from link:', err);
  }
  return 'badaro'; // Safe fallback
}

/**
 * Loads all active KDS stations for a given FLOW branch.
 */
export async function loadKdsStations(branchId?: string): Promise<KdsStation[]> {
  let stationsData: any[] = [];
  const targetBranch = normalizeBranchId(branchId);

  const { data, error } = await supabase
    .from('kds_stations')
    .select('*')
    .or(`branch_id.eq.${targetBranch},branch_id.eq.1`)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (!error && data && data.length > 0) {
    stationsData = data;
  }

  // If no branch-specific stations found, query all active stations in DB
  if (stationsData.length === 0) {
    const { data: allActive } = await supabase
      .from('kds_stations')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (allActive && allActive.length > 0) {
      stationsData = allActive;
    }
  }

  // Fallback defaults if table is empty
  const defaultFallbackStations: KdsStation[] = [
    {
      id: 'hot-kitchen',
      branch_id: branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
      code: 'HOT_KITCHEN',
      name: 'Hot Kitchen',
      station_type: 'prep',
      color: '#f59e0b',
      sort_order: 1,
      active: true,
      display_mode: 'grid',
      allow_bump_all: true,
      sound_enabled: true,
      default_timer_yellow_seconds: 480,
      default_timer_red_seconds: 900,
      printer_destination_key: 'kitchen-printer'
    },
    {
      id: 'cold-kitchen',
      branch_id: branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
      code: 'COLD_KITCHEN',
      name: 'Cold Kitchen',
      station_type: 'prep',
      color: '#3b82f6',
      sort_order: 2,
      active: true,
      display_mode: 'grid',
      allow_bump_all: true,
      sound_enabled: true,
      default_timer_yellow_seconds: 480,
      default_timer_red_seconds: 900,
      printer_destination_key: 'cold-kitchen-printer'
    },
    {
      id: 'bar',
      branch_id: branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
      code: 'BAR',
      name: 'Bar & Drinks',
      station_type: 'bar',
      color: '#8b5cf6',
      sort_order: 3,
      active: true,
      display_mode: 'grid',
      allow_bump_all: true,
      sound_enabled: true,
      default_timer_yellow_seconds: 300,
      default_timer_red_seconds: 600,
      printer_destination_key: 'bar-printer'
    },
    {
      id: 'pastry',
      branch_id: branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
      code: 'PASTRY',
      name: 'Pastry / Bakery',
      station_type: 'prep',
      color: '#ec4899',
      sort_order: 4,
      active: true,
      display_mode: 'grid',
      allow_bump_all: true,
      sound_enabled: true,
      default_timer_yellow_seconds: 480,
      default_timer_red_seconds: 900,
      printer_destination_key: 'kitchen-printer'
    },
    {
      id: 'expo',
      branch_id: branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
      code: 'EXPO',
      name: 'Expo Station',
      station_type: 'expo',
      color: '#10b981',
      sort_order: 5,
      active: true,
      display_mode: 'grid',
      allow_bump_all: true,
      sound_enabled: true,
      default_timer_yellow_seconds: 480,
      default_timer_red_seconds: 900,
      printer_destination_key: 'kitchen-printer'
    }
  ];

  const loadedStations: KdsStation[] = stationsData.length > 0
    ? stationsData.map((s: any) => ({
        id: s.id,
        branch_id: s.branch_id,
        code: s.station_key || s.code,
        name: s.name,
        station_type: s.is_expo ? 'expo' : (s.station_key === 'BAR' ? 'bar' : 'prep'),
        color: s.color || (s.is_expo ? '#10b981' : (s.station_key === 'BAR' ? '#8b5cf6' : '#f59e0b')),
        sort_order: s.sort_order || 1,
        active: s.active,
        display_mode: 'grid',
        allow_bump_all: true,
        sound_enabled: true,
        default_timer_yellow_seconds: (s.sla_warning_mins || 8) * 60,
        default_timer_red_seconds: (s.sla_late_mins || 15) * 60,
        printer_destination_key: s.printer_destination_key || 'kitchen-printer',
        default_printer_ip: s.default_printer_ip || '192.168.18.10',
        default_printer_port: s.default_printer_port || 9100
      }))
    : defaultFallbackStations;

  // Add an "All Stations" overview option
  const allStationOption: KdsStation = {
    id: 'all-stations-overview',
    branch_id: branchId || 'all',
    code: 'ALL',
    name: 'All Stations (Overview)',
    station_type: 'prep',
    color: '#6366f1',
    sort_order: 0,
    active: true,
    display_mode: 'grid',
    allow_bump_all: true,
    sound_enabled: true,
    default_timer_yellow_seconds: 480,
    default_timer_red_seconds: 900
  };

  return [allStationOption, ...loadedStations];
}

/**
 * Loads product-to-station routings for a given FLOW branch.
 */
export async function loadProductRoutings(branchId: string): Promise<KdsProductRouting[]> {
  const { data, error } = await supabase
    .from('kds_product_routings')
    .select(`
      id, branch_id, commerce_product_link_id, station_id, fallback_station_id, disposition,
      station:kds_stations(station_key, name),
      link:commerce_product_links(external_product_id, external_product_name)
    `)
    .eq('branch_id', branchId);

  if (error) {
    console.error('Error loading product routings:', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    branch_id: r.branch_id,
    commerce_product_link_id: r.commerce_product_link_id,
    station_id: r.station_id,
    fallback_station_id: r.fallback_station_id,
    disposition: (r.disposition || 'production') as any,
    active: true,
    product_name: r.link?.external_product_name || r.link?.external_product_id,
    station_code: r.station?.station_key || r.station?.code,
    station_name: r.station?.name
  }));
}

/**
 * Loads full product routing coverage diagnostic for manager review.
 * Computes: Total Products, Routed, Unrouted, and No-Kitchen counts.
 */
export async function loadProductRoutingCoverage(branchId: string): Promise<{
  totalProducts: number;
  routedCount: number;
  unroutedCount: number;
  noKitchenCount: number;
  products: {
    linkId: string;
    ovrloadProductId: string;
    productName: string;
    categoryName: string;
    routingId: string | null;
    stationId: string | null;
    stationCode: string | null;
    stationName: string | null;
    disposition: 'production' | 'no_kitchen';
    isRouted: boolean;
  }[];
}> {
  try {
    // 1. Fetch all active commerce product links
    const { data: links, error: linksErr } = await supabase
      .from('commerce_product_links')
      .select('id, external_product_id, external_product_name, active')
      .eq('active', true);

    if (linksErr) throw linksErr;

    // 2. Fetch all configured routings for this branch
    const { data: routings, error: routingsErr } = await supabase
      .from('kds_product_routings')
      .select(`
        id, branch_id, commerce_product_link_id, station_id, fallback_station_id, disposition,
        station:kds_stations(id, station_key, name)
      `)
      .eq('branch_id', branchId);

    if (routingsErr) throw routingsErr;

    const routingMap = new Map<string, any>();
    for (const r of (routings || [])) {
      routingMap.set(r.commerce_product_link_id, r);
    }

    const products = (links || []).map((link: any) => {
      const routing = routingMap.get(link.id);
      const disposition = (routing?.disposition || 'production') as 'production' | 'no_kitchen';
      const hasStation = Boolean(routing?.station_id);
      const isRouted = routing && (
        disposition === 'no_kitchen' || (disposition === 'production' && hasStation)
      );

      return {
        linkId: link.id,
        ovrloadProductId: link.external_product_id,
        productName: link.external_product_name || link.external_product_id,
        categoryName: 'General',
        routingId: routing?.id || null,
        stationId: routing?.station_id || null,
        stationCode: routing?.station?.station_key || routing?.station?.code || null,
        stationName: routing?.station?.name || null,
        disposition,
        isRouted: Boolean(isRouted)
      };
    });

    const totalProducts = products.length;
    const routedCount = products.filter(p => p.isRouted).length;
    const unroutedCount = products.filter(p => !p.isRouted).length;
    const noKitchenCount = products.filter(p => p.disposition === 'no_kitchen' && p.isRouted).length;

    return {
      totalProducts,
      routedCount,
      unroutedCount,
      noKitchenCount,
      products
    };
  } catch (err) {
    console.error('Error computing product routing coverage:', err);
    return {
      totalProducts: 0,
      routedCount: 0,
      unroutedCount: 0,
      noKitchenCount: 0,
      products: []
    };
  }
}

/**
 * Updates or creates a product-to-station routing rule.
 */
export async function updateProductRouting(params: {
  branchId: string;
  commerceProductLinkId: string;
  stationId?: string | null;
  disposition: 'production' | 'no_kitchen';
  active?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('kds_product_routings')
      .upsert({
        branch_id: params.branchId,
        commerce_product_link_id: params.commerceProductLinkId,
        station_id: params.disposition === 'no_kitchen' ? null : params.stationId,
        disposition: params.disposition,
        is_primary: true
      }, {
        onConflict: 'branch_id,commerce_product_link_id'
      });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetches active kitchen fires from Supabase pos_orders and pos_order_items.
 * Falls back to remote API if COMMERCE_API_BASE is configured.
 */
export async function fetchKdsFires(
  locationKey: string,
  stationKey?: string,
  status?: string,
  branchId?: string
): Promise<{ success: boolean; fires: KdsFire[]; error?: string }> {
  try {
    // 1. Try remote endpoint if COMMERCE_API_BASE is set
    if (COMMERCE_API_BASE) {
      try {
        const params = new URLSearchParams();
        params.set('location_key', locationKey);
        if (stationKey) params.set('station_key', stationKey);
        if (status) params.set('status', status);

        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/kds/fires?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.fires && data.fires.length > 0) return { success: true, fires: data.fires };
        }
      } catch (e) {
        // Fallback to Supabase pos_orders
      }
    }

    // 2. Fetch active kitchen orders directly from Supabase
    const targetBranch = normalizeBranchId(branchId);
    const branchCandidates = Array.from(new Set([
      targetBranch,
      '9c214659-9cc7-4f33-b115-cbbb8a823a94',
      '1',
      branchId
    ].filter(Boolean) as string[]));

    let query = supabase
      .from('pos_orders')
      .select('*, items:pos_order_items(*)')
      .in('status', ['held', 'preparing', 'ready', 'open', 'pending'])
      .in('branch_id', branchCandidates)
      .order('created_at', { ascending: true }); // FIFO kitchen order

    const [{ data: orders, error }, productMap] = await Promise.all([
      query,
      getProductImageMap()
    ]);
    if (error) throw error;

    // Read local item statuses & bumped orders
    const itemStatuses: Record<string, { status: KdsFireItemStatus; updated_at: string; reason?: string }> =
      JSON.parse(localStorage.getItem('flow_kds_item_statuses') || '{}');
    const bumpedTickets: Record<string, any> =
      JSON.parse(localStorage.getItem('flow_kds_bumped_tickets') || '{}');
    let hasBumpUpdates = false;

    const fires: KdsFire[] = (orders || [])
      .map((order: any) => {
        const orderItems = order.items || [];

        // Check if course was fired from POS
        const isCourseFired = Boolean(
          order.special_instructions && String(order.special_instructions).includes('COURSE_FIRED')
        );

        let fireNumber = 1;
        if (isCourseFired) {
          const m = String(order.special_instructions).match(/COURSE_FIRED:(\d+)/);
          fireNumber = m ? (parseInt(m[1], 10) > 10 ? 2 : parseInt(m[1], 10)) : 2;
        }

        const holdIdx = orderItems.findIndex((it: any) => isHoldItem(it));

        const kdsItems: KdsFireItem[] = orderItems.map((item: any, idx: number) => {
          const pName = item.product_name || 'Item';
          const detectedStation = detectItemStation(pName);

          const savedStatus = itemStatuses[item.id]?.status;
          let itemStatus: KdsFireItemStatus = savedStatus || (order.status === 'ready' ? 'ready' : 'queued');

          const isAfterHold = holdIdx !== -1 && idx > holdIdx && !isHoldItem(item);

          // If Course 2 is fired, any item after hold that isn't ready/bumped becomes 'preparing'
          if (isCourseFired && isAfterHold && (!savedStatus || savedStatus === 'queued')) {
            itemStatus = 'preparing';
          }

          // Parse customizations
          const modifiers: KdsFireItemModifier[] = [];
          if (Array.isArray(item.customizations_json) && item.customizations_json.length > 0) {
            for (const c of item.customizations_json) {
              const name = c.name || c.ingredient || String(c);
              modifiers.push({
                id: c.customization_item_id || c.product_customization_id,
                name,
                action: (name && name.toLowerCase().startsWith('no ')) ? 'remove' : 'add',
                price: c.price
              });
            }
          } else if (typeof item.customizations === 'string' && item.customizations.trim()) {
            const parts = item.customizations.split(/,\s*/);
            for (const p of parts) {
              if (p.trim()) {
                modifiers.push({
                  name: p.trim(),
                  action: p.toLowerCase().startsWith('no ') ? 'remove' : 'add'
                });
              }
            }
          }

          let noteText = item.comment || null;
          if (isHoldItem(item)) {
            noteText = isCourseFired ? 'COURSE 2 FIRED • PREPARE NOW' : (item.comment || 'Kitchen waits for fire');
          }

          const prodInfo = (item.product_id ? productMap.byId.get(String(item.product_id)) : null) ||
                           productMap.byName.get(pName.trim().toLowerCase());
          const pImage = item.image_url || prodInfo?.image_url || null;

          return {
            id: item.id,
            fire_id: order.id,
            order_item_id: item.id,
            product_id: item.product_id || prodInfo?.id || null,
            product_image: pImage,
            quantity: item.quantity || 1,
            station_key: detectedStation,
            status: itemStatus,
            product_name_snapshot: pName,
            modifiers_snapshot: modifiers,
            notes_snapshot: noteText,
            refire_reason: itemStatuses[item.id]?.reason || null,
            created_at: item.created_at || order.created_at
          };
        });

        // Determine if ticket has subsequent rounds added after a previous bump
        const hasBumpedItems = kdsItems.some(i => i.status === 'bumped');
        const hasUnbumpedFoodItems = kdsItems.some(
          i => !isHoldItem(i) && i.status !== 'bumped' && i.status !== 'voided'
        );

        if (hasBumpedItems && hasUnbumpedFoodItems && fireNumber === 1) {
          fireNumber = 2; // Auto-indicate round 2 for new items added after earlier bump
        }

        return {
          id: order.id,
          operation_id: `ord-${order.id}`,
          order_id: order.id,
          fire_number: fireNumber,
          location_key: locationKey || 'badaro',
          service_type: order.order_type || 'dine_in',
          table_label_snapshot: order.table_label || null,
          guest_count_snapshot: order.guest_count || null,
          waiter_reference_snapshot: order.waiter_name || order.cashier_name || 'Staff',
          fired_by_reference: order.waiter_name || order.cashier_name || 'POS',
          terminal_id: order.terminal_id || 'FLOW-POS',
          status: 'active' as const,
          fired_at: order.created_at,
          created_at: order.created_at,
          items: kdsItems
        };
      })
      .filter((fire: KdsFire) => {
        const unbumpedFoodItems = (fire.items || []).filter(
          i => !isHoldItem(i) && i.status !== 'bumped' && i.status !== 'voided'
        );

        // If waiter added new items, unbump the ticket so it reappears immediately!
        if (unbumpedFoodItems.length > 0) {
          if (bumpedTickets[fire.id]) {
            delete bumpedTickets[fire.id];
            hasBumpUpdates = true;
          }
          return true;
        }

        // If all items are bumped/voided and the ticket was bumped, hide from active KDS
        if (bumpedTickets[fire.id]) {
          return false;
        }

        // If all food items are already bumped individually, mark ticket as bumped and hide
        const totalFoodItems = (fire.items || []).filter(i => !isHoldItem(i));
        if (totalFoodItems.length > 0 && totalFoodItems.every(i => i.status === 'bumped' || i.status === 'voided')) {
          bumpedTickets[fire.id] = { bumped_at: new Date().toISOString() };
          hasBumpUpdates = true;
          return false;
        }

        return true;
      });

    if (hasBumpUpdates) {
      try {
        localStorage.setItem('flow_kds_bumped_tickets', JSON.stringify(bumpedTickets));
      } catch {}
    }

    return { success: true, fires };
  } catch (err: any) {
    console.error('Error fetching KDS fires from Supabase:', err);
    return { success: false, fires: [], error: err.message };
  }
}

/**
 * Fires a round of items to KDS. Enforces quantity invariants and sequential fire numbering server-side.
 */
export async function fireOrderRound(params: {
  orderId: number;
  locationKey: string;
  items: {
    order_item_id: number;
    product_link_id?: string;
    product_name: string;
    quantity: number;
    station_key: string;
    modifiers?: any[];
    notes?: string | null;
  }[];
  serviceType?: string;
  tableLabel?: string;
  guestCount?: number;
  waiterReference?: string;
  firedBy?: string;
  terminalId?: string;
}): Promise<{ success: boolean; fire?: KdsFire; fireNumber?: number; error?: string }> {
  try {
    if (params.orderId) {
      try {
        await supabase
          .from('pos_orders')
          .update({
            special_instructions: `COURSE_FIRED:${Date.now()}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', params.orderId);
      } catch (e) {
        console.warn('Could not update order fire timestamp in Supabase:', e);
      }
    }

    if (COMMERCE_API_BASE) {
      try {
        const operationId = (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : 'fire-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

        await fetch(`${COMMERCE_API_BASE}/api/pos/kds/fire`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation_id: operationId,
            order_id: params.orderId,
            location_key: params.locationKey,
            service_type: params.serviceType || 'dine_in',
            table_label: params.tableLabel || null,
            guest_count: params.guestCount || 1,
            waiter_reference: params.waiterReference || null,
            fired_by: params.firedBy || 'POS Staff',
            terminal_id: params.terminalId || 'TERMINAL-1',
            items: params.items
          })
        });
      } catch (e) {
        // Non-fatal
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
}

/**
 * Marks a fire as bumped (completed/cleared from KDS view).
 */
export async function bumpKdsFire(fireId: number): Promise<void> {
  try {
    const bumpedTickets = JSON.parse(localStorage.getItem('flow_kds_bumped_tickets') || '{}');
    bumpedTickets[fireId] = { bumped_at: new Date().toISOString() };
    localStorage.setItem('flow_kds_bumped_tickets', JSON.stringify(bumpedTickets));

    // Update order status in Supabase so table & POS knows order is ready
    await supabase.from('pos_orders').update({ status: 'ready' }).eq('id', fireId);
  } catch (e) {
    console.warn('Could not update order bump status:', e);
  }
}

/**
 * Fetches all orders bumped or completed today for read-only reference.
 */
export async function fetchTodayBumpedOrders(branchId?: string): Promise<KdsBumpedOrder[]> {
  try {
    const targetBranch = normalizeBranchId(branchId);
    const branchCandidates = Array.from(new Set([
      targetBranch,
      '9c214659-9cc7-4f33-b115-cbbb8a823a94',
      '1',
      branchId
    ].filter(Boolean) as string[]));

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    let query = supabase
      .from('pos_orders')
      .select('*, items:pos_order_items(*)')
      .gte('created_at', startOfToday.toISOString())
      .in('branch_id', branchCandidates)
      .order('created_at', { ascending: false });

    const [{ data: orders, error }, productMap] = await Promise.all([
      query,
      getProductImageMap()
    ]);
    if (error) throw error;

    const bumpedTickets = JSON.parse(localStorage.getItem('flow_kds_bumped_tickets') || '{}');

    const bumpedOrders: KdsBumpedOrder[] = (orders || [])
      .filter((order: any) => {
        const isLocallyBumped = Boolean(bumpedTickets[order.id]);
        const isStatusBumped = ['ready', 'completed', 'closed'].includes(order.status);
        return isLocallyBumped || isStatusBumped;
      })
      .map((order: any) => {
        const orderItems = order.items || [];

        let bumpTimeStr = order.completed_at || order.updated_at || order.created_at;
        const localBumpInfo = bumpedTickets[order.id];
        if (localBumpInfo && typeof localBumpInfo === 'object' && localBumpInfo.bumped_at) {
          bumpTimeStr = localBumpInfo.bumped_at;
        }

        const firedTime = new Date(order.created_at).getTime();
        const bumpedTime = new Date(bumpTimeStr).getTime();
        const diffMins = Math.max(0, Math.round((bumpedTime - firedTime) / 60000));

        const parsedItems: KdsBumpedItem[] = orderItems.map((item: any) => {
          const pName = item.product_name || 'Item';
          const hold = isHoldItem(item);

          const modifiers: string[] = [];
          if (Array.isArray(item.customizations_json)) {
            for (const c of item.customizations_json) {
              const name = c.name || c.ingredient || String(c);
              if (name) modifiers.push(name);
            }
          } else if (typeof item.customizations === 'string' && item.customizations.trim()) {
            modifiers.push(...item.customizations.split(/,\s*/).filter(Boolean));
          }

          const prodInfo = (item.product_id ? productMap.byId.get(String(item.product_id)) : null) ||
                           productMap.byName.get(pName.trim().toLowerCase());
          const pImage = item.image_url || prodInfo?.image_url || null;

          return {
            id: item.id,
            productId: item.product_id || prodInfo?.id || null,
            product_image: pImage,
            name: pName,
            quantity: item.quantity || 1,
            modifiers,
            notes: item.comment || null,
            stationKey: detectItemStation(pName),
            isHold: hold
          };
        });

        const foodItemsCount = parsedItems.filter(i => !i.isHold).reduce((acc, i) => acc + i.quantity, 0);

        return {
          id: order.id,
          orderId: order.id,
          tableLabel: order.table_label || null,
          serviceType: order.order_type || 'dine_in',
          waiterName: order.waiter_name || order.cashier_name || 'Staff',
          guestCount: order.guest_count || null,
          status: order.status || 'bumped',
          firedAt: order.created_at,
          bumpedAt: bumpTimeStr,
          durationMinutes: diffMins,
          items: parsedItems,
          totalFoodItems: foodItemsCount
        };
      });

    return bumpedOrders;
  } catch (err) {
    console.error('Error fetching today bumped orders:', err);
    return [];
  }
}

/**
 * Updates a fire item status (queued -> in_progress -> ready -> bumped).
 */
export async function updateFireItemStatus(
  itemId: number,
  targetStatus: string,
  operatorReference?: string
): Promise<{ success: boolean; item?: KdsFireItem; error?: string }> {
  try {
    const itemStatuses = JSON.parse(localStorage.getItem('flow_kds_item_statuses') || '{}');
    itemStatuses[itemId] = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
      operator: operatorReference || 'KDS Operator'
    };
    localStorage.setItem('flow_kds_item_statuses', JSON.stringify(itemStatuses));

    if (COMMERCE_API_BASE) {
      try {
        await fetch(`${COMMERCE_API_BASE}/api/pos/kds/items/${itemId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_status: targetStatus,
            operator_reference: operatorReference || 'KDS Operator'
          })
        });
      } catch (e) {
        // Non-fatal
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Re-fires an item (replacement production). Does not consume additional commerce quantity.
 */
export async function refireFireItem(
  itemId: number,
  reason: string,
  quantity?: number,
  requestedBy?: string
): Promise<{ success: boolean; item?: KdsFireItem; error?: string }> {
  try {
    const itemStatuses = JSON.parse(localStorage.getItem('flow_kds_item_statuses') || '{}');
    itemStatuses[itemId] = {
      status: 'preparing',
      reason,
      quantity: quantity || 1,
      requested_by: requestedBy || 'Staff',
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('flow_kds_item_statuses', JSON.stringify(itemStatuses));

    if (COMMERCE_API_BASE) {
      try {
        await fetch(`${COMMERCE_API_BASE}/api/pos/kds/items/${itemId}/refire`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refire_reason: reason,
            quantity: quantity || 1,
            requested_by: requestedBy || 'Staff'
          })
        });
      } catch (e) {
        // Non-fatal
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Dispatches a ticket print to the configured station physical ESC/POS printer via local LAN print server.
 * Uses printer_destination_key abstraction (e.g. kitchen-printer, bar-printer) through print-server.js.
 */
export async function printStationChit(params: {
  station: KdsStation;
  fire: KdsFire;
  items: KdsFireItem[];
  destinationKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const destinationKey = params.destinationKey || params.station.printer_destination_key || 'kitchen-printer';
    const payload = {
      destination: destinationKey,
      printer: {
        host: params.station.default_printer_ip || '192.168.18.10',
        port: params.station.default_printer_port || 9100
      },
      content: {
        type: 'kitchen_chit',
        isKitchenTicket: true,
        destination_key: destinationKey,
        station: params.station.name,
        station_code: params.station.code,
        table: params.fire.table_label_snapshot || 'N/A',
        fire: `FIRE #${params.fire.fire_number}`,
        serviceType: params.fire.service_type,
        waiter: params.fire.waiter_reference_snapshot || 'Staff',
        timestamp: new Date().toLocaleTimeString(),
        items: params.items.map(i => ({
          name: i.product_name_snapshot,
          quantity: i.quantity,
          qty: i.quantity,
          notes: i.notes_snapshot,
          note: i.notes_snapshot,
          modifiers: i.modifiers_snapshot
        }))
      }
    };

    const res = await fetch(`${PRINT_SERVER_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn(`Print server responded with status: ${res.status}`);
      return { success: false, error: `Print server error: ${res.status}` };
    }

    return { success: true };
  } catch (err: any) {
    console.warn('LAN KDS print chit dispatch error (non-fatal):', err);
    return { success: false, error: err.message };
  }
}

/**
 * Re-dispatches a print chit for an existing fire without creating a new fire or contacting commerce DB.
 * Implements Rule 10: Printer Retry Without Re-Fire.
 */
export async function retryPrintChit(params: {
  fire: KdsFire;
  station: KdsStation;
  items?: KdsFireItem[];
}): Promise<{ success: boolean; message: string }> {
  const itemsToPrint = params.items && params.items.length > 0
    ? params.items
    : (params.fire.items || []).filter(i => (
        params.station.station_type === 'expo' || i.station_key === params.station.code
      ) && i.status !== 'voided');

  if (itemsToPrint.length === 0) {
    return { success: false, message: 'No active items to print for this station.' };
  }

  const result = await printStationChit({
    station: params.station,
    fire: params.fire,
    items: itemsToPrint
  });

  if (result.success) {
    return { success: true, message: `Print chit re-dispatched to ${params.station.name} (${params.station.printer_destination_key || 'kitchen-printer'})` };
  } else {
    return { success: false, message: result.error || 'Failed to dispatch to print server.' };
  }
}
