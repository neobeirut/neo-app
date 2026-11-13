import type { OrderCheck } from './types';

import { COMMERCE_API_BASE } from '../config';

export async function getOrderChecks(orderId: number): Promise<{ success: boolean; checks: OrderCheck[]; error?: string }> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${orderId}/checks`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, checks: [], error: data.error || 'Failed to fetch checks' };
    }
    return { success: true, checks: data.checks || [] };
  } catch (err: any) {
    return { success: false, checks: [], error: err.message };
  }
}

export async function createEqualSplit(params: {
  orderId: number;
  ways: number;
  splitOperationId?: string;
}): Promise<{ success: boolean; checks: OrderCheck[]; error?: string }> {
  try {
    const opId = params.splitOperationId || (
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'split-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8)
    );

    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.orderId}/checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        split_type: 'equal',
        ways: params.ways,
        split_operation_id: opId
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, checks: [], error: data.error || 'Failed to create equal split' };
    }

    return { success: true, checks: data.checks || [] };
  } catch (err: any) {
    return { success: false, checks: [], error: err.message };
  }
}

export async function createItemSplit(params: {
  orderId: number;
  checks: { label: string; items: { order_item_id: number; quantity: number; allocated_amount?: number }[] }[];
  splitOperationId?: string;
}): Promise<{ success: boolean; checks: OrderCheck[]; error?: string }> {
  try {
    const opId = params.splitOperationId || (
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'split-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8)
    );

    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.orderId}/checks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        split_type: 'item',
        checks: params.checks,
        split_operation_id: opId
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, checks: [], error: data.error || 'Failed to create item split' };
    }

    return { success: true, checks: data.checks || [] };
  } catch (err: any) {
    return { success: false, checks: [], error: err.message };
  }
}

export async function deleteSplitChecks(orderId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${orderId}/checks`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to discard checks' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
