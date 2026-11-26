import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../api/supabase';
import { COMMERCE_API_BASE, HAS_COMMERCE_API } from '../config';
import { recordDeliveryExpenseForOrder } from '../services/posOrderService';

export interface DriverHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any | null;
  activeCashierId?: string;
  activeCashierName?: string;
  activeShiftId?: string;
  exchangeRate?: number;
  onHandoverSuccess?: (result: any) => void;
}

export const DriverHandoverModal: React.FC<DriverHandoverModalProps> = ({
  isOpen,
  onClose,
  order,
  activeCashierId,
  activeCashierName,
  activeShiftId,
  exchangeRate = 90000,
  onHandoverSuccess
}) => {
  const [tenderedUsd, setTenderedUsd] = useState<string>('');
  const [tenderedLbp, setTenderedLbp] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritatively derive food amount and delivery fee with robust field fallback
  const rawDeliveryFee = Number(order?.deliveryFee ?? order?.delivery_fee ?? 0);
  const rawDiscount = Number(order?.discount ?? order?.discount_amount ?? order?.discountAmount ?? 0);
  
  let rawSubtotal = Number(
    order?.subtotal ??
    order?.subtotal_amount ??
    order?.subtotalAmount ??
    0
  );

  if (rawSubtotal <= 0) {
    const rawTotal = Number(order?.total ?? order?.total_amount ?? order?.totalAmount ?? 0);
    if (rawTotal > 0) {
      rawSubtotal = Math.max(0, rawTotal - rawDeliveryFee + rawDiscount);
    }
  }

  const orderItems = order?.items || order?.pos_order_items || [];
  if (rawSubtotal <= 0 && Array.isArray(orderItems) && orderItems.length > 0) {
    const itemsSum = orderItems.reduce((sum: number, it: any) => {
      const p = Number(it.unit_price ?? it.unit_price_usd ?? it.price ?? it.unitPrice ?? 0);
      const q = Number(it.quantity ?? it.qty ?? 1);
      return sum + (p * q);
    }, 0);
    if (itemsSum > 0) {
      rawSubtotal = itemsSum;
    }
  }

  const foodDue = Math.max(0, rawSubtotal - rawDiscount);
  const customerTotal = foodDue + rawDeliveryFee;
  const deliveryFee = rawDeliveryFee;

  // Rate resolution
  const effectiveRate = Number(order?.exchange_rate || exchangeRate || 90000);

  // Initialize tender when modal opens
  useEffect(() => {
    if (isOpen && order) {
      setTenderedUsd(foodDue > 0 ? foodDue.toFixed(2) : '0');
      setTenderedLbp('0');
      setDriverName(order.driver_name || order.driverName || 'Delivery Driver');
      setDriverPhone(order.driver_phone || order.driverPhone || '');
      setErrorMessage(null);
    }
  }, [isOpen, order, foodDue]);

  const numUsd = parseFloat(tenderedUsd) || 0;
  const numLbp = parseFloat(tenderedLbp) || 0;
  const tenderFromLbpInUsd = effectiveRate > 0 ? numLbp / effectiveRate : 0;
  const totalTenderedUsd = numUsd + tenderFromLbpInUsd;
  const changeUsd = Math.max(0, totalTenderedUsd - foodDue);
  const isTenderSufficient = totalTenderedUsd >= (foodDue - 0.01);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTenderSufficient) {
      setErrorMessage(`Insufficient cash tendered. Total required from driver is $${foodDue.toFixed(2)} USD.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const idempotencyKey = `ho-${order.id}-${Date.now()}`;
    const cleanCashierId = activeCashierId && /^[0-9a-f-]{36}$/i.test(activeCashierId)
      ? activeCashierId
      : '18de2660-4d25-4065-8a77-5be29e746104'; // Canonical cashier UUID

    try {
      // 1. Sync completed & paid status to Railway Commerce API
      if (HAS_COMMERCE_API) {
        try {
          const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'completed',
              payment_status: 'paid',
              tendered_amount: totalTenderedUsd,
              change_amount: changeUsd,
              driver_name: driverName.trim() || 'Driver',
              driver_phone: driverPhone.trim() || null
            })
          });
          if (!res.ok) {
            console.warn(`Commerce API status update HTTP ${res.status}`);
          }
        } catch (apiErr) {
          console.warn('Failed to update status on commerce API:', apiErr);
        }
      }

      // 2. Try calling PostgreSQL stored procedure execute_driver_handover if available
      let rpcSucceeded = false;
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('execute_driver_handover', {
          p_order_id: Number(order.id),
          p_cashier_id: cleanCashierId,
          p_tendered_usd: numUsd,
          p_tendered_lbp: numLbp,
          p_driver_name: driverName.trim() || 'Driver',
          p_driver_phone: driverPhone.trim() || null,
          p_idempotency_key: idempotencyKey
        });
        if (!rpcError) {
          rpcSucceeded = true;
        }
      } catch (e) {}

      // 3. Mark the order as COMPLETED and PAID in pos_orders (closes the order)
      const { error: updateErr } = await supabase
        .from('pos_orders')
        .update({
          status: 'completed',
          payment_status: 'paid',
          tendered_amount: totalTenderedUsd,
          change_amount: changeUsd,
          special_instructions: `Completed via Driver Handover with ${driverName} (${driverPhone || 'No phone'})`,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateErr) {
        console.warn('Direct pos_orders update error (non-fatal if commerce API succeeded):', updateErr);
      }

      // 3b. Ensure invoice number is allocated and delivery fee is recorded as Delivery Expense in Payments
      if (!order.invoice_number) {
        try {
          await supabase.rpc('allocate_concept_invoice_number', {
            p_order_id: Number(order.id),
            p_idempotency_key: idempotencyKey,
            p_fiscal_series: 'DEFAULT'
          });
        } catch {}
      }

      if (deliveryFee > 0) {
        await recordDeliveryExpenseForOrder({
          orderId: order.id,
          deliveryFee,
          orderType: 'delivery',
          orderSource: order.order_source || order.channel || 'WhatsApp',
          paymentMethod: order.payment_method || 'Cash USD',
          customerName: order.customer_name || order.customerName || driverName,
          cashierName: activeCashierName || 'Cashier',
          restaurantId: order.restaurant_id
        }).catch(() => {});
      }

      // 4. Record physical cash-in into active shift movements if shift is open
      const movementOpId = idempotencyKey || `ho-${order.id}-${Date.now()}`;
      const shiftTargetId = activeShiftId || 'active-shift';

      // Always persist in local shift cash ledger for instant UI reactivity and offline resilience
      try {
        const cacheKey = `flow_shift_movements_${shiftTargetId}`;
        const existingStr = window.localStorage.getItem(cacheKey);
        const existingList = existingStr ? JSON.parse(existingStr) : [];
        if (numUsd > 0) {
          existingList.unshift({
            id: movementOpId,
            shift_id: shiftTargetId,
            operation_id: movementOpId,
            movement_type: 'cash_in',
            amount: numUsd,
            currency: 'USD',
            reason: `Driver Handover Order #${order.id} (${driverName.trim() || 'Driver'})`,
            created_by: activeCashierName || 'Cashier',
            created_at: new Date().toISOString()
          });
        }
        if (numLbp > 0) {
          existingList.unshift({
            id: `${movementOpId}-lbp`,
            shift_id: shiftTargetId,
            operation_id: `${movementOpId}-lbp`,
            movement_type: 'cash_in',
            amount: numLbp,
            currency: 'LBP',
            reason: `Driver Handover Order #${order.id} (${driverName.trim() || 'Driver'})`,
            created_by: activeCashierName || 'Cashier',
            created_at: new Date().toISOString()
          });
        }
        window.localStorage.setItem(cacheKey, JSON.stringify(existingList));
      } catch (cacheErr) {
        console.warn('Could not cache shift movement locally:', cacheErr);
      }

      // Record in Supabase shift_cash_movements if active shift exists
      if (activeShiftId && !rpcSucceeded) {
        try {
          if (numUsd > 0) {
            const usdPayload: any = {
              shift_id: activeShiftId,
              operation_id: movementOpId,
              movement_type: 'cash_in',
              amount: numUsd,
              currency: 'USD',
              reason: `Driver Handover Order #${order.id} (${driverName.trim() || 'Driver'})`,
              created_by: activeCashierName || 'Cashier'
            };
            const { error: insErr } = await supabase.from('shift_cash_movements').insert([usdPayload]);
            if (insErr) {
              console.warn('shift_cash_movements USD insert error, retrying without operation_id:', insErr);
              delete usdPayload.operation_id;
              await supabase.from('shift_cash_movements').insert([usdPayload]);
            }
          }
          if (numLbp > 0) {
            const lbpPayload: any = {
              shift_id: activeShiftId,
              operation_id: `${movementOpId}-lbp`,
              movement_type: 'cash_in',
              amount: numLbp,
              currency: 'LBP',
              reason: `Driver Handover Order #${order.id} (${driverName.trim() || 'Driver'})`,
              created_by: activeCashierName || 'Cashier'
            };
            const { error: insLbpErr } = await supabase.from('shift_cash_movements').insert([lbpPayload]);
            if (insLbpErr) {
              console.warn('shift_cash_movements LBP insert error, retrying without operation_id:', insLbpErr);
              delete lbpPayload.operation_id;
              await supabase.from('shift_cash_movements').insert([lbpPayload]);
            }
          }
        } catch (movErr) {
          console.warn('Non-fatal error inserting shift_cash_movements:', movErr);
        }
      }

      // 5. Dispatch global events so OrdersHub, ConceptCashModal, and queues immediately reflect the closed order and cash
      try {
        window.dispatchEvent(new CustomEvent('flow:cash_movement_recorded', {
          detail: { shiftId: activeShiftId, orderId: order.id, amountUsd: numUsd, amountLbp: numLbp }
        }));
        window.dispatchEvent(new CustomEvent('flow:order_settled', { detail: { orderId: order.id } }));
        window.dispatchEvent(new CustomEvent('flow:table_settled'));
      } catch (e) {}

      if (onHandoverSuccess) {
        onHandoverSuccess({ success: true, orderId: order.id, status: 'completed' });
      }
      onClose();
    } catch (err: any) {
      console.error('Error during driver handover:', err);
      setErrorMessage(err.message || 'Failed to complete driver handover.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🛵</span>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">Driver Handover & Cash Collection</h3>
              <p className="text-[11px] text-slate-400">Order #{order.id} • {order.customerName || 'WhatsApp Direct Order'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Financial Breakdown Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                Food Amount To Collect
              </span>
              <div className="text-xl font-black text-emerald-700 mt-0.5">
                ${foodDue.toFixed(2)}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                Enters Restaurant Drawer
              </span>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block">
                  Driver Delivery Fee
                </span>
                <span className="text-[9px] bg-blue-200 text-blue-800 font-extrabold px-1.5 py-0.2 rounded">
                  Driver Retains
                </span>
              </div>
              <div className="text-xl font-black text-blue-700 mt-0.5">
                ${deliveryFee.toFixed(2)}
              </div>
              <span className="text-[10px] text-blue-600 font-semibold block mt-1">
                Does NOT enter drawer
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Total Customer Pays Driver:</span>
            <span className="font-extrabold text-slate-900">${customerTotal.toFixed(2)} USD</span>
          </div>

          {/* Tender Inputs */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Cash Received From Driver</span>
              <span className="text-[11px] text-slate-500 font-mono">Rate: 1 USD = {effectiveRate.toLocaleString()} LBP</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">USD Tendered</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tenderedUsd}
                    onChange={(e) => setTenderedUsd(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">LBP Tendered</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">ل.ل</span>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={tenderedLbp}
                    onChange={(e) => setTenderedLbp(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Change and Summary */}
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Received (USD Equivalent)</span>
                <span className="text-sm font-extrabold text-slate-900 font-mono">${totalTenderedUsd.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Change Due to Driver</span>
                <span className={`text-sm font-black font-mono ${changeUsd > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                  ${changeUsd.toFixed(2)} USD
                </span>
              </div>
            </div>
          </div>

          {/* Driver Details */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Driver Name</label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                placeholder="e.g. Charbel"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Driver Phone (Optional)</label>
              <input
                type="text"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
                placeholder="+961..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isTenderSufficient}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
            >
              <span>{isSubmitting ? 'Processing...' : '✓ Collect Cash & Close Order'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
