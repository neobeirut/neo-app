import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ClipboardList, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Eye, 
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  Send,
  FileText,
  Clock,
  ArrowRight,
  Ban,
  Check,
  Edit,
  Mail
} from 'lucide-react';
import { api } from '../api/client';
import './DashboardScreen.css';

interface PurchasingScreenProps {
  user: any;
}

export default function PurchasingScreen({ user }: PurchasingScreenProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'invoices' | 'requests_history' | 'catalog'>('orders');
  const [loading, setLoading] = useState(true);

  // Common Master Data
  const [branches, setBranches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [allCatalogItems, setAllCatalogItems] = useState<any[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [dbVatRate, setDbVatRate] = useState<number>(11);

  // --------------------------------------------------------------------------
  // TAB: SUPPLIER INVOICES STATE
  // --------------------------------------------------------------------------
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState<boolean>(false);
  const [invFilterStatus, setInvFilterStatus] = useState<string>('All');
  const [invFilterReceipt, setInvFilterReceipt] = useState<string>('All');
  const [invFilterPayment, setInvFilterPayment] = useState<string>('All');
  const [invFilterSupplier, setInvFilterSupplier] = useState<string>('All');
  const [invFilterBranch, setInvFilterBranch] = useState<string>('All');
  const [invSearchQuery, setInvSearchQuery] = useState<string>('');

  // Invoice Inspection Modal
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any | null>(null);
  const [showInvoiceDetailModal, setShowInvoiceDetailModal] = useState<boolean>(false);
  const [invActionLoading, setInvActionLoading] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // TAB 1: PURCHASE ORDERS STATE (PHASE 2)
  // --------------------------------------------------------------------------
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [poFilterStatus, setPoFilterStatus] = useState<string>('All');
  const [poFilterBranch, setPoFilterBranch] = useState<string>('All');
  const [poFilterSupplier, setPoFilterSupplier] = useState<string>('All');

  // PO Modals
  const [showCreatePoModal, setShowCreatePoModal] = useState<boolean>(false);
  const [showPoDetailModal, setShowPoDetailModal] = useState<boolean>(false);
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const [poInvoices, setPoInvoices] = useState<any[]>([]);
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // PO Creation / Edit Form
  const [poForm, setPoForm] = useState<{
    id?: string;
    branch_id: string;
    destination_location_id: string;
    supplier_id: string;
    order_date: string;
    expected_delivery_date: string;
    notes: string;
    items: Array<{
      item_id: string;
      item_name: string;
      purchase_quantity: number;
      purchase_unit: string;
      purchase_unit_price: number;
      pack_quantity: number;
      pack_description: string;
      brand: string;
      base_unit: string;
      base_quantity: number;
      base_unit_price: number;
      total_price: number;
      notes?: string;
    }>;
  }>({
    branch_id: '',
    destination_location_id: '',
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    items: [],
  });
  const [poItemSearch, setPoItemSearch] = useState('');

  // --------------------------------------------------------------------------
  // TAB 2: HISTORICAL REQUESTS STATE
  // --------------------------------------------------------------------------
  const [historicalRequests, setHistoricalRequests] = useState<any[]>([]);
  const [histFilterStatus, setHistFilterStatus] = useState('All');
  const [histFilterBranch, setHistFilterBranch] = useState('All');
  const [histFilterDept, setHistFilterDept] = useState('All');
  const [selectedHistoricalRequest, setSelectedHistoricalRequest] = useState<any | null>(null);
  const [historicalRequestItems, setHistoricalRequestItems] = useState<any[]>([]);
  const [showHistRequestModal, setShowHistRequestModal] = useState(false);

  // --------------------------------------------------------------------------
  // TAB 3: CATALOG STATE
  // --------------------------------------------------------------------------
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogDept, setCatalogDept] = useState('All');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogItemForm, setCatalogItemForm] = useState({
    id: '',
    name: '',
    department: 'Kitchen',
    unit: 'Pcs'
  });

  // KPI stats for POs
  const poKpis = useMemo(() => {
    const draft = purchaseOrders.filter(p => p.status === 'DRAFT' || p.status === 'PENDING_APPROVAL').length;
    const sent = purchaseOrders.filter(p => p.status === 'ISSUED' || p.status === 'APPROVED').length;
    const partial = purchaseOrders.filter(p => p.status === 'PARTIALLY_RECEIVED').length;
    const completed = purchaseOrders.filter(p => p.status === 'COMPLETED' || p.status === 'RECEIVED').length;
    return { draft, sent, partial, completed };
  }, [purchaseOrders]);

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (activeTab === 'orders') {
      loadPurchaseOrders();
    } else if (activeTab === 'invoices') {
      loadInvoices();
    } else if (activeTab === 'requests_history') {
      loadHistoricalRequests();
    } else if (activeTab === 'catalog') {
      loadCatalog();
    }
  }, [activeTab, poFilterStatus, poFilterBranch, poFilterSupplier, histFilterStatus, histFilterBranch, histFilterDept, catalogSearch, catalogDept, invFilterStatus, invFilterReceipt, invFilterPayment, invFilterSupplier, invFilterBranch, invSearchQuery]);

  const loadInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const res = await api.getSupplierInvoices({
        supplier_id: invFilterSupplier !== 'All' ? invFilterSupplier : undefined,
        branch_id: invFilterBranch !== 'All' ? invFilterBranch : undefined,
        document_status: invFilterStatus !== 'All' ? invFilterStatus : undefined,
        payment_status: invFilterPayment !== 'All' ? invFilterPayment : undefined,
        receipt_status: invFilterReceipt !== 'All' ? invFilterReceipt : undefined,
        search: invSearchQuery.trim() || undefined
      });
      if (res.success && res.data) {
        setInvoicesList(res.data);
      } else {
        setInvoicesList([]);
      }
    } catch (e) {
      console.error('Failed to load supplier invoices:', e);
      setInvoicesList([]);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleValidateAndPostInvoiceFromAdmin = async (inv: any) => {
    if (!window.confirm(`Are you sure you want to validate and POST supplier invoice #${inv.invoice_number}? This will permanently record the Accounts Payable liability.`)) {
      return;
    }
    setInvActionLoading(true);
    try {
      const res = await api.validateAndPostSupplierInvoice({
        restaurant_id: inv.restaurant_id,
        branch_id: inv.branch_id,
        supplier_id: inv.supplier_id,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        currency: inv.invoice_currency,
        exchange_rate: inv.exchange_rate,
        subtotal: inv.subtotal_amount,
        tax_amount: inv.tax_amount,
        total_amount: inv.total_amount,
        override_review: true,
        override_reason: 'Approved by Administrator in Web Admin',
        items: (inv.items || []).map((it: any) => ({
          ...it,
          invoiced_quantity: it.invoiced_quantity,
          unit_price: it.unit_price,
          line_total: it.line_total
        }))
      }, user?.id);

      if (res.success) {
        alert(`Invoice #${inv.invoice_number} successfully POSTED!`);
        setShowInvoiceDetailModal(false);
        loadInvoices();
      } else {
        alert('Posting failed: ' + res.error);
      }
    } catch (e: any) {
      alert('Posting error: ' + e.message);
    } finally {
      setInvActionLoading(false);
    }
  };

  const handleCancelInvoiceDraftFromAdmin = async (inv: any) => {
    const reason = window.prompt(`Enter reason for cancelling draft invoice #${inv.invoice_number}:`, 'Duplicate / Incorrect draft');
    if (!reason) return;

    setInvActionLoading(true);
    try {
      const res = await api.cancelSupplierInvoiceDraft(inv.id, reason, user?.id);
      if (res.success) {
        alert(`Draft #${inv.invoice_number} cancelled.`);
        setShowInvoiceDetailModal(false);
        loadInvoices();
      } else {
        alert('Cancellation failed: ' + res.error);
      }
    } catch (e: any) {
      alert('Cancellation error: ' + e.message);
    } finally {
      setInvActionLoading(false);
    }
  };

  const handleReverseInvoiceFromAdmin = async (inv: any) => {
    const reason = window.prompt(`CRITICAL AUDIT ACTION: Enter formal reason for reversing posted invoice #${inv.invoice_number} (Credit Note adjustment):`, 'Supplier returned goods / billing correction');
    if (!reason) return;

    setInvActionLoading(true);
    try {
      const res = await api.reverseSupplierInvoice(inv.id, reason, user?.id);
      if (res.success) {
        alert(`Invoice #${inv.invoice_number} successfully REVERSED.`);
        setShowInvoiceDetailModal(false);
        loadInvoices();
      } else {
        alert('Reversal failed: ' + res.error);
      }
    } catch (e: any) {
      alert('Reversal error: ' + e.message);
    } finally {
      setInvActionLoading(false);
    }
  };

  const handleReceivePendingGoodsFromAdmin = async (inv: any) => {
    if (!window.confirm(`Confirm physical goods receipt for all unreceived items on invoice #${inv.invoice_number}? Inventory stock balances will update authoritatively in USD.`)) {
      return;
    }
    setInvActionLoading(true);
    try {
      const itemsToReceive = (inv.items || [])
        .filter((it: any) => (Number(it.base_quantity) || 0) > (Number(it.received_quantity) || 0))
        .map((it: any) => ({
          invoice_item_id: it.id,
          received_quantity: (Number(it.base_quantity) || 0) - (Number(it.received_quantity) || 0)
        }));

      const res = await api.receiveInvoiceGoods({
        invoice_id: inv.id,
        items: itemsToReceive,
        received_by_name: user?.name || user?.email || 'Admin'
      }, user?.id);

      if (res.success) {
        alert(`Goods successfully received for Invoice #${inv.invoice_number}!`);
        setShowInvoiceDetailModal(false);
        loadInvoices();
      } else {
        alert('Receiving failed: ' + res.error);
      }
    } catch (e: any) {
      alert('Receiving error: ' + e.message);
    } finally {
      setInvActionLoading(false);
    }
  };

  const loadMasterData = async () => {
    try {
      const results = await Promise.allSettled([
        api.getBranchesList ? api.getBranchesList() : Promise.resolve({ success: false }),
        api.getInventoryLocationsSimpleList ? api.getInventoryLocationsSimpleList() : Promise.resolve({ success: false }),
        api.getSuppliers ? api.getSuppliers() : Promise.resolve({ success: false }),
        api.getAllCatalogItems ? api.getAllCatalogItems() : Promise.resolve({ success: false }),
        api.getVatRate ? api.getVatRate(user?.restaurant_id) : Promise.resolve({ success: false }),
        api.getAllItemPackagingOptions ? api.getAllItemPackagingOptions() : Promise.resolve({ success: true, data: [] }),
        api.getDepartmentsList ? api.getDepartmentsList() : Promise.resolve({ success: false })
      ]);

      const [branchRes, locRes, suppliersRes, catalogRes, vatRes, pkgRes, deptRes] = results.map(r => r.status === 'fulfilled' ? r.value : null);

      if (branchRes?.success && branchRes.data) {
        setBranches(branchRes.data);
      }
      if (locRes?.success && locRes.data) {
        setLocations(locRes.data);
      }
      if (suppliersRes?.success && suppliersRes.data) {
        setSuppliers(suppliersRes.data);
      }
      if (catalogRes?.success && catalogRes.data) {
        setAllCatalogItems(catalogRes.data);
      }
      if (vatRes?.success && vatRes.rate !== undefined) {
        setDbVatRate(vatRes.rate);
      }
      if (pkgRes?.success && pkgRes.data) {
        setPackagingOptions(pkgRes.data);
      }
      if (deptRes?.success && deptRes.data) {
        setDepartments(deptRes.data.map((d: any) => typeof d === 'string' ? d : d.name));
      }
    } catch (e) {
      console.error('Error loading master data for purchasing:', e);
    }
  };

  // --------------------------------------------------------------------------
  // PO DATA LOADERS & ACTIONS
  // --------------------------------------------------------------------------
  const loadPurchaseOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getPurchaseOrders({
        status: poFilterStatus === 'All' ? undefined : poFilterStatus,
        branch_id: poFilterBranch === 'All' ? undefined : poFilterBranch,
        supplier_id: poFilterSupplier === 'All' ? undefined : poFilterSupplier
      });
      if (res.success && res.data) {
        setPurchaseOrders(res.data);
      } else {
        setPurchaseOrders([]);
      }
    } catch (e) {
      console.error('Error loading purchase orders:', e);
    }
    setLoading(false);
  };

  const handleOpenCreatePo = (existingPo?: any) => {
    if (existingPo) {
      setPoForm({
        id: existingPo.id,
        branch_id: existingPo.branch_id || (branches[0]?.id || ''),
        destination_location_id: existingPo.destination_location_id || (locations[0]?.id || ''),
        supplier_id: existingPo.supplier_id || '',
        order_date: existingPo.order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: existingPo.expected_delivery_date || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: existingPo.notes || '',
        items: (existingPo.items || []).map((it: any) => ({
          item_id: it.item_id,
          item_name: it.item_name,
          purchase_quantity: Number(it.purchase_quantity) || 1,
          purchase_unit: it.purchase_unit || 'Unit',
          purchase_unit_price: Number(it.purchase_unit_price) || 0,
          pack_quantity: Number(it.pack_quantity) || 1,
          pack_description: it.pack_description || '',
          brand: it.brand || '',
          base_unit: it.base_unit || it.purchase_unit || 'Unit',
          base_quantity: Number(it.base_quantity) || Number(it.purchase_quantity) || 1,
          base_unit_price: Number(it.base_unit_price) || Number(it.purchase_unit_price) || 0,
          total_price: Number(it.total_price) || 0,
          notes: it.notes || ''
        }))
      });
    } else {
      setPoForm({
        branch_id: branches[0]?.id || '',
        destination_location_id: locations[0]?.id || '',
        supplier_id: suppliers[0]?.id || '',
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: '',
        items: []
      });
    }
    setShowCreatePoModal(true);
  };

  const handleAddItemToPo = (itemId: string) => {
    const catalogItem = allCatalogItems.find(i => i.id === itemId);
    if (!catalogItem) return;

    // Check if already added
    if (poForm.items.some(i => i.item_id === itemId)) {
      alert('This item is already included in the purchase order.');
      return;
    }

    const itemPacks = packagingOptions.filter((p: any) => p.item_id === itemId);
    const defaultPack = itemPacks.find((p: any) => p.is_default) || itemPacks[0];

    const packQty = defaultPack?.pack_size ? Number(defaultPack.pack_size) : 1;
    const unitPrice = defaultPack?.price !== undefined ? Number(defaultPack.price) : (Number(catalogItem.price_usd) || 0);
    const purchaseUnit = defaultPack?.purchase_unit || defaultPack?.pack_description || catalogItem.unit || 'Unit';
    const baseUnit = catalogItem.base_unit || catalogItem.unit || 'Unit';

    const newItem = {
      item_id: catalogItem.id,
      item_name: catalogItem.name,
      purchase_quantity: 1,
      purchase_unit: purchaseUnit,
      purchase_unit_price: unitPrice,
      pack_quantity: packQty,
      pack_description: defaultPack?.pack_description || purchaseUnit,
      brand: defaultPack?.brand || '',
      base_unit: baseUnit,
      base_quantity: 1 * packQty,
      base_unit_price: packQty > 0 ? unitPrice / packQty : unitPrice,
      total_price: unitPrice,
      notes: ''
    };

    setPoForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleUpdatePoItem = (index: number, field: string, value: any) => {
    setPoForm(prev => {
      const updated = [...prev.items];
      const cur = { ...updated[index], [field]: value };

      if (field === 'purchase_quantity' || field === 'purchase_unit_price') {
        const qty = Number(cur.purchase_quantity) || 0;
        const price = Number(cur.purchase_unit_price) || 0;
        const packSize = Number(cur.pack_quantity) || 1;
        cur.total_price = Number((qty * price).toFixed(4));
        cur.base_quantity = Number((qty * packSize).toFixed(4));
        cur.base_unit_price = packSize > 0 ? price / packSize : price;
      }

      updated[index] = cur;
      return { ...prev, items: updated };
    });
  };

  const handleRemovePoItem = (index: number) => {
    setPoForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const calculatePoFormTotal = () => {
    return poForm.items.reduce((sum, it) => sum + (Number(it.total_price) || 0), 0);
  };

  const handleSavePurchaseOrder = async (desiredStatus: 'DRAFT' | 'APPROVED') => {
    if (!poForm.branch_id) {
      alert('Please select a branch.');
      return;
    }
    if (!poForm.supplier_id) {
      alert('Please select a supplier.');
      return;
    }
    if (poForm.items.length === 0) {
      alert('Please add at least one line item to the purchase order.');
      return;
    }

    setSubmittingAction(true);
    try {
      const payload = {
        po_id: poForm.id || undefined,
        branch_id: poForm.branch_id,
        destination_location_id: poForm.destination_location_id || undefined,
        supplier_id: poForm.supplier_id,
        order_date: poForm.order_date,
        expected_delivery_date: poForm.expected_delivery_date,
        notes: poForm.notes,
        user_id: user?.id || 'admin',
        user_name: user?.name || 'Admin',
        status: desiredStatus,
        items: poForm.items.map(it => ({
          item_id: it.item_id,
          item_name: it.item_name,
          purchase_quantity: Number(it.purchase_quantity),
          purchase_unit: it.purchase_unit,
          purchase_unit_price: Number(it.purchase_unit_price),
          base_quantity: Number(it.base_quantity),
          base_unit: it.base_unit,
          base_unit_price: Number(it.base_unit_price),
          notes: it.notes
        }))
      };

      const res = await api.createOrUpdatePurchaseOrder(payload);
      if (res.success) {
        alert(`Purchase Order ${res.data?.po_number || ''} saved successfully as ${desiredStatus}.`);
        setShowCreatePoModal(false);
        loadPurchaseOrders();
      } else {
        alert('Error saving purchase order: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmittingAction(false);
  };

  const handleOpenPoDetail = async (po: any) => {
    setSelectedPo(po);
    setShowPoDetailModal(true);
    // Fetch fresh PO detail with joined dispatches and items
    try {
      const res = await api.getPurchaseOrderById(po.id);
      if (res.success && res.data) {
        setSelectedPo(res.data);
      }
      // Also fetch any supplier invoices linked to this PO
      const invRes = await api.getSupplierInvoices({ supplier_id: po.supplier_id });
      if (invRes.success && invRes.data) {
        const linked = invRes.data.filter((inv: any) => inv.purchase_order_id === po.id);
        setPoInvoices(linked);
      } else {
        setPoInvoices([]);
      }
    } catch (e) {
      console.error('Error opening PO details:', e);
    }
  };

  const handleApprovePo = async (poId: string) => {
    if (!window.confirm('Approve this Purchase Order?')) return;
    setSubmittingAction(true);
    try {
      const res = await api.approvePurchaseOrder(poId, user?.id || 'admin', user?.name || 'Admin');
      if (res.success) {
        alert('Purchase Order approved.');
        loadPurchaseOrders();
        handleOpenPoDetail(selectedPo);
      } else {
        alert('Error approving PO: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmittingAction(false);
  };

  const handleSendSupplierWhatsApp = async (po: any) => {
    const supplier = po.supplier;
    if (!supplier?.phone) {
      alert('Supplier does not have a phone number configured.');
      return;
    }

    let text = `*PURCHASE ORDER: ${po.po_number}*\n`;
    text += `Branch: ${branches.find(b => b.id === po.branch_id)?.name || 'Default'}\n`;
    text += `Order Date: ${po.order_date}\n`;
    text += `Expected Delivery: ${po.expected_delivery_date}\n\n`;
    text += `*ITEMS:*\n`;

    (po.items || []).forEach((item: any) => {
      text += `• ${item.item_name}: ${item.purchase_quantity} ${item.purchase_unit}\n`;
    });

    if (po.notes) {
      text += `\n*Notes:* ${po.notes}\n`;
    }
    text += `\nPlease confirm order receipt and delivery schedule.\nThank you!`;

    const cleanedPhone = supplier.phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');

    // Record dispatch audit in backend
    try {
      await api.recordPurchaseOrderDispatch({
        po_id: po.id,
        supplier_id: po.supplier_id,
        user_id: user?.id || 'admin',
        user_name: user?.name || 'Admin',
        communication_method: 'WHATSAPP',
        recipient: supplier.phone,
        notes: 'Order sent via WhatsApp Web'
      });
      loadPurchaseOrders();
      handleOpenPoDetail(po);
    } catch (e) {
      console.error('Error logging WhatsApp dispatch:', e);
    }
  };

  const handleSendSupplierEmail = async (po: any) => {
    const supplier = po.supplier;
    if (!supplier?.email) {
      alert('Supplier does not have an email address configured.');
      return;
    }

    const subject = `Purchase Order ${po.po_number}`;
    let body = `Dear ${supplier.name},\n\nPlease find our purchase order details below:\n\n`;
    body += `PO Number: ${po.po_number}\n`;
    body += `Order Date: ${po.order_date}\n`;
    body += `Expected Delivery: ${po.expected_delivery_date}\n\n`;
    body += `Ordered Items:\n`;

    (po.items || []).forEach((item: any) => {
      body += `- ${item.item_name}: ${item.purchase_quantity} ${item.purchase_unit} (@ $${Number(item.purchase_unit_price).toFixed(2)})\n`;
    });

    body += `\nEstimated Total: $${Number(po.total_amount).toFixed(2)}\n`;
    if (po.notes) body += `Notes: ${po.notes}\n`;
    body += `\nPlease confirm receipt of this order.\n\nBest regards,\n${user?.name || 'Purchasing Department'}`;

    const mailto = `mailto:${encodeURIComponent(supplier.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');

    try {
      await api.recordPurchaseOrderDispatch({
        po_id: po.id,
        supplier_id: po.supplier_id,
        user_id: user?.id || 'admin',
        user_name: user?.name || 'Admin',
        communication_method: 'EMAIL',
        recipient: supplier.email,
        notes: 'Order dispatched via Email'
      });
      loadPurchaseOrders();
      handleOpenPoDetail(po);
    } catch (e) {
      console.error('Error logging email dispatch:', e);
    }
  };

  const handleCancelPo = async (poId: string, poNumber: string) => {
    const reason = window.prompt(`Enter cancellation reason for Purchase Order ${poNumber}:`);
    if (!reason || !reason.trim()) return;

    setSubmittingAction(true);
    try {
      const res = await api.cancelPurchaseOrder(poId, reason, user?.id || 'admin', user?.name || 'Admin');
      if (res.success) {
        alert('Purchase Order cancelled.');
        setShowPoDetailModal(false);
        loadPurchaseOrders();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error cancelling order: ' + e.message);
    }
    setSubmittingAction(false);
  };

  const handleCloseShortPo = async (poId: string, poNumber: string) => {
    const reason = window.prompt(`Enter reason for closing short Purchase Order ${poNumber} (e.g., supplier out of stock):`);
    if (!reason || !reason.trim()) return;

    setSubmittingAction(true);
    try {
      const res = await api.closeShortPurchaseOrder(poId, reason, user?.id || 'admin', user?.name || 'Admin');
      if (res.success) {
        alert('Purchase Order marked as Closed Short.');
        setShowPoDetailModal(false);
        loadPurchaseOrders();
      } else {
        alert('Error closing short: ' + e.message);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
    setSubmittingAction(false);
  };

  // --------------------------------------------------------------------------
  // HISTORICAL REQUESTS LOGIC (LEGACY COMPATIBILITY)
  // --------------------------------------------------------------------------
  const loadHistoricalRequests = async () => {
    setLoading(true);
    try {
      const res = await api.getPurchasingRequests(
        histFilterStatus === 'All' ? undefined : histFilterStatus,
        histFilterDept === 'All' ? undefined : histFilterDept
      );
      if (res.success && res.data) {
        let list = res.data;
        if (histFilterBranch !== 'All') {
          list = list.filter((r: any) => r.branch === histFilterBranch);
        }
        setHistoricalRequests(list);
      } else {
        setHistoricalRequests([]);
      }
    } catch (e) {
      console.error('Error loading historical requests:', e);
    }
    setLoading(false);
  };

  const handleOpenHistoricalRequest = async (req: any) => {
    setSelectedHistoricalRequest(req);
    setHistoricalRequestItems([]);
    setShowHistRequestModal(true);
    try {
      const res = await api.getPurchasingRequestItems(req.id);
      if (res.success && res.data) {
        setHistoricalRequestItems(res.data);
      }
    } catch (e) {
      console.error('Error loading historical request items:', e);
    }
  };

  // --------------------------------------------------------------------------
  // CATALOG LOGIC
  // --------------------------------------------------------------------------
  const loadCatalog = async () => {
    setLoading(true);
    try {
      const res = await api.getPurchasingItems(catalogSearch || undefined, catalogDept);
      if (res.success && res.data) {
        setCatalogItems(res.data);
      } else {
        setCatalogItems([]);
      }
    } catch (e) {
      console.error('Error loading catalog:', e);
    }
    setLoading(false);
  };

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogItemForm.name.trim()) {
      alert('Please enter item name.');
      return;
    }
    try {
      const res = await api.savePurchasingItem(catalogItemForm);
      if (res.success) {
        setShowCatalogModal(false);
        loadCatalog();
        setCatalogItemForm({ id: '', name: '', department: 'Kitchen', unit: 'Pcs' });
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const handleEditCatalogItem = (item: any) => {
    setCatalogItemForm({
      id: item.id,
      name: item.name,
      department: item.department,
      unit: item.unit
    });
    setShowCatalogModal(true);
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (!window.confirm('Remove this item from the purchasing catalog?')) return;
    try {
      const res = await api.deletePurchasingItem(id);
      if (res.success) {
        loadCatalog();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    let bg = '#f1f5f9';
    let color = '#475569';
    if (s === 'DRAFT' || s === 'PENDING_APPROVAL') {
      bg = '#e2e8f0'; color = '#334155';
    } else if (s === 'APPROVED') {
      bg = '#dbeafe'; color = '#1d4ed8';
    } else if (s === 'ISSUED' || s === 'SENT') {
      bg = '#fef3c7'; color = '#b45309';
    } else if (s === 'PARTIALLY_RECEIVED') {
      bg = '#ffedd5'; color = '#c2410c';
    } else if (s === 'COMPLETED' || s === 'RECEIVED') {
      bg = '#dcfce7'; color = '#15803d';
    } else if (s === 'CANCELLED' || s === 'DELETED') {
      bg = '#fee2e2'; color = '#b91c1c';
    } else if (s === 'CLOSED_SHORT') {
      bg = '#f3e8ff'; color = '#7e22ce';
    }
    return (
      <span style={{
        padding: '3px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: bg,
        color: color,
        display: 'inline-block'
      }}>
        {s}
      </span>
    );
  };

  // Available catalog items for PO creation: supplier items listed first, followed by other catalog items, with search filter
  const { supplierItemsForPo, otherItemsForPo } = useMemo(() => {
    // Resolve alias suppliers with same normalized name or phone
    const matchedSupplierIds = new Set<string>();
    if (poForm.supplier_id) {
      matchedSupplierIds.add(poForm.supplier_id);
      const selSupplier = suppliers.find(s => s.id === poForm.supplier_id);
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

    const q = poItemSearch.trim().toLowerCase();
    const filtered = allCatalogItems.filter(i => {
      if (!q) return true;
      return (i.name || '').toLowerCase().includes(q) || (i.unit || '').toLowerCase().includes(q);
    });

    const supplierItems: any[] = [];
    const otherItems: any[] = [];

    filtered.forEach(i => {
      if (matchedSupplierIds.has(i.supplier_id)) {
        supplierItems.push(i);
      } else {
        otherItems.push(i);
      }
    });

    return { supplierItemsForPo: supplierItems, otherItemsForPo: otherItems };
  }, [allCatalogItems, poForm.supplier_id, suppliers, poItemSearch]);

  return (
    <div className="dashboard-container">
      {/* Title Header */}
      <div className="dashboard-title-row">
        <div>
          <h1>Purchasing & Procurement</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Unified purchase order creation, supplier communications, receiving tracking, and item catalog.
          </p>
        </div>
        
        {/* Toggle Tabs */}
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          <button 
            className="auth-btn" 
            style={{ 
              width: 'auto', 
              borderRadius: 0,
              backgroundColor: activeTab === 'orders' ? 'var(--primary)' : '#ffffff',
              color: activeTab === 'orders' ? '#ffffff' : 'var(--text-main)',
              border: 'none',
              padding: '10px 18px',
              fontWeight: 600,
              fontSize: '14px'
            }}
            onClick={() => setActiveTab('orders')}
          >
            Purchase Orders
          </button>
          <button 
            className="auth-btn" 
            style={{ 
              width: 'auto', 
              borderRadius: 0,
              backgroundColor: activeTab === 'invoices' ? 'var(--primary)' : '#ffffff',
              color: activeTab === 'invoices' ? '#ffffff' : 'var(--text-main)',
              border: 'none',
              padding: '10px 18px',
              fontWeight: 600,
              fontSize: '14px'
            }}
            onClick={() => setActiveTab('invoices')}
          >
            Supplier Invoices
          </button>
          <button 
            className="auth-btn" 
            style={{ 
              width: 'auto', 
              borderRadius: 0,
              backgroundColor: activeTab === 'requests_history' ? 'var(--primary)' : '#ffffff',
              color: activeTab === 'requests_history' ? '#ffffff' : 'var(--text-main)',
              border: 'none',
              padding: '10px 18px',
              fontWeight: 600,
              fontSize: '14px'
            }}
            onClick={() => setActiveTab('requests_history')}
          >
            Historical Requests
          </button>
          <button 
            className="auth-btn" 
            style={{ 
              width: 'auto', 
              borderRadius: 0,
              backgroundColor: activeTab === 'catalog' ? 'var(--primary)' : '#ffffff',
              color: activeTab === 'catalog' ? '#ffffff' : 'var(--text-main)',
              border: 'none',
              padding: '10px 18px',
              fontWeight: 600,
              fontSize: '14px'
            }}
            onClick={() => setActiveTab('catalog')}
          >
            Purchasing Catalog
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: PURCHASE ORDERS (PHASE 2) */}
      {/* ==================================================================== */}
      {activeTab === 'orders' && (
        <>
          {/* Summary KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-status-neutral" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Draft Orders</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: '#e2e8f0', color: '#64748b' }}>
                  <ClipboardList size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{poKpis.draft}</span>
                <span className="kpi-card-label">Drafts & pending approval</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Sent to Suppliers</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                  <Send size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{poKpis.sent}</span>
                <span className="kpi-card-label">Approved & issued orders</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-warning" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Partially Received</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)', color: '#ea580c' }}>
                  <Truck size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{poKpis.partial}</span>
                <span className="kpi-card-label">Deliveries in progress at POS</span>
              </div>
            </div>

            <div className="kpi-card kpi-status-success" style={{ cursor: 'default' }}>
              <div className="kpi-card-header">
                <span className="kpi-card-title">Completed Orders</span>
                <div className="kpi-card-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <div className="kpi-card-body">
                <span className="kpi-card-value">{poKpis.completed}</span>
                <span className="kpi-card-label">Fully received & fulfilled</span>
              </div>
            </div>
          </div>

          {/* Filters Card */}
          <div className="filters-card" style={{ marginTop: '16px' }}>
            <div className="filters-row" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flex: 1 }}>
                <div className="filter-group">
                  <label>Status</label>
                  <select 
                    className="filter-select"
                    value={poFilterStatus} 
                    onChange={(e) => setPoFilterStatus(e.target.value)}
                  >
                    <option value="All">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="APPROVED">Approved</option>
                    <option value="ISSUED">Sent (Issued)</option>
                    <option value="PARTIALLY_RECEIVED">Partially Received</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CLOSED_SHORT">Closed Short</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Branch</label>
                  <select 
                    className="filter-select"
                    value={poFilterBranch} 
                    onChange={(e) => setPoFilterBranch(e.target.value)}
                  >
                    <option value="All">All Branches</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>Supplier</label>
                  <select 
                    className="filter-select"
                    value={poFilterSupplier} 
                    onChange={(e) => setPoFilterSupplier(e.target.value)}
                  >
                    <option value="All">All Suppliers</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                  <button 
                    onClick={() => {
                      setPoFilterStatus('All');
                      setPoFilterBranch('All');
                      setPoFilterSupplier('All');
                    }}
                    className="auth-btn"
                    style={{ width: 'auto', height: '40px', padding: '0 16px', backgroundColor: '#eef2f5', color: '#495057', border: 'none' }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <button 
                  onClick={() => handleOpenCreatePo()}
                  className="auth-btn"
                  style={{ width: 'auto', height: '40px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  <Plus size={16} /> Create Purchase Order
                </button>
              </div>
            </div>
          </div>

          {/* PO Table */}
          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            {loading ? (
              <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading purchase orders...</p>
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
                <AlertCircle size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>No Purchase Orders Found</span>
                <span className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Click "Create Purchase Order" above to place a new order.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={tableHeaderStyle}>PO Number</th>
                      <th style={tableHeaderStyle}>Supplier</th>
                      <th style={tableHeaderStyle}>Branch</th>
                      <th style={tableHeaderStyle}>Order Date</th>
                      <th style={tableHeaderStyle}>Delivery Date</th>
                      <th style={tableHeaderStyle}>Total (USD)</th>
                      <th style={tableHeaderStyle}>Status</th>
                      <th style={tableHeaderStyle}>Dispatches</th>
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map((po) => {
                      const branchName = branches.find(b => b.id === po.branch_id)?.name || 'Default';
                      const supplierName = po.supplier?.name || suppliers.find(s => s.id === po.supplier_id)?.name || 'Supplier';
                      const dispatchCount = po.dispatches?.length || 0;

                      return (
                        <tr key={po.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s' }}>
                          <td style={{ ...tableCellStyle, fontWeight: 700, color: 'var(--primary)' }}>{po.po_number}</td>
                          <td style={{ ...tableCellStyle, fontWeight: 600 }}>{supplierName}</td>
                          <td style={tableCellStyle}>{branchName}</td>
                          <td style={tableCellStyle}>{po.order_date}</td>
                          <td style={tableCellStyle}>{po.expected_delivery_date}</td>
                          <td style={{ ...tableCellStyle, fontWeight: 700 }}>${Number(po.total_amount).toFixed(2)}</td>
                          <td style={tableCellStyle}>{getStatusBadge(po.status)}</td>
                          <td style={tableCellStyle}>
                            {dispatchCount > 0 ? (
                              <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                                Sent ({dispatchCount})
                              </span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Not Sent</span>
                            )}
                          </td>
                          <td style={tableCellStyle}>
                            <button 
                              onClick={() => handleOpenPoDetail(po)} 
                              className="auth-btn" 
                              style={{ 
                                width: 'auto', 
                                padding: '6px 12px', 
                                fontSize: '12px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px',
                                backgroundColor: 'var(--primary)'
                              }}
                            >
                              <Eye size={14} /> View / Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: HISTORICAL REQUESTS (LEGACY VIEW) */}
      {/* ==================================================================== */}
      {activeTab === 'requests_history' && (
        <>
          <div className="filters-card" style={{ marginTop: '16px' }}>
            <div className="filters-row">
              <div className="filter-group">
                <label>Status</label>
                <select 
                  className="filter-select"
                  value={histFilterStatus} 
                  onChange={(e) => setHistFilterStatus(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Ordered">Ordered</option>
                  <option value="Partially Received">Partially Received</option>
                  <option value="Received">Received</option>
                  <option value="Deleted">Cancelled</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Branch</label>
                <select 
                  className="filter-select"
                  value={histFilterBranch} 
                  onChange={(e) => setHistFilterBranch(e.target.value)}
                >
                  <option value="All">All Branches</option>
                  {branches.map(b => (
                    <option key={b.id || b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Department</label>
                <select 
                  className="filter-select"
                  value={histFilterDept} 
                  onChange={(e) => setHistFilterDept(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            {loading ? (
              <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading historical requests...</p>
              </div>
            ) : historicalRequests.length === 0 ? (
              <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
                <AlertCircle size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>No Historical Requests Found</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={tableHeaderStyle}>Request ID</th>
                      <th style={tableHeaderStyle}>Branch</th>
                      <th style={tableHeaderStyle}>Department</th>
                      <th style={tableHeaderStyle}>Created By</th>
                      <th style={tableHeaderStyle}>Created Date</th>
                      <th style={tableHeaderStyle}>Status</th>
                      <th style={tableHeaderStyle}>Comments</th>
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalRequests.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ ...tableCellStyle, fontWeight: 700, color: 'var(--primary)' }}>{req.purchasing_id}</td>
                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>{req.branch}</td>
                        <td style={tableCellStyle}>{req.department}</td>
                        <td style={tableCellStyle}>{req.user_name || '—'}</td>
                        <td style={tableCellStyle}>{new Date(req.created_at).toLocaleString().split(',')[0]}</td>
                        <td style={tableCellStyle}>{getStatusBadge(req.status)}</td>
                        <td style={{ ...tableCellStyle, maxWidth: '200px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {req.comments || '—'}
                        </td>
                        <td style={tableCellStyle}>
                          <button 
                            onClick={() => handleOpenHistoricalRequest(req)} 
                            className="auth-btn" 
                            style={{ 
                              width: 'auto', 
                              padding: '6px 12px', 
                              fontSize: '12px', 
                              backgroundColor: '#f1f5f9',
                              color: 'var(--text-main)',
                              border: '1px solid var(--border)'
                            }}
                          >
                            <Eye size={14} /> View Items
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: PURCHASING CATALOG */}
      {/* ==================================================================== */}
      {activeTab === 'catalog' && (
        <>
          <div className="filters-card">
            <div className="filters-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px', flex: 1, maxWidth: '600px' }}>
                <div className="filter-group" style={{ flex: 1 }}>
                  <label>Search Item</label>
                  <input 
                    type="text" 
                    className="filter-input"
                    placeholder="Search by name..."
                    value={catalogSearch} 
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                </div>

                <div className="filter-group" style={{ width: '180px' }}>
                  <label>Department</label>
                  <select 
                    className="filter-select"
                    value={catalogDept} 
                    onChange={(e) => setCatalogDept(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '2px', gap: '10px', flexWrap: 'wrap' }}>
                <Link
                  to="/catalog"
                  style={{
                    height: '40px',
                    padding: '0 16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#f1f5f9',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '13px'
                  }}
                >
                  <ExternalLink size={15} /> Open Master Catalog
                </Link>
                <button 
                  onClick={() => {
                    setCatalogItemForm({ id: '', name: '', department: 'Kitchen', unit: 'Pcs' });
                    setShowCatalogModal(true);
                  }}
                  className="auth-btn"
                  style={{ width: 'auto', height: '40px', padding: '0 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={16} /> Quick Add Item
                </button>
              </div>
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'var(--surface)', 
            borderRadius: '12px', 
            border: '1px solid var(--border)', 
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            marginTop: '16px'
          }}>
            {loading ? (
              <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', gap: '8px' }}>
                <RefreshCw className="spin" size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading catalog items...</p>
              </div>
            ) : catalogItems.length === 0 ? (
              <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', textAlign: 'center', gap: '8px' }}>
                <ShoppingBag size={36} style={{ color: 'var(--text-muted)' }} />
                <span className="empty-state-title" style={{ fontWeight: 700, fontSize: '16px' }}>Catalog is Empty</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                      <th style={tableHeaderStyle}>Item Name</th>
                      <th style={tableHeaderStyle}>Department</th>
                      <th style={tableHeaderStyle}>Standard Unit</th>
                      <th style={tableHeaderStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogItems.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ ...tableCellStyle, fontWeight: 600 }}>{item.name}</td>
                        <td style={tableCellStyle}>{item.department}</td>
                        <td style={tableCellStyle}>
                          <span style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', borderRadius: '4px', fontWeight: 600, color: '#475569', fontSize: '12px' }}>
                            {item.unit}
                          </span>
                        </td>
                        <td style={tableCellStyle}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button 
                              onClick={() => handleEditCatalogItem(item)} 
                              className="auth-btn" 
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none' }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteCatalogItem(item.id)} 
                              className="auth-btn" 
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: SUPPLIER INVOICES (PHASE 5 MANAGEMENT) */}
      {/* ==================================================================== */}
      {activeTab === 'invoices' && (
        <>
          {/* KPI Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Invoices</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                {invoicesList.length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Recorded across all branches</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Open AP Liability (USD)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                ${invoicesList
                  .filter(inv => inv.status === 'POSTED')
                  .reduce((sum, inv) => sum + Math.max(0, (Number(inv.total_amount_usd) || 0) - (Number(inv.paid_amount_usd) || 0)), 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Unsettled supplier debt</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Total Paid to Date (USD)</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                ${invoicesList
                  .reduce((sum, inv) => sum + (Number(inv.paid_amount_usd) || 0), 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Disbursements recorded</div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px 20px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase' }}>Drafts &amp; Pending Reviews</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#4f46e5', marginTop: '4px' }}>
                {invoicesList.filter(inv => ['DRAFT', 'PENDING_REVIEW', 'PROCESSING'].includes(inv.status)).length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Awaiting validation &amp; posting</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div style={{ flex: '1 1 200px' }}>
              <input 
                type="text" 
                placeholder="Search Invoice # or Notes..." 
                value={invSearchQuery}
                onChange={(e) => setInvSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px' }}
              />
            </div>

            <div style={{ width: '160px' }}>
              <select 
                value={invFilterStatus} 
                onChange={(e) => setInvFilterStatus(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: '#ffffff' }}
              >
                <option value="All">All Document Statuses</option>
                <option value="POSTED">POSTED (Active)</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PENDING_REVIEW">PENDING REVIEW</option>
                <option value="REVERSED">REVERSED (Credit Note)</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div style={{ width: '150px' }}>
              <select 
                value={invFilterReceipt} 
                onChange={(e) => setInvFilterReceipt(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: '#ffffff' }}
              >
                <option value="All">All Receiving</option>
                <option value="FULLY_RECEIVED">Fully Received</option>
                <option value="PARTIALLY_RECEIVED">Partially Received</option>
                <option value="NO_GOODS_RECEIVED">No Goods Received</option>
              </select>
            </div>

            <div style={{ width: '150px' }}>
              <select 
                value={invFilterPayment} 
                onChange={(e) => setInvFilterPayment(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: '#ffffff' }}
              >
                <option value="All">All Payments</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
              </select>
            </div>

            <div style={{ width: '180px' }}>
              <select 
                value={invFilterSupplier} 
                onChange={(e) => setInvFilterSupplier(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', backgroundColor: '#ffffff' }}
              >
                <option value="All">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={loadInvoices}
              className="auth-btn"
              style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#f1f5f9', color: 'var(--text-main)', border: '1px solid var(--border)' }}
            >
              <RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh
            </button>
          </div>

          {/* Invoices Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {invoicesLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ marginBottom: '8px' }} />
                <div>Loading supplier invoices...</div>
              </div>
            ) : invoicesList.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileText size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0' }}>No supplier invoices found</h3>
                <p style={{ fontSize: '13px', margin: 0 }}>Try adjusting your search criteria or record an invoice at POS or Mobile.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1000px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                      <th style={tableHeaderStyle}>Invoice #</th>
                      <th style={tableHeaderStyle}>Date</th>
                      <th style={tableHeaderStyle}>Supplier</th>
                      <th style={tableHeaderStyle}>Doc</th>
                      <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Native Total</th>
                      <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Total (USD)</th>
                      <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Rate</th>
                      <th style={tableHeaderStyle}>Lifecycle</th>
                      <th style={tableHeaderStyle}>Receiving</th>
                      <th style={tableHeaderStyle}>Payment</th>
                      <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesList.map(inv => {
                      const isLbp = inv.invoice_currency === 'LBP';
                      const nativeTotalFormatted = isLbp 
                        ? `${Number(inv.total_amount || 0).toLocaleString()} L.L.` 
                        : `$${Number(inv.total_amount_usd || inv.total_amount || 0).toFixed(2)}`;

                      return (
                        <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ ...tableCellStyle, fontWeight: 700, color: 'var(--primary)' }}>
                            {inv.invoice_number}
                            {inv.purchase_order_id && (
                              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>
                                PO linked
                              </span>
                            )}
                          </td>
                          <td style={tableCellStyle}>
                            {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                            {inv.supplier?.name || 'Unknown Supplier'}
                          </td>
                          <td style={tableCellStyle}>
                            {inv.attachment_url ? (
                              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                                📎 Attached
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700 }}>
                            {nativeTotalFormatted}
                          </td>
                          <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                            ${Number(inv.total_amount_usd || 0).toFixed(2)}
                          </td>
                          <td style={{ ...tableCellStyle, textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
                            {isLbp ? Number(inv.exchange_rate || 89500).toLocaleString() : '1.0'}
                          </td>
                          <td style={tableCellStyle}>
                            <span style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              backgroundColor: inv.status === 'POSTED' ? '#dcfce7' : inv.status === 'DRAFT' ? '#fef3c7' : inv.status === 'REVERSED' ? '#fee2e2' : '#f1f5f9',
                              color: inv.status === 'POSTED' ? '#166534' : inv.status === 'DRAFT' ? '#92400e' : inv.status === 'REVERSED' ? '#991b1b' : '#475569'
                            }}>
                              {inv.status}
                            </span>
                          </td>
                          <td style={tableCellStyle}>
                            <span style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              backgroundColor: inv.receipt_status === 'FULLY_RECEIVED' ? '#dcfce7' : inv.receipt_status === 'PARTIALLY_RECEIVED' ? '#ffedd5' : '#f1f5f9',
                              color: inv.receipt_status === 'FULLY_RECEIVED' ? '#166534' : inv.receipt_status === 'PARTIALLY_RECEIVED' ? '#9a3412' : '#475569'
                            }}>
                              {inv.receipt_status ? inv.receipt_status.replace(/_/g, ' ') : 'NO GOODS'}
                            </span>
                          </td>
                          <td style={tableCellStyle}>
                            <span style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontWeight: 700,
                              backgroundColor: inv.payment_status === 'PAID' ? '#dcfce7' : inv.payment_status === 'PARTIALLY_PAID' ? '#ffedd5' : '#fee2e2',
                              color: inv.payment_status === 'PAID' ? '#166534' : inv.payment_status === 'PARTIALLY_PAID' ? '#9a3412' : '#991b1b'
                            }}>
                              {inv.payment_status || 'UNPAID'}
                            </span>
                          </td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedInvoiceForModal(inv);
                                setShowInvoiceDetailModal(true);
                              }}
                              className="auth-btn"
                              style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none', borderRadius: '6px' }}
                            >
                              <Eye size={12} style={{ marginRight: '4px' }} /> Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {showPoDetailModal && selectedPo && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '1100px' }}>
            {/* Header */}
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                    Purchase Order: <span style={{ color: 'var(--primary)' }}>{selectedPo.po_number}</span>
                  </h2>
                  {getStatusBadge(selectedPo.status)}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                  Supplier: <strong>{selectedPo.supplier?.name || suppliers.find(s => s.id === selectedPo.supplier_id)?.name}</strong> 
                  {selectedPo.supplier?.phone && ` (${selectedPo.supplier.phone})`} | 
                  Branch: <strong>{branches.find(b => b.id === selectedPo.branch_id)?.name || 'Default'}</strong> | 
                  Ordered: <strong>{selectedPo.order_date}</strong> | 
                  Expected: <strong>{selectedPo.expected_delivery_date}</strong>
                </p>
              </div>
              <button onClick={() => setShowPoDetailModal(false)} style={iconButtonStyle}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* SECTION 1: ITEMS ORDERED & RECEIVING STATUS (Ordered vs Received vs Outstanding) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Ordered Items & Fulfillment Audit</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Total Order: <strong style={{ color: 'var(--text-main)' }}>${Number(selectedPo.total_amount).toFixed(2)}</strong>
                  </span>
                </div>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                        <th style={tableHeaderStyle}>Item</th>
                        <th style={tableHeaderStyle}>Unit</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Ordered</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right', color: '#16a34a' }}>Received</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right', color: '#ea580c' }}>Outstanding</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Unit Price</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Line Total</th>
                        <th style={tableHeaderStyle}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedPo.items || []).map((item: any) => {
                        const ordered = Number(item.purchase_quantity) || 0;
                        const received = Number(item.received_purchase_quantity) || 0;
                        const outstanding = Math.max(0, ordered - received);
                        const isFulfilled = received >= ordered && ordered > 0;

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ ...tableCellStyle, fontWeight: 600 }}>{item.item_name}</td>
                            <td style={tableCellStyle}>{item.purchase_unit}</td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700 }}>{ordered}</td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{received}</td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700, color: outstanding > 0 ? '#ea580c' : 'var(--text-muted)' }}>
                              {outstanding}
                            </td>
                            <td style={{ ...tableCellStyle, textAlign: 'right' }}>${Number(item.purchase_unit_price).toFixed(2)}</td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 600 }}>${Number(item.total_price).toFixed(2)}</td>
                            <td style={tableCellStyle}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: isFulfilled ? '#dcfce7' : '#f1f5f9',
                                color: isFulfilled ? '#15803d' : '#64748b'
                              }}>
                                {isFulfilled ? 'FULFILLED' : 'OPEN'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 2: PHYSICAL GOODS RECEIVING BANNER (PHASE 2.5) */}
              <div style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <Truck size={20} style={{ color: '#2563eb', marginTop: '2px', flexShrink: 0 }} />
                <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: 1.5 }}>
                  <strong>Physical Goods Receiving Notice:</strong> In accordance with the FLOW inventory architecture, manual order receiving in Admin has been decommissioned. Physical stock receiving is performed exclusively at the <strong>POS</strong> upon delivery (via <em>POS Payments &gt; Supplier Invoice</em>). Once received at POS, inventory balances update automatically, and received quantities reflect here.
                </div>
              </div>

              {/* SECTION 3: LINKED SUPPLIER INVOICES */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Linked Supplier Invoices</h3>
                {poInvoices.length === 0 ? (
                  <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-muted)' }}>
                    No supplier invoices have been posted against this purchase order yet. Invoices are recorded at POS upon delivery.
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                          <th style={tableHeaderStyle}>Invoice #</th>
                          <th style={tableHeaderStyle}>Invoice Date</th>
                          <th style={tableHeaderStyle}>Currency</th>
                          <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Total Amount</th>
                          <th style={tableHeaderStyle}>Payment Status</th>
                          <th style={tableHeaderStyle}>Receipt Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poInvoices.map((inv) => (
                          <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ ...tableCellStyle, fontWeight: 700, color: 'var(--primary)' }}>{inv.invoice_number}</td>
                            <td style={tableCellStyle}>{inv.invoice_date}</td>
                            <td style={tableCellStyle}>{inv.currency}</td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700 }}>
                              {inv.currency === 'LBP' ? `${Number(inv.total_amount_lbp).toLocaleString()} LBP` : `$${Number(inv.total_amount_usd).toFixed(2)}`}
                            </td>
                            <td style={tableCellStyle}>{getStatusBadge(inv.payment_status)}</td>
                            <td style={tableCellStyle}>{getStatusBadge(inv.receipt_status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SECTION 4: SUPPLIER COMMUNICATIONS & DISPATCH AUDIT (PHASE 2.3) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Supplier Communication &amp; Dispatch History</h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleSendSupplierWhatsApp(selectedPo)}
                      className="auth-btn"
                      style={{
                        width: 'auto',
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#25D366',
                        color: '#ffffff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 700
                      }}
                    >
                      <WhatsAppIcon size={14} /> Send WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendSupplierEmail(selectedPo)}
                      className="auth-btn"
                      style={{
                        width: 'auto',
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 700
                      }}
                    >
                      <Mail size={14} /> Send Email
                    </button>
                  </div>
                </div>

                {(!selectedPo.dispatches || selectedPo.dispatches.length === 0) ? (
                  <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-muted)' }}>
                    No communications logged yet. Click "Send WhatsApp" or "Send Email" above to transmit this purchase order to the vendor.
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                          <th style={tableHeaderStyle}>Date / Time</th>
                          <th style={tableHeaderStyle}>Channel</th>
                          <th style={tableHeaderStyle}>Recipient</th>
                          <th style={tableHeaderStyle}>Sent By</th>
                          <th style={tableHeaderStyle}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPo.dispatches.map((d: any) => (
                          <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={tableCellStyle}>{new Date(d.sent_at).toLocaleString()}</td>
                            <td style={{ ...tableCellStyle, fontWeight: 600 }}>{d.communication_method}</td>
                            <td style={tableCellStyle}>{d.recipient || '—'}</td>
                            <td style={tableCellStyle}>{d.sent_by_name || 'Admin'}</td>
                            <td style={tableCellStyle}>
                              <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '12px' }}>{d.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedPo.notes && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '8px', color: '#b45309', fontSize: '13px' }}>
                  <strong>Order Notes:</strong> {selectedPo.notes}
                </div>
              )}
            </div>

            {/* Modal Footer / Workflow Actions */}
            <div style={modalFooterStyle}>
              <div>
                {/* Cancel PO action if unreceived */}
                {selectedPo.status !== 'CANCELLED' && selectedPo.status !== 'COMPLETED' && (
                  <button
                    onClick={() => handleCancelPo(selectedPo.id, selectedPo.po_number)}
                    className="auth-btn"
                    style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', fontWeight: 600, fontSize: '13px' }}
                    disabled={submittingAction}
                  >
                    Cancel Order
                  </button>
                )}

                {/* Close Short action if partially received */}
                {(selectedPo.status === 'PARTIALLY_RECEIVED' || selectedPo.status === 'ISSUED') && (
                  <button
                    onClick={() => handleCloseShortPo(selectedPo.id, selectedPo.po_number)}
                    className="auth-btn"
                    style={{ width: 'auto', marginLeft: '8px', padding: '8px 16px', backgroundColor: 'rgba(126, 34, 206, 0.1)', color: '#7e22ce', border: 'none', fontWeight: 600, fontSize: '13px' }}
                    disabled={submittingAction}
                  >
                    Close Short
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowPoDetailModal(false)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                >
                  Close
                </button>

                {/* If DRAFT: can approve or edit */}
                {selectedPo.status === 'DRAFT' && (
                  <>
                    <button
                      onClick={() => {
                        setShowPoDetailModal(false);
                        handleOpenCreatePo(selectedPo);
                      }}
                      className="auth-btn"
                      style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                      disabled={submittingAction}
                    >
                      <Edit size={14} /> Edit PO
                    </button>
                    <button
                      onClick={() => handleApprovePo(selectedPo.id)}
                      className="auth-btn"
                      style={{ width: 'auto', padding: '8px 18px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                      disabled={submittingAction}
                    >
                      <Check size={14} /> Approve Order
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PO CREATE / EDIT MODAL */}
      {/* ==================================================================== */}
      {showCreatePoModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '1050px' }}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                {poForm.id ? 'Edit Purchase Order' : 'Create New Purchase Order'}
              </h2>
              <button onClick={() => setShowCreatePoModal(false)} style={iconButtonStyle}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Form Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="filter-group">
                  <label style={{ fontWeight: 600, fontSize: '12px' }}>Branch *</label>
                  <select
                    className="filter-select"
                    value={poForm.branch_id}
                    onChange={(e) => setPoForm(prev => ({ ...prev, branch_id: e.target.value }))}
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label style={{ fontWeight: 600, fontSize: '12px' }}>Destination Storage Location</label>
                  <select
                    className="filter-select"
                    value={poForm.destination_location_id}
                    onChange={(e) => setPoForm(prev => ({ ...prev, destination_location_id: e.target.value }))}
                  >
                    <option value="">Select Location</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label style={{ fontWeight: 600, fontSize: '12px' }}>Supplier *</label>
                  <select
                    className="filter-select"
                    value={poForm.supplier_id}
                    onChange={(e) => setPoForm(prev => ({ ...prev, supplier_id: e.target.value }))}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label style={{ fontWeight: 600, fontSize: '12px' }}>Expected Delivery Date</label>
                  <input
                    type="date"
                    className="filter-input"
                    value={poForm.expected_delivery_date}
                    onChange={(e) => setPoForm(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Item Catalog Selector Row */}
              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                  <label style={{ fontWeight: 700, fontSize: '13px' }}>
                    Add Items from Master Catalog
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Search input for items */}
                  <div style={{ position: 'relative', width: '220px' }}>
                    <input
                      type="text"
                      className="filter-input"
                      style={{ width: '100%', paddingRight: poItemSearch ? '28px' : '10px' }}
                      placeholder="🔍 Search items..."
                      value={poItemSearch}
                      onChange={(e) => setPoItemSearch(e.target.value)}
                    />
                    {poItemSearch && (
                      <button
                        type="button"
                        onClick={() => setPoItemSearch('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Dropdown with supplier items first, then others */}
                  <select
                    id="po-item-selector"
                    className="filter-select"
                    style={{ flex: 1, minWidth: '240px' }}
                    defaultValue=""
                  >
                    <option value="">-- Choose item to add --</option>
                    {supplierItemsForPo.length > 0 && (
                      <optgroup label="⭐ Items from Selected Supplier">
                        {supplierItemsForPo.map(item => (
                          <option key={item.id} value={item.id}>
                            ⭐ {item.name} ({item.unit || 'Unit'}) {item.price_usd ? `- $${Number(item.price_usd).toFixed(2)}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label={supplierItemsForPo.length > 0 ? "Other Catalog Items" : "Catalog Items"}>
                      {otherItemsForPo.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.unit || 'Unit'}) {item.price_usd ? `- $${Number(item.price_usd).toFixed(2)}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const sel = document.getElementById('po-item-selector') as HTMLSelectElement;
                      if (sel && sel.value) {
                        handleAddItemToPo(sel.value);
                        sel.value = '';
                      }
                    }}
                    className="auth-btn"
                    style={{ width: 'auto', padding: '0 18px', backgroundColor: 'var(--primary)', color: 'white' }}
                  >
                    Add Item
                  </button>
                </div>

                {/* Direct matches quick-click pills when searching */}
                {poItemSearch.trim() && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '10px', padding: '8px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>⚡ Direct matches:</span>
                    {supplierItemsForPo.slice(0, 6).map(it => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          handleAddItemToPo(it.id);
                          setPoItemSearch('');
                        }}
                        style={{ padding: '3px 8px', backgroundColor: 'rgba(230, 81, 0, 0.1)', color: 'var(--primary)', border: '1px solid rgba(230, 81, 0, 0.3)', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        ⭐ {it.name} +
                      </button>
                    ))}
                    {otherItemsForPo.slice(0, 6).map(it => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          handleAddItemToPo(it.id);
                          setPoItemSearch('');
                        }}
                        style={{ padding: '3px 8px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        {it.name} +
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* PO Items Table */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Line Items</h4>
                {poForm.items.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No items added yet. Select an item above and click "Add Item".
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '8px 10px', fontSize: '12px' }}>Item Name</th>
                          <th style={{ padding: '8px 10px', fontSize: '12px', width: '90px' }}>Qty</th>
                          <th style={{ padding: '8px 10px', fontSize: '12px', width: '110px' }}>Unit</th>
                          <th style={{ padding: '8px 10px', fontSize: '12px', width: '110px' }}>Price ($)</th>
                          <th style={{ padding: '8px 10px', fontSize: '12px', width: '120px', textAlign: 'right' }}>Total ($)</th>
                          <th style={{ padding: '8px 10px', fontSize: '12px', width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {poForm.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{item.item_name}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.purchase_quantity}
                                onChange={(e) => handleUpdatePoItem(idx, 'purchase_quantity', Number(e.target.value) || 0)}
                                style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px' }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="text"
                                value={item.purchase_unit}
                                onChange={(e) => handleUpdatePoItem(idx, 'purchase_unit', e.target.value)}
                                style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px' }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.purchase_unit_price}
                                onChange={(e) => handleUpdatePoItem(idx, 'purchase_unit_price', Number(e.target.value) || 0)}
                                style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '13px' }}
                              />
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                              ${Number(item.total_price).toFixed(2)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemovePoItem(idx)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                          <td colSpan={4} style={{ padding: '10px', textAlign: 'right' }}>Estimated Total:</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: 'var(--primary)', fontSize: '14px' }}>
                            ${calculatePoFormTotal().toFixed(2)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}>
                  Purchase Order Notes (Optional)
                </label>
                <textarea
                  className="filter-input"
                  rows={2}
                  value={poForm.notes}
                  onChange={(e) => setPoForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Special instructions or notes for the supplier..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={modalFooterStyle}>
              <button
                type="button"
                onClick={() => setShowCreatePoModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSavePurchaseOrder('DRAFT')}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 18px', backgroundColor: '#e2e8f0', color: 'var(--text-main)', border: 'none' }}
                  disabled={submittingAction}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePurchaseOrder('APPROVED')}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '10px 20px', backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}
                  disabled={submittingAction}
                >
                  Approve &amp; Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* HISTORICAL REQUEST DETAIL MODAL */}
      {/* ==================================================================== */}
      {showHistRequestModal && selectedHistoricalRequest && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '850px' }}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                Historical Request: <span style={{ color: 'var(--primary)' }}>{selectedHistoricalRequest.purchasing_id}</span>
              </h2>
              <button onClick={() => setShowHistRequestModal(false)} style={iconButtonStyle}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Branch</span>
                  <div style={{ fontWeight: 600 }}>{selectedHistoricalRequest.branch}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Department</span>
                  <div style={{ fontWeight: 600 }}>{selectedHistoricalRequest.department}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</span>
                  <div>{getStatusBadge(selectedHistoricalRequest.status)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Created By</span>
                  <div style={{ fontWeight: 600 }}>{selectedHistoricalRequest.user_name || '—'}</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Items Requested</h4>
                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border)' }}>
                        <th style={tableHeaderStyle}>Item</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Req Qty</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Ordered</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Received</th>
                        <th style={tableHeaderStyle}>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalRequestItems.map((it: any) => (
                        <tr key={it.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ ...tableCellStyle, fontWeight: 600 }}>{it.item_name}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'right' }}>{it.qty_requested}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'right' }}>{it.qty_ordered || 0}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'right', color: '#16a34a' }}>{it.qty_received || 0}</td>
                          <td style={tableCellStyle}>{it.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedHistoricalRequest.comments && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '8px', color: '#b45309', fontSize: '13px' }}>
                  <strong>Comments:</strong> {selectedHistoricalRequest.comments}
                </div>
              )}
            </div>

            <div style={modalFooterStyle}>
              <div />
              <button
                type="button"
                onClick={() => setShowHistRequestModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CATALOG QUICK ITEM MODAL */}
      {/* ==================================================================== */}
      {showCatalogModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '450px' }}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                {catalogItemForm.id ? 'Edit Catalog Item' : 'Add Item to Purchasing Catalog'}
              </h2>
              <button onClick={() => setShowCatalogModal(false)} style={iconButtonStyle}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="filter-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Item Name *</label>
                  <input 
                    type="text" 
                    className="filter-input"
                    value={catalogItemForm.name} 
                    onChange={(e) => setCatalogItemForm({ ...catalogItemForm, name: e.target.value })}
                    placeholder="e.g. Olive Oil"
                    required
                  />
                </div>

                <div className="filter-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Department</label>
                  <select 
                    className="filter-select"
                    value={catalogItemForm.department} 
                    onChange={(e) => setCatalogItemForm({ ...catalogItemForm, department: e.target.value })}
                  >
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Standard Unit</label>
                  <select 
                    className="filter-select"
                    value={catalogItemForm.unit} 
                    onChange={(e) => setCatalogItemForm({ ...catalogItemForm, unit: e.target.value })}
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Kg">Kg</option>
                    <option value="Liter">Liter</option>
                    <option value="Pack">Pack</option>
                    <option value="Box">Box</option>
                  </select>
                </div>
              </div>

              <div style={modalFooterStyle}>
                <button 
                  type="button" 
                  onClick={() => setShowCatalogModal(false)}
                  className="auth-btn"
                  style={{ width: 'auto', padding: '8px 16px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="auth-btn"
                  style={{ width: 'auto', padding: '8px 18px', backgroundColor: 'var(--primary)', color: 'white' }}
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ==================================================================== */}
      {/* SUPPLIER INVOICE INSPECT / AUDIT MODAL (PHASE 5) */}
      {/* ==================================================================== */}
      {showInvoiceDetailModal && selectedInvoiceForModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalContainerStyle, maxWidth: '1050px' }}>
            {/* Header */}
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                    Supplier Invoice: <span style={{ color: 'var(--primary)' }}>{selectedInvoiceForModal.invoice_number}</span>
                  </h2>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    backgroundColor: selectedInvoiceForModal.status === 'POSTED' ? '#dcfce7' : selectedInvoiceForModal.status === 'DRAFT' ? '#fef3c7' : '#fee2e2',
                    color: selectedInvoiceForModal.status === 'POSTED' ? '#166534' : selectedInvoiceForModal.status === 'DRAFT' ? '#92400e' : '#991b1b'
                  }}>
                    {selectedInvoiceForModal.status}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    backgroundColor: selectedInvoiceForModal.receipt_status === 'FULLY_RECEIVED' ? '#dcfce7' : '#ffedd5',
                    color: selectedInvoiceForModal.receipt_status === 'FULLY_RECEIVED' ? '#166534' : '#9a3412'
                  }}>
                    📦 {selectedInvoiceForModal.receipt_status ? selectedInvoiceForModal.receipt_status.replace(/_/g, ' ') : 'NO GOODS'}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    backgroundColor: selectedInvoiceForModal.payment_status === 'PAID' ? '#dcfce7' : '#fee2e2',
                    color: selectedInvoiceForModal.payment_status === 'PAID' ? '#166534' : '#991b1b'
                  }}>
                    💳 {selectedInvoiceForModal.payment_status || 'UNPAID'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                  Supplier: <strong>{selectedInvoiceForModal.supplier?.name || 'N/A'}</strong> 
                  {selectedInvoiceForModal.supplier?.phone && ` (${selectedInvoiceForModal.supplier.phone})`} | 
                  Date: <strong>{selectedInvoiceForModal.invoice_date}</strong> | 
                  Source: <strong>{selectedInvoiceForModal.source_client || 'POS'}</strong>
                </p>
              </div>
              <button onClick={() => setShowInvoiceDetailModal(false)} style={iconButtonStyle}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Metadata & Attachment Preview Card */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>ORIGINAL CURRENCY &amp; RATE</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                    {selectedInvoiceForModal.invoice_currency === 'LBP' ? 'Lebanese Pounds (L.L.)' : 'US Dollars ($)'}
                  </span>
                  {selectedInvoiceForModal.invoice_currency === 'LBP' && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                      Exchange Rate: {Number(selectedInvoiceForModal.exchange_rate || 89500).toLocaleString()} LBP/USD
                    </span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>PURCHASE ORDER REFERENCE</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: selectedInvoiceForModal.purchase_order_id ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {selectedInvoiceForModal.purchase_order_id ? `Linked PO #${selectedInvoiceForModal.purchase_order_id.slice(-6)}` : 'Direct Purchase (No PO)'}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>SUPPORTING DOCUMENT</span>
                  {selectedInvoiceForModal.attachment_url ? (
                    <a 
                      href={selectedInvoiceForModal.attachment_url.startsWith('http') ? selectedInvoiceForModal.attachment_url : `https://ilrlychrraagugntqdfr.supabase.co/storage/v1/object/public/${selectedInvoiceForModal.attachment_url}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      📎 View Original Invoice Photo/PDF <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No document uploaded</span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>VALIDATED BY</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>
                    {selectedInvoiceForModal.validated_by || 'Pending Validation'}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                    Purchased Line Items ({selectedInvoiceForModal.items?.length || 0})
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    All quantities converted to inventory canonical base units
                  </span>
                </div>

                <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid var(--border)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                        <th style={tableHeaderStyle}>Catalog Item</th>
                        <th style={tableHeaderStyle}>Supplier Desc / Code</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Invoiced Qty</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Unit Price</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>VAT (11%)</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Packaging &rarr; Base Qty</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Line Total</th>
                        <th style={{ ...tableHeaderStyle, textAlign: 'right', color: '#16a34a' }}>Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedInvoiceForModal.items || []).map((it: any, idx: number) => {
                        const isLbp = selectedInvoiceForModal.invoice_currency === 'LBP';
                        return (
                          <tr key={it.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ ...tableCellStyle, fontWeight: 700 }}>
                              {it.item_name || 'Item'}
                              {it.price_variance_percentage && Number(it.price_variance_percentage) > 10 && (
                                <span style={{ display: 'inline-block', marginLeft: '6px', fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
                                  ⚠️ +{it.price_variance_percentage}% Variance
                                </span>
                              )}
                            </td>
                            <td style={{ ...tableCellStyle, fontSize: '12px', color: 'var(--text-muted)' }}>
                              {it.supplier_product_desc || it.supplier_product_code || '—'}
                            </td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700 }}>
                              {it.invoiced_quantity} {it.purchase_unit}
                            </td>
                            <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                              {isLbp ? `${Number(it.unit_price).toLocaleString()} L.L.` : `$${Number(it.unit_price).toFixed(2)}`}
                            </td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontSize: '12px' }}>
                              {isLbp ? `${Number(it.vat_amount || 0).toLocaleString()} L.L.` : `$${Number(it.vat_amount || 0).toFixed(2)}`}
                            </td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                              {it.conversion_factor || 1} &times; = <strong>{it.base_quantity} {it.base_unit}</strong>
                            </td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700 }}>
                              {isLbp ? `${Number(it.line_total).toLocaleString()} L.L.` : `$${Number(it.line_total).toFixed(2)}`}
                            </td>
                            <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                              {it.received_quantity || 0} {it.base_unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals Card */}
              <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div>Notes: <em>{selectedInvoiceForModal.notes || 'None'}</em></div>
                  {selectedInvoiceForModal.replacement_reason && (
                    <div style={{ marginTop: '4px', color: '#b45309' }}>
                      Replacement Audit: <strong>{selectedInvoiceForModal.replacement_reason}</strong>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', minWidth: '240px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Subtotal: <strong>
                      {selectedInvoiceForModal.invoice_currency === 'LBP' 
                        ? `${Number(selectedInvoiceForModal.subtotal_amount || 0).toLocaleString()} L.L.`
                        : `$${Number(selectedInvoiceForModal.subtotal_amount || 0).toFixed(2)}`}
                    </strong>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    VAT: <strong>
                      {selectedInvoiceForModal.invoice_currency === 'LBP' 
                        ? `${Number(selectedInvoiceForModal.tax_amount || 0).toLocaleString()} L.L.`
                        : `$${Number(selectedInvoiceForModal.tax_amount || 0).toFixed(2)}`}
                    </strong>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                    Grand Total: {selectedInvoiceForModal.invoice_currency === 'LBP' 
                      ? `${Number(selectedInvoiceForModal.total_amount || 0).toLocaleString()} L.L.`
                      : `$${Number(selectedInvoiceForModal.total_amount_usd || selectedInvoiceForModal.total_amount || 0).toFixed(2)}`}
                  </div>
                  {selectedInvoiceForModal.invoice_currency === 'LBP' && (
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
                      ≈ ${Number(selectedInvoiceForModal.total_amount_usd || 0).toFixed(2)} USD @ {Number(selectedInvoiceForModal.exchange_rate || 89500).toLocaleString()}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Paid: ${Number(selectedInvoiceForModal.paid_amount_usd || 0).toFixed(2)} | Balance Due: <strong style={{ color: '#b45309' }}>${Math.max(0, (Number(selectedInvoiceForModal.total_amount_usd) || 0) - (Number(selectedInvoiceForModal.paid_amount_usd) || 0)).toFixed(2)}</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer with Managerial Controls */}
            <div style={modalFooterStyle}>
              <div style={{ display: 'flex', gap: '10px' }}>
                {/* For Drafts / Pending Review */}
                {['DRAFT', 'PENDING_REVIEW'].includes(selectedInvoiceForModal.status) && (
                  <>
                    <button
                      onClick={() => handleValidateAndPostInvoiceFromAdmin(selectedInvoiceForModal)}
                      className="auth-btn"
                      style={{ width: 'auto', padding: '8px 18px', backgroundColor: '#16a34a', color: 'white', border: 'none', fontWeight: 700 }}
                      disabled={invActionLoading}
                    >
                      ✅ Approve &amp; Post Invoice
                    </button>
                    <button
                      onClick={() => handleCancelInvoiceDraftFromAdmin(selectedInvoiceForModal)}
                      className="auth-btn"
                      style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', fontWeight: 600 }}
                      disabled={invActionLoading}
                    >
                      <Trash2 size={14} style={{ marginRight: '4px' }} /> Discard Draft
                    </button>
                  </>
                )}

                {/* For Posted Invoices */}
                {selectedInvoiceForModal.status === 'POSTED' && (
                  <>
                    {selectedInvoiceForModal.receipt_status !== 'FULLY_RECEIVED' && (
                      <button
                        onClick={() => handleReceivePendingGoodsFromAdmin(selectedInvoiceForModal)}
                        className="auth-btn"
                        style={{ width: 'auto', padding: '8px 18px', backgroundColor: '#2563eb', color: 'white', border: 'none', fontWeight: 700 }}
                        disabled={invActionLoading}
                      >
                        📦 Receive Pending Goods
                      </button>
                    )}
                    <button
                      onClick={() => handleReverseInvoiceFromAdmin(selectedInvoiceForModal)}
                      className="auth-btn"
                      style={{ width: 'auto', padding: '8px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', fontWeight: 600 }}
                      disabled={invActionLoading}
                    >
                      🔄 Reverse (Credit Adjustment)
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowInvoiceDetailModal(false)}
                className="auth-btn"
                style={{ width: 'auto', padding: '8px 18px', backgroundColor: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Close SVG helper
function X({ size = 20, color = 'currentColor' }: { size?: number, color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}

// Inline WhatsApp SVG helper
function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.504-5.714-1.465L0 24zm6.59-4.846c1.6.95 3.498 1.45 5.42 1.451 5.378 0 9.754-4.368 9.757-9.742.002-2.605-1.013-5.053-2.86-6.903C17.062 2.112 14.615.96 12.012.96c-5.385 0-9.762 4.37-9.765 9.743-.001 1.924.499 3.804 1.447 5.412L2.68 20.2l4.156-1.092c-.08-.047-.16-.096-.239-.144zM17.842 14.83c-.328-.164-1.939-.955-2.239-1.064-.3-.11-.518-.165-.736.164-.219.328-.847 1.064-1.037 1.282-.19.219-.382.246-.71.082-.328-.164-1.385-.51-2.637-1.63-1.002-.892-1.677-1.996-1.874-2.325-.196-.328-.02-.505.144-.668.148-.146.328-.382.492-.573.164-.19.219-.327.328-.546.11-.22.055-.41-.027-.573-.082-.164-.736-1.773-1.009-2.43-.266-.638-.537-.552-.736-.562-.19-.01-.409-.012-.628-.012-.218 0-.573.082-.873.41-.3.327-1.145 1.118-1.145 2.727s1.173 3.164 1.336 3.382c.164.219 2.307 3.52 5.59 4.94 2.73 1.18 3.284.95 3.9.39.617-.56 1.939-1.58 2.21-3.11.272-1.53.272-2.84.19-3.11-.081-.27-.272-.43-.6-.59z"/>
    </svg>
  );
}

const tableHeaderStyle: React.CSSProperties = {
  padding: '10px 14px',
  color: 'var(--text-muted)',
  fontWeight: 700,
  fontSize: '11.5px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '2px solid var(--border)',
  backgroundColor: '#f8fafc',
};

const tableCellStyle: React.CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'middle',
  fontSize: '13px',
  color: 'var(--text-main)',
  fontWeight: 500,
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '20px'
};

const modalContainerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  width: '100%',
  maxHeight: '92vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  overflow: 'hidden'
};

const modalHeaderStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#ffffff'
};

const modalFooterStyle: React.CSSProperties = {
  padding: '14px 20px',
  borderTop: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: '#f8fafc'
};

const iconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  padding: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
