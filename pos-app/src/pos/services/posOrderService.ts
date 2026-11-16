import { readModifiers, serializeModifiers, modifierText, inventoryLines } from './posInventory';
import { supabase, getGlobalRestaurantId } from "../../api/supabase";
import { COMMERCE_API_BASE, HAS_COMMERCE_API } from "../config";

export interface CreateOrderPayload {
  branch_id?: number | string;
  restaurant_id?: string;
  concept_id?: string;
  client_order_token?: string;
  orderType?: string;
  service_type?: string;
  table_label?: string;
  guest_count?: number;
  waiter_reference?: string;
  cashierName?: string;
  terminalId?: string;
  orderSource?: string;
  paymentMethod?: string;
  payment_status?: string;
  tendered_amount?: number;
  tendered_currency?: "USD" | "LBP";
  change_amount?: number;
  change_currency?: "USD" | "LBP";
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  status?: string;
  subtotal?: number;
  deliveryFee?: number;
  discountAmount?: number;
  discountLabel?: string;
  marketplace_order_ref?: string;
  marketplace_commission_pct?: number;
  marketplace_commission_usd?: number;
  net_receivable_usd?: number;
  invoice_series?: string;
  invoice_number?: string;
  is_vat_subscribed?: boolean;
  vat_rate?: number;
  vat_amount?: number;
  total?: number;
  is_scheduled?: boolean;
  scheduled_for?: string;
  scheduled_time_display?: string;
  scheduled_note?: string;
  is_inventory_commit?: boolean;
  channel?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  items?: Array<{
    line_item_id?: string;
    product_id?: number | string;
    name?: string;
    quantity?: number;
    unit_price?: number;
    customizations?: any[];
    comment?: string;
    channel?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  }>;
}

/**
 * Resolves POS orderType and orderSource to canonical backend sales channels:
 * DINE_IN, TAKEAWAY, DELIVERY
 */
export function resolveCanonicalSalesChannel(
  orderType?: string,
  orderSource?: string
): 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' {
  const t = (orderType || '').toLowerCase();
  const s = (orderSource || '').toLowerCase();

  if (t === 'dine_in' || t === 'table') {
    return 'DINE_IN';
  }
  if (t === 'pickup' || t === 'takeaway' || t === 'takeout' || t === 'take_out' || s.includes('in-store') || s.includes('counter')) {
    return 'TAKEAWAY';
  }
  if (
    t === 'delivery' ||
    s.includes('toters') ||
    s.includes('noknok') ||
    s.includes('whatsapp') ||
    s.includes('delivery')
  ) {
    return 'DELIVERY';
  }
  return 'DINE_IN';
}

export async function createDirectOrder(payload: CreateOrderPayload) {
  let persistedOrderId: number | string | undefined;
  try {
    const restaurantId = payload.restaurant_id || getGlobalRestaurantId();
    if (!restaurantId) throw new Error('Restaurant context is required.');
    if (!payload.branch_id || String(payload.branch_id).trim() === '') {
      throw new Error('INVALID_INVENTORY_BRANCH: Missing branch identifier. POS session must resolve branch explicitly.');
    }
    const branchIdStr = String(payload.branch_id);

    const subtotal = payload.subtotal || 0;
    const total = payload.total || 0;
    const itemsCount = (payload.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);

    const isActuallyPaid = String(payload.payment_status).toLowerCase() === 'paid' || payload.status === 'completed' || payload.status === 'paid';
    const resolvedTendered = typeof payload.tendered_amount === 'number'
      ? payload.tendered_amount
      : (isActuallyPaid ? total : 0);

    const canonicalChannel = payload.channel || resolveCanonicalSalesChannel(payload.orderType, payload.orderSource);

    // Validate selections before creating any order records.
    for (const item of payload.items || []) {
      serializeModifiers(readModifiers(item));
      if (!Number.isFinite(Number(item.quantity ?? 1)) || Number(item.quantity ?? 1) <= 0) throw new Error('Invalid item quantity.');
    }

    // Resolve concept identity: strict non-silent fallback
    // Client-controlled boolean bypass is strictly prohibited.
    // Every order MUST carry an explicit concept_id resolved by the active POS workspace.
    const resolvedConceptId = payload.concept_id;
    if (!resolvedConceptId || String(resolvedConceptId).trim() === '') {
      throw new Error('MISSING_CONCEPT_IDENTITY: POS orders require an explicit, authorized concept_id. Silent fallback or client-controlled boolean bypass is prohibited.');
    }

    // Validate concept consistency: prevent mixing items from multiple concepts on a single order
    for (const item of payload.items || []) {
      if ((item as any).concept_id && (item as any).concept_id !== resolvedConceptId) {
        throw new Error(
          `CROSS_CONCEPT_CART_PROHIBITED: Item "${item.name}" belongs to concept ${(item as any).concept_id}, which does not match active workspace concept ${resolvedConceptId}. Mixing concepts on a single invoice is prohibited.`
        );
      }
    }

    // Idempotency: Duplicate check for external marketplace orders (Toters, NokNok)
    if (payload.marketplace_order_ref && String(payload.marketplace_order_ref).trim()) {
      const cleanRef = String(payload.marketplace_order_ref).trim();
      const { data: existingRef } = await supabase
        .from('pos_orders')
        .select('id, marketplace_order_ref, created_at')
        .eq('marketplace_order_ref', cleanRef)
        .limit(1)
        .maybeSingle();

      if (existingRef) {
        throw new Error(`DUPLICATE_ORDER: Marketplace order "${cleanRef}" has already been processed (Order #${existingRef.id}). Duplicate submission rejected.`);
      }
    }

    const orderInsertData: any = {
      restaurant_id: restaurantId,
      branch_id: branchIdStr,
      concept_id: resolvedConceptId,
      order_type: payload.orderType || 'dine_in',
      order_source: payload.orderSource || 'POS',
      payment_method: payload.paymentMethod || 'Cash USD',
      customer_name: payload.customerName || (payload.orderType === 'pickup' ? 'Pickup Customer' : 'Direct Order'),
      customer_phone: payload.customerPhone || null,
      delivery_address: payload.deliveryAddress || null,
      special_instructions: payload.scheduled_note || null,
      status: payload.status || 'preparing',
      subtotal_amount: subtotal,
      delivery_fee: payload.deliveryFee || 0,
      discount_amount: payload.discountAmount || 0,
      discount_label: payload.discountLabel || null,
      ...(payload.marketplace_order_ref ? { marketplace_order_ref: payload.marketplace_order_ref } : {}),
      ...(typeof payload.marketplace_commission_pct === 'number' ? { marketplace_commission_pct: payload.marketplace_commission_pct } : {}),
      ...(typeof payload.marketplace_commission_usd === 'number' ? { marketplace_commission_usd: payload.marketplace_commission_usd } : {}),
      ...(typeof payload.net_receivable_usd === 'number' ? { net_receivable_usd: payload.net_receivable_usd } : {}),
      ...(payload.invoice_series ? { invoice_series: payload.invoice_series } : {}),
      ...(payload.invoice_number ? { invoice_number: payload.invoice_number } : {}),
      total_amount: total,
      tendered_amount: resolvedTendered,
      tendered_currency: payload.tendered_currency || 'USD',
      change_amount: payload.change_amount || 0,
      change_currency: payload.change_currency || 'USD',
      exchange_rate: 89500,
      table_label: payload.table_label || null,
      guest_count: payload.guest_count || 1,
      waiter_name: payload.waiter_reference || payload.cashierName || 'Cashier',
      cashier_name: payload.cashierName || 'Cashier',
      terminal_id: payload.terminalId || 'FLOW-TERM-01',
      is_scheduled: Boolean(payload.is_scheduled),
      scheduled_for: payload.scheduled_for || null,
      scheduled_time_display: payload.scheduled_time_display || null,
      scheduled_notes: payload.scheduled_note || null,
      items_count: itemsCount,
      version: 1,
      inventory_status: 'PENDING',
      created_at: new Date().toISOString(),
      completed_at: isActuallyPaid ? new Date().toISOString() : null
    };

    let { data: orderData, error: orderErr } = await supabase
      .from('pos_orders')
      .insert([orderInsertData])
      .select()
      .single();

    if (orderErr) {
      const isMissingConceptColumn = String(orderErr.message || '').includes("'concept_id'") || orderErr.code === 'PGRST204';
      if (isMissingConceptColumn) {
        const isLegacyNeo = !resolvedConceptId || resolvedConceptId === '00000000-0000-0000-0000-000000000001';
        if (isLegacyNeo) {
          // Backward compatibility for existing NÉO restaurant tables during phased rollout:
          // Retry legacy restaurant order without the pending concept_id column
          const legacyPayload = { ...orderInsertData };
          delete legacyPayload.concept_id;
          delete legacyPayload.marketplace_order_ref;
          delete legacyPayload.marketplace_commission_pct;
          delete legacyPayload.marketplace_commission_usd;
          delete legacyPayload.net_receivable_usd;
          delete legacyPayload.invoice_series;
          delete legacyPayload.invoice_number;

          const { data: legacyRetryData, error: legacyRetryErr } = await supabase
            .from('pos_orders')
            .insert([legacyPayload])
            .select()
            .single();

          if (legacyRetryErr) {
            console.error('Error inserting legacy POS order into Supabase:', legacyRetryErr);
            return { success: false, error: legacyRetryErr.message };
          }
          orderData = legacyRetryData;
        } else {
          // Strictly reject non-legacy multi-concept checkout with clear activation message
          console.error('Multi-concept ordering blocked: pending database schema migration.');
          return {
            success: false,
            error: `Multi-concept POS ordering is pending database schema migration (concept_id on pos_orders). Please run the approved migration (20261106_multiconcept_pos_schema.sql) in staging before processing orders for this concept.`
          };
        }
      } else {
        console.error('Error inserting direct POS order into Supabase:', orderErr);
        return { success: false, error: orderErr.message };
      }
    }

    const orderId = orderData.id;
    persistedOrderId = orderId;

    // Insert line items preserving persistent line_item_id and structured canonical modifiers
    let insertedItems: any[] = [];
    if (payload.items && payload.items.length > 0) {
      const itemsToInsert = payload.items.map((item) => {
        const lineId = item.line_item_id || (typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : 'line-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8));

        return {
          order_id: orderId,
          concept_id: resolvedConceptId,
          line_item_id: lineId,
          product_id: String(item.product_id || ''),
          product_name: item.name || 'Item',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total_price: (item.quantity || 1) * (item.unit_price || 0),
          customizations: modifierText(readModifiers(item)),
          customizations_json: serializeModifiers(readModifiers(item)),
          comment: item.comment || null,
          created_at: new Date().toISOString()
        };
      });

      const { data: resItems, error: itemsErr } = await supabase
        .from('pos_order_items')
        .insert(itemsToInsert)
        .select();

      if (itemsErr) {
        return { success: false, orderId, error: 'Order was created but items could not be saved: ' + itemsErr.message };
      } else if (resItems?.length === itemsToInsert.length) {
        insertedItems = resItems;
      } else {
        return { success: false, orderId, error: 'Not all saved order lines could be confirmed. Reload this order before finalizing.' };
      }
    }

    // Explicit Inventory Commit Point:
    // Only deduct inventory when order is paid / finalized OR explicitly marked as committed.
    // Draft dine-in tables DO NOT deduct inventory prematurely!
    const isCommitted = isActuallyPaid || payload.is_inventory_commit === true;
    let inventoryResult: any = null;

    if (isCommitted && insertedItems && insertedItems.length > 0) {
      inventoryResult = await deductPosOrderInventory(
        orderId,
        branchIdStr,
        insertedItems,
        restaurantId,
        payload.cashierName,
        canonicalChannel
      );
    }

    // Phase 11 Tenders Recording (Canonical procedure)
    if (isActuallyPaid) {
      try {
        await recordOrderTenderReceivable({
          restaurantId,
          branchId: branchIdStr,
          orderId: Number(orderId),
          paymentMethod: payload.paymentMethod || 'Cash USD',
          total: total,
          tenderedAmount: resolvedTendered,
          tenderedCurrency: payload.tendered_currency || 'USD',
          changeAmount: payload.change_amount || 0,
          changeCurrency: payload.change_currency || 'USD',
          exchangeRate: 89500,
          clientOrderToken: payload.client_order_token
        });
      } catch (tenderErr) {
        console.warn('[createDirectOrder] Phase 11 tender recording warning:', tenderErr);
      }

      // Concept Invoice Number Allocation (Atomic gapless sequencing)
      try {
        const { data: seqData, error: seqErr } = await supabase.rpc('allocate_concept_invoice_number', {
          p_order_id: Number(orderId),
          p_idempotency_key: payload.client_order_token || `order-${orderId}`,
          p_fiscal_series: 'DEFAULT'
        });
        if (!seqErr && seqData && seqData.invoice_number) {
          orderData.invoice_number = seqData.invoice_number;
          orderData.invoice_sequence_number = seqData.sequence_number;
          orderData.invoice_issued_at = seqData.issued_at;
        }
      } catch (seqEx) {
        console.warn('[createDirectOrder] Invoice sequencing RPC skipped or not yet migrated:', seqEx);
      }
    }

    return {
      success: true,
      order: orderData,
      orderId: orderData.id,
      inventory: inventoryResult
    };
  } catch (err: any) {
    console.error('Exception in createDirectOrder:', err);
    return { success: false, orderId: persistedOrderId, error: err.message };
  }
}

/**
 * Non-destructive deterministic update of direct POS order and its line items.
 * Preserves stable line_item_id identities across edits, kitchen firing, and payment retries.
 */
export async function updateDirectOrderStatus(orderId: number | string, patch: any) {
  try {
    const rid = getGlobalRestaurantId();
    if (!rid) throw new Error('Restaurant context is required.');
    const { data: existingOrder, error: orderError } = await supabase.from('pos_orders')
      .select('*').eq('id', orderId).eq('restaurant_id', rid).single();
    if (orderError || !existingOrder) throw new Error(orderError?.message || 'Order not found.');
    const { data: existingRows, error: linesError } = await supabase.from('pos_order_items').select('*').eq('order_id', orderId);
    if (linesError) throw new Error(linesError.message);
    let currentLines = existingRows || [];
    const channel = patch.channel || resolveCanonicalSalesChannel(patch.orderType || existingOrder.order_type, patch.orderSource || existingOrder.order_source);
    if (Array.isArray(patch.items)) {
      const existingMap = new Map<string, any>();
      currentLines.forEach(row => { existingMap.set(String(row.id), row); if (row.line_item_id) existingMap.set(row.line_item_id, row); });
      const rows = patch.items.map((item: any) => {
        const previous = existingMap.get(item.line_item_id || String(item.order_item_id || item.id || ''));
        const mods = item.customizations === undefined && previous ? readModifiers(previous) : readModifiers(item);
        const quantity = Number(item.quantity ?? item.qty ?? previous?.quantity ?? 1);
        const price = Number(item.unit_price ?? previous?.unit_price ?? 0);
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) throw new Error('Invalid item quantity or price.');
        return { ...(previous?.id ? { id: previous.id } : {}), order_id: orderId,
          line_item_id: previous?.line_item_id || item.line_item_id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'line-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)),
          product_id: String(item.product_id ?? previous?.product_id ?? ''),
          product_name: item.name || item.product_name || previous?.product_name || 'Item',
          quantity, unit_price: price, total_price: quantity * price,
          customizations: modifierText(mods), customizations_json: serializeModifiers(mods),
          comment: item.comment ?? item.note ?? previous?.comment ?? null };
      });
      if (new Set(rows.map((r: any) => r.line_item_id)).size !== rows.length) throw new Error('Duplicate order line identity. Reload this order.');
      if (existingOrder.inventory_status === 'COMPLETED' || existingOrder.inventory_status === 'FAILED') {
        // Once stock processing was attempted, keep the original sale snapshot for
        // safe retries. Returns/voids must use the existing reversal workflow.
        const signature = (values: any[]) => JSON.stringify(inventoryLines(values, channel).map(line => ({
          id: line.source_line_id, product: line.product_id, quantity: line.quantity,
          modifiers: line.customizations.map((c: any) => [c.product_customization_id, c.customization_item_id, c.name, c.quantity]).sort()
        })).sort((a, b) => a.id.localeCompare(b.id)));
        const isApprovedReduction = patch.inventory_void === true && existingOrder.inventory_status === 'COMPLETED' && rows.every((row: any) => {
          const previous = currentLines.find(old => old.line_item_id === row.line_item_id);
          return previous && row.quantity <= previous.quantity && signature([{ ...row, quantity: previous.quantity }]) === signature([previous]);
        });
        if (signature(rows) !== signature(currentLines) && !isApprovedReduction) throw new Error('Stock processing has already started for this order. Retry its stock update or use the void/return workflow before changing items.');
      }
      const saved: any[] = [];
      for (const row of rows) {
        const query = row.id
          ? supabase.from('pos_order_items').update(row).eq('id', row.id).eq('order_id', orderId)
          : supabase.from('pos_order_items').insert(row);
        const { data, error } = await query.select().single();
        if (error || !data) throw new Error(error?.message || 'Order item save was not confirmed.');
        saved.push(data);
      }
      // Never delete old lines until every retained/new line has been saved.
      const retained = new Set(saved.map(row => String(row.id)));
      const removed = currentLines.filter(row => !retained.has(String(row.id))).map(row => row.id);
      if (removed.length) {
        const { error } = await supabase.from('pos_order_items').delete().eq('order_id', orderId).in('id', removed);
        if (error) throw new Error(error.message);
      }
      currentLines = saved;
    }
    const paymentReceived = patch.status === 'completed' || patch.status === 'paid' || String(patch.payment_status).toLowerCase() === 'paid';
    const updateData: any = { updated_at: new Date().toISOString() };
    if (paymentReceived && !existingOrder.completed_at) {
      updateData.completed_at = new Date().toISOString();
      if (!['paid','completed'].includes(existingOrder.status) && patch.terminalId) updateData.terminal_id = patch.terminalId;
    }
    for (const key of ['status','payment_method','customer_name','special_instructions','tendered_amount','tendered_currency','change_amount','change_currency','is_scheduled','scheduled_for','scheduled_notes']) {
      if (patch[key] !== undefined) updateData[key] = patch[key];
    }
    if (patch.subtotal !== undefined || patch.subtotal_amount !== undefined) updateData.subtotal_amount = patch.subtotal_amount ?? patch.subtotal;
    if (patch.total !== undefined || patch.total_amount !== undefined) updateData.total_amount = patch.total_amount ?? patch.total;
    if (Array.isArray(patch.items)) updateData.items_count = currentLines.reduce((sum, row) => sum + Number(row.quantity), 0);
    const { data, error } = await supabase.from('pos_orders').update(updateData).eq('id', orderId).eq('restaurant_id', rid).select().single();
    if (error || !data) throw new Error(error?.message || 'Order update was not confirmed.');
    const isNowPaid = patch.status === 'completed' || patch.status === 'paid' || String(patch.payment_status).toLowerCase() === 'paid' || patch.is_inventory_commit === true;
    let inventory: any = null;
    if (isNowPaid) {
      inventory = await deductPosOrderInventory(orderId, data.branch_id, currentLines, data.restaurant_id, data.cashier_name, channel);
      try {
        if (!['paid', 'completed', 'delivered', 'closed'].includes(existingOrder.status)) await recordOrderTenderReceivable({ restaurantId: data.restaurant_id, branchId: data.branch_id, orderId: Number(orderId),
          paymentMethod: data.payment_method || 'Cash USD', total: Number(data.total_amount || 0),
          tenderedAmount: Number(data.tendered_amount ?? data.total_amount ?? 0), tenderedCurrency: data.tendered_currency || 'USD',
          changeAmount: Number(data.change_amount || 0), changeCurrency: data.change_currency || 'USD', exchangeRate: 89500 });
      } catch (error) { console.warn('[updateDirectOrderStatus] Tender recording warning:', error); }

      // Concept Invoice Number Allocation (Atomic gapless sequencing)
      if (!existingOrder.invoice_number) {
        try {
          const { data: seqData, error: seqErr } = await supabase.rpc('allocate_concept_invoice_number', {
            p_order_id: Number(orderId),
            p_idempotency_key: patch.client_order_token || `order-${orderId}`,
            p_fiscal_series: 'DEFAULT'
          });
          if (!seqErr && seqData && seqData.invoice_number) {
            data.invoice_number = seqData.invoice_number;
            data.invoice_sequence_number = seqData.sequence_number;
            data.invoice_issued_at = seqData.issued_at;
          }
        } catch (seqEx) {
          console.warn('[updateDirectOrderStatus] Invoice sequencing RPC skipped or not yet migrated:', seqEx);
        }
      }
    }
    return { success: true, order: data, orderId, inventory };
  } catch (error: any) {
    return { success: false, orderId, error: error.message };
  }
}

/**
 * Resolves the start cutoff ISO timestamp for today's shifts cycle.
 */
export async function getTodayShiftsCutoffIso(
  branchName?: string,
  restaurantId?: string,
  activeShift?: any
): Promise<string | null> {
  try {
    if (activeShift && activeShift.status === 'open') {
      if (activeShift.shift === 'AM') {
        return activeShift.created_at;
      }
      const shiftDate = activeShift.date ? String(activeShift.date).slice(0, 10) : '';
      const rid = restaurantId || getGlobalRestaurantId();
      let query = supabase
        .from('shift_cash')
        .select('id, date, shift, status, created_at, closed_at, branch')
        .eq('shift', 'AM')
        .order('created_at', { ascending: false })
        .limit(5);

      if (rid) query = query.eq('restaurant_id', rid);
      const { data } = await query;
      const sameDayAm = (data || []).find((s) => s.date && String(s.date).slice(0, 10) === shiftDate);
      if (sameDayAm && sameDayAm.created_at) {
        return sameDayAm.created_at;
      }
      return activeShift.created_at;
    }

    const rid = restaurantId || getGlobalRestaurantId();
    let query = supabase
      .from('shift_cash')
      .select('id, date, shift, status, created_at, closed_at, branch')
      .order('created_at', { ascending: false })
      .limit(10);

    if (rid) query = query.eq('restaurant_id', rid);
    const { data: shifts, error } = await query;
    if (error || !shifts || shifts.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today.toISOString();
    }

    let branchShifts = shifts;
    if (branchName && branchName.toLowerCase() !== 'all') {
      const core = branchName.toLowerCase().replace(/\s*\(bistro\)/i, '').trim();
      const filtered = shifts.filter((s) => {
        if (!s.branch) return true;
        const b = s.branch.toLowerCase().replace(/\s*\(bistro\)/i, '').trim();
        return b === core || s.branch.toLowerCase().includes(core);
      });
      if (filtered.length > 0) branchShifts = filtered;
    }

    const openShift = branchShifts.find((s) => s.status === 'open');
    if (openShift) {
      if (openShift.shift === 'AM') {
        return openShift.created_at;
      }
      const openDate = openShift.date ? String(openShift.date).slice(0, 10) : '';
      const sameDayAm = branchShifts.find(
        (s) => s.shift === 'AM' && s.date && String(s.date).slice(0, 10) === openDate
      );
      if (sameDayAm && sameDayAm.created_at) {
        return sameDayAm.created_at;
      }
      return openShift.created_at;
    }

    const latestClosedPm = branchShifts.find((s) => s.shift === 'PM' && s.status === 'closed');
    if (latestClosedPm) {
      return latestClosedPm.closed_at || latestClosedPm.created_at;
    }

    const latestShift = branchShifts[0];
    return latestShift?.closed_at || latestShift?.created_at || new Date().toISOString();
  } catch (err) {
    console.warn('Error computing shift cutoff:', err);
    return null;
  }
}

export async function fetchDirectOrders(
  restaurantId?: string,
  branchId?: number | string,
  flowBranchId?: string,
  shiftCutoffTime?: string | null,
  conceptId?: string | null
) {
  try {
    const rid = restaurantId || getGlobalRestaurantId();
    let query = supabase
      .from('pos_orders')
      .select('*, pos_order_items(*)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (rid) query = query.eq('restaurant_id', rid);
    if (conceptId) query = query.eq('concept_id', conceptId);
    if (branchId || flowBranchId) {
      const bVals = Array.from(
        new Set([branchId ? String(branchId) : null, flowBranchId ? String(flowBranchId) : null].filter(Boolean))
      ) as string[];
      if (bVals.length > 1) {
        query = query.in('branch_id', bVals);
      } else if (bVals.length === 1) {
        query = query.eq('branch_id', bVals[0]);
      }
    }
    if (shiftCutoffTime) {
      query = query.or(
        `created_at.gte.${shiftCutoffTime},status.in.(held,preparing,new,confirmed,ready,open,occupied,bill_requested),order_source.eq.SYNTHETIC_MIGRATION`
      );
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching orders from Supabase:', error);
      return { success: false, orders: [] };
    }

    return { success: true, orders: data || [] };
  } catch (err) {
    console.error('Exception in fetchDirectOrders:', err);
    return { success: false, orders: [] };
  }
}

export async function claimDirectOrder(orderId: number | string, cashierName?: string, terminalId?: string) {
  try {
    const { data, error } = await supabase
      .from('pos_orders')
      .update({
        cashier_name: cashierName || 'Cashier',
        terminal_id: terminalId || 'FLOW-TERM-01',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, order: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Unified Inventory: Deduct finished goods and recipes for order line items
 * - Enforces explicit branch security (no Badaro UUID fallback)
 * - Persists durable reconciliation failure state in pos_orders
 * - Passes canonical sales channel (DINE_IN, TAKEAWAY, DELIVERY)
 */
export async function deductPosOrderInventory(
  orderId: number | string,
  branchId: number | string | undefined,
  lineItems: Array<any>,
  restaurantId?: string,
  cashierName?: string,
  channel?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
) {
  try {
    if (!branchId || String(branchId).trim() === '') {
      const errMsg = 'INVALID_INVENTORY_BRANCH: Missing branch identifier. Inventory deduction requires authenticated session branch.';
      console.error(`[posOrderService] ${errMsg}`);
      await recordInventoryFailure(orderId, errMsg);
      return { success: false, error: errMsg };
    }
    const branchIdStr = String(branchId);

    const deductionItems = inventoryLines(lineItems || [], channel || 'DINE_IN');
    if (!deductionItems.length) throw new Error('This order has no saved sale lines to process.');

    const { data: invRes, error: invErr } = await supabase.rpc('process_sale_inventory_deduction', {
      p_order_id: String(orderId),
      p_source_type: 'POS_ORDER',
      p_raw_branch_id: branchIdStr,
      p_items: deductionItems,
      p_restaurant_id: restaurantId || getGlobalRestaurantId(),
      p_created_by: cashierName || 'Cashier'
    });

    if (invErr || invRes?.success !== true) {
      const failure = invErr?.message || invRes?.error || invRes?.message || 'Inventory processing was not confirmed.';
      console.error('[posOrderService] Inventory deduction error:', failure);
      await recordInventoryFailure(orderId, failure);
      return { success: false, error: failure };
    }

    // Record successful durable inventory commit
    const { error: stateError } = await supabase
      .from('pos_orders')
      .update({
        inventory_status: 'COMPLETED',
        inventory_error: null,
        inventory_resolved_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (stateError) return { success: false, error: 'Stock was processed but its status could not be saved. Retry the same order to confirm: ' + stateError.message };
    return invRes;
  } catch (err: any) {
    console.error('[posOrderService] Inventory deduction exception:', err);
    await recordInventoryFailure(orderId, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Records durable inventory failure state into pos_orders
 */
async function recordInventoryFailure(orderId: number | string, errorMessage: string) {
  try {
    const { data: ord } = await supabase
      .from('pos_orders')
      .select('inventory_retry_count')
      .eq('id', orderId)
      .maybeSingle();

    const nextCount = (ord?.inventory_retry_count || 0) + 1;

    await supabase
      .from('pos_orders')
      .update({
        inventory_status: 'FAILED',
        inventory_error: errorMessage,
        inventory_failed_at: new Date().toISOString(),
        inventory_last_retry_at: new Date().toISOString(),
        inventory_retry_count: nextCount
      })
      .eq('id', orderId);
  } catch (recordErr) {
    console.warn('[posOrderService] Could not persist inventory failure status:', recordErr);
  }
}

/**
 * Retries failed inventory deduction for an order using the SAME order_id and line_item_id
 */
export async function retryOrderInventoryDeduction(orderId: number | string) {
  try {
    const { data: ord, error: ordErr } = await supabase
      .from('pos_orders')
      .select('*, pos_order_items(*)')
      .eq('restaurant_id', getGlobalRestaurantId())
      .eq('id', orderId)
      .single();

    if (ordErr || !ord) {
      return { success: false, error: ordErr?.message || 'Order not found' };
    }

    if (['cancelled', 'voided', 'refunded'].includes(String(ord.status).toLowerCase())) return { success: false, error: 'Cancelled or refunded orders cannot be deducted again.' };
    if (ord.inventory_status !== 'FAILED' && ord.inventory_status !== 'COMPLETED') return { success: false, error: 'This order has not reached the inventory commit point.' };
    const channel = resolveCanonicalSalesChannel(ord.order_type, ord.order_source);
    return await deductPosOrderInventory(
      ord.id,
      ord.branch_id,
      ord.pos_order_items || [],
      ord.restaurant_id,
      ord.cashier_name,
      channel
    );
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Unified Inventory: Reverse finished goods / recipe deduction when item voided before preparation
 * - Enforces explicit branch security (no Badaro UUID fallback)
 */
export async function reversePosOrderInventory(
  orderId: number | string,
  branchId: number | string | undefined,
  lineId: number | string,
  productId: number | string,
  quantity: number,
  restaurantId?: string,
  reason?: string,
  cashierName?: string
) {
  try {
    if (!branchId || String(branchId).trim() === '') {
      throw new Error('INVALID_INVENTORY_BRANCH: Missing branch identifier for void reversal.');
    }

    const { data, error } = await supabase.rpc('process_sale_void_reversal', {
      p_order_id: String(orderId),
      p_source_type: 'POS_ORDER',
      p_raw_branch_id: String(branchId),
      p_line_id: String(lineId),
      p_product_id: parseInt(String(productId), 10),
      p_quantity: Number(quantity || 1),
      p_restaurant_id: restaurantId || getGlobalRestaurantId(),
      p_created_by: cashierName || 'Cashier',
      p_reason: reason || 'Voided before preparation'
    });

    if (error) {
      console.error('[posOrderService] Void reversal error:', error);
      return { success: false, error: error.message };
    }

    return data || { success: true };
  } catch (err: any) {
    console.error('[posOrderService] Void reversal exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Records Phase 11 Order Tender Receivable using the canonical database RPC
 */
export async function recordOrderTenderReceivable(params: {
  restaurantId: string;
  branchId: string;
  orderId: number;
  paymentMethod: string;
  total: number;
  tenderedAmount: number;
  tenderedCurrency: string;
  changeAmount: number;
  changeCurrency: string;
  exchangeRate: number;
  clientOrderToken?: string;
  tenderSequence?: number;
  sourceTenderKey?: string;
}) {
  const methodUpper = (params.paymentMethod || '').toUpperCase();
  let tenderType = 'CASH';
  let collectionParty = 'RESTAURANT_CASHIER';

  if (methodUpper.includes('CARD') || methodUpper.includes('VISA') || methodUpper.includes('MASTERCARD')) {
    tenderType = 'CREDIT_CARD';
    collectionParty = 'PAYMENT_PROCESSOR';
  } else if (methodUpper.includes('TOTERS') || methodUpper.includes('NOKNOK') || methodUpper.includes('AGGREGATOR')) {
    tenderType = 'MARKETPLACE_COLLECTION';
    collectionParty = 'MARKETPLACE_PLATFORM';
  } else if (methodUpper.includes('WALLET')) {
    tenderType = 'E_WALLET';
    collectionParty = 'PAYMENT_PROCESSOR';
  }

  const seq = params.tenderSequence || 1;
  const sourceKey = params.sourceTenderKey || `${params.orderId}_t${seq}`;

  const { data, error } = await supabase.rpc('create_order_tender_receivable', {
    p_restaurant_id: params.restaurantId,
    p_branch_id: String(params.branchId),
    p_pos_order_id: Number(params.orderId),
    p_tender_sequence: seq,
    p_source_tender_key: sourceKey,
    p_business_date: new Date().toISOString().split('T')[0],
    p_completed_at: new Date().toISOString(),
    p_tender_type: tenderType,
    p_tender_currency: params.tenderedCurrency || 'USD',
    p_tendered_amount: Number(params.tenderedAmount || params.total),
    p_change_amount: Number(params.changeAmount || 0),
    p_change_currency: params.changeCurrency || 'USD',
    p_net_receivable_amount: Number(params.total),
    p_gratuity_amount: 0,
    p_collection_party: collectionParty,
    p_platform_id: null,
    p_provider_payment_reference: params.clientOrderToken || null,
    p_exchange_rate_applied: Number(params.exchangeRate || 89500)
  });

  if (error) {
    console.warn('[recordOrderTenderReceivable] Error recording tender receivable:', error.message);
  }
  return data;
}

/**
 * Records Phase 11 Order Tender Refund using the canonical database RPC
 */
export async function recordOrderTenderRefund(params: {
  orderId: number | string;
  restaurantId?: string;
  branchId: string;
  refundAmount: number;
  refundType?: 'CASH_REFUND' | 'CARD_REFUND';
  reason?: string;
  gatewayReference?: string;
  shiftId?: string;
  operationId?: string;
}) {
  try {
    const defaultRestaurantId = params.restaurantId || getGlobalRestaurantId() || '79256f11-a9f8-4fec-901d-69baf929762d';
    
    // 1. Locate open tender receivables for this order (LIFO order for refund allocation)
    const { data: tenders, error: findErr } = await supabase
      .from('order_tender_receivables')
      .select('id, net_receivable_amount, tender_type, tender_sequence')
      .eq('pos_order_id', Number(params.orderId))
      .eq('restaurant_id', defaultRestaurantId)
      .gt('net_receivable_amount', 0)
      .order('tender_sequence', { ascending: false });

    if (findErr) {
      return { success: false, error: `Failed to query open tenders: ${findErr.message}` };
    }

    if (!tenders || tenders.length === 0) {
      console.warn('[posOrderService] No open tender receivable found for order refund:', params.orderId);
      return { success: false, error: 'NO_OPEN_TENDER' };
    }

    const totalOpenAmount = tenders.reduce((sum, t) => sum + Number(t.net_receivable_amount || 0), 0);
    if (Number(params.refundAmount) > totalOpenAmount + 0.001) {
      return { success: false, error: 'Refund amount exceeds open tender receivables' };
    }

    let remainingToRefund = Number(params.refundAmount);
    let totalRefundedSoFar = 0;
    const completedPortions: Array<{
      tenderId: any;
      amount: number;
      refundId: any;
      gatewayReference?: string;
    }> = [];
    let lastRefundId: any = null;
    const baseOpId = params.operationId || params.gatewayReference || `ref-${params.orderId}`;

    for (let i = 0; i < tenders.length; i++) {
      if (remainingToRefund <= 0.001) break;
      const targetTender = tenders[i];
      const tenderAvailable = Number(targetTender.net_receivable_amount || 0);
      if (tenderAvailable <= 0) continue;

      const currentRefund = Math.min(remainingToRefund, tenderAvailable);
      const resolvedRefundType = params.refundType || (targetTender.tender_type === 'CASH' ? 'CASH_REFUND' : 'CARD_REFUND');
      const portionGatewayRef = `${baseOpId}:part_${i + 1}:${targetTender.id}`;

      const { data: refundId, error: refundErr } = await supabase.rpc('record_order_tender_refund', {
        p_restaurant_id: defaultRestaurantId,
        p_branch_id: String(params.branchId),
        p_tender_id: targetTender.id,
        p_refund_amount: Number(currentRefund),
        p_refund_type: resolvedRefundType,
        p_refund_reason: params.reason || 'POS order refund',
        p_gateway_reference: portionGatewayRef,
        p_shift_id: params.shiftId || null
      });

      if (refundErr) {
        console.error('[posOrderService] record_order_tender_refund error on portion:', refundErr);
        return {
          success: false,
          error: refundErr.message,
          partialSuccess: totalRefundedSoFar > 0,
          amountRefundedSoFar: totalRefundedSoFar,
          completedPortions,
          lastRefundId
        };
      }

      lastRefundId = refundId;
      totalRefundedSoFar += currentRefund;
      completedPortions.push({
        tenderId: targetTender.id,
        amount: currentRefund,
        refundId,
        gatewayReference: portionGatewayRef
      });
      remainingToRefund -= currentRefund;
    }

    return {
      success: true,
      refundId: lastRefundId,
      amountRefundedSoFar: totalRefundedSoFar,
      completedPortions
    };
  } catch (err: any) {
    console.error('[posOrderService] recordOrderTenderRefund exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Cancels an issued invoice (Standard or A-series) with a mandatory audit reason.
 * The original invoice reference and allocated sequence number are strictly preserved.
 */
export async function cancelOrderInvoice(
  orderId: number | string,
  reason: string,
  canceledBy?: string
) {
  try {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A mandatory cancellation reason must be provided.' };
    }

    const { data, error } = await supabase.rpc('cancel_pos_order_invoice', {
      p_order_id: Number(orderId),
      p_reason: reason.trim(),
      p_canceled_by: canceledBy || 'Authorized Cashier'
    });

    if (error) {
      console.error('[posOrderService] cancel_pos_order_invoice error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[posOrderService] cancelOrderInvoice exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Deletes an unissued draft order that has not received an invoice number.
 * Physical deletion of already issued invoices is strictly blocked.
 */
export async function deleteDraftOrder(orderId: number | string) {
  try {
    const { data, error } = await supabase.rpc('delete_unissued_pos_order', {
      p_order_id: Number(orderId)
    });

    if (error) {
      console.error('[posOrderService] delete_unissued_pos_order error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[posOrderService] deleteDraftOrder exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Authoritative single-order fetcher with full line items hydration.
 * Checks Supabase direct pos_orders first (source of truth for table orders),
 * falls back to legacy orders table, table_label active order matching,
 * and finally Commerce API if available.
 */
export async function fetchOrderWithItems(
  orderId?: string | number | null,
  tableCode?: string | null,
  restaurantId?: string | null
): Promise<any | null> {
  const rid = restaurantId || getGlobalRestaurantId();

  // 1. If orderId is provided, check direct Supabase pos_orders first
  if (orderId && String(orderId).trim() !== '' && !String(orderId).startsWith('table-')) {
    try {
      const { data, error } = await supabase
        .from('pos_orders')
        .select('*, pos_order_items(*)')
        .eq('id', orderId)
        .maybeSingle();

      if (!error && data) {
        return {
          ...data,
          items: data.pos_order_items || data.items || []
        };
      }
    } catch (err) {
      console.warn('[fetchOrderWithItems] Error fetching pos_orders by id:', err);
    }

    // 2. Try legacy orders table in Supabase
    try {
      const { data: legData, error: legErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (!legErr && legData) {
        return legData;
      }
    } catch (err) {
      // ignore
    }

    // 3. Try Commerce API if available
    if (HAS_COMMERCE_API) {
      try {
        const singleRes = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${orderId}`);
        if (singleRes.ok) {
          const sData = await singleRes.json();
          const ord = sData.order || (sData.id ? sData : null);
          if (ord) return ord;
        }
      } catch {
        // fallback to list
      }
      try {
        const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
        if (res.ok) {
          const d = await res.json();
          const orders = d.orders || (Array.isArray(d) ? d : []);
          const found = orders.find((o: any) => String(o.id) === String(orderId));
          if (found) return found;
        }
      } catch (err) {
        console.warn('[fetchOrderWithItems] Error querying Commerce API:', err);
      }
    }
  }

  // 4. If tableCode is provided (or orderId was null/not found), search active open order by table_label
  if (tableCode) {
    try {
      const clean = String(tableCode).trim();
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

      let query = supabase
        .from('pos_orders')
        .select('*, pos_order_items(*)')
        .in('table_label', variants)
        .in('status', ['held', 'preparing', 'new', 'confirmed', 'ready', 'open', 'occupied', 'bill_requested', 'pending'])
        .order('id', { ascending: false })
        .limit(1);

      if (rid) query = query.eq('restaurant_id', rid);

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return {
          ...data,
          items: data.pos_order_items || data.items || []
        };
      }
    } catch (err) {
      console.warn('[fetchOrderWithItems] Error fetching by tableCode:', err);
    }
  }

  return null;
}
