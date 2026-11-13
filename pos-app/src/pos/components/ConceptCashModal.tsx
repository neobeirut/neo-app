import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../api/supabase';
import { COMMERCE_API_BASE, HAS_COMMERCE_API } from '../config';
import type { ShiftCashRecord } from '../services/shiftCashBridge';

export function getOrderFoodDue(ord: any): number {
  if (!ord) return 0;
  const rawDelivery = Number(ord.delivery_fee ?? ord.deliveryFee ?? 0);
  const rawDiscount = Number(ord.discount_amount ?? ord.discount ?? ord.discountAmount ?? 0);
  let sub = Number(ord.subtotal_amount ?? ord.subtotal ?? ord.subtotalAmount ?? 0);

  if (sub <= 0) {
    const rawTotal = Number(ord.total_amount ?? ord.total ?? ord.totalAmount ?? 0);
    if (rawTotal > 0) {
      sub = Math.max(0, rawTotal - rawDelivery + rawDiscount);
    }
  }

  const items = ord.items || ord.pos_order_items || [];
  if (sub <= 0 && Array.isArray(items) && items.length > 0) {
    const itemsSum = items.reduce((sum: number, it: any) => {
      const p = Number(it.unit_price ?? it.unit_price_usd ?? it.price ?? it.unitPrice ?? 0);
      const q = Number(it.quantity ?? it.qty ?? 1);
      return sum + (p * q);
    }, 0);
    if (itemsSum > 0) {
      sub = itemsSum;
    }
  }

  return Math.max(0, sub - rawDiscount);
}

export function getOrderDeliveryFee(ord: any): number {
  if (!ord) return 0;
  return Number(ord.delivery_fee ?? ord.deliveryFee ?? 0);
}

export interface ConceptCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeConcept: { id: string; code: string; name: string; primary_color?: string };
  activeShift: ShiftCashRecord | null;
  branchId?: string;
  branchName?: string;
  terminalId?: string;
  cashierName?: string;
  cashierId?: string;
  onOpenShift: (params: { openingUsd: number; openingLbp: number; shift?: 'AM' | 'PM' | 'ALL DAY' }) => Promise<{ success: boolean; error?: string }>;
  onCloseShift: (params: any) => Promise<{ success: boolean; error?: string }>;
  onTriggerHandoverOrder?: (order: any) => void;
}

export const ConceptCashModal: React.FC<ConceptCashModalProps> = ({
  isOpen,
  onClose,
  activeConcept,
  activeShift,
  branchId,
  branchName,
  terminalId = 'FLOW-TERM-01',
  cashierName = 'Cashier',
  cashierId,
  onOpenShift,
  onCloseShift,
  onTriggerHandoverOrder
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'handovers' | 'cashout' | 'transfer' | 'close' | 'history'>('status');

  // Open Shift Form State
  const [openUsd, setOpenUsd] = useState<string>('50.00');
  const [openLbp, setOpenLbp] = useState<string>('0');
  const [isOpening, setIsOpening] = useState<boolean>(false);

  // Cash Out Form State
  const [cashOutAmount, setCashOutAmount] = useState<string>('');
  const [cashOutCurrency, setCashOutCurrency] = useState<'USD' | 'LBP'>('USD');
  const [cashOutCategory, setCashOutCategory] = useState<string>('SUPPLIES');
  const [cashOutVendor, setCashOutVendor] = useState<string>('');
  const [cashOutReason, setCashOutReason] = useState<string>('');
  const [isSubmittingCashOut, setIsSubmittingCashOut] = useState<boolean>(false);

  // Transfer Form State
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferCurrency, setTransferCurrency] = useState<'USD' | 'LBP'>('USD');
  const [transferTarget, setTransferTarget] = useState<string>('SAFE');
  const [transferReason, setTransferReason] = useState<string>('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);

  // Close Shift Blind Count Form State
  const [actualUsd, setActualUsd] = useState<string>('');
  const [actualLbp, setActualLbp] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [showVariancePreview, setShowVariancePreview] = useState<boolean>(false);

  // Data lists
  const [pendingHandoverOrders, setPendingHandoverOrders] = useState<any[]>([]);
  const [shiftMovements, setShiftMovements] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch pending handover orders and shift movements
  const loadData = async () => {
    if (!isOpen) return;
    setIsLoadingData(true);
    try {
      // 1. Fetch orders eligible for driver handover (WhatsApp or Direct COD orders not yet dispatched)
      let orders: any[] = [];
      if (HAS_COMMERCE_API) {
        try {
          const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
          if (res.ok) {
            const json = await res.json();
            const list = Array.isArray(json) ? json : (json.orders || []);
            orders = list.filter((o: any) => {
              const st = String(o.status || '').toLowerCase();
              const isPending = ['preparing', 'ready', 'open', 'confirmed', 'new'].includes(st);
              const cId = String(o.concept_id || o.concept || '').toLowerCase();
              const isConceptMatch = !cId || cId === activeConcept.id.toLowerCase() ||
                (activeConcept.id.includes('00000000-0000-0000-0000-000000000002') && (cId.includes('ovrload') || !cId.includes('00000000-0000-0000-0000-000000000001')));
              return isPending && isConceptMatch;
            });
          }
        } catch (apiErr) {
          console.warn('Could not fetch pending handover orders from Commerce API:', apiErr);
        }
      }

      if (orders.length === 0) {
        let { data: rawOrders, error: ordersErr } = await supabase
          .from('pos_orders')
          .select('*, items:pos_order_items(*)')
          .eq('concept_id', activeConcept.id)
          .in('status', ['preparing', 'ready', 'open', 'confirmed'])
          .order('created_at', { ascending: false });

        if (ordersErr && (String(ordersErr.message || '').includes('concept_id') || (ordersErr as any).code === '42703' || (ordersErr as any).code === 'PGRST204')) {
          const fallback = await supabase
            .from('pos_orders')
            .select('*, items:pos_order_items(*)')
            .in('status', ['preparing', 'ready', 'open', 'confirmed'])
            .order('created_at', { ascending: false });
          rawOrders = (fallback.data || []).filter((o: any) => !o.concept_id || o.concept_id === activeConcept.id);
        }
        orders = rawOrders || [];
      }
      setPendingHandoverOrders(orders);

      // 2. Fetch shift movements and completed cash collections if shift is open
      if (activeShift?.id) {
        let loadedMovements: any[] = [];

        // A. Remote Supabase movements
        try {
          const { data: dbMovements, error: movErr } = await supabase
            .from('shift_cash_movements')
            .select('*')
            .eq('shift_id', activeShift.id)
            .order('created_at', { ascending: false });

          if (!movErr && dbMovements) {
            loadedMovements = [...dbMovements];
          }
        } catch (dbErr) {
          console.warn('Could not load remote shift movements:', dbErr);
        }

        // B. Local cache movements for this active shift
        try {
          const cacheKey = `flow_shift_movements_${activeShift.id}`;
          const localStr = window.localStorage.getItem(cacheKey);
          if (localStr) {
            const localList = JSON.parse(localStr);
            const knownIds = new Set(loadedMovements.map(m => m.id || m.operation_id));
            for (const lm of localList) {
              if (!knownIds.has(lm.id) && !knownIds.has(lm.operation_id)) {
                loadedMovements.push(lm);
                knownIds.add(lm.id);
              }
            }
          }
        } catch (cacheErr) {
          console.warn('Could not read cached shift movements:', cacheErr);
        }

        // C. Retroactively / authoritatively pull completed cash orders (POS, App, WhatsApp) for this shift
        try {
          const shiftStartTime = activeShift.opened_at || activeShift.created_at;
          let completedOrders: any[] = [];

          if (HAS_COMMERCE_API) {
            try {
              const res = await fetch(`${COMMERCE_API_BASE}/api/pos/orders?type=all`);
              if (res.ok) {
                const json = await res.json();
                const list = Array.isArray(json) ? json : (json.orders || []);
                completedOrders = list.filter((o: any) => {
                  const st = String(o.status || '').toLowerCase();
                  const pSt = String(o.payment_status || '').toLowerCase();
                  const isCompleted = ['completed', 'delivered', 'paid'].includes(st) || pSt === 'paid';
                  const cId = String(o.concept_id || o.concept || '').toLowerCase();
                  const isConceptMatch = !cId || cId === activeConcept.id.toLowerCase() ||
                    (activeConcept.id.includes('00000000-0000-0000-0000-000000000002') && (cId.includes('ovrload') || !cId.includes('00000000-0000-0000-0000-000000000001')));
                  return isCompleted && isConceptMatch;
                });
              }
            } catch (apiErr) {
              console.warn('Could not fetch completed orders from Commerce API:', apiErr);
            }
          }

          if (completedOrders.length === 0) {
            let completedQuery = supabase
              .from('pos_orders')
              .select('*, items:pos_order_items(*)')
              .eq('status', 'completed')
              .order('completed_at', { ascending: false })
              .limit(50);

            let { data: sbCompleted, error: compErr } = await completedQuery.eq('concept_id', activeConcept.id);
            if (compErr && (String(compErr.message || '').includes('concept_id') || (compErr as any).code === '42703')) {
              const fallbackComp = await supabase
                .from('pos_orders')
                .select('*, items:pos_order_items(*)')
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
                .limit(50);
              sbCompleted = (fallbackComp.data || []).filter((o: any) => !o.concept_id || o.concept_id === activeConcept.id);
            }
            completedOrders = sbCompleted || [];
          }

          if (completedOrders && completedOrders.length > 0) {
            const existingReasons = loadedMovements.map(m => String(m.reason || ''));
            const existingIds = new Set(loadedMovements.map(m => String(m.pos_order_id || m.id || m.operation_id || '')));

            for (const ord of completedOrders) {
              // Ensure order belongs to current shift window if shiftStartTime is available
              if (shiftStartTime) {
                const orderTime = ord.completed_at || ord.created_at;
                if (orderTime && new Date(orderTime) < new Date(shiftStartTime)) {
                  continue;
                }
              }

              const orderIdStr = String(ord.id);
              const alreadyPresent = existingIds.has(orderIdStr) ||
                existingReasons.some(r => r.includes(`Order #${orderIdStr}`) || r.includes(`Sale #${orderIdStr}`));

              if (!alreadyPresent) {
                const ch = String(ord.order_source || ord.channel || 'POS');
                const chLower = ch.toLowerCase();
                const pm = String(ord.payment_method || '').toLowerCase();

                // Exclude non-cash aggregators like Toters and NokNok (platform settlements, not register drawer cash)
                const isAggregator = chLower.includes('toter') || chLower.includes('nok') || pm.includes('toter') || pm.includes('nok');
                // Exclude card payments (electronic, not physical cash drawer)
                const isCard = pm.includes('card') || pm.includes('credit') || pm.includes('stripe');

                const isCashPayment = !isAggregator && !isCard && (
                  !ord.payment_method ||
                  pm.includes('cash') ||
                  ord.payment_status === 'paid' ||
                  String(ord.special_instructions || '').toLowerCase().includes('driver handover') ||
                  chLower.includes('pos') ||
                  chLower.includes('app') ||
                  chLower.includes('whatsapp')
                );

                if (isCashPayment) {
                  const foodCollected = getOrderFoodDue(ord);
                  const totalCollected = foodCollected > 0 ? foodCollected : Number(ord.tendered_amount || ord.total_amount || ord.total || 0);

                  if (totalCollected > 0) {
                    const isHandover = String(ord.special_instructions || '').includes('Driver Handover');
                    const isAppOrder = chLower.includes('app') || chLower.includes('mobile');
                    const isPosOrder = chLower.includes('pos') || chLower.includes('walk');
                    const reasonLabel = isHandover
                      ? (ord.special_instructions || `Driver Handover Order #${ord.id} (${ord.customer_name || 'Driver'})`)
                      : isAppOrder
                      ? `App Cash Order #${ord.id} (${ord.customer_name || 'App Customer'})`
                      : isPosOrder
                      ? `POS Cash Sale #${ord.id} (${ord.customer_name || 'Walk-in'})`
                      : `${ch} Cash Order #${ord.id} (${ord.customer_name || 'Customer'})`;

                    loadedMovements.push({
                      id: `cash-order-${ord.id}`,
                      shift_id: activeShift.id,
                      operation_id: `cash-order-${ord.id}`,
                      movement_type: 'cash_in',
                      amount: totalCollected,
                      currency: 'USD',
                      reason: reasonLabel,
                      created_by: activeShift.user_name || cashierName,
                      created_at: ord.completed_at || ord.created_at || new Date().toISOString()
                    });
                  }
                }
              }
            }
          }
        } catch (ordersCompErr) {
          console.warn('Could not aggregate completed orders into cash movements:', ordersCompErr);
        }

        // Sort descending by created_at
        loadedMovements.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setShiftMovements(loadedMovements);
      } else {
        setShiftMovements([]);
      }
    } catch (err) {
      console.warn('Error loading concept cash data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setShowVariancePreview(false);
      setNotification(null);
    }
  }, [isOpen, activeShift?.id, activeConcept.id]);

  // Real-time synchronization when orders settle or driver collections occur
  useEffect(() => {
    const handleUpdateEvent = () => {
      if (isOpen) {
        loadData();
      }
    };

    window.addEventListener('flow:order_settled', handleUpdateEvent);
    window.addEventListener('flow:cash_movement_recorded', handleUpdateEvent);
    window.addEventListener('flow:order_created', handleUpdateEvent);

    return () => {
      window.removeEventListener('flow:order_settled', handleUpdateEvent);
      window.removeEventListener('flow:cash_movement_recorded', handleUpdateEvent);
      window.removeEventListener('flow:order_created', handleUpdateEvent);
    };
  }, [isOpen, activeShift?.id, activeConcept.id]);

  // Derived shift cash calculations
  const openingFloatUsd = Number(activeShift?.opening_usd || activeShift?.opening_float_usd || 0);
  const openingFloatLbp = Number(activeShift?.opening_lbp || activeShift?.opening_float_lbp || 0);

  const totalCashInUsd = useMemo(() => {
    return shiftMovements
      .filter(m => m.movement_type === 'cash_in' && m.currency === 'USD')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);
  }, [shiftMovements]);

  const totalCashInLbp = useMemo(() => {
    return shiftMovements
      .filter(m => m.movement_type === 'cash_in' && m.currency === 'LBP')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);
  }, [shiftMovements]);

  const totalCashOutUsd = useMemo(() => {
    return shiftMovements
      .filter(m => ['payout', 'transfer_out', 'cash_drop', 'change_out'].includes(m.movement_type) && m.currency === 'USD')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);
  }, [shiftMovements]);

  const totalCashOutLbp = useMemo(() => {
    return shiftMovements
      .filter(m => ['payout', 'transfer_out', 'cash_drop', 'change_out'].includes(m.movement_type) && m.currency === 'LBP')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);
  }, [shiftMovements]);

  const expectedCashUsd = openingFloatUsd + totalCashInUsd - totalCashOutUsd;
  const expectedCashLbp = openingFloatLbp + totalCashInLbp - totalCashOutLbp;

  if (!isOpen) return null;

  // Handlers
  const handleOpenShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpening(true);
    setNotification(null);
    try {
      const res = await onOpenShift({
        openingUsd: parseFloat(openUsd) || 0,
        openingLbp: parseFloat(openLbp) || 0,
        shift: 'DAY'
      });
      if (res.success) {
        setNotification({ type: 'success', message: `${activeConcept.name} cash shift opened successfully!` });
        await loadData();
      } else {
        setNotification({ type: 'error', message: res.error || 'Failed to open shift.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Error opening shift.' });
    } finally {
      setIsOpening(false);
    }
  };

  const handleCashOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift?.id) {
      setNotification({ type: 'error', message: 'An active shift is required for cash payouts.' });
      return;
    }
    const amt = parseFloat(cashOutAmount);
    if (!amt || amt <= 0) {
      setNotification({ type: 'error', message: 'Enter a valid positive amount.' });
      return;
    }

    setIsSubmittingCashOut(true);
    setNotification(null);
    try {
      // Call RPC execute_concept_cash_out or fallback insert
      const { error: rpcErr } = await supabase.rpc('execute_concept_cash_out', {
        p_shift_id: activeShift.id,
        p_amount: amt,
        p_currency: cashOutCurrency,
        p_expense_category: cashOutCategory,
        p_vendor_or_recipient: cashOutVendor.trim() || 'General Vendor',
        p_reason: cashOutReason.trim() || 'Petty cash disbursement',
        p_authorized_by: cashierName
      });

      const localOutRecord = {
        id: `payout-${Date.now()}`,
        shift_id: activeShift.id,
        operation_id: `payout-${Date.now()}`,
        movement_type: 'payout',
        amount: amt,
        currency: cashOutCurrency,
        reason: `[${cashOutCategory}] ${cashOutVendor}: ${cashOutReason}`,
        authorized_by: cashierName,
        created_by: cashierName,
        created_at: new Date().toISOString()
      };

      try {
        const cacheKey = `flow_shift_movements_${activeShift.id}`;
        const existingStr = window.localStorage.getItem(cacheKey);
        const existingList = existingStr ? JSON.parse(existingStr) : [];
        existingList.unshift(localOutRecord);
        window.localStorage.setItem(cacheKey, JSON.stringify(existingList));
      } catch (cacheErr) {}

      if (rpcErr) {
        // Direct insert fallback with graceful handling of concept_id
        const payload: any = {
          shift_id: activeShift.id,
          operation_id: localOutRecord.operation_id,
          movement_type: 'payout',
          amount: amt,
          currency: cashOutCurrency,
          reason: `[${cashOutCategory}] ${cashOutVendor}: ${cashOutReason}`,
          authorized_by: cashierName,
          created_by: cashierName
        };
        const { error: insErr } = await supabase.from('shift_cash_movements').insert([payload]);
        if (insErr) {
          console.warn('shift_cash_movements direct payout error:', insErr);
        }
      }

      setNotification({ type: 'success', message: `Disbursed ${amt} ${cashOutCurrency} for ${cashOutCategory}.` });
      setCashOutAmount('');
      setCashOutVendor('');
      setCashOutReason('');
      await loadData();
      setActiveTab('history');
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to record cash out.' });
    } finally {
      setIsSubmittingCashOut(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift?.id) {
      setNotification({ type: 'error', message: 'An active shift is required for drawer transfers.' });
      return;
    }
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      setNotification({ type: 'error', message: 'Enter a valid transfer amount.' });
      return;
    }

    setIsSubmittingTransfer(true);
    setNotification(null);
    try {
      const localTransferRecord = {
        id: `transfer-${Date.now()}`,
        shift_id: activeShift.id,
        operation_id: `transfer-${Date.now()}`,
        movement_type: 'transfer_out',
        amount: amt,
        currency: transferCurrency,
        reason: `Transfer to ${transferTarget}: ${transferReason || 'Drawer drop'}`,
        authorized_by: cashierName,
        created_by: cashierName,
        created_at: new Date().toISOString()
      };

      try {
        const cacheKey = `flow_shift_movements_${activeShift.id}`;
        const existingStr = window.localStorage.getItem(cacheKey);
        const existingList = existingStr ? JSON.parse(existingStr) : [];
        existingList.unshift(localTransferRecord);
        window.localStorage.setItem(cacheKey, JSON.stringify(existingList));
      } catch (cacheErr) {}

      const payload: any = {
        shift_id: activeShift.id,
        operation_id: localTransferRecord.operation_id,
        movement_type: 'transfer_out',
        amount: amt,
        currency: transferCurrency,
        reason: `Transfer to ${transferTarget}: ${transferReason || 'Drawer drop'}`,
        authorized_by: cashierName,
        created_by: cashierName
      };

      const { error: insErr } = await supabase.from('shift_cash_movements').insert([payload]);
      if (insErr) {
        console.warn('shift_cash_movements transfer error:', insErr);
      }

      setNotification({ type: 'success', message: `Transferred ${amt} ${transferCurrency} to ${transferTarget}.` });
      setTransferAmount('');
      setTransferReason('');
      await loadData();
      setActiveTab('history');
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to record transfer.' });
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift?.id) return;

    const countUsd = parseFloat(actualUsd) || 0;
    const countLbp = parseFloat(actualLbp) || 0;
    const varUsd = countUsd - expectedCashUsd;
    const varLbp = countLbp - expectedCashLbp;

    if (!showVariancePreview) {
      setShowVariancePreview(true);
      return;
    }

    setIsClosing(true);
    setNotification(null);
    try {
      const res = await onCloseShift({
        shiftId: activeShift.id,
        actualUsd: countUsd,
        actualLbp: countLbp,
        expectedCashUsd,
        expectedCashLbp,
        varianceUsd: varUsd,
        varianceLbp: varLbp,
        closedBy: cashierName,
        blindClosed: true,
        closingNotes: closingNotes.trim() || undefined
      });

      if (res.success) {
        setNotification({ type: 'success', message: `${activeConcept.name} shift closed and reconciled!` });
        await loadData();
        setActiveTab('status');
      } else {
        setNotification({ type: 'error', message: res.error || 'Failed to close shift.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Error closing shift.' });
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className="px-6 py-4 text-white flex items-center justify-between"
          style={{ backgroundColor: activeConcept.primary_color || '#e11d48' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💵</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base tracking-wide uppercase">{activeConcept.name} Cash Register</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${activeShift ? 'bg-emerald-400 text-slate-950' : 'bg-rose-400 text-slate-950'}`}>
                  {activeShift ? 'Shift Open' : 'Shift Closed'}
                </span>
              </div>
              <p className="text-xs text-white/80">Branch: {branchName || 'Badaro'} • Register: {terminalId}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white font-bold p-1 rounded-lg text-lg"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'status' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            1. Register Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('handovers')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeTab === 'handovers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <span>2. Driver Handover</span>
            {pendingHandoverOrders.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-extrabold">
                {pendingHandoverOrders.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cashout')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'cashout' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            3. Petty Cash Out
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'transfer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            4. Drawer Transfer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('close')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'close' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            5. Close Shift
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            History ({shiftMovements.length})
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div className={`p-3 px-6 text-xs font-bold flex items-center justify-between ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-rose-50 text-rose-800 border-b border-rose-200'}`}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="text-xs font-bold px-1">✕</button>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {/* TAB 1: STATUS & OPEN SHIFT */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {activeShift ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Opening Float</span>
                      <span className="text-lg font-black text-slate-900 font-mono">${openingFloatUsd.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">0 LBP</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">Cash Collected (In)</span>
                      <span className="text-lg font-black text-emerald-700 font-mono">+${totalCashInUsd.toFixed(2)}</span>
                      <span className="text-[10px] text-emerald-600 block font-mono">+{totalCashInLbp.toLocaleString()} LBP</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="text-[10px] uppercase font-bold text-rose-800 block">Disbursed (Out)</span>
                      <span className="text-lg font-black text-rose-700 font-mono">-${totalCashOutUsd.toFixed(2)}</span>
                      <span className="text-[10px] text-rose-600 block font-mono">-{totalCashOutLbp.toLocaleString()} LBP</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="text-[10px] uppercase font-bold text-blue-800 block">Current Expected In Drawer</span>
                      <span className="text-lg font-black text-blue-700 font-mono">${expectedCashUsd.toFixed(2)}</span>
                      <span className="text-[10px] text-blue-600 block font-mono">{expectedCashLbp.toLocaleString()} LBP</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block">Shift Information</span>
                      <span className="text-slate-500 text-[11px]">
                        Cashier: <strong className="text-slate-700">{activeShift.user_name || cashierName}</strong> • Opened: <strong className="text-slate-700">{new Date(activeShift.opened_at || activeShift.created_at).toLocaleTimeString()}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('close')}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Count & Close Shift →
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleOpenShiftSubmit} className="space-y-4 max-w-md mx-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="text-center">
                    <span className="text-3xl">🔓</span>
                    <h4 className="font-black text-base text-slate-900 mt-1">Open {activeConcept.name} Shift</h4>
                    <p className="text-xs text-slate-500">Enter the initial opening cash drawer float to begin sales.</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Opening Float (USD)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={openUsd}
                        onChange={(e) => setOpenUsd(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 bg-white"
                        placeholder="50.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Opening Float (LBP)</label>
                      <input
                        type="number"
                        step="50000"
                        min="0"
                        value={openLbp}
                        onChange={(e) => setOpenLbp(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 bg-white"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isOpening}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs shadow-md transition disabled:opacity-50"
                  >
                    {isOpening ? 'Opening Shift...' : '✓ Confirm & Open Shift'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: DRIVER HANDOVER QUEUE */}
          {activeTab === 'handovers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-slate-900">Driver Collection Queue</h4>
                  <p className="text-xs text-slate-500">Orders ready or preparing for driver handover and food cash collection.</p>
                </div>
                <button
                  type="button"
                  onClick={loadData}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                >
                  🔄 Refresh
                </button>
              </div>

              {pendingHandoverOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-semibold text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No orders currently waiting for driver collection.
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingHandoverOrders.map((ord) => {
                    const foodTotal = getOrderFoodDue(ord);
                    const deliveryFee = getOrderDeliveryFee(ord);
                    return (
                      <div
                        key={ord.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs hover:border-emerald-300 transition"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-slate-900">Order #{ord.id}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 uppercase">
                              {ord.order_source || 'WhatsApp'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                              {ord.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-semibold">
                            Customer: {ord.customer_name || 'Customer'} {ord.customer_phone ? `(${ord.customer_phone})` : ''}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Food Due: <strong className="text-emerald-700 font-mono">${foodTotal.toFixed(2)}</strong> • Delivery Fee: <strong className="text-blue-700 font-mono">${deliveryFee.toFixed(2)}</strong>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (onTriggerHandoverOrder) {
                              onTriggerHandoverOrder({
                                ...ord,
                                subtotal: foodTotal,
                                subtotal_amount: foodTotal,
                                foodDue: foodTotal,
                                deliveryFee: deliveryFee,
                                delivery_fee: deliveryFee
                              });
                              onClose();
                            }
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-xs transition active:scale-95 flex items-center gap-1.5"
                        >
                          <span>🛵</span>
                          <span>Handover Cashier</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PETTY CASH OUT */}
          {activeTab === 'cashout' && (
            <form onSubmit={handleCashOutSubmit} className="space-y-4 max-w-lg mx-auto p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <h4 className="font-black text-sm text-slate-900">Petty Cash Out / Expense</h4>
                <p className="text-xs text-slate-500">Record cash disbursed from the drawer for store expenses.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashOutAmount}
                    onChange={(e) => setCashOutAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 bg-white"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <select
                    value={cashOutCurrency}
                    onChange={(e: any) => setCashOutCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="LBP">LBP (ل.ل)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Expense Category</label>
                <select
                  value={cashOutCategory}
                  onChange={(e) => setCashOutCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                >
                  <option value="SUPPLIES">Cleaning & Store Supplies</option>
                  <option value="DRIVER_GAS">Driver Fuel / Transport Allowance</option>
                  <option value="PACKAGING">Urgent Packaging Replenishment</option>
                  <option value="MAINTENANCE">Equipment Maintenance</option>
                  <option value="GENERAL">General Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vendor / Recipient</label>
                <input
                  type="text"
                  value={cashOutVendor}
                  onChange={(e) => setCashOutVendor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white"
                  placeholder="e.g. Supermarket Mar Mkhayel"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Description</label>
                <input
                  type="text"
                  value={cashOutReason}
                  onChange={(e) => setCashOutReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white"
                  placeholder="e.g. Disinfectant spray and towels"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingCashOut}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs shadow-md transition disabled:opacity-50"
              >
                {isSubmittingCashOut ? 'Recording...' : 'Disburse Cash Out (Audit Logged)'}
              </button>
            </form>
          )}

          {/* TAB 4: DRAWER TRANSFER */}
          {activeTab === 'transfer' && (
            <form onSubmit={handleTransferSubmit} className="space-y-4 max-w-lg mx-auto p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <h4 className="font-black text-sm text-slate-900">Drawer Transfer / Safe Drop</h4>
                <p className="text-xs text-slate-500">Transfer excess cash to the branch safe or another concept drawer.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 bg-white"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <select
                    value={transferCurrency}
                    onChange={(e: any) => setTransferCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="LBP">LBP (ل.ل)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Destination</label>
                <select
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
                >
                  <option value="SAFE">Branch Safe Drop</option>
                  <option value="NEO_MAIN_DRAWER">NÉO Restaurant Main Drawer</option>
                  <option value="BANK_DEPOSIT">Bank Cash Remittance Bag</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Transfer Notes</label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 bg-white"
                  placeholder="e.g. Mid-day cash drop to branch safe"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingTransfer}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs shadow-md transition disabled:opacity-50"
              >
                {isSubmittingTransfer ? 'Recording Transfer...' : 'Execute Balanced Drawer Transfer'}
              </button>
            </form>
          )}

          {/* TAB 5: CLOSE SHIFT */}
          {activeTab === 'close' && (
            <form onSubmit={handleCloseShiftSubmit} className="space-y-4 max-w-lg mx-auto p-5 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <h4 className="font-black text-sm text-slate-900">Close {activeConcept.name} Shift (Blind Cash Count)</h4>
                <p className="text-xs text-slate-500">Count physical bills in the cash drawer without viewing expected totals first.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Actual USD Counted</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={actualUsd}
                    onChange={(e) => setActualUsd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 bg-white"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Actual LBP Counted</label>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={actualLbp}
                    onChange={(e) => setActualLbp(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 bg-white"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Closing Notes</label>
                <textarea
                  rows={2}
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white resize-none"
                  placeholder="Notes about shift variance, driver cash collections, or handed-over bills..."
                />
              </div>

              {showVariancePreview && (
                <div className="p-4 rounded-xl bg-white border border-slate-300 space-y-2">
                  <span className="text-xs font-black text-slate-900 uppercase block tracking-wider">
                    Reconciliation Variance Preview
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">USD Expected: ${expectedCashUsd.toFixed(2)}</span>
                      <span className="text-slate-500 block">USD Counted: ${(parseFloat(actualUsd) || 0).toFixed(2)}</span>
                      <span className={`font-black font-mono block mt-1 ${(parseFloat(actualUsd) || 0) - expectedCashUsd >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        USD Variance: ${((parseFloat(actualUsd) || 0) - expectedCashUsd).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">LBP Expected: {expectedCashLbp.toLocaleString()}</span>
                      <span className="text-slate-500 block">LBP Counted: {(parseFloat(actualLbp) || 0).toLocaleString()}</span>
                      <span className={`font-black font-mono block mt-1 ${(parseFloat(actualLbp) || 0) - expectedCashLbp >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        LBP Variance: {((parseFloat(actualLbp) || 0) - expectedCashLbp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isClosing}
                className={`w-full py-2.5 rounded-xl font-black text-xs shadow-md transition text-white ${showVariancePreview ? 'bg-rose-600 hover:bg-rose-500' : 'bg-slate-900 hover:bg-slate-800'}`}
              >
                {isClosing ? 'Finalizing Close...' : showVariancePreview ? 'Confirm & Finalize Close Shift (Z-Report)' : 'Calculate & Review Variance'}
              </button>
            </form>
          )}

          {/* TAB 6: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-sm text-slate-900">Shift Cash Ledger Entries</h4>
                <span className="text-xs text-slate-500 font-mono">{shiftMovements.length} total movements</span>
              </div>

              {shiftMovements.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-semibold text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No cash movements recorded yet in this shift.
                </div>
              ) : (
                <div className="space-y-2">
                  {shiftMovements.map((m) => {
                    const isIncome = ['cash_in', 'transfer_in'].includes(m.movement_type);
                    return (
                      <div
                        key={m.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {m.movement_type}
                            </span>
                            <span className="text-xs font-bold text-slate-800">{m.reason}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            By {m.created_by || 'Cashier'} • {new Date(m.created_at).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className={`text-sm font-black font-mono ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {isIncome ? '+' : '-'}{Number(m.amount).toLocaleString()} {m.currency}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
