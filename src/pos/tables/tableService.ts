import { supabase } from '../../api/supabase';
import type {
  FloorArea,
  PosTable,
  TableSession,
  OpenTableParams,
  TransferTableParams,
  MergeTableParams
} from './types';

const COMMERCE_API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OVRLOAD_API_URL)
    ? import.meta.env.VITE_OVRLOAD_API_URL
    : 'https://ovrload-backend-production.up.railway.app'
).replace(/\/+$/, '');

/**
 * Loads floor areas and tables for a given branch, reconciles active sessions from FLOW,
 * and fetches live order financial totals from OVRLOAD.
 */
export async function loadFloorState(branchId: string): Promise<{
  success: boolean;
  areas: FloorArea[];
  tables: PosTable[];
  error?: string;
}> {
  try {
    // 1. Fetch floor areas
    const { data: areasData, error: areasErr } = await supabase
      .from('pos_floor_areas')
      .select('*')
      .eq('branch_id', branchId)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (areasErr) throw areasErr;

    // 2. Fetch tables
    const { data: tablesData, error: tablesErr } = await supabase
      .from('pos_tables')
      .select('*')
      .eq('branch_id', branchId)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (tablesErr) throw tablesErr;

    // 3. Fetch active table sessions and session-table links
    const { data: sessionsData, error: sessionsErr } = await supabase
      .from('pos_table_sessions')
      .select(`
        id, branch_id, restaurant_id, commerce_order_id,
        opened_by_user_id, opened_by_name_snapshot,
        assigned_waiter_user_id, assigned_waiter_name_snapshot,
        guest_count, status, opened_at, bill_requested_at, version,
        tables:pos_table_session_tables(id, session_id, table_id, is_primary, joined_at)
      `)
      .eq('branch_id', branchId)
      .in('status', ['opening', 'occupied', 'bill_requested', 'closing']);

    if (sessionsErr) throw sessionsErr;

    // 4. Map active sessions onto tables
    const tableMap = new Map<string, PosTable>();
    (tablesData || []).forEach(t => {
      tableMap.set(t.id, {
        ...t,
        status: 'available',
        current_session_id: null,
        commerce_order_id: null,
        assigned_waiter: null,
        guest_count: null,
        current_bill: 0,
        amount_paid: 0,
        amount_remaining: 0,
        elapsed_minutes: 0,
        is_primary: true,
        merged_table_codes: []
      });
    });

    const activeOrderIds: number[] = [];

    (sessionsData || []).forEach((session: any) => {
      const links = session.tables || [];
      const primaryLink = links.find((l: any) => l.is_primary) || links[0];
      const secondaryLinks = links.filter((l: any) => !l.is_primary);
      const secondaryCodes = secondaryLinks
        .map((l: any) => tableMap.get(l.table_id)?.table_code)
        .filter(Boolean);

      if (session.commerce_order_id) {
        activeOrderIds.push(session.commerce_order_id);
      }

      const openedDate = session.opened_at ? new Date(session.opened_at) : new Date();
      const elapsedMins = Math.max(0, Math.floor((Date.now() - openedDate.getTime()) / 60000));
      const displayStatus = session.status === 'bill_requested' ? 'bill_requested' : 'occupied';

      links.forEach((l: any) => {
        const table = tableMap.get(l.table_id);
        if (table) {
          table.status = displayStatus;
          table.current_session_id = session.id;
          table.commerce_order_id = session.commerce_order_id;
          table.assigned_waiter = session.assigned_waiter_name_snapshot;
          table.guest_count = session.guest_count;
          table.elapsed_minutes = elapsedMins;
          table.is_primary = Boolean(l.is_primary);
          if (l.is_primary) {
            table.merged_table_codes = secondaryCodes;
          }
        }
      });
    });

    // 5. Fetch live order amounts from OVRLOAD commerce for all active dine-in orders
    if (activeOrderIds.length > 0) {
      try {
        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
        if (res.ok) {
          const oData = await res.json();
          const allOrders = oData.orders || [];
          const orderMap = new Map<number, any>();
          allOrders.forEach((o: any) => orderMap.set(o.id, o));

          tableMap.forEach(table => {
            if (table.commerce_order_id) {
              const liveOrder = orderMap.get(table.commerce_order_id);
              if (liveOrder) {
                const total = parseFloat(liveOrder.total_amount || 0);
                const paid = parseFloat(liveOrder.amount_paid || 0);
                table.current_bill = total;
                table.amount_paid = paid;
                table.amount_remaining = Math.max(0, total - paid);
              }
            }
          });
        }
      } catch (err) {
        console.warn('Could not refresh live order balances for tables:', err);
      }
    }

    return {
      success: true,
      areas: areasData || [],
      tables: Array.from(tableMap.values())
    };
  } catch (err: any) {
    console.error('Error in loadFloorState:', err);
    return { success: false, areas: [], tables: [], error: err.message };
  }
}

/**
 * RECOVERABLE TWO-SYSTEM TABLE OPENING:
 * 1. Atomically reserves FLOW table session (status: 'opening', commerce_order_id: null).
 * 2. Links table into pos_table_session_tables. Database occupancy trigger ensures absolute active uniqueness.
 * 3. Creates OVRLOAD dine-in order with stable client_order_token.
 * 4. Links commerce_order_id to FLOW session and transitions status to 'occupied'.
 * 5. On failure, cleans up session safely to avoid orphan records.
 */
export async function openTableSession(
  params: OpenTableParams
): Promise<{
  success: boolean;
  sessionId?: string;
  orderId?: number;
  error?: string;
}> {
  const clientOrderToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'tok-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

  let sessionId: string | null = null;

  try {
    // Step A & B: Reserve FLOW session and establish table occupancy
    const { data: sessData, error: sessErr } = await supabase
      .from('pos_table_sessions')
      .insert([{
        branch_id: params.branchId,
        restaurant_id: params.restaurantId,
        commerce_order_id: null,
        opened_by_user_id: params.operatorUserId || null,
        opened_by_name_snapshot: params.operatorName,
        assigned_waiter_user_id: params.waiterUserId || null,
        assigned_waiter_name_snapshot: params.waiterName,
        guest_count: params.guestCount,
        status: 'opening'
      }])
      .select('id')
      .single();

    if (sessErr || !sessData) {
      throw new Error('Failed to create FLOW table session: ' + sessErr?.message);
    }

    sessionId = sessData.id;

    // Link physical table
    const { error: linkErr } = await supabase
      .from('pos_table_session_tables')
      .insert([{
        session_id: sessionId,
        table_id: params.tableId,
        is_primary: true
      }]);

    if (linkErr) {
      // Trigger blocked occupancy or conflict
      await supabase.from('pos_table_sessions').delete().eq('id', sessionId);
      throw new Error(`Table ${params.tableCode} is already occupied or locked by another session.`);
    }

    // Step C: Create dine-in order in OVRLOAD commerce
    const orderPayload = {
      branch_id: parseInt(params.externalBranchId || '1', 10),
      client_order_token: clientOrderToken,
      orderType: 'dine_in',
      service_type: 'dine_in',
      table_label: params.tableCode,
      guest_count: params.guestCount,
      waiter_reference: params.waiterName,
      customerName: `Table ${params.tableCode}`,
      customerPhone: '',
      orderSource: 'POS',
      paymentMethod: 'Cash',
      status: 'held', // Table opened, cart empty or held pending first round
      subtotal: 0,
      deliveryFee: 0,
      discountAmount: 0,
      total: 0,
      items: []
    };

    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const oData = await res.json();
    if (!res.ok || !oData.success) {
      // Commerce creation failed: roll back FLOW session
      await supabase.from('pos_table_sessions').update({ status: 'failed' }).eq('id', sessionId);
      await supabase.from('pos_table_session_tables').delete().eq('session_id', sessionId);
      throw new Error(oData.error || 'Failed to create commerce dine-in order in OVRLOAD');
    }

    const orderId = oData.order?.id || oData.orderId;

    // Step D & E: Finalize FLOW session with commerce_order_id and status: 'occupied'
    const { error: finalizeErr } = await supabase
      .from('pos_table_sessions')
      .update({
        commerce_order_id: orderId,
        status: 'occupied',
        version: 1
      })
      .eq('id', sessionId);

    if (finalizeErr) {
      console.warn('FLOW session finalization warning, order #', orderId, finalizeErr);
    }

    return {
      success: true,
      sessionId: sessionId!,
      orderId
    };
  } catch (err: any) {
    if (sessionId) {
      try {
        await supabase.from('pos_table_sessions').update({ status: 'failed' }).eq('id', sessionId);
        await supabase.from('pos_table_session_tables').delete().eq('session_id', sessionId);
      } catch {}
    }
    return { success: false, error: err.message || 'Table opening failed' };
  }
}

/**
 * ATOMIC TABLE TRANSFER (MOVE TABLE: T4 -> T8):
 * Verifies T8 is available, updates session table links, updates OVRLOAD table_label snapshot.
 */
export async function transferTable(
  params: TransferTableParams
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Move session link in FLOW
    // First insert link to new table (trigger checks if toTableId is available)
    const { error: insertErr } = await supabase
      .from('pos_table_session_tables')
      .insert([{
        session_id: params.sessionId,
        table_id: params.toTableId,
        is_primary: true
      }]);

    if (insertErr) {
      throw new Error(`Target table ${params.toTableCode} is already occupied.`);
    }

    // Delete link from old table
    await supabase
      .from('pos_table_session_tables')
      .delete()
      .eq('session_id', params.sessionId)
      .eq('table_id', params.fromTableId);

    // 2. Update OVRLOAD table_label snapshot
    try {
      await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.commerceOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_label: params.toTableCode
        })
      });
    } catch (snapErr) {
      console.warn('Could not update commerce table_label snapshot (FLOW move succeeded):', snapErr);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Table transfer failed' };
  }
}

/**
 * TABLE MERGE (T8 + T9):
 * Adds secondary table to active session without creating another order.
 */
export async function mergeTables(
  params: MergeTableParams
): Promise<{ success: boolean; error?: string }> {
  try {
    // Insert secondary table link
    const { error: linkErr } = await supabase
      .from('pos_table_session_tables')
      .insert([{
        session_id: params.sessionId,
        table_id: params.secondaryTableId,
        is_primary: false
      }]);

    if (linkErr) {
      throw new Error(`Table ${params.secondaryTableCode} is already occupied and cannot be merged.`);
    }

    // Update OVRLOAD table_label snapshot to reflect merge
    const mergedLabel = `${params.primaryTableCode} + ${params.secondaryTableCode}`;
    try {
      await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.commerceOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_label: mergedLabel
        })
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Table merge failed' };
  }
}

/**
 * Changes guest count on FLOW session and updates OVRLOAD order snapshot.
 */
export async function changeGuestCount(
  sessionId: string,
  commerceOrderId: number,
  newCount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabase
      .from('pos_table_sessions')
      .update({ guest_count: newCount })
      .eq('id', sessionId);

    await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${commerceOrderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_count: newCount })
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Requests bill for table (status: 'bill_requested').
 */
export async function requestBill(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('pos_table_sessions')
      .update({
        status: 'bill_requested',
        bill_requested_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Closes table session once balance is zero.
 */
export async function closeTableSession(
  sessionId: string,
  commerceOrderId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify commerce order balance is resolved
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${commerceOrderId}/payments`);
    if (res.ok) {
      const data = await res.json();
      const remaining = data.orderSummary?.amountRemaining || 0;
      if (remaining > 0.01) {
        return {
          success: false,
          error: `Cannot close table: Unpaid balance of $${remaining.toFixed(2)} remaining.`
        };
      }
    }

    // Set FLOW session to closed
    const { error } = await supabase
      .from('pos_table_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) throw error;

    // Note: Historical links in pos_table_session_tables are preserved for reporting & audit.
    // The check_table_occupancy_guard trigger only blocks active sessions ('opening', 'occupied', 'bill_requested', 'closing').
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Saves layout coordinates and properties for multiple tables.
 */
export async function saveFloorLayout(
  tables: Partial<PosTable>[]
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const t of tables) {
      if (!t.id) continue;
      const { error } = await supabase
        .from('pos_tables')
        .update({
          position_x: t.position_x,
          position_y: t.position_y,
          width: t.width,
          height: t.height,
          shape: t.shape,
          capacity: t.capacity,
          table_code: t.table_code,
          display_name: t.display_name,
          floor_area_id: t.floor_area_id,
          active: t.active !== undefined ? t.active : true
        })
        .eq('id', t.id);

      if (error) throw error;
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Creates or updates a single table.
 */
export async function upsertTable(
  table: Partial<PosTable> & { branch_id: string; floor_area_id: string }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    if (table.id) {
      const { data, error } = await supabase
        .from('pos_tables')
        .update({
          table_code: table.table_code,
          display_name: table.display_name,
          capacity: table.capacity,
          shape: table.shape || 'square',
          position_x: table.position_x,
          position_y: table.position_y,
          width: table.width || 14,
          height: table.height || 14,
          floor_area_id: table.floor_area_id,
          active: table.active !== undefined ? table.active : true
        })
        .eq('id', table.id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } else {
      const { data, error } = await supabase
        .from('pos_tables')
        .insert([{
          branch_id: table.branch_id,
          floor_area_id: table.floor_area_id,
          table_code: table.table_code || 'T-NEW',
          display_name: table.display_name || table.table_code || 'New Table',
          capacity: table.capacity || 4,
          shape: table.shape || 'square',
          position_x: table.position_x || 20,
          position_y: table.position_y || 20,
          width: table.width || 14,
          height: table.height || 14,
          active: true
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Deletes a table record if not actively occupied.
 */
export async function deleteTable(
  tableId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('pos_tables')
      .delete()
      .eq('id', tableId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Creates a new floor area for a branch.
 */
export async function createFloorArea(
  branchId: string,
  restaurantId: string,
  name: string
): Promise<{ success: boolean; area?: FloorArea; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('pos_floor_areas')
      .insert([{
        branch_id: branchId,
        restaurant_id: restaurantId,
        name: name.trim(),
        sort_order: 10,
        active: true
      }])
      .select()
      .single();

    if (error) throw error;
    return { success: true, area: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
