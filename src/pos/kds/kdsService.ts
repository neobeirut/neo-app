import { supabase } from '../../api/supabase';
import type {
  KdsStation,
  KdsFire,
  KdsFireItem,
  KdsProductRouting
} from './types';

import { COMMERCE_API_BASE } from '../config';

const PRINT_SERVER_URL = 'http://192.168.18.195:9191';

/**
 * Resolves the neutral commerce location_key for a given FLOW branch UUID.
 * Never leaks branch UUIDs to OVRLOAD KDS APIs.
 */
export async function getBranchLocationKey(branchId: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('commerce_branch_links')
      .select('location_key')
      .eq('flow_branch_id', branchId)
      .single();

    if (data?.location_key) return data.location_key;
  } catch (err) {
    console.warn('Could not load branch location_key from link:', err);
  }
  return 'badaro'; // Safe fallback
}

/**
 * Loads all active KDS stations for a given FLOW branch.
 */
export async function loadKdsStations(branchId: string): Promise<KdsStation[]> {
  const { data, error } = await supabase
    .from('kds_stations')
    .select('*')
    .eq('branch_id', branchId)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error loading KDS stations:', error);
    return [];
  }
  return (data || []).map((s: any) => ({
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
  }));
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
 * Fetches active kitchen fires from OVRLOAD using neutral location_key and station_key.
 */
export async function fetchKdsFires(
  locationKey: string,
  stationKey?: string,
  status?: string
): Promise<{ success: boolean; fires: KdsFire[]; error?: string }> {
  try {
    const params = new URLSearchParams();
    params.set('location_key', locationKey);
    if (stationKey) params.set('station_key', stationKey);
    if (status) params.set('status', status);

    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/kds/fires?${params.toString()}`);
    if (!res.ok) throw new Error(`Failed to fetch fires: HTTP ${res.status}`);
    const data = await res.json();
    return { success: true, fires: data.fires || [] };
  } catch (err: any) {
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
    const operationId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'fire-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/kds/fire`, {
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

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fire kitchen round');
    }

    return {
      success: true,
      fire: data.fire,
      fireNumber: data.fireNumber
    };
  } catch (err: any) {
    return { success: false, error: err.message };
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
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/kds/items/${itemId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_status: targetStatus,
        operator_reference: operatorReference || 'KDS Operator'
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update item status');
    }

    return { success: true, item: data.item };
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
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/kds/items/${itemId}/refire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refire_reason: reason,
        quantity: quantity || 1,
        requested_by: requestedBy || 'Staff'
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to refire item');
    }

    return { success: true, item: data.item };
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
          notes: i.notes_snapshot,
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
