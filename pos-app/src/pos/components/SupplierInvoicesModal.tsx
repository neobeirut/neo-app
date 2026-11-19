import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Plus, Search, FileText, Upload, Camera, RefreshCw, CheckCircle2, 
  AlertTriangle, ShieldAlert, ArrowRight, Eye, Check, Calendar, 
  DollarSign, Package, Layers, Info, Trash2, ChevronRight, Truck
} from 'lucide-react';
import { supplierInvoiceClientService, type SupplierInvoiceItemPayload } from '../services/supplierInvoiceClientService';
import { supabase } from '../../api/supabase';

interface SupplierInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchName: string;
  branchId?: string;
  restaurantId?: string;
  cashierName: string;
  userRole?: string;
  userId?: string;
}

export const SupplierInvoicesModal: React.FC<SupplierInvoicesModalProps> = ({
  isOpen,
  onClose,
  branchName,
  branchId,
  restaurantId,
  cashierName,
  userRole = 'cashier',
  userId
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected invoice for read-only view
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  // Form / Editor state
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [openPurchaseOrders, setOpenPurchaseOrders] = useState<any[]>([]);

  // Editor fields
  const [supplierId, setSupplierId] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState<'USD' | 'LBP' | 'UNKNOWN'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [systemExchangeRate, setSystemExchangeRate] = useState<number>(0);
  const [isExchangeRateOverridden, setIsExchangeRateOverridden] = useState<boolean>(false);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Document upload & preview
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionAlert, setExtractionAlert] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Line items
  const [items, setItems] = useState<SupplierInvoiceItemPayload[]>([]);

  // Receiving & Override
  const [confirmPhysicalReceiving, setConfirmPhysicalReceiving] = useState(false);
  const [overrideReview, setOverrideReview] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Supplier live account balance
  const [supplierBalance, setSupplierBalance] = useState<{ totalInvoicedUsd: number; totalPaidUsd: number; outstandingBalanceUsd: number } | null>(null);

  // Load initial data
  useEffect(() => {
    if (isOpen) {
      loadInvoices();
      loadSuppliers();
      loadCatalog();
      loadCentralizedExchangeRate();
    }
  }, [isOpen, filterStatus]);

  const loadCentralizedExchangeRate = async () => {
    try {
      const res = await api.getExchangeRate(restaurantId);
      const rate = (res && res.success && res.rate && res.rate > 0) ? res.rate : 90000;
      setSystemExchangeRate(rate);
      setExchangeRate((prev) => (prev > 0 ? prev : rate));
    } catch (err) {
      console.warn('Failed to load dynamic exchange rate:', err);
      setSystemExchangeRate(90000);
      setExchangeRate((prev) => (prev > 0 ? prev : 90000));
    }
  };

  useEffect(() => {
    if (supplierId) {
      loadSupplierOrdersAndBalance(supplierId);
    } else {
      setSupplierBalance(null);
      setOpenPurchaseOrders([]);
    }
  }, [supplierId]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await supplierInvoiceClientService.getInvoices({
        restaurantId,
        branchId,
        status: filterStatus,
        search: searchQuery,
        limit: 50
      });
      setInvoices(data);
    } catch (err: any) {
      console.error('Failed to load supplier invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name, phone, address')
      .order('name');
    if (data) setSuppliers(data);
  };

  const loadCatalog = async () => {
    const { data } = await supabase
      .from('items')
      .select('id, name, unit, base_unit, price_usd')
      .eq('restaurant_id', supplierInvoiceClientService.getRestaurantId())
      .order('name');
    if (data) setCatalogItems(data);
  };

  const loadSupplierOrdersAndBalance = async (sId: string) => {
    try {
      const bal = await supplierInvoiceClientService.getSupplierBalance(sId, restaurantId);
      setSupplierBalance(bal);

      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total_cost, expected_delivery_date, status')
        .eq('supplier_id', sId)
        .in('status', ['APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED'])
        .order('created_at', { ascending: false });
      if (pos) setOpenPurchaseOrders(pos);
    } catch (err) {
      console.error('Failed to load supplier info:', err);
    }
  };

  // Mathematical totals calculation
  const totals = useMemo(() => {
    let calcSubtotal = 0;
    let calcVat = 0;

    items.forEach(item => {
      const lineNet = (Number(item.invoiced_quantity) || 0) * (Number(item.unit_price) || 0) * (1 - (Number(item.discount_rate) || 0) / 100);
      const vat = lineNet * ((Number(item.tax_rate) || 0) / 100);
      calcSubtotal += lineNet;
      calcVat += vat;
    });

    const netSubtotal = Math.max(0, calcSubtotal - Number(discountAmount || 0));
    const grandTotal = netSubtotal + calcVat;

    return {
      subtotal: Number(calcSubtotal.toFixed(2)),
      discount: Number(discountAmount || 0),
      vatTotal: Number(calcVat.toFixed(2)),
      totalAmount: Number(grandTotal.toFixed(2)),
      totalAmountUsd: currency === 'USD' ? grandTotal : grandTotal / (exchangeRate || 1),
      totalAmountLbp: currency === 'LBP' ? grandTotal : grandTotal * (exchangeRate || systemExchangeRate || 90000)
    };
  }, [items, discountAmount, currency, exchangeRate]);

  // Handle Document Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocumentFile(file);
    setDocumentUrl(URL.createObjectURL(file));
    setIsExtracting(true);
    setExtractionAlert('Analyzing invoice with Gemini Multimodal AI...');

    try {
      // 1. Upload to Supabase Storage
      const storagePath = await supplierInvoiceClientService.uploadInvoiceDocument(file, restaurantId);

      // 2. Read base64 and perform direct Gemini Multimodal AI extraction
      let parsedData: any = null;
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const commaIdx = res.indexOf(',');
            resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        parsedData = await supplierInvoiceClientService.extractInvoiceFromImage(base64Data, file.type || 'image/jpeg');
      } catch (aiErr: any) {
        console.warn('Direct AI vision extraction notice:', aiErr.message);
      }

      // Match supplier if found
      let matchedSupplierId = '';
      if (parsedData?.supplier_name && suppliers.length > 0) {
        const found = suppliers.find(s =>
          s.name.toLowerCase().includes(parsedData.supplier_name.toLowerCase()) ||
          parsedData.supplier_name.toLowerCase().includes(s.name.toLowerCase())
        );
        if (found) {
          matchedSupplierId = found.id;
          setSupplierId(found.id);
          if (found.default_currency && !parsedData?.currency) {
            setCurrency(found.default_currency === 'LBP' ? 'LBP' : 'USD');
          }
        }
      }

      // Process and match extracted items
      const processedItems: SupplierInvoiceItemPayload[] = [];
      if (parsedData?.items && Array.isArray(parsedData.items) && parsedData.items.length > 0) {
        for (const rawItem of parsedData.items) {
          let matchedItemId: string | null = null;
          let matchedItemName = '';
          let conversionFactor = 1;
          let baseUnit = rawItem.purchase_unit || 'unit';
          let needsReview = true;
          let reviewReasons: string[] = ['UNMATCHED_PRODUCT'];

          try {
            const matchRes = await supplierInvoiceClientService.matchItem({
              supplierId: matchedSupplierId || undefined,
              supplierProductCode: rawItem.supplier_product_code || undefined,
              supplierDescription: rawItem.supplier_description || 'Item',
              purchaseUnit: rawItem.purchase_unit || 'unit',
              unitPrice: Number(rawItem.unit_price) || 0
            });

            if (matchRes?.matched_item_id) {
              matchedItemId = matchRes.matched_item_id;
              matchedItemName = matchRes.matched_item_name || '';
              conversionFactor = Number(matchRes.conversion_factor) || 1;
              baseUnit = matchRes.base_unit || rawItem.purchase_unit || 'unit';
              needsReview = matchRes.needs_review !== false;
              reviewReasons = matchRes.review_reasons || [];
            }
          } catch (mErr) {
            console.warn('Item matching warning:', mErr);
          }

          const qty = Number(rawItem.invoiced_quantity) || 1;
          const price = Number(rawItem.unit_price) || 0;
          let taxRate = Number(rawItem.tax_rate) || 0;
          if (taxRate > 0 && taxRate <= 1) {
            taxRate = Math.round(taxRate * 100);
          }
          const vat = Number(rawItem.vat_amount) || (qty * price * (taxRate / 100));
          const lineTot = Number(rawItem.line_total) || (qty * price + vat);

          processedItems.push({
            item_id: matchedItemId,
            item_name: matchedItemName,
            supplier_product_code: rawItem.supplier_product_code || undefined,
            supplier_description: rawItem.supplier_description || '',
            invoiced_quantity: qty,
            purchase_unit: rawItem.purchase_unit || 'unit',
            unit_price: price,
            discount_rate: 0,
            tax_rate: taxRate,
            vat_amount: Number(vat.toFixed(4)),
            line_total: Number(lineTot.toFixed(4)),
            package_quantity: conversionFactor,
            package_unit: rawItem.purchase_unit || 'unit',
            conversion_factor: conversionFactor,
            base_quantity: qty * conversionFactor,
            base_unit: baseUnit,
            confidence_score: parsedData?.confidence || 0.95,
            needs_review: needsReview,
            review_reasons: reviewReasons
          });
        }
      }

      const invNum = parsedData?.invoice_number || ('INV-POS-' + Date.now().toString().slice(-4));
      const invDate = parsedData?.invoice_date || new Date().toISOString().split('T')[0];
      const invCurr = supplierInvoiceClientService.normalizeCurrency(parsedData?.currency);
      const exRate = Number(parsedData?.exchange_rate) || systemExchangeRate || 90000;
      const discAmt = parsedData?.discount_amount ? String(parsedData.discount_amount) : '0';

      setInvoiceNumber(invNum);
      setInvoiceDate(invDate);
      setCurrency(invCurr);
      setExchangeRate(exRate);
      setDiscountAmount(Number(discAmt) || 0);
      if (processedItems.length > 0) {
        setItems(processedItems);
      }

      // Stage Draft in DB
      const draftRes = await supplierInvoiceClientService.createDraftInvoice({
        restaurant_id: supplierInvoiceClientService.getRestaurantId(),
        branch_id: branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
        supplier_id: matchedSupplierId || null,
        invoice_number: invNum,
        invoice_date: invDate,
        currency: invCurr,
        subtotal: parsedData?.subtotal || 0,
        tax_amount: parsedData?.tax_amount || 0,
        discount_amount: Number(discAmt) || 0,
        total_amount: parsedData?.total_amount || 0,
        attachment_url: storagePath,
        source_client: 'POS',
        items: processedItems
      }, userId);

      if (draftRes && draftRes.draft_invoice_id) {
        setActiveDraftId(draftRes.draft_invoice_id);
      }

      setExtractionAlert(`AI Extraction Complete for Invoice #${invNum}. Verbatim descriptions and codes preserved.`);
    } catch (err: any) {
      console.warn('Extraction API notice:', err.message);
      setExtractionAlert('Document uploaded to storage. Ready for manual entry/verification.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Add Item to table
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        item_id: null,
        item_name: '',
        supplier_description: '',
        invoiced_quantity: 1,
        purchase_unit: 'kg',
        unit_price: 0,
        discount_rate: 0,
        tax_rate: 0,
        vat_amount: 0,
        line_total: 0,
        conversion_factor: 1,
        base_quantity: 1,
        base_unit: 'kg',
        needs_review: true,
        review_reasons: ['UNMATCHED_PRODUCT']
      }
    ]);
  };

  // Update item field
  const handleUpdateItem = async (index: number, field: string, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    // Recompute line math
    if (['invoiced_quantity', 'unit_price', 'discount_rate', 'tax_rate'].includes(field)) {
      const qty = Number(item.invoiced_quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const disc = Number(item.discount_rate) || 0;
      const taxRate = Number(item.tax_rate) || 0;
      const net = qty * price * (1 - disc / 100);
      const vat = net * (taxRate / 100);
      item.vat_amount = Number(vat.toFixed(4));
      item.line_total = Number((net + vat).toFixed(4));
    }

    // Recompute base quantity on packaging change
    if (['invoiced_quantity', 'conversion_factor'].includes(field)) {
      const qty = Number(item.invoiced_quantity) || 0;
      const factor = Number(item.conversion_factor) || 1.0;
      item.base_quantity = Number((qty * factor).toFixed(4));
    }

    // If changing catalog item selection
    if (field === 'item_id') {
      const cat = catalogItems.find(c => c.id === value);
      if (cat) {
        item.item_id = cat.id;
        item.item_name = cat.name;
        item.base_unit = cat.base_unit || cat.unit;
        item.needs_review = false;
        item.review_reasons = [];

        // Learn mapping for supplier in background
        if (supplierId && item.supplier_description) {
          supplierInvoiceClientService.confirmItemMapping({
            supplierId,
            supplierItemDesc: item.supplier_description,
            supplierProductCode: item.supplier_product_code,
            flowItemId: cat.id,
            packageSize: item.conversion_factor || 1.0,
            purchaseUnit: item.purchase_unit || cat.unit
          }, userId).catch(e => console.warn('Background alias learn:', e.message));
        }
      } else {
        item.item_id = null;
        item.needs_review = true;
        item.review_reasons = ['UNMATCHED_PRODUCT'];
      }
    }

    updated[index] = item;
    setItems(updated);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (!invoiceNumber.trim()) {
      alert('Please provide an invoice number for the draft.');
      return;
    }
    setLoading(true);
    try {
      const res = await supplierInvoiceClientService.createDraftInvoice({
        branch_id: branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
        supplier_id: supplierId || null,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        currency,
        exchange_rate: exchangeRate,
        subtotal: totals.subtotal,
        tax_amount: totals.vatTotal,
        discount_amount: totals.discount,
        total_amount: totals.totalAmount,
        notes,
        source_client: 'POS',
        attachment_url: documentUrl,
        items
      }, userId);

      alert('Draft invoice saved successfully!');
      setActiveDraftId(res.draft_invoice_id);
      loadInvoices();
      setViewMode('list');
    } catch (err: any) {
      alert('Error saving draft: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Validate and Post
  const handleValidateAndPost = async () => {
    if (!supplierId) {
      alert('Please select a supplier before posting.');
      return;
    }
    if (!invoiceNumber.trim()) {
      alert('Invoice number is required.');
      return;
    }
    if (currency === 'UNKNOWN') {
      alert('Currency Confirmation Required: Please select whether this invoice is in USD or LBP.');
      return;
    }
    if (currency === 'LBP' && (!exchangeRate || exchangeRate <= 1000)) {
      alert('Invalid Exchange Rate: A positive exchange rate in LBP per USD (e.g. 89,500) is required for LBP invoices.');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one line item.');
      return;
    }

    const hasUnmatched = items.some(i => !i.item_id);
    if (hasUnmatched && !overrideReview) {
      alert('One or more line items are not matched to FLOW catalog items. Please resolve item matching or request managerial review override.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        restaurant_id: supplierInvoiceClientService.getRestaurantId(),
        branch_id: branchId || '9c214659-9cc7-4f33-b115-cbbb8a823a94',
        supplier_id: supplierId,
        invoice_id: activeDraftId || undefined,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        currency,
        exchange_rate: exchangeRate,
        subtotal: totals.subtotal,
        tax_amount: totals.vatTotal,
        discount_amount: totals.discount,
        total_amount: totals.totalAmount,
        confirm_goods_received: confirmPhysicalReceiving,
        override_review: overrideReview,
        override_reason: overrideReason,
        notes,
        source_client: 'POS',
        attachment_url: documentUrl,
        items
      };

      const res = await supplierInvoiceClientService.validateAndPostInvoice(payload, userId);
      alert(`Invoice ${res.invoice_number} successfully POSTED! Status: ${res.status}, Receiving: ${res.receipt_status}`);
      setViewMode('list');
      loadInvoices();
      resetForm();
    } catch (err: any) {
      alert('Validation / Posting error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setActiveDraftId(null);
    setSupplierId('');
    setInvoiceNumber('');
    setItems([]);
    setDocumentUrl(null);
    setDocumentFile(null);
    setExtractionAlert(null);
    setConfirmPhysicalReceiving(false);
    setOverrideReview(false);
    setOverrideReason('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden shadow-2xl text-white font-sans">
        
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide text-white flex items-center gap-2">
                Centralized Supplier Invoices
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                  {branchName}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">FLOW POS Touch Engine &bull; Stage E Integration</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer ${
                  viewMode === 'list' ? 'bg-[#1e5c4f] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Invoice History
              </button>
              <button
                type="button"
                onClick={() => { resetForm(); setViewMode('editor'); }}
                className={`px-4 py-2 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'editor' ? 'bg-[#1e5c4f] text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus size={14} /> New / Scan Invoice
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition border border-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/90 space-y-6">
          {viewMode === 'list' ? (
            /* LIST VIEW */
            <div className="space-y-4">
              {/* Search & Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2 flex-1 min-w-[260px] bg-slate-900 px-3 py-2 rounded-xl border border-slate-700/80">
                  <Search size={16} className="text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by invoice # or notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadInvoices()}
                    className="bg-transparent text-xs text-white placeholder-slate-500 font-bold outline-none w-full"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {['ALL', 'DRAFT', 'POSTED', 'REVERSED'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFilterStatus(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                        filterStatus === status
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={loadInvoices}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Receiving</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4 text-right">Total (USD)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500 font-bold">
                          {loading ? 'Loading invoices...' : 'No supplier invoices found.'}
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4 font-black text-amber-400 flex items-center gap-1.5">
                            {inv.invoice_number}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-200">
                            {inv.suppliers?.name || 'Unassigned Supplier'}
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-medium">
                            {inv.invoice_date}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              inv.status === 'POSTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                              inv.status === 'DRAFT' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                              'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[11px] font-bold ${
                              inv.receipt_status === 'FULLY_RECEIVED' ? 'text-emerald-400' :
                              inv.receipt_status === 'PARTIALLY_RECEIVED' ? 'text-amber-400' : 'text-slate-500'
                            }`}>
                              {inv.receipt_status?.replace(/_/g, ' ') || 'NO GOODS'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[11px] font-bold ${
                              inv.payment_status === 'PAID' ? 'text-emerald-400' :
                              inv.payment_status === 'PARTIALLY_PAID' ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {inv.payment_status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-white">
                            ${Number(inv.total_amount_usd || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                const details = await supplierInvoiceClientService.getInvoiceDetails(inv.id);
                                if (inv.status === 'DRAFT') {
                                  setActiveDraftId(inv.id);
                                  setSupplierId(details.supplier_id || '');
                                  setInvoiceNumber(details.invoice_number);
                                  setInvoiceDate(details.invoice_date);
                                  setCurrency(details.invoice_currency || 'USD');
                                  setItems(details.items || []);
                                  setDocumentUrl(details.attachment_url || null);
                                  setViewMode('editor');
                                } else {
                                  setSelectedInvoice(details);
                                }
                              }}
                              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 cursor-pointer"
                            >
                              {inv.status === 'DRAFT' ? 'Edit Draft' : 'View'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* EDITOR VIEW */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: Upload & Preview (4 cols) */}
              <div className="lg:col-span-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex flex-col space-y-4">
                <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  Invoice Document (Photo / PDF)
                  {isExtracting && <span className="text-amber-400 animate-pulse text-[10px]">Processing...</span>}
                </span>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {documentUrl ? (
                  <div className="flex-1 flex flex-col space-y-3">
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black flex-1 min-h-[300px] flex items-center justify-center">
                      <img
                        src={documentUrl}
                        alt="Scanned invoice"
                        className="max-h-[360px] object-contain w-full"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition border border-slate-700 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Upload size={14} /> Replace Document
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 min-h-[260px] border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition bg-slate-900/40 hover:bg-slate-900/80 group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Camera size={26} />
                    </div>
                    <p className="text-xs font-black text-slate-200 mb-1">Click or Tap to Upload Invoice</p>
                    <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs">
                      Supports JPG, PNG, and multi-page PDFs. Gemini AI extracts fields and auto-matches catalog items.
                    </p>
                  </div>
                )}

                {extractionAlert && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium leading-relaxed flex items-start gap-2">
                    <Info size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{extractionAlert}</span>
                  </div>
                )}

                {supplierBalance && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/60 space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Supplier Balance</span>
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-400">Total Invoiced:</span>
                      <span className="text-slate-200">${supplierBalance.totalInvoicedUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-400">Total Paid:</span>
                      <span className="text-emerald-400">${supplierBalance.totalPaidUsd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-black border-t border-slate-800 pt-1.5 text-amber-400">
                      <span>Outstanding AP:</span>
                      <span>${supplierBalance.outstandingBalanceUsd.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Invoice Fields & Lines (8 cols) */}
              <div className="lg:col-span-8 flex flex-col space-y-4">
                
                {/* Header Information Card */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                    Supplier &amp; Invoice Metadata
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier *</label>
                      <select
                        value={supplierId}
                        onChange={(e) => {
                          const newId = e.target.value;
                          setSupplierId(newId);
                          const sup = suppliers.find(s => s.id === newId);
                          if (sup?.default_currency) {
                            setCurrency(sup.default_currency === 'LBP' ? 'LBP' : 'USD');
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value="">-- Choose Supplier --</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name} [{s.default_currency || 'USD'}]</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Purchase Order Link</label>
                      <select
                        value={selectedPoId}
                        onChange={(e) => setSelectedPoId(e.target.value)}
                        disabled={!supplierId}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none cursor-pointer disabled:opacity-40"
                      >
                        <option value="">No PO (Direct Invoice)</option>
                        {openPurchaseOrders.map(po => (
                          <option key={po.id} value={po.id}>{po.po_number} (${po.total_cost})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Invoice Number *</label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="e.g. INV-1094"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Invoice Date</label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Currency *</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrency('USD')}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition ${
                            currency === 'USD' ? 'bg-[#1e5c4f] text-white' : 'bg-slate-900 border border-slate-700 text-slate-400'
                          }`}
                        >
                          USD ($)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrency('LBP')}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition ${
                            currency === 'LBP' ? 'bg-[#1e5c4f] text-white' : 'bg-slate-900 border border-slate-700 text-slate-400'
                          }`}
                        >
                          LBP (L.L.)
                        </button>
                      </div>
                    </div>

                    {currency === 'LBP' && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Exchange Rate (LBP/USD) *</label>
                        <input
                          type="number"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(Number(e.target.value) || systemExchangeRate || 90000)}
                          placeholder={String(systemExchangeRate || 90000)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none"
                        />
                      </div>
                    )}
                  </div>
                  {currency === 'UNKNOWN' && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle size={14} />
                      <span>Currency Unconfirmed: Please explicitly select whether this invoice is in USD or LBP.</span>
                    </div>
                  )}
                </div>

                {/* Line Items Table */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                      Purchased Items ({items.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-1.5 rounded-xl bg-[#1e5c4f] hover:bg-[#1e5c4f]/80 text-white text-xs font-black flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold">
                          <th className="py-2 px-2">FLOW Catalog Item</th>
                          <th className="py-2 px-2">Extracted Desc / SKU</th>
                          <th className="py-2 px-2 text-center">Invoiced Qty</th>
                          <th className="py-2 px-2 text-center">Unit Price</th>
                          <th className="py-2 px-2 text-center">VAT Rate</th>
                          <th className="py-2 px-2 text-center">Packaging &rarr; Base Qty</th>
                          <th className="py-2 px-2 text-right">Line Total</th>
                          <th className="py-2 px-1 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-500 font-bold">
                              No line items yet. Upload a document or click "+ Add Item".
                            </td>
                          </tr>
                        ) : (
                          items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/60 transition">
                              <td className="py-2 px-2 min-w-[160px]">
                                <select
                                  value={item.item_id || ''}
                                  onChange={(e) => handleUpdateItem(idx, 'item_id', e.target.value)}
                                  className={`w-full bg-slate-900 border rounded-lg px-2 py-1.5 text-xs font-bold outline-none cursor-pointer ${
                                    !item.item_id ? 'border-amber-500/80 text-amber-300' : 'border-slate-700 text-white'
                                  }`}
                                >
                                  <option value="">⚠️ Select FLOW Item...</option>
                                  {catalogItems.map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.base_unit || c.unit})</option>
                                  ))}
                                </select>
                              </td>

                              <td className="py-2 px-2 min-w-[130px]">
                                <input
                                  type="text"
                                  value={item.supplier_description || ''}
                                  placeholder="Raw OCR Desc"
                                  onChange={(e) => handleUpdateItem(idx, 'supplier_description', e.target.value)}
                                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-slate-300 outline-none"
                                />
                              </td>

                              <td className="py-2 px-2 w-20 text-center">
                                <input
                                  type="number"
                                  step="any"
                                  value={item.invoiced_quantity || ''}
                                  onChange={(e) => handleUpdateItem(idx, 'invoiced_quantity', e.target.value)}
                                  className="w-full text-center bg-slate-900 border border-slate-700 rounded-lg px-1 py-1 text-xs font-black text-white outline-none"
                                />
                              </td>

                              <td className="py-2 px-2 w-24 text-center">
                                <input
                                  type="number"
                                  step="any"
                                  value={item.unit_price || ''}
                                  onChange={(e) => handleUpdateItem(idx, 'unit_price', e.target.value)}
                                  className="w-full text-center bg-slate-900 border border-slate-700 rounded-lg px-1 py-1 text-xs font-black text-white outline-none"
                                />
                              </td>

                              <td className="py-2 px-2 w-20 text-center">
                                <select
                                  value={item.tax_rate || 0}
                                  onChange={(e) => handleUpdateItem(idx, 'tax_rate', Number(e.target.value))}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1 py-1 text-xs font-bold outline-none cursor-pointer"
                                >
                                  <option value={0}>0%</option>
                                  <option value={11}>11%</option>
                                </select>
                              </td>

                              <td className="py-2 px-2 w-32 text-center text-[11px] text-slate-300">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    value={item.conversion_factor || 1}
                                    onChange={(e) => handleUpdateItem(idx, 'conversion_factor', e.target.value)}
                                    className="w-12 text-center bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs text-slate-300"
                                    title="Conversion factor to base unit"
                                  />
                                  <span>&times; = <b>{item.base_quantity || item.invoiced_quantity}</b> {item.base_unit || 'unit'}</span>
                                </div>
                              </td>

                              <td className="py-2 px-2 text-right font-black text-amber-400">
                                ${Number(item.line_total || 0).toFixed(2)}
                              </td>

                              <td className="py-2 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer transition"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals & Approval Box */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmPhysicalReceiving}
                        onChange={(e) => setConfirmPhysicalReceiving(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-bold text-slate-200">
                        Confirm Physical Goods Receipt on Loading Dock immediately
                      </span>
                    </label>

                    {items.some(i => i.needs_review) && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-2">
                        <AlertTriangle size={16} />
                        <span>Managerial review approval required for unmatched or price-spike items.</span>
                      </div>
                    )}
                  </div>

                  {/* Summary math */}
                  <div className="text-right space-y-1 text-xs">
                    <div className="text-slate-400">
                      Subtotal: <b className="text-slate-200">
                        {currency === 'LBP' ? `${totals.subtotal.toLocaleString()} L.L.` : `$${totals.subtotal.toFixed(2)}`}
                      </b>
                    </div>
                    <div className="text-slate-400">
                      VAT Total: <b className="text-slate-200">
                        {currency === 'LBP' ? `${totals.vatTotal.toLocaleString()} L.L.` : `$${totals.vatTotal.toFixed(2)}`}
                      </b>
                    </div>
                    <div className="text-base font-black text-emerald-400">
                      Total: {currency === 'LBP' ? `${totals.totalAmount.toLocaleString()} L.L.` : `$${totals.totalAmount.toFixed(2)}`}
                    </div>
                    {currency === 'LBP' && exchangeRate > 0 && (
                      <div className="text-[11px] font-bold text-slate-400">
                        ≈ ${(totals.totalAmount / exchangeRate).toFixed(2)} USD @ {exchangeRate.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Touch Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={loading}
                    className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-xs transition border border-slate-700 cursor-pointer disabled:opacity-50"
                  >
                    💾 Save as Draft
                  </button>

                  <button
                    type="button"
                    onClick={handleValidateAndPost}
                    disabled={loading}
                    className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    {confirmPhysicalReceiving ? 'Post & Receive Stock' : 'Validate & Post Invoice'}
                  </button>
                </div>

              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
