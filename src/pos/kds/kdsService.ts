import { supabase } from '../../api/supabase';
import type {
  KdsStation,
  KdsFire,
  KdsFireItem,
  KdsProductRouting
} from './types';

const COMMERCE_API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OVRLOAD_API_URL)
    ? import.meta.env.VITE_OVRLOAD_API_URL
    : 'https://ovrload-backend-production.up.railway.app'
).replace(/\/+$/, '');

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
  return data || [];
}

/**
 * Loads product-to-station routings for a given FLOW branch.
 */
export async function loadProductRoutings(branchId: string): Promise<KdsProductRouting[]> {
  const { data, error } = await supabase
    .from('kds_product_routings')
    .select(`
      id, branch_id, commerce_product_link_id, station_id, fallback_station_id, active,
      station:kds_stations(code, name),
      link:commerce_product_links(ovrload_product_id)
    `)
    .eq('branch_id', branchId)
    .eq('active', true);

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
    active: r.active,
    station_code: r.station?.code,
    station_name: r.station?.name
  }));
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
 */
export async function printStationChit(params: {
  station: KdsStation;
  fire: KdsFire;
  items: KdsFireItem[];
}): Promise<void> {
  if (!params.station.default_printer_ip) return;
  try {
    const payload = {
      printer: {
        host: params.station.default_printer_ip,
        port: params.station.default_printer_port || 9100
      },
      content: {
        type: 'kitchen_chit',
        station: params.station.name,
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
    await fetch(`${PRINT_SERVER_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('LAN KDS print chit dispatch error (non-fatal):', err);
  }
}
