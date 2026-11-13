import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  DollarSign, 
  Calendar, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  FileText, 
  CreditCard, 
  ShoppingCart, 
  Receipt, 
  AlertCircle,
  Truck,
  Building,
  Check,
  ChevronDown
} from 'lucide-react';
import { api } from '../../api/client';
import { getDailyPayments, deleteDailyPayment } from '../services/shiftCashBridge';
import { SupplierInvoicesModal } from './SupplierInvoicesModal';

interface DailyPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName: string;
  cashierName: string;
  activeShiftName?: string;
  activeShiftDate?: string;
  activeShiftId?: string;
  branchId?: string;
  restaurantId?: string;
}

export const DailyPaymentsModal: React.FC<DailyPaymentsModalProps> = ({
  isOpen,
  onClose,
  branchName,
  cashierName,
  activeShiftName = 'AM',
  activeShiftDate,
  activeShiftId,
  branchId,
  restaurantId
}) => {
  // Navigation: 4 core modules
  const [activeTab, setActiveTab] = useState<'invoice' | 'payment' | 'direct' | 'expense'>('invoice');
  const [isFullInvoicesModalOpen, setIsFullInvoicesModalOpen] = useState(false);

  // Shift & Date
  const [date, setDate] = useState(() => {
    if (activeShiftDate) {
      if (activeShiftDate.includes('T')) return activeShiftDate.split('T')[0];
      if (activeShiftDate.includes(' ')) return activeShiftDate.split(' ')[0];
      return activeShiftDate;
    }
    return new Date().toISOString().split('T')[0];
  });
  const [shift, setShift] = useState(activeShiftName === 'PM' ? 'PM' : 'AM');

  // Common master data
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [openPurchaseOrders, setOpenPurchaseOrders] = useState<any[]>([]);
  const [supplierPriceLists, setSupplierPriceLists] = useState<any[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Status banners
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // --------------------------------------------------------------------------
  // TAB 1: SUPPLIER INVOICE STATE (PHASE 4)
  // --------------------------------------------------------------------------
  const [invSupplierId, setInvSupplierId] = useState('');
  const [invSelectedPoId, setInvSelectedPoId] = useState('');
  const [invNumber, setInvNumber] = useState('');
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0]);
  const [invDueDate, setInvDueDate] = useState('');
  const [invCurrency, setInvCurrency] = useState<'USD' | 'LBP'>('USD');
  const [invExchangeRate, setInvExchangeRate] = useState<number>(89500);
  const [invConfirmReceived, setInvConfirmReceived] = useState<boolean>(true);
  const [invPayNow, setInvPayNow] = useState<boolean>(false);
  const [invPaymentMethod, setInvPaymentMethod] = useState<string>('CASH_USD');
  const [invNotes, setInvNotes] = useState('');
  const [invItemSearch, setInvItemSearch] = useState('');
  const [invItems, setInvItems] = useState<Array<{
    item_id: string;
    item_name: string;
    po_item_id?: string;
    quantity: number;
    ordered_quantity?: number;
    unit: string;
    unit_price: number;
    location_id: string;
    total: number;
  }>>([]);

  // --------------------------------------------------------------------------
  // TAB 2: SUPPLIER PAYMENT STATE (PHASE 5)
  // --------------------------------------------------------------------------
  const [paySupplierId, setPaySupplierId] = useState('');
  const [supplierLedger, setSupplierLedger] = useState<any | null>(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [payPaymentMethod, setPayPaymentMethod] = useState<string>('CASH_USD');
  const [payAmountUsd, setPayAmountUsd] = useState<string>('');
  const [payAmountLbp, setPayAmountLbp] = useState<string>('');
  const [payExchangeRate, setPayExchangeRate] = useState<number>(89500);
  const [payNotes, setPayNotes] = useState<string>('');
  const [payAllocations, setPayAllocations] = useState<{ [invoiceId: string]: number }>({});

  // --------------------------------------------------------------------------
  // TAB 3: DIRECT PURCHASE STATE (PHASE 6)
  // --------------------------------------------------------------------------
  const [dirSupplierName, setDirSupplierName] = useState('');
  const [dirLocationId, setDirLocationId] = useState('');
  const [dirPaymentMethod, setDirPaymentMethod] = useState<'CASH_USD' | 'CASH_LBP'>('CASH_USD');
  const [dirNotes, setDirNotes] = useState('');
  const [dirItemSearch, setDirItemSearch] = useState('');
  const [dirItems, setDirItems] = useState<Array<{
    item_id: string;
    item_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total: number;
  }>>([]);

  // --------------------------------------------------------------------------
  // TAB 4: GENERAL EXPENSE STATE (PHASE 7)
  // --------------------------------------------------------------------------
  const [expCategory, setExpCategory] = useState('Operating Expense');
  const [expPayee, setExpPayee] = useState('');
  const [expAmountUsd, setExpAmountUsd] = useState('');
  const [expAmountLbp, setExpAmountLbp] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [dailyPaymentsList, setDailyPaymentsList] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Initialize
  useEffect(() => {
    if (isOpen) {
      if (activeShiftDate) {
        const d = activeShiftDate.includes('T') ? activeShiftDate.split('T')[0] : (activeShiftDate.includes(' ') ? activeShiftDate.split(' ')[0] : activeShiftDate);
        setDate(d);
      }
      if (activeShiftName) {
        setShift(activeShiftName === 'PM' ? 'PM' : 'AM');
      }
      loadMasterData();
      loadExpensesList();
    }
  }, [isOpen, activeShiftDate, activeShiftName, branchName]);

  const loadMasterData = async () => {
    setLoadingMaster(true);
    try {
      const [supRes, locRes, catRes] = await Promise.all([
        api.getSuppliers(),
        api.getInventoryLocations(),
        api.getItemCatalog()
      ]);
      if (supRes.success && supRes.data) setSuppliers(supRes.data);
      if (locRes.success && locRes.data) {
        setLocations(locRes.data);
        if (locRes.data.length > 0) {
          setDirLocationId(locRes.data[0].id);
        }
      }
      if (catRes.success && catRes.data) setCatalogItems(catRes.data);
    } catch (e) {
      console.error('Error loading POS payments master data:', e);
    }
    setLoadingMaster(false);
  };

  const loadExpensesList = async () => {
    setLoadingPayments(true);
    try {
      const res = await getDailyPayments(branchName, date, shift);
      if (res.success) {
        setDailyPaymentsList(res.data);
      }
    } catch (e) {
      console.error('Error loading daily payments:', e);
    }
    setLoadingPayments(false);
  };

  // --------------------------------------------------------------------------
  // TAB 1 (SUPPLIER INVOICE) HANDLERS
  // --------------------------------------------------------------------------
  const handleSupplierChangeForInvoice = async (supplierId: string) => {
    setInvSupplierId(supplierId);
    setInvSelectedPoId('');
    setInvItems([]);
    if (!supplierId) {
      setOpenPurchaseOrders([]);
      setSupplierPriceLists([]);
      return;
    }
    try {
      const [poRes, splRes] = await Promise.all([
        api.getOpenPurchaseOrders(supplierId, branchId),
        api.getSupplierPriceLists(supplierId)
      ]);
      if (poRes.success && poRes.data) {
        setOpenPurchaseOrders(poRes.data);
      } else {
        setOpenPurchaseOrders([]);
      }
      if (splRes.success && splRes.data) {
        setSupplierPriceLists(splRes.data);
      } else {
        setSupplierPriceLists([]);
      }
    } catch (e) {
      console.error('Error loading POs / price lists for supplier:', e);
    }
  };

  const handlePoSelectForInvoice = (poId: string) => {
    setInvSelectedPoId(poId);
    if (!poId) {
      setInvItems([]);
      return;
    }
    const po = openPurchaseOrders.find(p => p.id === poId);
    if (!po || !po.items) return;

    const defaultLoc = locations[0]?.id || '';
    const newItems = po.items.map((it: any) => {
      const ordered = Number(it.purchase_quantity) || 0;
      const received = Number(it.received_purchase_quantity) || 0;
      const outstanding = Math.max(0, ordered - received);
      const price = Number(it.purchase_unit_price) || 0;

      return {
        item_id: it.item_id,
        item_name: it.item_name,
        po_item_id: it.id,
        quantity: outstanding > 0 ? outstanding : ordered,
        ordered_quantity: ordered,
        unit: it.purchase_unit || 'Unit',
        unit_price: price,
        location_id: po.destination_location_id || defaultLoc,
        total: Number(((outstanding > 0 ? outstanding : ordered) * price).toFixed(4))
      };
    });

    setInvItems(newItems);
  };

  const handleAddManualItemToInvoice = (itemId: string) => {
    const it = catalogItems.find(i => i.id === itemId);
    if (!it) return;
    const defaultLoc = locations[0]?.id || '';
    
    // Check if supplier has negotiated price in supplier_price_lists
    const spl = supplierPriceLists.find(p => p.item_id === it.id && p.supplier_id === invSupplierId);
    const price = spl?.purchase_unit_price != null ? Number(spl.purchase_unit_price) : (Number(it.price_usd) || 0);
    const unit = spl?.purchase_unit || it.unit || 'Unit';

    setInvItems(prev => [
      ...prev,
      {
        item_id: it.id,
        item_name: it.name,
        quantity: 1,
        unit: unit,
        unit_price: price,
        location_id: defaultLoc,
        total: price
      }
    ]);
  };

  // Sorted and filtered items for Supplier Invoice (Supplier items listed first, then others)
  const supplierInvoiceItemsList = useMemo(() => {
    if (!catalogItems || catalogItems.length === 0) return { supplierItems: [], otherItems: [] };

    // Match selected supplier by ID as well as alias/duplicate suppliers with same normalized name or phone
    const matchedSupplierIds = new Set<string>();
    if (invSupplierId) {
      matchedSupplierIds.add(invSupplierId);
      const selSupplier = suppliers.find(s => s.id === invSupplierId);
      if (selSupplier) {
        const cleanName = (selSupplier.name || '').toLowerCase().replace(/^(al|el)\s+/, '').trim();
        const cleanPhone = (selSupplier.phone || '').replace(/\D/g, '');
        suppliers.forEach(s => {
          const sCleanName = (s.name || '').toLowerCase().replace(/^(al|el)\s+/, '').trim();
          const sCleanPhone = (s.phone || '').replace(/\D/g, '');
          if ((cleanName && sCleanName === cleanName) || (cleanPhone && sCleanPhone && cleanPhone.length > 5 && sCleanPhone === cleanPhone)) {
            matchedSupplierIds.add(s.id);
          }
        });
      }
    }

    const supplierItemIds = new Set<string>();
    if (matchedSupplierIds.size > 0) {
      catalogItems.forEach(it => {
        if (matchedSupplierIds.has(it.supplier_id)) {
          supplierItemIds.add(it.id);
        }
      });
      supplierPriceLists.forEach(spl => {
        if (matchedSupplierIds.has(spl.supplier_id) && spl.item_id) {
          supplierItemIds.add(spl.item_id);
        }
      });
    }

    const q = invItemSearch.trim().toLowerCase();
    const filtered = catalogItems.filter(it => {
      if (!q) return true;
      return (it.name || '').toLowerCase().includes(q) || (it.unit || '').toLowerCase().includes(q);
    });

    const supplierItems: any[] = [];
    const otherItems: any[] = [];

    filtered.forEach(it => {
      const isSupplierItem = supplierItemIds.has(it.id);
      const spl = supplierPriceLists.find(p => p.item_id === it.id && matchedSupplierIds.has(p.supplier_id));
      const displayPrice = spl?.purchase_unit_price != null ? Number(spl.purchase_unit_price) : (Number(it.price_usd) || 0);

      const enhanced = {
        ...it,
        isSupplierItem,
        displayPrice,
        displayUnit: spl?.purchase_unit || it.unit || 'Unit'
      };

      if (isSupplierItem) {
        supplierItems.push(enhanced);
      } else {
        otherItems.push(enhanced);
      }
    });

    return { supplierItems, otherItems };
  }, [catalogItems, invSupplierId, suppliers, supplierPriceLists, invItemSearch]);

  const handleUpdateInvoiceItem = (index: number, field: string, value: any) => {
    setInvItems(prev => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const q = Number(cur.quantity) || 0;
        const p = Number(cur.unit_price) || 0;
        cur.total = Number((q * p).toFixed(4));
      }
      updated[index] = cur;
      return updated;
    });
  };

  const handleRemoveInvoiceItem = (index: number) => {
    setInvItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const invoiceSubtotal = useMemo(() => {
    return invItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0);
  }, [invItems]);

  const handleSubmitSupplierInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invSupplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }
    if (!invNumber.trim()) {
      setErrorMsg('Please enter the supplier invoice number.');
      return;
    }
    if (invItems.length === 0) {
      setErrorMsg('Please add at least one line item to the invoice.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const payload = {
        branch_id: branchId,
        supplier_id: invSupplierId,
        invoice_number: invNumber.trim(),
        invoice_date: invDate,
        due_date: invDueDate || null,
        purchase_order_id: invSelectedPoId || null,
        currency: invCurrency,
        exchange_rate: invExchangeRate,
        tax_rate: 0,
        discount_amount: 0,
        notes: invNotes,
        user_id: cashierName,
        user_name: cashierName,
        confirm_received: invConfirmReceived,
        pay_now: invPayNow,
        payment_method: invPaymentMethod,
        shift_id: activeShiftId || null,
        idempotency_key: idempotencyKey,
        is_direct_purchase: false,
        items: invItems.map(it => ({
          item_id: it.item_id,
          item_name: it.item_name,
          po_item_id: it.po_item_id || null,
          quantity: Number(it.quantity),
          unit: it.unit,
          unit_price: Number(it.unit_price),
          location_id: it.location_id
        }))
      };

      const res = await api.postSupplierInvoice(payload);
      if (res && res.success) {
        setSuccessMsg(`Supplier invoice ${invNumber} recorded successfully!${invConfirmReceived ? ' Stock balances updated.' : ''}${invPayNow ? ' Drawer cash deducted.' : ''}`);
        // Reset form
        setInvNumber('');
        setInvItems([]);
        setInvSelectedPoId('');
        setInvNotes('');
        setInvPayNow(false);
        loadExpensesList();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res?.error || 'Failed to post supplier invoice.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error posting invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // TAB 2 (SUPPLIER PAYMENT) HANDLERS
  // --------------------------------------------------------------------------
  const handleSupplierChangeForPayment = async (supplierId: string) => {
    setPaySupplierId(supplierId);
    setSupplierLedger(null);
    setUnpaidInvoices([]);
    setPayAllocations({});
    setPayAmountUsd('');
    setPayAmountLbp('');
    if (!supplierId) return;

    setLoadingLedger(true);
    try {
      const [ledgerRes, invRes] = await Promise.all([
        api.getSupplierPayableLedger(supplierId),
        api.getSupplierInvoices({ supplier_id: supplierId, status: 'UNPAID' })
      ]);

      if (ledgerRes.success && ledgerRes.data && ledgerRes.data.length > 0) {
        setSupplierLedger(ledgerRes.data[0]);
      }
      if (invRes.success && invRes.data) {
        // Also include PARTIALLY_PAID
        setUnpaidInvoices(invRes.data.filter((i: any) => i.payment_status !== 'PAID'));
      }
    } catch (e) {
      console.error('Error fetching supplier ledger:', e);
    }
    setLoadingLedger(false);
  };

  const handleAutoAllocatePayment = () => {
    const totalUsd = parseFloat(payAmountUsd) || 0;
    if (totalUsd <= 0) return;

    let remaining = totalUsd;
    const allocs: { [id: string]: number } = {};

    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const outstanding = Number(inv.total_amount_usd) - Number(inv.paid_amount_usd || 0);
      const apply = Math.min(remaining, outstanding);
      allocs[inv.id] = Number(apply.toFixed(2));
      remaining -= apply;
    }

    setPayAllocations(allocs);
  };

  const handleSubmitSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }
    const usd = parseFloat(payAmountUsd) || 0;
    const lbp = parseFloat(payAmountLbp) || 0;

    if (usd === 0 && lbp === 0) {
      setErrorMsg('Please enter payment amount in USD or LBP.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      // Build allocation array
      const allocationsArray = Object.entries(payAllocations)
        .filter(([_, amt]) => amt > 0)
        .map(([invId, amt]) => ({
          invoice_id: invId,
          allocated_usd: amt
        }));

      const payload = {
        branch_id: branchId,
        supplier_id: paySupplierId,
        payment_method: payPaymentMethod,
        paid_amount_usd: usd,
        paid_amount_lbp: lbp,
        exchange_rate: payExchangeRate,
        notes: payNotes,
        user_id: cashierName,
        user_name: cashierName,
        shift_id: activeShiftId || null,
        allocations: allocationsArray,
        idempotency_key: idempotencyKey
      };

      const res = await api.settleSupplierInvoices(payload);
      if (res && res.success) {
        setSuccessMsg(`Supplier payment settled successfully!${payPaymentMethod.startsWith('CASH') ? ' Drawer cash deducted.' : ''} Stock was not modified.`);
        setPayAmountUsd('');
        setPayAmountLbp('');
        setPayNotes('');
        setPayAllocations({});
        handleSupplierChangeForPayment(paySupplierId);
        loadExpensesList();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res?.error || 'Failed to settle supplier payment.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // TAB 3 (DIRECT PURCHASE) HANDLERS
  // --------------------------------------------------------------------------
  const handleAddDirectItem = (itemId: string) => {
    const it = catalogItems.find(i => i.id === itemId);
    if (!it) return;
    const price = Number(it.price_usd) || 0;

    setDirItems(prev => [
      ...prev,
      {
        item_id: it.id,
        item_name: it.name,
        quantity: 1,
        unit: it.unit || 'Unit',
        unit_price: price,
        total: price
      }
    ]);
  };

  const handleUpdateDirectItem = (index: number, field: string, value: any) => {
    setDirItems(prev => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        const q = Number(cur.quantity) || 0;
        const p = Number(cur.unit_price) || 0;
        cur.total = Number((q * p).toFixed(4));
      }
      updated[index] = cur;
      return updated;
    });
  };

  const handleRemoveDirectItem = (index: number) => {
    setDirItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const directSubtotal = useMemo(() => {
    return dirItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0);
  }, [dirItems]);

  // Sorted and filtered items for Direct Purchase (Vendor/Supplier items listed first if matched, then others)
  const directPurchaseItemsList = useMemo(() => {
    if (!catalogItems || catalogItems.length === 0) return { supplierItems: [], otherItems: [] };

    // Look for matching supplier if dirSupplierName matches a known supplier
    const matchedSupplier = suppliers.find(s => 
      s.name.toLowerCase() === dirSupplierName.trim().toLowerCase() || s.id === dirSupplierName
    );

    const supplierItemIds = new Set<string>();
    if (matchedSupplier) {
      catalogItems.forEach(it => {
        if (it.supplier_id === matchedSupplier.id) {
          supplierItemIds.add(it.id);
        }
      });
    }

    const q = dirItemSearch.trim().toLowerCase();
    const filtered = catalogItems.filter(it => {
      if (!q) return true;
      return (it.name || '').toLowerCase().includes(q) || (it.unit || '').toLowerCase().includes(q);
    });

    const supplierItems: any[] = [];
    const otherItems: any[] = [];

    filtered.forEach(it => {
      const isSupplierItem = supplierItemIds.has(it.id);
      const enhanced = {
        ...it,
        isSupplierItem,
        displayPrice: Number(it.price_usd) || 0,
        displayUnit: it.unit || 'Unit'
      };

      if (isSupplierItem) {
        supplierItems.push(enhanced);
      } else {
        otherItems.push(enhanced);
      }
    });

    return { supplierItems, otherItems };
  }, [catalogItems, dirSupplierName, suppliers, dirItemSearch]);

  const handleSubmitDirectPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirSupplierName.trim()) {
      setErrorMsg('Please enter a supplier or vendor name for the direct purchase.');
      return;
    }
    if (dirItems.length === 0) {
      setErrorMsg('Please add at least one purchased item.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = `DIR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      // Find or pick a fallback supplier UUID for relational integrity
      const matchedSup = suppliers.find(s => s.name.toLowerCase() === dirSupplierName.trim().toLowerCase()) || suppliers[0];

      const payload = {
        branch_id: branchId,
        supplier_id: matchedSup?.id,
        invoice_number: `DIR-${Date.now().toString().slice(-6)}`,
        invoice_date: date,
        purchase_order_id: null,
        currency: dirPaymentMethod === 'CASH_LBP' ? 'LBP' : 'USD',
        exchange_rate: 89500,
        notes: `Direct Purchase: ${dirSupplierName.trim()}${dirNotes ? ` - ${dirNotes}` : ''}`,
        user_id: cashierName,
        user_name: cashierName,
        confirm_received: true,
        pay_now: true,
        payment_method: dirPaymentMethod,
        shift_id: activeShiftId || null,
        idempotency_key: idempotencyKey,
        is_direct_purchase: true,
        items: dirItems.map(it => ({
          item_id: it.item_id,
          item_name: it.item_name,
          quantity: Number(it.quantity),
          unit: it.unit,
          unit_price: Number(it.unit_price),
          location_id: dirLocationId || locations[0]?.id
        }))
      };

      const res = await api.postSupplierInvoice(payload);
      if (res && res.success) {
        setSuccessMsg('Direct purchase processed successfully! Stock received into inventory and drawer cash deducted.');
        setDirSupplierName('');
        setDirItems([]);
        setDirNotes('');
        loadExpensesList();
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res?.error || 'Failed to record direct purchase.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error processing direct purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // TAB 4 (GENERAL EXPENSE) HANDLERS
  // --------------------------------------------------------------------------
  const handleSubmitGeneralExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const usd = parseFloat(expAmountUsd) || 0;
    const lbp = parseFloat(expAmountLbp) || 0;

    if (!expPayee.trim()) {
      setErrorMsg('Please enter a payee or description.');
      return;
    }
    if (usd === 0 && lbp === 0) {
      setErrorMsg('Please enter an amount in USD or LBP.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const idempotencyKey = `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await api.postDrawerCashOutflow({
        shiftId: activeShiftId || '00000000-0000-0000-0000-000000000000',
        amountUsd: usd,
        amountLbp: lbp,
        outflowType: expCategory === 'Cash In / Float' ? 'FLOAT_TOPUP' : 'EXPENSE',
        expenseCategoryCode: expCategory,
        payee: expPayee.trim(),
        reason: expNotes.trim() || expCategory,
        authorizedBy: cashierName,
        createdBy: cashierName,
        idempotencyKey: idempotencyKey
      });

      if (res && res.success) {
        setSuccessMsg('Operational cash outflow recorded in cash drawer!');
        setExpPayee('');
        setExpAmountUsd('');
        setExpAmountLbp('');
        setExpNotes('');
        loadExpensesList();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(res?.error || 'Failed to record general expense.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving general expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHistoricalDailyPayment = async (id: string) => {
    if (!window.confirm('Delete this cash record?')) return;
    try {
      const res = await deleteDailyPayment(id);
      if (res.success) {
        loadExpensesList();
      } else {
        alert('Failed to delete payment: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#1e5c4f] border border-emerald-200 flex items-center justify-center text-xl font-black shadow-xs">
              💳
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">POS Payments &amp; Receiving Center</h2>
              <p className="text-xs text-slate-500 font-medium">
                Supplier invoices, payments, direct purchases &amp; daily cash • <strong className="text-slate-700">{branchName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
              <span>Shift: <strong className="text-emerald-700">{shift}</strong></span>
              <span className="mx-2 text-slate-300">•</span>
              <span>Cashier: <strong className="text-slate-900">{cashierName}</strong></span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-xs"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 4 PRIMARY NAVIGATION TABS */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 gap-2 flex-shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('invoice')}
            className={`py-3 px-4 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'invoice'
                ? 'border-[#1e5c4f] text-[#1e5c4f] bg-emerald-50/80'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt size={15} />
            <span>1. Supplier Invoice</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payment')}
            className={`py-3 px-4 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'payment'
                ? 'border-[#1e5c4f] text-[#1e5c4f] bg-emerald-50/80'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard size={15} />
            <span>2. Supplier Payment</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`py-3 px-4 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'direct'
                ? 'border-[#1e5c4f] text-[#1e5c4f] bg-emerald-50/80'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingCart size={15} />
            <span>3. Direct Purchase</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expense')}
            className={`py-3 px-4 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'expense'
                ? 'border-[#1e5c4f] text-[#1e5c4f] bg-emerald-50/80'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign size={15} />
            <span>4. General Expense / Cash</span>
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2 shadow-xs">
              <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs">
              <CheckCircle2 size={16} className="text-[#1e5c4f] flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 1: SUPPLIER INVOICE (PHASE 4) */}
          {/* ================================================================ */}
          {activeTab === 'invoice' && (
            <form onSubmit={handleSubmitSupplierInvoice} className="space-y-4">
              {/* Centralized Engine Quick Launcher */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1e5c4f]/10 border border-[#1e5c4f]/20 flex items-center justify-center text-[#1e5c4f]">
                    <FileText size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">FLOW Centralized Invoice Engine</span>
                    <span className="text-[11px] text-slate-600 font-medium">AI camera scan, PDF upload, catalog matching &amp; packaging conversion</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFullInvoicesModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#1e5c4f] hover:bg-[#1e5c4f]/90 text-white font-black text-xs transition shadow-xs cursor-pointer flex items-center gap-2 whitespace-nowrap self-stretch sm:self-auto justify-center"
                >
                  <Plus size={14} /> Open Scanner &amp; History
                </button>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Supplier &amp; Purchase Order Information
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Supplier selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Supplier *</label>
                    <select
                      value={invSupplierId}
                      onChange={(e) => handleSupplierChangeForInvoice(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none shadow-xs cursor-pointer"
                      required
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Purchase order link */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Purchase Order Ref (Optional)
                    </label>
                    <select
                      value={invSelectedPoId}
                      onChange={(e) => handlePoSelectForInvoice(e.target.value)}
                      disabled={!invSupplierId}
                      className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <option value="">No PO (Direct Invoice)</option>
                      {openPurchaseOrders.map(po => (
                        <option key={po.id} value={po.id}>
                          {po.po_number} (Due: {po.expected_delivery_date})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Invoice Number */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Invoice Number *</label>
                    <input
                      type="text"
                      value={invNumber}
                      onChange={(e) => setInvNumber(e.target.value)}
                      placeholder="e.g. INV-9042"
                      required
                      className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none shadow-xs"
                    />
                  </div>

                  {/* Invoice Date */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={invDate}
                      onChange={(e) => setInvDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Purchased Items Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Purchased Items &amp; Stock Delivery
                  </span>
                  
                  {/* Search and item selection controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Item Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={invItemSearch}
                        onChange={(e) => setInvItemSearch(e.target.value)}
                        placeholder="🔍 Search items..."
                        className="bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 font-medium outline-none shadow-xs w-36 sm:w-48"
                      />
                      {invItemSearch && (
                        <button
                          type="button"
                          onClick={() => setInvItemSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Item Selector Dropdown */}
                    <select
                      id="pos-invoice-add-item"
                      defaultValue=""
                      className="bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold outline-none shadow-xs max-w-xs cursor-pointer"
                    >
                      <option value="">+ Add item from catalog</option>
                      {supplierInvoiceItemsList.supplierItems.length > 0 && (
                        <optgroup label="⭐ Items from Selected Supplier">
                          {supplierInvoiceItemsList.supplierItems.map(it => (
                            <option key={it.id} value={it.id}>
                              ⭐ {it.name} ({it.displayUnit}) - ${it.displayPrice.toFixed(2)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label={supplierInvoiceItemsList.supplierItems.length > 0 ? "Other Catalog Items" : "Catalog Items"}>
                        {supplierInvoiceItemsList.otherItems.map(it => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.unit || 'Unit'}) {it.price_usd ? `- $${Number(it.price_usd).toFixed(2)}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        const sel = document.getElementById('pos-invoice-add-item') as HTMLSelectElement;
                        if (sel && sel.value) {
                          handleAddManualItemToInvoice(sel.value);
                          sel.value = '';
                        }
                      }}
                      className="px-3 py-1.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black rounded-xl text-xs transition cursor-pointer shadow-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Direct quick-add matches bar when searching */}
                {invItemSearch.trim() && (
                  <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-slate-100 rounded-xl border border-slate-300 text-xs">
                    <span className="text-[10px] uppercase font-black text-slate-700 mr-1 flex items-center gap-1">
                      <span>⚡</span> Direct Matches:
                    </span>
                    {supplierInvoiceItemsList.supplierItems.slice(0, 6).map(it => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          handleAddManualItemToInvoice(it.id);
                          setInvItemSearch('');
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        ⭐ {it.name} (${it.displayPrice.toFixed(2)}) +
                      </button>
                    ))}
                    {supplierInvoiceItemsList.otherItems.slice(0, 6).map(it => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          handleAddManualItemToInvoice(it.id);
                          setInvItemSearch('');
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-medium flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        {it.name} +
                      </button>
                    ))}
                    {supplierInvoiceItemsList.supplierItems.length === 0 && supplierInvoiceItemsList.otherItems.length === 0 && (
                      <span className="text-slate-500 text-[11px] italic">No items match "{invItemSearch}"</span>
                    )}
                  </div>
                )}

                {invItems.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-xl">
                    No items selected. Select a Purchase Order above to auto-populate items or add manually.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600 font-bold">
                          <th className="py-2 px-2">Item Name</th>
                          <th className="py-2 px-2 w-24">Qty Recv</th>
                          <th className="py-2 px-2 w-24">Unit</th>
                          <th className="py-2 px-2 w-28">Unit Price ($)</th>
                          <th className="py-2 px-2 w-36">Destination Location</th>
                          <th className="py-2 px-2 w-24 text-right">Total ($)</th>
                          <th className="py-2 px-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invItems.map((it, idx) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="py-2 px-2 font-bold text-slate-900">
                              {it.item_name}
                              {it.ordered_quantity !== undefined && (
                                <span className="block text-[10px] text-slate-500 font-normal">
                                  PO Ordered: {it.ordered_quantity} {it.unit}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={it.quantity}
                                onChange={(e) => handleUpdateInvoiceItem(idx, 'quantity', Number(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs font-bold outline-none shadow-xs"
                              />
                            </td>
                            <td className="py-2 px-2 text-slate-600 font-bold">{it.unit}</td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={it.unit_price}
                                onChange={(e) => handleUpdateInvoiceItem(idx, 'unit_price', Number(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs font-bold outline-none shadow-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={it.location_id}
                                onChange={(e) => handleUpdateInvoiceItem(idx, 'location_id', e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 text-[11px] font-bold outline-none shadow-xs cursor-pointer"
                              >
                                {locations.map(loc => (
                                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                              ${Number(it.total).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveInvoiceItem(idx)}
                                className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-300 font-bold text-xs">
                          <td colSpan={5} className="py-2.5 px-2 text-right text-slate-700">Invoice Total:</td>
                          <td className="py-2.5 px-2 text-right font-mono text-sm text-[#1e5c4f] font-black">
                            ${invoiceSubtotal.toFixed(2)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Physical Receiving & Payment Controls */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Physical Receipt Confirmation (Phase 4.3) */}
                <div className="p-3 bg-white rounded-xl border border-slate-300 flex items-start gap-3 shadow-xs">
                  <input
                    type="checkbox"
                    id="inv-confirm-received"
                    checked={invConfirmReceived}
                    onChange={(e) => setInvConfirmReceived(e.target.checked)}
                    className="w-4 h-4 mt-1 rounded bg-slate-100 border-slate-300 text-[#1e5c4f] focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="inv-confirm-received" className="text-xs font-black text-slate-900 cursor-pointer block">
                      Confirm Physical Stock Received
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      When checked, goods receipt is posted and inventory stock balances increase immediately. If unchecked, registers financial invoice liability only.
                    </p>
                  </div>
                </div>

                {/* Pay Now Toggle (Phase 4.4) */}
                <div className="p-3 bg-white rounded-xl border border-slate-300 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-900 cursor-pointer flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={invPayNow}
                        onChange={(e) => setInvPayNow(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-100 border-slate-300 text-[#1e5c4f] focus:ring-0 cursor-pointer"
                      />
                      <span>Pay Now (Immediate Settlement)</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {invPayNow ? 'Paid at Drawer' : 'Save as Unpaid'}
                    </span>
                  </div>

                  {invPayNow && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Payment Method</label>
                      <select
                        value={invPaymentMethod}
                        onChange={(e) => setInvPaymentMethod(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold outline-none shadow-xs cursor-pointer"
                      >
                        <option value="CASH_USD">Cash Drawer (USD)</option>
                        <option value="CASH_LBP">Cash Drawer (LBP)</option>
                        <option value="CREDIT_CARD">Credit Card / POS Machine</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CHEQUE">Company Cheque</option>
                      </select>
                      <p className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2 font-medium">
                        ⚠️ Cash payments deduct drawer cash via the authoritative cash reconciliation process.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>{submitting ? 'Recording Invoice...' : 'Post Supplier Invoice'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* TAB 2: SUPPLIER PAYMENT (PHASE 5) */}
          {/* ================================================================ */}
          {activeTab === 'payment' && (
            <form onSubmit={handleSubmitSupplierPayment} className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Select Supplier &amp; Check Outstanding Balance
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Supplier *</label>
                    <select
                      value={paySupplierId}
                      onChange={(e) => handleSupplierChangeForPayment(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none shadow-xs cursor-pointer"
                      required
                    >
                      <option value="">-- Choose Supplier to Pay --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Real-time Ledger Summary */}
                  {loadingLedger ? (
                    <div className="flex items-center justify-center p-3 text-xs text-slate-500">
                      <RefreshCw size={14} className="animate-spin mr-2" /> Loading ledger...
                    </div>
                  ) : supplierLedger ? (
                    <div className="p-3 bg-white border border-slate-300 rounded-xl flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Payable Balance</span>
                        <span className="text-base font-black text-rose-700 font-mono">
                          ${Number(supplierLedger.outstanding_balance_usd).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right text-[11px] text-slate-600 font-mono">
                        <div>Invoiced: ${Number(supplierLedger.total_invoiced_usd).toFixed(2)}</div>
                        <div className="text-emerald-700 font-bold">Paid: ${Number(supplierLedger.total_paid_usd).toFixed(2)}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Outstanding Invoices Table */}
              {paySupplierId && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Outstanding Invoices ({unpaidInvoices.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoAllocatePayment}
                      className="text-xs font-bold text-[#1e5c4f] hover:underline cursor-pointer"
                    >
                      Auto-allocate payment to invoices
                    </button>
                  </div>

                  {unpaidInvoices.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-xl">
                      No unpaid invoices found for this supplier.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-600 font-bold">
                            <th className="py-2 px-2">Invoice #</th>
                            <th className="py-2 px-2">Date</th>
                            <th className="py-2 px-2 text-right">Invoice Total</th>
                            <th className="py-2 px-2 text-right">Already Paid</th>
                            <th className="py-2 px-2 text-right">Outstanding</th>
                            <th className="py-2 px-2 w-32 text-right">Allocate ($)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unpaidInvoices.map((inv) => {
                            const tot = Number(inv.total_amount_usd) || 0;
                            const pd = Number(inv.paid_amount_usd) || 0;
                            const rem = Math.max(0, tot - pd);

                            return (
                              <tr key={inv.id} className="border-b border-slate-200 hover:bg-slate-50">
                                <td className="py-2 px-2 font-bold text-slate-900">{inv.invoice_number}</td>
                                <td className="py-2 px-2 text-slate-600">{inv.invoice_date}</td>
                                <td className="py-2 px-2 text-right font-mono text-slate-900">${tot.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right font-mono text-emerald-700">${pd.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right font-mono text-rose-700 font-bold">${rem.toFixed(2)}</td>
                                <td className="py-2 px-2 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    max={rem}
                                    step="0.01"
                                    value={payAllocations[inv.id] || ''}
                                    placeholder="0.00"
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setPayAllocations(prev => ({ ...prev, [inv.id]: val }));
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs font-bold outline-none shadow-xs text-right"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Method & Cash Drawer Settlement */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Payment Settlement &amp; Drawer Payout
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Payment Method</label>
                    <select
                      value={payPaymentMethod}
                      onChange={(e) => setPayPaymentMethod(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none shadow-xs cursor-pointer"
                    >
                      <option value="CASH_USD">Cash Drawer (USD)</option>
                      <option value="CASH_LBP">Cash Drawer (LBP)</option>
                      <option value="CREDIT_CARD">Credit Card / POS</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Paid USD ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payAmountUsd}
                      onChange={(e) => setPayAmountUsd(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs font-bold outline-none shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Paid LBP (L.L.)</label>
                    <input
                      type="number"
                      min="0"
                      value={payAmountLbp}
                      onChange={(e) => setPayAmountLbp(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs font-bold outline-none shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Notes / Reason</label>
                    <input
                      type="text"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      placeholder="e.g. Settle meat invoice"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none shadow-xs"
                    />
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-300 text-[11px] text-slate-600 leading-snug shadow-xs">
                  🛡️ <strong>Zero Inventory Duplication Guarantee:</strong> Recording a Supplier Payment only creates accounting settlements and drawer cash deductions. It <strong>never</strong> alters inventory quantities or creates duplicate receiving movements.
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  <span>{submitting ? 'Settling Payment...' : 'Record Supplier Payment'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* TAB 3: DIRECT PURCHASE (PHASE 6) */}
          {/* ================================================================ */}
          {activeTab === 'direct' && (
            <form onSubmit={handleSubmitDirectPurchase} className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Direct Spot Purchase (Immediate Stock &amp; Cash Deduction)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Vendor / Store Name *</label>
                    <input
                      type="text"
                      list="pos-direct-supplier-list"
                      value={dirSupplierName}
                      onChange={(e) => setDirSupplierName(e.target.value)}
                      placeholder="Select supplier or enter store name..."
                      required
                      className="w-full bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none shadow-xs"
                    />
                    <datalist id="pos-direct-supplier-list">
                      {suppliers.map(s => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Destination Storage Location</label>
                    <select
                      value={dirLocationId}
                      onChange={(e) => setDirLocationId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none shadow-xs cursor-pointer"
                    >
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Cash Outflow Currency</label>
                    <select
                      value={dirPaymentMethod}
                      onChange={(e) => setDirPaymentMethod(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-xs font-bold outline-none shadow-xs cursor-pointer"
                    >
                      <option value="CASH_USD">Drawer Cash (USD)</option>
                      <option value="CASH_LBP">Drawer Cash (LBP)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Purchased Catalog Items
                  </span>

                  {/* Search and item selection controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Direct Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={dirItemSearch}
                        onChange={(e) => setDirItemSearch(e.target.value)}
                        placeholder="🔍 Search items..."
                        className="bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 font-medium outline-none shadow-xs w-36 sm:w-48"
                      />
                      {dirItemSearch && (
                        <button
                          type="button"
                          onClick={() => setDirItemSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <select
                      id="pos-direct-add-item"
                      defaultValue=""
                      className="bg-white border border-slate-300 focus:border-[#1e5c4f] rounded-xl px-3 py-1.5 text-xs text-slate-900 font-bold outline-none shadow-xs max-w-xs cursor-pointer"
                    >
                      <option value="">+ Add item to receive</option>
                      {directPurchaseItemsList.supplierItems.length > 0 && (
                        <optgroup label="⭐ Items from this Vendor">
                          {directPurchaseItemsList.supplierItems.map(it => (
                            <option key={it.id} value={it.id}>
                              ⭐ {it.name} ({it.displayUnit}) - ${it.displayPrice.toFixed(2)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label={directPurchaseItemsList.supplierItems.length > 0 ? "Other Catalog Items" : "Catalog Items"}>
                        {directPurchaseItemsList.otherItems.map(it => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.unit || 'Unit'}) {it.price_usd ? `- $${Number(it.price_usd).toFixed(2)}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        const sel = document.getElementById('pos-direct-add-item') as HTMLSelectElement;
                        if (sel && sel.value) {
                          handleAddDirectItem(sel.value);
                          sel.value = '';
                        }
                      }}
                      className="px-3 py-1.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Direct quick-add matches bar when searching */}
                {dirItemSearch.trim() && (
                  <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-slate-100 rounded-xl border border-slate-300 text-xs">
                    <span className="text-[10px] uppercase font-black text-slate-700 mr-1 flex items-center gap-1">
                      <span>⚡</span> Direct Matches:
                    </span>
                    {directPurchaseItemsList.supplierItems.slice(0, 6).map(it => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          handleAddDirectItem(it.id);
                          setDirItemSearch('');
                        }}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        ⭐ {it.name} (${it.displayPrice.toFixed(2)}) +
                      </button>
                    ))}
                    {directPurchaseItemsList.otherItems.slice(0, 6).map(it => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          handleAddDirectItem(it.id);
                          setDirItemSearch('');
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-medium flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        {it.name} +
                      </button>
                    ))}
                    {directPurchaseItemsList.supplierItems.length === 0 && directPurchaseItemsList.otherItems.length === 0 && (
                      <span className="text-slate-500 text-[11px] italic">No items match "{dirItemSearch}"</span>
                    )}
                  </div>
                )}

                {dirItems.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-xl">
                    No items selected. Add items above to receive into stock.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600 font-bold">
                          <th className="py-2 px-2">Item</th>
                          <th className="py-2 px-2 w-28">Quantity</th>
                          <th className="py-2 px-2 w-24">Unit</th>
                          <th className="py-2 px-2 w-32">Unit Price ($)</th>
                          <th className="py-2 px-2 w-28 text-right">Total ($)</th>
                          <th className="py-2 px-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dirItems.map((it, idx) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="py-2 px-2 font-bold text-slate-900">{it.item_name}</td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={it.quantity}
                                onChange={(e) => handleUpdateDirectItem(idx, 'quantity', Number(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs font-bold outline-none shadow-xs"
                              />
                            </td>
                            <td className="py-2 px-2 text-slate-600 font-bold">{it.unit}</td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={it.unit_price}
                                onChange={(e) => handleUpdateDirectItem(idx, 'unit_price', Number(e.target.value) || 0)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-slate-900 font-mono text-xs font-bold outline-none shadow-xs"
                              />
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                              ${Number(it.total).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveDirectItem(idx)}
                                className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-300 font-bold text-xs">
                          <td colSpan={4} className="py-2.5 px-2 text-right text-slate-700">Total Purchase:</td>
                          <td className="py-2.5 px-2 text-right font-mono text-sm text-[#1e5c4f] font-black">
                            ${directSubtotal.toFixed(2)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <RefreshCw size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                  <span>{submitting ? 'Receiving Goods...' : 'Record Direct Purchase'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* TAB 4: GENERAL EXPENSE (PHASE 7 & CASH AUDIT) */}
          {/* ================================================================ */}
          {activeTab === 'expense' && (
            <div className="space-y-4">
              <form onSubmit={handleSubmitGeneralExpense} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Record Operational Expense / Cash Outflow
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Category</label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none shadow-xs cursor-pointer"
                    >
                      <option value="Operating Expense">Operating Expense</option>
                      <option value="Delivery Expense">Delivery Expense</option>
                      <option value="Cleaning & Supplies">Cleaning &amp; Supplies</option>
                      <option value="Maintenance & Gas">Maintenance &amp; Gas</option>
                      <option value="Staff Advance / Loan">Staff Advance / Loan</option>
                      <option value="Cash In / Float">Cash In (Float Top-up)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Payee / Description *</label>
                    <input
                      type="text"
                      value={expPayee}
                      onChange={(e) => setExpPayee(e.target.value)}
                      placeholder="e.g. Delivery rider, Taxi, Gas cylinder"
                      required
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold outline-none shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Amount USD ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={expAmountUsd}
                      onChange={(e) => setExpAmountUsd(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs font-bold outline-none shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Amount LBP (L.L.)</label>
                    <input
                      type="number"
                      min="0"
                      value={expAmountLbp}
                      onChange={(e) => setExpAmountLbp(e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-xs font-bold outline-none shadow-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Deducted from drawer for shift: <strong className="text-slate-800">{shift}</strong>
                  </span>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-[#1e5c4f] hover:bg-[#16473D] text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                    <span>{submitting ? 'Recording...' : 'Add Cash Record'}</span>
                  </button>
                </div>
              </form>

              {/* Recorded Payments Log for Active Shift */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                  Recorded Shift Outflows &amp; Daily Payments ({dailyPaymentsList.length})
                </span>

                {loadingPayments ? (
                  <div className="py-6 text-center text-slate-500 text-xs">Loading payments...</div>
                ) : dailyPaymentsList.length === 0 ? (
                  <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-300 rounded-xl">
                    No payments recorded for this shift yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dailyPaymentsList.map(p => (
                      <div
                        key={p.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{p.supplier || p.reason || 'Expense'}</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            Type: <span className="text-slate-700 font-semibold">{p.type}</span> • Cashier: <span className="text-slate-700 font-semibold">{p.user_name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right font-mono font-bold">
                            {parseFloat(p.amount_usd) > 0 && <div className="text-slate-900">${parseFloat(p.amount_usd).toFixed(2)}</div>}
                            {parseFloat(p.amount_lbp) > 0 && <div className="text-emerald-800 text-[11px]">{parseFloat(p.amount_lbp).toLocaleString()} LBP</div>}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteHistoricalDailyPayment(p.id)}
                            className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            💡 Authoritative daily cash reconciliation active: Cash movements sync automatically into shift drawer sessions.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-bold text-xs rounded-xl border border-slate-300 transition cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>

      </div>

      {/* FULL SUPPLIER INVOICES MODAL */}
      <SupplierInvoicesModal
        isOpen={isFullInvoicesModalOpen}
        onClose={() => setIsFullInvoicesModalOpen(false)}
        branchName={branchName}
        branchId={branchId}
        restaurantId={restaurantId}
        cashierName={cashierName}
      />
    </div>
  );
};
