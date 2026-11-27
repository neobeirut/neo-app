import { supabase, getGlobalRestaurantId } from '../../api/supabase';
import { createDirectOrder, updateDirectOrderStatus } from './posOrderService';
import { COMMERCE_API_BASE, HAS_COMMERCE_API } from '../config';
import { closeTableSession } from '../tables/tableService';
import { fireOrderRound } from '../kds';

export type SyncTaskType = 'payment' | 'hold' | 'fire' | 'table_close';

export interface SyncTask {
  id: string;
  type: SyncTaskType;
  payload: any;
  createdAt: string;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
}

const QUEUE_STORAGE_KEY = 'flow_pos_background_sync_queue';
let isProcessing = false;

export function getSyncQueue(): SyncTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[BackgroundSync] Failed to read queue:', e);
    return [];
  }
}

export function saveSyncQueue(queue: SyncTask[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    notifySyncStatus();
  } catch (e) {
    console.warn('[BackgroundSync] Failed to save queue:', e);
  }
}

export function notifySyncStatus(): void {
  if (typeof window === 'undefined') return;
  const queue = getSyncQueue();
  const pendingCount = queue.filter(t => t.status === 'pending' || t.status === 'failed').length;
  window.dispatchEvent(
    new CustomEvent('flow:background_sync_status', {
      detail: {
        pendingCount,
        isSyncing: isProcessing,
        totalQueue: queue.length
      }
    })
  );
}

/**
 * Enqueue a task for background processing and immediately trigger queue execution.
 */
export function enqueueSyncTask(type: SyncTaskType, payload: any): SyncTask {
  const task: SyncTask = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending'
  };

  const queue = getSyncQueue();
  queue.push(task);
  saveSyncQueue(queue);

  // Trigger non-blocking background queue execution
  setTimeout(() => {
    processSyncQueue().catch(err => {
      console.warn('[BackgroundSync] Queue runner error:', err);
    });
  }, 10);

  return task;
}

function updateTaskInQueue(taskId: string, updater: (t: SyncTask) => SyncTask): void {
  const current = getSyncQueue();
  const next = current.map(t => (t.id === taskId ? updater(t) : t));
  saveSyncQueue(next);
}

function removeTaskFromQueue(taskId: string): void {
  const current = getSyncQueue();
  const next = current.filter(t => t.id !== taskId);
  saveSyncQueue(next);
}

/**
 * Process all pending background tasks in sequence without blocking UI.
 * Always reads fresh queue state around every async boundary so tasks
 * enqueued while syncing are never overwritten or lost.
 */
export async function processSyncQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  notifySyncStatus();

  try {
    const processedInThisPass = new Set<string>();

    while (true) {
      const queue = getSyncQueue();
      const nextTask = queue.find(
        t =>
          !processedInThisPass.has(t.id) &&
          (t.status === 'pending' || (t.status === 'failed' && (t.attempts || 0) < 10))
      );
      if (!nextTask) break;

      processedInThisPass.add(nextTask.id);
      updateTaskInQueue(nextTask.id, t => ({
        ...t,
        status: 'syncing',
        attempts: (t.attempts || 0) + 1
      }));

      try {
        let success = false;
        switch (nextTask.type) {
          case 'payment':
            success = await executePaymentSync(nextTask.payload);
            break;
          case 'hold':
            success = await executeHoldSync(nextTask.payload);
            break;
          case 'fire':
            success = await executeFireSync(nextTask.payload);
            break;
          case 'table_close':
            success = await executeTableCloseSync(nextTask.payload);
            break;
          default:
            console.warn(`[BackgroundSync] Unknown task type: ${nextTask.type}`);
            success = true; // remove unrecognized task
        }

        if (success) {
          removeTaskFromQueue(nextTask.id);
        } else {
          updateTaskInQueue(nextTask.id, t => ({
            ...t,
            status: 'failed',
            lastError: 'Sync returned unsuccessful status'
          }));
        }
      } catch (err: any) {
        console.warn(`[BackgroundSync] Error syncing task ${nextTask.id} (${nextTask.type}):`, err);
        updateTaskInQueue(nextTask.id, t => ({
          ...t,
          status: 'failed',
          lastError: err?.message || String(err)
        }));
      }
    }
  } finally {
    isProcessing = false;
    notifySyncStatus();
  }
}

async function executePaymentSync(p: any): Promise<boolean> {
  const {
    targetOrderId,
    directPayload,
    isDineIn,
    settledSessionId,
    settledTableId,
    settledTableCode,
    isAdvancePayment,
    shiftCashMovement
  } = p;

  let completedOrderId = targetOrderId;

  // 1. Update existing order or create new order
  if (targetOrderId && (!String(targetOrderId).startsWith('TMP-') && !String(targetOrderId).startsWith('local-'))) {
    const updateRes = await updateDirectOrderStatus(targetOrderId, directPayload);
    if (!updateRes.success) {
      console.warn('[BackgroundSync] Update order warning:', updateRes.error);
    }
  } else {
    const createRes = await createDirectOrder(directPayload);
    if (!createRes.success) {
      throw new Error(createRes.error || 'Failed to create order on server');
    }
    completedOrderId = createRes.order?.id || createRes.orderId;
  }

  // 2. Table closure
  if (isDineIn && !isAdvancePayment) {
    try {
      if (settledSessionId) {
        await closeTableSession(settledSessionId, completedOrderId ? Number(completedOrderId) : undefined).catch(() => {});
      }
      if (completedOrderId) {
        await supabase
          .from('pos_table_sessions')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString()
          })
          .eq('commerce_order_id', completedOrderId)
          .in('status', ['opening', 'occupied', 'bill_requested', 'closing']);
      }
      if (settledTableId) {
        const { data: sessionLinks } = await supabase
          .from('pos_table_session_tables')
          .select('session_id')
          .eq('table_id', settledTableId);
        if (sessionLinks && sessionLinks.length > 0) {
          const sIds = sessionLinks.map((s: any) => s.session_id);
          await supabase
            .from('pos_table_sessions')
            .update({
              status: 'closed',
              closed_at: new Date().toISOString()
            })
            .in('id', sIds)
            .in('status', ['opening', 'occupied', 'bill_requested', 'closing']);
        }
      } else if (settledTableCode) {
        const { data: tbl } = await supabase
          .from('pos_tables')
          .select('id')
          .eq('table_code', settledTableCode)
          .maybeSingle();
        if (tbl?.id) {
          const { data: sessionLinks } = await supabase
            .from('pos_table_session_tables')
            .select('session_id')
            .eq('table_id', tbl.id);
          if (sessionLinks && sessionLinks.length > 0) {
            const sIds = sessionLinks.map((s: any) => s.session_id);
            await supabase
              .from('pos_table_sessions')
              .update({
                status: 'closed',
                closed_at: new Date().toISOString()
              })
              .in('id', sIds)
              .in('status', ['opening', 'occupied', 'bill_requested', 'closing']);
          }
        }
      }
    } catch (e) {
      console.warn('[BackgroundSync] Table session closure warning:', e);
    }
  }

  // 3. Shift cash movements in DB
  if (shiftCashMovement && shiftCashMovement.shift_id && shiftCashMovement.shift_id !== 'active-shift') {
    try {
      await supabase.from('shift_cash_movements').insert([shiftCashMovement]);
    } catch (e) {
      console.warn('[BackgroundSync] Shift cash movement insert warning:', e);
    }
  }

  // 4. Notify UI of final confirmed order id
  if (typeof window !== 'undefined' && completedOrderId) {
    const isPreparingOnly = String(directPayload?.status || '').toLowerCase() === 'preparing';
    window.dispatchEvent(new CustomEvent(isPreparingOnly ? 'flow:order_created' : 'flow:order_settled', {
      detail: {
        orderId: completedOrderId,
        tableCode: settledTableCode,
        tableId: settledTableId
      }
    }));
  }

  return true;
}

export async function executeHoldSyncNow(p: any): Promise<{ success: boolean; orderId?: number | string }> {
  const { heldOrderId, orderPayload, activeTableContext, isDineIn } = p;
  let finalOrderId = heldOrderId;
  const hasRealHeldId = Boolean(
    heldOrderId &&
    !String(heldOrderId).startsWith('TMP-') &&
    !String(heldOrderId).startsWith('local-')
  );

  if (hasRealHeldId) {
    const res = await updateDirectOrderStatus(heldOrderId, {
      subtotal: orderPayload.subtotal,
      total: orderPayload.total,
      items: orderPayload.items
    });
    if (!res.success) {
      throw new Error(res.error || 'Failed to update held order');
    }
  } else {
    // Guard against duplicate open orders for the same dine-in table
    let existingTableOrder: any = null;
    if (isDineIn && orderPayload?.table_label) {
      try {
        const clean = String(orderPayload.table_label).trim();
        const numOnly = clean.replace(/^(TABLE\s*|T)/i, '').trim();
        const variants = Array.from(new Set([
          clean,
          clean.toUpperCase(),
          clean.toLowerCase(),
          numOnly,
          `T${numOnly}`,
          `Table ${numOnly}`,
          `TABLE ${numOnly}`
        ].filter(Boolean)));
        const rid = orderPayload.restaurant_id || getGlobalRestaurantId();
        let q = supabase
          .from('pos_orders')
          .select('id, subtotal_amount, total_amount, pos_order_items(*)')
          .in('table_label', variants)
          .in('status', ['held', 'preparing', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested', 'pending'])
          .order('id', { ascending: false })
          .limit(1);
        if (rid) q = q.eq('restaurant_id', rid);
        const { data: found } = await q.maybeSingle();
        if (found?.id) existingTableOrder = found;
      } catch (lookupErr) {
        console.warn('[BackgroundSync] Existing table order check warning:', lookupErr);
      }
    }

    if (existingTableOrder) {
      // Merge newly added items onto the existing open table order instead of creating a duplicate order
      const existingRows = existingTableOrder.pos_order_items || [];
      const existingLineIds = new Set(
        existingRows.map((r: any) => String(r.line_item_id || r.id))
      );
      const mergedItems: any[] = existingRows.map((r: any) => ({
        id: r.id,
        order_item_id: r.id,
        line_item_id: r.line_item_id || String(r.id),
        product_id: r.product_id,
        name: r.product_name,
        quantity: Number(r.quantity || 1),
        unit_price: Number(r.unit_price || 0),
        customizations: r.customizations_json,
        comment: r.comment || ''
      }));
      for (const incoming of (orderPayload.items || [])) {
        const incId = incoming.line_item_id ? String(incoming.line_item_id) : '';
        if (!incId || !existingLineIds.has(incId)) {
          mergedItems.push(incoming);
        }
      }
      const mergedSubtotal = mergedItems.reduce(
        (sum, it) => sum + Number(it.unit_price || 0) * Number(it.quantity ?? it.qty ?? 1),
        0
      );
      const res = await updateDirectOrderStatus(existingTableOrder.id, {
        subtotal: mergedSubtotal,
        total: mergedSubtotal,
        items: mergedItems
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to merge items onto existing table order');
      }
      finalOrderId = existingTableOrder.id;
    } else {
      const res = await createDirectOrder(orderPayload);
      if (!res.success) {
        throw new Error(res.error || 'Failed to create held order');
      }
      finalOrderId = res.order?.id || res.orderId;
    }
  }

  // Update pos_table_sessions
  if (isDineIn && finalOrderId && activeTableContext?.sessionId) {
    try {
      await supabase
        .from('pos_table_sessions')
        .update({
          commerce_order_id: finalOrderId,
          status: 'occupied',
          sync_status: 'synced',
          last_sync_error: null
        })
        .eq('id', activeTableContext.sessionId);
    } catch (e) {
      console.warn('[BackgroundSync] Error updating table session on hold:', e);
    }
  }

  // Notify TablesScreen, useOrders, and PosTerminalScreen immediately after DB write confirms
  if (typeof window !== 'undefined' && finalOrderId) {
    window.dispatchEvent(new CustomEvent('flow:order_created', {
      detail: {
        orderId: finalOrderId,
        tableCode: activeTableContext?.tableCode || orderPayload?.table_label,
        tableId: activeTableContext?.tableId,
        sessionId: activeTableContext?.sessionId,
        isDineIn: Boolean(isDineIn)
      }
    }));
  }

  return { success: true, orderId: finalOrderId };
}

async function executeHoldSync(p: any): Promise<boolean> {
  const res = await executeHoldSyncNow(p);
  return res.success;
}

async function executeFireSync(p: any): Promise<boolean> {
  const { orderId, locationKey, items, serviceType, tableLabel, guestCount, waiterReference, firedBy } = p;
  const res = await fireOrderRound({
    orderId,
    locationKey,
    items,
    serviceType,
    tableLabel,
    guestCount,
    waiterReference,
    firedBy
  });
  return Boolean(res.success);
}

async function executeTableCloseSync(p: any): Promise<boolean> {
  const { sessionId, orderId } = p;
  const res = await closeTableSession(sessionId, orderId);
  return Boolean(res.success);
}

// Auto-register network listeners and periodic retry
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[BackgroundSync] Network online - processing pending queue');
    processSyncQueue().catch(() => {});
  });

  // Background interval every 20 seconds
  setInterval(() => {
    const queue = getSyncQueue();
    if (queue.some(t => t.status === 'pending' || t.status === 'failed')) {
      processSyncQueue().catch(() => {});
    }
  }, 20000);
}
