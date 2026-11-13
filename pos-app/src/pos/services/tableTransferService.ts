// FLOW POS — Table & Item Transfer Service
import { supabase } from '../../api/supabase';
import { COMMERCE_API_BASE } from '../config';
import { logSensitivePosAction } from './posPermissionService';
import { createDirectOrder, updateDirectOrderStatus } from './posOrderService';

export interface TransferEntireTableParams {
  fromTableCode: string;
  toTableCode: string;
  fromOrderId?: string | number | null;
  fromSessionId?: string | null;
  branchId: string;
  restaurantId: string;
  staffUser: {
    id: string;
    name: string;
    role: string;
  };
  authorizer?: {
    id: string;
    name: string;
    role: string;
  };
}

export interface TransferItemSelection {
  line_item_id: string;
  order_item_id?: string | number;
  product_id: string | number;
  name: string;
  unit_price: number;
  transferQty: number;
  remainingQty: number;
  selectedCustomizations?: any[];
  note?: string;
  isOrdered?: boolean;
  item_added_by?: string;
  item_added_by_id?: string;
}

export interface TransferSelectedItemsParams {
  fromTableCode: string;
  toTableCode: string;
  fromOrderId?: string | number | null;
  fromSessionId?: string | null;
  branchId: string;
  restaurantId: string;
  selectedItems: TransferItemSelection[];
  allTicketItems: any[];
  staffUser: {
    id: string;
    name: string;
    role: string;
  };
  authorizer?: {
    id: string;
    name: string;
    role: string;
  };
}

/**
 * Finds or auto-creates a table in pos_tables by code.
 */
export async function resolveOrCreatePosTable(
  branchId: string,
  tableCodeInput: string
): Promise<{ id: string; table_code: string; display_name: string }> {
  const clean = tableCodeInput.trim().toUpperCase();
  const destCode = clean.startsWith('T') ? clean : `T${clean}`;
  const simpleDest = clean.replace(/^T/, '');

  // 1. Check existing in pos_tables
  const { data: existing } = await supabase
    .from('pos_tables')
    .select('id, table_code, display_name')
    .eq('branch_id', branchId)
    .or(`table_code.eq.${destCode},table_code.eq.${simpleDest}`);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // 2. Create if not found
  const { data: created, error } = await supabase
    .from('pos_tables')
    .insert([{
      branch_id: branchId,
      table_code: destCode,
      display_name: `Table ${simpleDest}`,
      capacity: 4,
      shape: 'square',
      active: true
    }])
    .select('id, table_code, display_name')
    .single();

  if (error || !created) {
    throw new Error(`Failed to resolve destination table ${destCode}: ${error?.message || 'DB error'}`);
  }

  return created;
}

/**
 * Transfers the ENTIRE table (session and orders) to another table.
 */
export async function executeTransferEntireTable(params: TransferEntireTableParams): Promise<{
  success: boolean;
  targetTableCode: string;
  targetTableId: string;
  error?: string;
}> {
  try {
    const fromClean = params.fromTableCode.trim().toUpperCase();
    const toClean = params.toTableCode.trim().toUpperCase();

    if (fromClean === toClean || fromClean.replace(/^T/, '') === toClean.replace(/^T/, '')) {
      throw new Error('Destination table cannot be the same as current table.');
    }

    const targetTable = await resolveOrCreatePosTable(params.branchId, params.toTableCode);
    const finalTargetCode = targetTable.table_code;
    const finalTargetId = targetTable.id;

    const fromVariants = [
      fromClean,
      `T${fromClean.replace(/^T/, '')}`,
      fromClean.replace(/^T/, ''),
      `Table ${fromClean}`,
      `Table ${fromClean.replace(/^T/, '')}`
    ];

    // 1. Update orders in pos_orders
    if (params.fromOrderId) {
      await supabase
        .from('pos_orders')
        .update({ table_label: finalTargetCode })
        .eq('id', params.fromOrderId);

      if (COMMERCE_API_BASE) {
        fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.fromOrderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ table_label: finalTargetCode })
        }).catch(() => {});
      }
    }

    // Also update any active order associated with source table
    await supabase
      .from('pos_orders')
      .update({ table_label: finalTargetCode })
      .in('status', ['held', 'preparing', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested'])
      .in('table_label', fromVariants);

    // 2. Update pos_table_session_tables linkages
    if (params.fromSessionId) {
      // Find source table id
      const { data: sessionTables } = await supabase
        .from('pos_table_session_tables')
        .select('table_id')
        .eq('session_id', params.fromSessionId);

      if (sessionTables && sessionTables.length > 0) {
        for (const st of sessionTables) {
          await supabase
            .from('pos_table_session_tables')
            .delete()
            .eq('session_id', params.fromSessionId)
            .eq('table_id', st.table_id);
        }
      }

      await supabase
        .from('pos_table_session_tables')
        .insert([{
          session_id: params.fromSessionId,
          table_id: finalTargetId,
          is_primary: true
        }]);

      await supabase
        .from('pos_table_sessions')
        .update({ version: Date.now() })
        .eq('id', params.fromSessionId);
    }

    // 3. Log sensitive action audit
    await logSensitivePosAction({
      restaurantId: params.restaurantId,
      branch: params.branchId,
      employeeId: params.staffUser?.id || '',
      employeeName: params.staffUser?.name || 'Staff',
      authorizerId: params.authorizer?.id || null,
      authorizerName: params.authorizer?.name || null,
      tableNumber: finalTargetCode,
      orderId: params.fromOrderId,
      actionType: 'transfer_table',
      actionLabel: `Transfer Entire Table: ${fromClean} -> ${finalTargetCode}`,
      previousValue: `Table ${fromClean}`,
      newValue: `Table ${finalTargetCode}`,
      reason: 'Entire table moved'
    });

    return {
      success: true,
      targetTableCode: finalTargetCode,
      targetTableId: finalTargetId
    };
  } catch (err: any) {
    console.error('executeTransferEntireTable error:', err);
    return {
      success: false,
      targetTableCode: params.toTableCode,
      targetTableId: '',
      error: err.message || 'Transfer failed'
    };
  }
}

/**
 * Transfers SELECTED ITEMS from Table A to Table B.
 */
export async function executeTransferSelectedItems(params: TransferSelectedItemsParams): Promise<{
  success: boolean;
  remainingTicketItems: any[];
  transferredCount: number;
  destTableCode: string;
  error?: string;
}> {
  try {
    const fromClean = params.fromTableCode.trim().toUpperCase();
    const toClean = params.toTableCode.trim().toUpperCase();

    if (fromClean === toClean || fromClean.replace(/^T/, '') === toClean.replace(/^T/, '')) {
      throw new Error('Destination table cannot be the same as current table.');
    }

    if (!params.selectedItems || params.selectedItems.length === 0) {
      throw new Error('No items selected to transfer.');
    }

    // 1. Resolve destination table
    const targetTable = await resolveOrCreatePosTable(params.branchId, params.toTableCode);
    const finalTargetCode = targetTable.table_code;

    // 2. Check if destination table has an active order
    const toVariants = [
      finalTargetCode,
      `T${finalTargetCode.replace(/^T/, '')}`,
      finalTargetCode.replace(/^T/, ''),
      `Table ${finalTargetCode}`,
      `Table ${finalTargetCode.replace(/^T/, '')}`
    ];

    const { data: existingDestOrders } = await supabase
      .from('pos_orders')
      .select('id, items:pos_order_items(*)')
      .in('table_label', toVariants)
      .in('status', ['held', 'preparing', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested'])
      .order('id', { ascending: false })
      .limit(1);

    const destOrder = existingDestOrders && existingDestOrders.length > 0 ? existingDestOrders[0] : null;

    // Items to add to destination table
    const itemsToAdd = params.selectedItems.map(item => ({
      line_item_id: 'line-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      product_id: item.product_id,
      name: item.name,
      quantity: item.transferQty,
      unit_price: item.unit_price,
      customizations: item.selectedCustomizations || [],
      comment: item.note ? `${item.note} (Transferred from ${fromClean})` : `Transferred from ${fromClean}`,
      item_added_by: params.staffUser.name || 'Staff',
      item_added_by_id: params.staffUser.id || null
    }));

    if (destOrder) {
      // Append items to destination order
      const currentDestItems = (destOrder.items || []).map((i: any) => ({
        line_item_id: i.line_item_id || String(i.id),
        order_item_id: i.id,
        product_id: i.product_id,
        name: i.name || i.product_name,
        quantity: Number(i.quantity || i.qty) || 1,
        unit_price: Number(i.unit_price) || 0,
        customizations: i.customizations || [],
        comment: i.comment || i.note || '',
        item_added_by: i.item_added_by,
        item_added_by_id: i.item_added_by_id
      }));

      const mergedDestItems = [...currentDestItems, ...itemsToAdd];
      const newDestSubtotal = mergedDestItems.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);

      await updateDirectOrderStatus(destOrder.id, {
        subtotal: newDestSubtotal,
        total: newDestSubtotal,
        items: mergedDestItems
      });
    } else {
      // Create new dine-in order for destination table
      const newDestSubtotal = itemsToAdd.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);
      const createRes = await createDirectOrder({
        branch_id: params.branchId,
        restaurant_id: params.restaurantId,
        orderType: 'dine_in',
        service_type: 'dine_in',
        table_label: finalTargetCode,
        guest_count: 2,
        waiter_reference: params.staffUser.name || 'Staff',
        cashierName: params.staffUser.name || 'Staff',
        orderSource: 'POS',
        paymentMethod: 'Cash',
        status: 'held',
        subtotal: newDestSubtotal,
        total: newDestSubtotal,
        items: itemsToAdd
      });

      if (createRes.success && (createRes.order?.id || createRes.orderId)) {
        const newOrderId = createRes.order?.id || createRes.orderId;
        // Check/create table session for destination table
        const { data: newSession } = await supabase
          .from('pos_table_sessions')
          .insert([{
            branch_id: params.branchId,
            commerce_order_id: newOrderId,
            status: 'occupied',
            guest_count: 2,
            waiter_name: params.staffUser.name || 'Staff',
            version: 1
          }])
          .select('id')
          .single();

        if (newSession?.id) {
          await supabase
            .from('pos_table_session_tables')
            .insert([{
              session_id: newSession.id,
              table_id: targetTable.id,
              is_primary: true
            }]);
        }
      }
    }

    // 3. Update source order items: subtract or remove transferred items
    const transferMap = new Map<string, number>();
    params.selectedItems.forEach(it => {
      transferMap.set(it.line_item_id, it.transferQty);
    });

    const updatedSourceItems: any[] = [];
    for (const item of params.allTicketItems) {
      if (item.isHoldSeparator) {
        updatedSourceItems.push(item);
        continue;
      }
      const transferQty = transferMap.get(item.line_item_id) || 0;
      if (transferQty > 0) {
        const remaining = item.qty - transferQty;
        if (remaining > 0) {
          updatedSourceItems.push({
            ...item,
            qty: remaining
          });
        }
      } else {
        updatedSourceItems.push(item);
      }
    }

    // Save updated source order
    const sourceHasItems = updatedSourceItems.filter(i => !i.isHoldSeparator).length > 0;
    const newSourceSubtotal = updatedSourceItems.reduce((acc, it) => acc + (it.isHoldSeparator ? 0 : it.unit_price * it.qty), 0);

    if (params.fromOrderId) {
      if (sourceHasItems) {
        await updateDirectOrderStatus(params.fromOrderId, {
          subtotal: newSourceSubtotal,
          total: newSourceSubtotal,
          items: updatedSourceItems.map(it => ({
            line_item_id: it.line_item_id,
            order_item_id: it.order_item_id,
            product_id: it.product_id,
            name: it.name,
            quantity: it.qty,
            unit_price: it.unit_price,
            customizations: it.selectedCustomizations || [],
            comment: it.note || '',
            item_added_by: it.item_added_by,
            item_added_by_id: it.item_added_by_id
          }))
        });
      } else {
        // All items transferred out: update order status to cancelled or held empty
        await updateDirectOrderStatus(params.fromOrderId, {
          subtotal: 0,
          total: 0,
          items: []
        });
        if (params.fromSessionId) {
          await supabase
            .from('pos_table_sessions')
            .update({ status: 'completed' })
            .eq('id', params.fromSessionId);
        }
      }
    }

    // 4. Audit Log
    const itemSummary = params.selectedItems.map(i => `${i.transferQty}x ${i.name}`).join(', ');
    await logSensitivePosAction({
      restaurantId: params.restaurantId,
      branch: params.branchId,
      employeeId: params.staffUser?.id || '',
      employeeName: params.staffUser?.name || 'Staff',
      authorizerId: params.authorizer?.id || null,
      authorizerName: params.authorizer?.name || null,
      tableNumber: fromClean,
      orderId: params.fromOrderId,
      actionType: 'transfer_table',
      actionLabel: `Transfer Items: ${fromClean} -> ${finalTargetCode} (${itemSummary})`,
      previousValue: `Table ${fromClean}`,
      newValue: `Table ${finalTargetCode}`,
      reason: `Transferred: ${itemSummary}`
    });

    return {
      success: true,
      remainingTicketItems: updatedSourceItems,
      transferredCount: params.selectedItems.reduce((a, b) => a + b.transferQty, 0),
      destTableCode: finalTargetCode
    };
  } catch (err: any) {
    console.error('executeTransferSelectedItems error:', err);
    return {
      success: false,
      remainingTicketItems: params.allTicketItems,
      transferredCount: 0,
      destTableCode: params.toTableCode,
      error: err.message || 'Item transfer failed'
    };
  }
}
