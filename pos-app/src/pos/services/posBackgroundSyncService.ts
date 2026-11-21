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

/**
 * Process all pending background tasks in sequence without blocking UI.
 */
export async function processSyncQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;
  notifySyncStatus();

  try {
    const queue = getSyncQueue();
    const pendingTasks = queue.filter(t => t.status === 'pending' || t.status === 'failed');

    for (const task of pendingTasks) {
      task.status = 'syncing';
      task.attempts = (task.attempts || 0) + 1;
      saveSyncQueue(queue);

      try {
        let success = false;
        switch (task.type) {
          case 'payment':
            success = await executePaymentSync(task.payload);
            break;
          case 'hold':
            success = await executeHoldSync(task.payload);
            break;
          case 'fire':
            success = await executeFireSync(task.payload);
            break;
          case 'table_close':
            success = await executeTableCloseSync(task.payload);
            break;
          default:
            console.warn(`[BackgroundSync] Unknown task type: ${task.type}`);
            success = true; // remove unrecognized task
        }

        if (success) {
          task.status = 'completed';
        } else {
          task.status = 'failed';
          task.lastError = 'Sync returned unsuccessful status';
        }
      } catch (err: any) {
        console.warn(`[BackgroundSync] Error syncing task ${task.id} (${task.type}):`, err);
        task.status = 'failed';
        task.lastError = err?.message || String(err);
      }

      // If attempts exceed 10, keep it marked failed but do not retry continuously
      saveSyncQueue(queue);
    }

    // Clean up completed tasks
    const remaining = queue.filter(t => t.status !== 'completed');
    saveSyncQueue(remaining);
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
    window.dispatchEvent(new CustomEvent('flow:order_settled', {
      detail: {
        orderId: completedOrderId,
        tableCode: settledTableCode,
        tableId: settledTableId
      }
    }));
  }

  return true;
}

async function executeHoldSync(p: any): Promise<boolean> {
  const { heldOrderId, orderPayload, activeTableContext, isDineIn } = p;
  let finalOrderId = heldOrderId;

  if (heldOrderId && (!String(heldOrderId).startsWith('TMP-') && !String(heldOrderId).startsWith('local-'))) {
    const res = await updateDirectOrderStatus(heldOrderId, {
      subtotal: orderPayload.subtotal,
      total: orderPayload.total,
      items: orderPayload.items
    });
    if (!res.success) {
      throw new Error(res.error || 'Failed to update held order');
    }
  } else {
    const res = await createDirectOrder(orderPayload);
    if (!res.success) {
      throw new Error(res.error || 'Failed to create held order');
    }
    finalOrderId = res.order?.id || res.orderId;
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

  return true;
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
