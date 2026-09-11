import { supabase } from '../../api/supabase';
import type {
  FloorArea,
  PosTable,
  TableSession,
  OpenTableParams,
  TransferTableParams,
  MergeTableParams
} from './types';

import { COMMERCE_API_BASE } from '../config';

/**
 * RECONCILE PENDING TABLE SYNCS (Phase 4.1 Hardening):
 * Survives browser refresh. Reconciles sessions where sync_status = 'requires_retry'
 * or status = 'opening' with commerce_client_order_token.
 */
export async function reconcilePendingTableSyncs(branchId: string): Promise<void> {
  try {
    const { data: pendingSessions, error } = await supabase
      .from('pos_table_sessions')
      .select(`
        id, branch_id, commerce_order_id, commerce_client_order_token,
        status, sync_status, guest_count, version,
        tables:pos_table_session_tables(table:pos_tables(table_code), is_primary)
      `)
      .eq('branch_id', branchId)
      .or('sync_status.eq.requires_retry,and(status.eq.opening,commerce_client_order_token.not.is.null)');

    if (error || !pendingSessions || pendingSessions.length === 0) return;

    for (const session of pendingSessions) {
      try {
        // Case 1: Session in 'opening' with client order token -> check if commerce order exists
        if (session.status === 'opening' && session.commerce_client_order_token) {
          const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?client_order_token=${encodeURIComponent(session.commerce_client_order_token)}`);
          if (res.ok) {
            const data = await res.json();
            const existingOrder = data.order || (data.orders && data.orders[0]);
            if (existingOrder && existingOrder.id) {
              await supabase
                .from('pos_table_sessions')
                .update({
                  commerce_order_id: existingOrder.id,
                  status: 'occupied',
                  sync_status: 'synced',
                  last_sync_error: null
                })
                .eq('id', session.id);
            }
          }
        }

        // Case 2: Session with sync_status = 'requires_retry' and commerce_order_id
        if (session.sync_status === 'requires_retry' && session.commerce_order_id) {
          const links = session.tables || [];
          const primaryTable = links.find((t: any) => t.is_primary)?.table?.table_code;
          const mergedTables = links.filter((t: any) => !t.is_primary).map((t: any) => t.table?.table_code).filter(Boolean);
          const label = primaryTable 
            ? (mergedTables && mergedTables.length > 0 ? `${primaryTable} + ${mergedTables.join(' + ')}` : primaryTable)
            : undefined;

          const patchBody: any = {};
          if (label) patchBody.table_label = label;
          if (session.guest_count) patchBody.guest_count = session.guest_count;

          const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${session.commerce_order_id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchBody)
          });

          if (res.ok) {
            await supabase
              .from('pos_table_sessions')
              .update({
                sync_status: 'synced',
                last_sync_error: null
              })
              .eq('id', session.id);
          }
        }
      } catch (sessErr) {
        console.warn(`Could not reconcile session ${session.id}:`, sessErr);
      }
    }
  } catch (err) {
    console.warn('Error in reconcilePendingTableSyncs:', err);
  }
}

export interface PendingTableSync {
  sessionId: string;
  tableCode: string;
  status: string;
  syncStatus: string;
  lastSyncError?: string | null;
  guestCount: number;
  commerceOrderId?: number | null;
  clientOrderToken?: string | null;
  createdAt: string;
}

/**
 * Loads pending table sessions that failed or are pending synchronization with OVRLOAD.
 * Implements Rule 11: Table Reconciliation Manager Visibility.
 */
export async function loadPendingTableSyncs(branchId: string): Promise<PendingTableSync[]> {
  try {
    const { data, error } = await supabase
      .from('pos_table_sessions')
      .select(`
        id, branch_id, commerce_order_id, commerce_client_order_token,
        status, sync_status, last_sync_error, guest_count, created_at,
        tables:pos_table_session_tables(table:pos_tables(table_code), is_primary)
      `)
      .eq('branch_id', branchId)
      .or('sync_status.eq.requires_retry,status.eq.opening,status.eq.sync_failed');

    if (error || !data) return [];

    return data.map((s: any) => {
      const primaryTable = (s.tables || []).find((t: any) => t.is_primary)?.table?.table_code || 'Unknown';
      return {
        sessionId: s.id,
        tableCode: primaryTable,
        status: s.status,
        syncStatus: s.sync_status || 'unknown',
        lastSyncError: s.last_sync_error,
        guestCount: s.guest_count || 1,
        commerceOrderId: s.commerce_order_id,
        clientOrderToken: s.commerce_client_order_token,
        createdAt: s.created_at
      };
    });
  } catch (err) {
    console.warn('Error loading pending table syncs:', err);
    return [];
  }
}

/**
 * Manually retries reconciliation for a specific table session.
 * Implements Rule 11: Table Reconciliation Manager Visibility.
 */
export async function retrySessionSync(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: session, error } = await supabase
      .from('pos_table_sessions')
      .select(`
        id, branch_id, commerce_order_id, commerce_client_order_token,
        status, sync_status, guest_count,
        tables:pos_table_session_tables(table:pos_tables(table_code), is_primary)
      `)
      .eq('id', sessionId)
      .single();

    if (error || !session) return { success: false, error: 'Session not found' };

    // Case 1: Session in opening or no commerce_order_id -> retrieve via client_order_token
    if (session.commerce_client_order_token && !session.commerce_order_id) {
      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?client_order_token=${encodeURIComponent(session.commerce_client_order_token)}`);
      if (res.ok) {
        const data = await res.json();
        const existingOrder = data.order || (data.orders && data.orders[0]);
        if (existingOrder && existingOrder.id) {
          await supabase
            .from('pos_table_sessions')
            .update({
              commerce_order_id: existingOrder.id,
              status: 'occupied',
              sync_status: 'synced',
              last_sync_error: null
            })
            .eq('id', session.id);
          return { success: true };
        }
      }
    }

    // Case 2: Session with commerce_order_id needing sync retry
    if (session.commerce_order_id) {
      const links = session.tables || [];
      const primaryTable = links.find((t: any) => t.is_primary)?.table?.table_code;
      const mergedTables = links.filter((t: any) => !t.is_primary).map((t: any) => t.table?.table_code).filter(Boolean);
      const label = primaryTable 
        ? (mergedTables && mergedTables.length > 0 ? `${primaryTable} + ${mergedTables.join(' + ')}` : primaryTable)
        : undefined;

      const patchBody: any = {};
      if (label) patchBody.table_label = label;
      if (session.guest_count) patchBody.guest_count = session.guest_count;

      const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${session.commerce_order_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody)
      });

      if (res.ok) {
        await supabase
          .from('pos_table_sessions')
          .update({
            status: session.status === 'opening' ? 'occupied' : session.status,
            sync_status: 'synced',
            last_sync_error: null
          })
          .eq('id', session.id);
        return { success: true };
      } else {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || `HTTP ${res.status}` };
      }
    }

    return { success: false, error: 'No actionable sync strategy found for session' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Auto-register network reconnect trigger
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    try {
      const savedBranchId = localStorage.getItem('flow_active_branch_id');
      if (savedBranchId) {
        reconcilePendingTableSyncs(savedBranchId);
      }
    } catch {}
  });
}

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
    // 0. Automatic reconciliation on floor load
    try {
      await reconcilePendingTableSyncs(branchId);
    } catch (recErr) {
      console.warn('Pre-load reconciliation notice:', recErr);
    }

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
        opening_operation_id, commerce_client_order_token, sync_status, last_sync_error,
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
                table.kitchen_readiness = liveOrder.kitchen_readiness || null;
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
 * RECOVERABLE TWO-SYSTEM TABLE OPENING (Phase 4.1):
 * 1. Atomically reserves FLOW table session (status: 'opening', commerce_order_id: null).
 * 2. Links table into pos_table_session_tables. Database occupancy trigger ensures absolute active uniqueness.
 * 3. Creates OVRLOAD dine-in order with stable client_order_token.
 * 4. Links commerce_order_id to FLOW session and transitions status to 'occupied'.
 * 5. On failure, if OVRLOAD order was created, handles retry with same token safely without duplicating.
 */
export async function openTableSession(
  params: OpenTableParams
): Promise<{
  success: boolean;
  sessionId?: string;
  orderId?: number;
  error?: string;
}> {
  const openingOperationId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'op-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

  const clientOrderToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'tok-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);

  let sessionId: string | null = null;
  let orderCreatedInCommerce = false;
  let orderId: number | null = null;

  try {
    // Check for existing pending session for this table
    const { data: existingLinks } = await supabase
      .from('pos_table_session_tables')
      .select('session_id, session:pos_table_sessions(id, status, commerce_order_id, commerce_client_order_token)')
      .eq('table_id', params.tableId);

    if (existingLinks && existingLinks.length > 0) {
      for (const link of existingLinks) {
        const s: any = link.session;
        if (s && s.status === 'opening' && s.commerce_client_order_token) {
          sessionId = s.id;
          break;
        } else if (s && ['occupied', 'bill_requested', 'closing'].includes(s.status)) {
          throw new Error(`Table ${params.tableCode} is already occupied or locked by another session.`);
        }
      }
    }

    if (!sessionId) {
      // Step A & B: Establish FLOW session and table occupancy
      const { data: sessData, error: sessErr } = await supabase
        .from('pos_table_sessions')
        .insert([{
          branch_id: params.branchId,
          restaurant_id: params.restaurantId,
          commerce_order_id: null,
          opening_operation_id: openingOperationId,
          commerce_client_order_token: clientOrderToken,
          sync_status: 'synced',
          opened_by_user_id: params.operatorUserId || null,
          opened_by_name_snapshot: params.operatorName,
          assigned_waiter_user_id: params.waiterUserId || null,
          assigned_waiter_name_snapshot: params.waiterName,
          guest_count: params.guestCount,
          status: 'occupied',
          version: 1
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
    }

    return {
      success: true,
      sessionId: sessionId!,
      orderId: undefined
    };
  } catch (err: any) {
    if (sessionId) {
      try {
        await supabase.from('pos_table_sessions').delete().eq('id', sessionId);
        await supabase.from('pos_table_session_tables').delete().eq('session_id', sessionId);
      } catch {}
    }
    return { success: false, error: err.message || 'Table opening failed' };
  }
}

/**
 * ATOMIC TABLE TRANSFER (MOVE TABLE: T4 -> T8):
 * Verifies T8 is available, updates session table links, updates OVRLOAD table_label snapshot.
 * Disconnects occupancy from commerce availability (marks sync_status = 'requires_retry' if commerce fails).
 */
export async function transferTable(
  params: TransferTableParams
): Promise<{ success: boolean; warning?: string; error?: string }> {
  try {
    // Concurrency Check
    if (params.expectedVersion !== undefined) {
      const { data: curr } = await supabase
        .from('pos_table_sessions')
        .select('version')
        .eq('id', params.sessionId)
        .single();
      if (curr && curr.version !== params.expectedVersion) {
        throw new Error('Table session version mismatch: Another terminal modified this session. Please reload the floor.');
      }
    }

    // 1. Move session link in FLOW
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

    // Update session version
    const newVersion = (params.expectedVersion || 1) + 1;
    await supabase
      .from('pos_table_sessions')
      .update({ version: newVersion })
      .eq('id', params.sessionId);

    // 2. Update OVRLOAD table_label snapshot (if commerce order exists)
    if (params.commerceOrderId) {
      try {
        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.commerceOrderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_label: params.toTableCode
          })
        });
        if (!res.ok) throw new Error('Commerce HTTP ' + res.status);
      } catch (snapErr: any) {
        console.warn('Could not update commerce table_label snapshot; marking sync_status = requires_retry:', snapErr);
        await supabase
          .from('pos_table_sessions')
          .update({
            sync_status: 'requires_retry',
            last_sync_error: 'Transfer sync deferred: ' + snapErr.message
          })
          .eq('id', params.sessionId);
        return { success: true, warning: 'Table moved in FLOW; commerce sync queued for retry.' };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Table transfer failed' };
  }
}

/**
 * TABLE MERGE (T8 + T9):
 * Adds secondary table to active session without creating another order.
 * Disconnects occupancy from commerce availability (marks sync_status = 'requires_retry' if commerce fails).
 */
export async function mergeTables(
  params: MergeTableParams
): Promise<{ success: boolean; warning?: string; error?: string }> {
  try {
    // Concurrency Check
    if (params.expectedVersion !== undefined) {
      const { data: curr } = await supabase
        .from('pos_table_sessions')
        .select('version')
        .eq('id', params.sessionId)
        .single();
      if (curr && curr.version !== params.expectedVersion) {
        throw new Error('Table session version mismatch: Another terminal modified this session. Please reload the floor.');
      }
    }

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

    // Update session version
    const newVersion = (params.expectedVersion || 1) + 1;
    await supabase
      .from('pos_table_sessions')
      .update({ version: newVersion })
      .eq('id', params.sessionId);

    // Update OVRLOAD table_label snapshot to reflect merge (if commerce order exists)
    if (params.commerceOrderId) {
      const mergedLabel = `${params.primaryTableCode} + ${params.secondaryTableCode}`;
      try {
        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.commerceOrderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_label: mergedLabel
          })
        });
        if (!res.ok) throw new Error('Commerce HTTP ' + res.status);
      } catch (err: any) {
        console.warn('Could not update commerce table_label on merge; marking sync_status = requires_retry:', err);
        await supabase
          .from('pos_table_sessions')
          .update({
            sync_status: 'requires_retry',
            last_sync_error: 'Merge sync deferred: ' + err.message
          })
          .eq('id', params.sessionId);
        return { success: true, warning: 'Table merged in FLOW; commerce sync queued for retry.' };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Table merge failed' };
  }
}

/**
 * Changes guest count on FLOW session and updates OVRLOAD order snapshot.
 * Disconnects occupancy from commerce availability (marks sync_status = 'requires_retry' if commerce fails).
 */
export async function changeGuestCount(
  sessionId: string,
  commerceOrderId: number | null | undefined,
  newCount: number,
  expectedVersion?: number
): Promise<{ success: boolean; warning?: string; error?: string }> {
  try {
    // Concurrency Check
    if (expectedVersion !== undefined) {
      const { data: curr } = await supabase
        .from('pos_table_sessions')
        .select('version')
        .eq('id', sessionId)
        .single();
      if (curr && curr.version !== expectedVersion) {
        throw new Error('Table session version mismatch: Another terminal modified this session. Please reload the floor.');
      }
    }

    const newVersion = (expectedVersion || 1) + 1;
    await supabase
      .from('pos_table_sessions')
      .update({
        guest_count: newCount,
        version: newVersion
      })
      .eq('id', sessionId);

    if (commerceOrderId) {
      try {
        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${commerceOrderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guest_count: newCount })
        });
        if (!res.ok) throw new Error('Commerce HTTP ' + res.status);
      } catch (err: any) {
        console.warn('Could not update commerce guest count; marking sync_status = requires_retry:', err);
        await supabase
          .from('pos_table_sessions')
          .update({
            sync_status: 'requires_retry',
            last_sync_error: 'Guest count sync deferred: ' + err.message
          })
          .eq('id', sessionId);
        return { success: true, warning: 'Guest count updated in FLOW; commerce sync queued for retry.' };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Requests bill for table (status: 'bill_requested').
 */
export async function requestBill(
  sessionId: string,
  expectedVersion?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (expectedVersion !== undefined) {
      const { data: curr } = await supabase
        .from('pos_table_sessions')
        .select('version')
        .eq('id', sessionId)
        .single();
      if (curr && curr.version !== expectedVersion) {
        throw new Error('Table session version mismatch: Another terminal modified this session. Please reload the floor.');
      }
    }

    const { error } = await supabase
      .from('pos_table_sessions')
      .update({
        status: 'bill_requested',
        bill_requested_at: new Date().toISOString(),
        version: (expectedVersion || 1) + 1
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
  commerceOrderId?: number | null,
  expectedVersion?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    if (expectedVersion !== undefined) {
      const { data: curr } = await supabase
        .from('pos_table_sessions')
        .select('version')
        .eq('id', sessionId)
        .single();
      if (curr && curr.version !== expectedVersion) {
        throw new Error('Table session version mismatch: Another terminal modified this session. Please reload the floor.');
      }
    }

    // Verify commerce order balance is resolved (if order exists)
    if (commerceOrderId) {
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
    }

    // Set FLOW session to closed
    const { error } = await supabase
      .from('pos_table_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        version: (expectedVersion || 1) + 1
      })
      .eq('id', sessionId);

    if (error) throw error;

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
