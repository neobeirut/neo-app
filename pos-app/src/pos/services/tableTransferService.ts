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
  conceptId?: string | null;
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

    const cleanDest = finalTargetCode.replace(/^T/, '');

    // 1. Update orders in pos_orders
    if (params.fromOrderId) {
      await supabase
        .from('pos_orders')
        .update({ 
          table_label: finalTargetCode,
          customer_name: `Table ${cleanDest}`
        })
        .eq('id', params.fromOrderId);

      if (COMMERCE_API_BASE) {
        fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.fromOrderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            table_label: finalTargetCode,
            customerName: `Table ${cleanDest}`,
            status: 'held'
          })
        }).catch(() => {});
      }
    }

    // Also update any active order associated with source table
    await supabase
      .from('pos_orders')
      .update({ 
        table_label: finalTargetCode,
        customer_name: `Table ${cleanDest}`
      })
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
        .update({ 
          table_id: finalTargetId,
          table_code: finalTargetCode,
          version: Date.now() 
        })
        .eq('id', params.fromSessionId);
    } else if (params.fromOrderId) {
      // If fromSessionId was null, find or create the active session
      const { data: existingSession } = await supabase
        .from('pos_table_sessions')
        .select('id')
        .eq('commerce_order_id', params.fromOrderId)
        .in('status', ['open', 'occupied', 'bill_requested'])
        .maybeSingle();

      if (existingSession?.id) {
        await supabase
          .from('pos_table_session_tables')
          .delete()
          .eq('session_id', existingSession.id);
        await supabase
          .from('pos_table_session_tables')
          .insert([{
            session_id: existingSession.id,
            table_id: finalTargetId,
            is_primary: true
          }]);
        await supabase
          .from('pos_table_sessions')
          .update({
            table_id: finalTargetId,
            table_code: finalTargetCode,
            version: Date.now()
          })
          .eq('id', existingSession.id);
      } else {
        const { data: createdSess } = await supabase
          .from('pos_table_sessions')
          .insert([{
            branch_id: params.branchId,
            restaurant_id: params.restaurantId,
            table_id: finalTargetId,
            table_code: finalTargetCode,
            commerce_order_id: params.fromOrderId,
            status: 'occupied',
            guest_count: 2,
            waiter_name: params.staffUser?.name || 'Staff',
            version: 1
          }])
          .select('id')
          .single();
        if (createdSess?.id) {
          await supabase
            .from('pos_table_session_tables')
            .insert([{
              session_id: createdSess.id,
              table_id: finalTargetId,
              is_primary: true
            }]);
        }
      }
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
  destOrderId?: string | number;
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

    // 1. Resolve concept_id
    let conceptId = params.conceptId;
    if (!conceptId && params.fromOrderId) {
      try {
        const { data: ord } = await supabase
          .from('pos_orders')
          .select('concept_id')
          .eq('id', params.fromOrderId)
          .maybeSingle();
        if (ord?.concept_id) conceptId = ord.concept_id;
      } catch (e) {}
    }
    if (!conceptId) conceptId = '00000000-0000-0000-0000-000000000001';

    // 2. Resolve destination table
    const targetTable = await resolveOrCreatePosTable(params.branchId, params.toTableCode);
    const finalTargetCode = targetTable.table_code;
    const cleanDestCode = finalTargetCode.replace(/^T/i, '');

    // 3. Check if destination table has an active order
    const toVariants = [
      finalTargetCode,
      `T${cleanDestCode}`,
      cleanDestCode,
      `Table ${finalTargetCode}`,
      `Table ${cleanDestCode}`
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

    let targetDestOrderId: string | number | null = null;

    if (destOrder) {
      // Append items to existing destination order
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

      // Update Commerce API if available
      if (COMMERCE_API_BASE && /^\d+$/.test(String(destOrder.id))) {
        try {
          await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${destOrder.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'held',
              subtotal: newDestSubtotal,
              total: newDestSubtotal,
              items: mergedDestItems
            })
          });
        } catch (e) {
          console.warn('Commerce API update existing dest order error:', e);
        }
      }

      await updateDirectOrderStatus(destOrder.id, {
        subtotal: newDestSubtotal,
        total: newDestSubtotal,
        items: mergedDestItems
      });

      targetDestOrderId = destOrder.id;
    } else {
      // Create new dine-in order for destination table
      const newDestSubtotal = itemsToAdd.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);

      let extOrderId: any = null;
      if (COMMERCE_API_BASE) {
        try {
          const extRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              branch_id: params.branchId,
              restaurant_id: params.restaurantId,
              concept_id: conceptId,
              orderType: 'dine_in',
              service_type: 'dine_in',
              table_label: finalTargetCode,
              customerName: `Table ${cleanDestCode}`,
              guest_count: 2,
              waiter_reference: params.staffUser.name || 'Staff',
              cashierName: params.staffUser.name || 'Staff',
              orderSource: 'POS',
              paymentMethod: 'Cash',
              status: 'held',
              subtotal: newDestSubtotal,
              total: newDestSubtotal,
              items: itemsToAdd
            })
          });
          if (extRes.ok) {
            const extData = await extRes.json();
            extOrderId = extData?.order?.id || extData?.orderId || extData?.id;
          }
        } catch (e) {
          console.warn('Commerce API create new dest order error:', e);
        }
      }

      const createRes = await createDirectOrder({
        branch_id: params.branchId,
        restaurant_id: params.restaurantId,
        concept_id: conceptId,
        orderType: 'dine_in',
        service_type: 'dine_in',
        table_label: finalTargetCode,
        customerName: `Table ${cleanDestCode}`,
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

      targetDestOrderId = extOrderId || createRes?.order?.id || createRes?.orderId;

      // SAFETY GATE: If destination order creation failed, DO NOT subtract items from source table!
      if (!createRes?.success && !targetDestOrderId) {
        throw new Error(createRes?.error || 'Failed to create destination table order. Source items were NOT modified.');
      }

      // Check/create table session for destination table
      const { data: newSession } = await supabase
        .from('pos_table_sessions')
        .insert([{
          branch_id: params.branchId,
          restaurant_id: params.restaurantId,
          table_id: targetTable.id,
          table_code: finalTargetCode,
          commerce_order_id: targetDestOrderId,
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

    // 4. NOW AND ONLY NOW: Update source order items (subtract or remove transferred items)
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
            qty: remaining,
            originalQty: Math.max(0, (Number(item.originalQty !== undefined ? item.originalQty : item.qty)) - transferQty)
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
        // Dual-write update to Commerce API & Supabase pos_orders
        if (COMMERCE_API_BASE && /^\d+$/.test(String(params.fromOrderId))) {
          try {
            await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.fromOrderId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'held',
                subtotal: newSourceSubtotal,
                total: newSourceSubtotal,
                items: updatedSourceItems
              })
            });
          } catch (e) {
            console.warn('Commerce API update source order error:', e);
          }
        }

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
        if (COMMERCE_API_BASE && /^\d+$/.test(String(params.fromOrderId))) {
          try {
            await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${params.fromOrderId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'completed',
                subtotal: 0,
                total: 0,
                items: []
              })
            });
          } catch (e) {}
        }
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
      destTableCode: finalTargetCode,
      destOrderId: targetDestOrderId || undefined
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
