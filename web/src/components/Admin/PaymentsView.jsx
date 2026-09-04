"use client";

import { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  Download,
  Calendar,
  Truck,
  Package,
  FileText,
  TrendingUp,
  BarChart2,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  X,
  RefreshCw,
  Layers,
  AlertCircle,
  Percent
} from "lucide-react";

const ALLOWED_UNITS = ["Litre", "Kg", "Box", "Bottle", "Bag", "Pcs", "Gallon"];

export default function PaymentsView() {
  const [activeTab, setActiveTab] = useState("payments"); // 'payments' | 'suppliers' | 'items' | 'reports'

  // Data states
  const [payments, setPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters for Payments & Reports
  const [datePreset, setDatePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState("all");
  const [selectedItemFilter, setSelectedItemFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [supplierHistoryTarget, setSupplierHistoryTarget] = useState(null);

  // Forms
  const [paymentForm, setPaymentForm] = useState({
    invoice_number: "",
    payment_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    payment_method: "Cash",
    status: "paid",
    notes: "",
    lines: [
      { item_id: "", unit: "Kg", qty: "1", price: "0", has_vat: false, vat_rate: "11" }
    ]
  });

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    contact_person: "",
    address: "",
    category: "",
    notes: ""
  });

  const [itemForm, setItemForm] = useState({
    name: "",
    unit: "Kg",
    category: "",
    has_vat: false,
    vat_rate: "11",
    notes: ""
  });

  // Calculate dates based on preset
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (datePreset === "today") {
      const todayStr = now.toISOString().split("T")[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (datePreset === "yesterday") {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = yest.toISOString().split("T")[0];
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (datePreset === "this_week") {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      setStartDate(monday.toISOString().split("T")[0]);
      setEndDate(now.toISOString().split("T")[0]);
    } else if (datePreset === "7days") {
      const d = new Date(now);
      d.setDate(now.getDate() - 7);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(now.toISOString().split("T")[0]);
    } else if (datePreset === "this_month") {
      const firstDay = new Date(y, m, 1).toISOString().split("T")[0];
      const lastDay = new Date(y, m + 1, 0).toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (datePreset === "last_month") {
      const firstDay = new Date(y, m - 1, 1).toISOString().split("T")[0];
      const lastDay = new Date(y, m, 0).toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (datePreset === "august_2026") {
      setStartDate("2026-08-01");
      setEndDate("2026-08-31");
    } else if (datePreset === "july_2026") {
      setStartDate("2026-07-01");
      setEndDate("2026-07-31");
    } else if (datePreset === "all") {
      setStartDate("");
      setEndDate("");
    }
  }, [datePreset]);

  // Fetch all base data
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Fetch Suppliers
      const supRes = await fetch("/api/suppliers");
      const supData = await supRes.json();
      if (supData.ok) setSuppliers(supData.suppliers || []);

      // 2. Fetch Items
      const itRes = await fetch("/api/supplier-items");
      const itData = await itRes.json();
      if (itData.ok) setItems(itData.items || []);

      // 3. Fetch Payments
      let payUrl = "/api/supplier-payments?limit=200";
      if (startDate) payUrl += `&startDate=${startDate}`;
      if (endDate) payUrl += `&endDate=${endDate}`;
      if (selectedSupplierFilter !== "all") payUrl += `&supplierId=${selectedSupplierFilter}`;
      if (selectedItemFilter !== "all") payUrl += `&itemId=${selectedItemFilter}`;
      if (searchQuery.trim()) payUrl += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const payRes = await fetch(payUrl);
      const payData = await payRes.json();
      if (payData.ok) setPayments(payData.payments || []);

      // 4. Fetch Stats
      let statsUrl = "/api/supplier-payments/stats";
      const statsParams = [];
      if (startDate) statsParams.push(`startDate=${startDate}`);
      if (endDate) statsParams.push(`endDate=${endDate}`);
      if (selectedSupplierFilter !== "all") statsParams.push(`supplierId=${selectedSupplierFilter}`);
      if (statsParams.length > 0) statsUrl += `?${statsParams.join("&")}`;

      const statsRes = await fetch(statsUrl);
      const statsData = await statsRes.json();
      if (statsData.ok) setStats(statsData);
    } catch (err) {
      console.error("Error loading payments data:", err);
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedSupplierFilter, selectedItemFilter]);

  const showToast = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  };

  // --- Actions: Payments ---
  const handleOpenNewPayment = () => {
    setEditingPayment(null);
    const defaultItem = items[0];
    setPaymentForm({
      invoice_number: "",
      payment_date: new Date().toISOString().split("T")[0],
      supplier_id: suppliers.length > 0 ? String(suppliers[0].id) : "",
      payment_method: "Cash",
      status: "paid",
      notes: "",
      lines: [
        { 
          item_id: defaultItem ? String(defaultItem.id) : "", 
          unit: defaultItem ? defaultItem.unit : "Kg", 
          qty: "1", 
          price: "0",
          has_vat: Boolean(defaultItem?.has_vat),
          vat_rate: defaultItem?.vat_rate !== null && defaultItem?.vat_rate !== undefined ? String(defaultItem.vat_rate) : "11"
        }
      ]
    });
    setShowPaymentModal(true);
  };

  const handleOpenEditPayment = (p) => {
    setEditingPayment(p);
    setPaymentForm({
      invoice_number: p.invoice_number || "",
      payment_date: p.payment_date ? p.payment_date.split("T")[0] : new Date().toISOString().split("T")[0],
      supplier_id: String(p.supplier_id),
      payment_method: p.payment_method || "Cash",
      status: p.status || "paid",
      notes: p.notes || "",
      lines: [
        {
          item_id: String(p.item_id),
          unit: p.unit || "Kg",
          qty: String(p.qty),
          price: String(p.price),
          has_vat: Boolean(p.has_vat),
          vat_rate: p.vat_rate !== null && p.vat_rate !== undefined ? String(p.vat_rate) : "11"
        }
      ]
    });
    setShowPaymentModal(true);
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...paymentForm.lines];
    updated[index][field] = value;

    // If item changed, automatically set unit and default VAT from the chosen item
    if (field === "item_id") {
      const matched = items.find((i) => String(i.id) === String(value));
      if (matched) {
        if (matched.unit) updated[index].unit = matched.unit;
        updated[index].has_vat = Boolean(matched.has_vat);
        updated[index].vat_rate = matched.vat_rate !== null && matched.vat_rate !== undefined ? String(matched.vat_rate) : "11";
      }
    }

    setPaymentForm({ ...paymentForm, lines: updated });
  };

  const handleAddPaymentLine = () => {
    const defaultItem = items[0];
    setPaymentForm({
      ...paymentForm,
      lines: [
        ...paymentForm.lines,
        {
          item_id: defaultItem ? String(defaultItem.id) : "",
          unit: defaultItem ? defaultItem.unit : "Kg",
          qty: "1",
          price: "0",
          has_vat: Boolean(defaultItem?.has_vat),
          vat_rate: defaultItem?.vat_rate !== null && defaultItem?.vat_rate !== undefined ? String(defaultItem.vat_rate) : "11"
        }
      ]
    });
  };

  const handleRemovePaymentLine = (index) => {
    if (paymentForm.lines.length <= 1) return;
    setPaymentForm({
      ...paymentForm,
      lines: paymentForm.lines.filter((_, i) => i !== index)
    });
  };

  const computeTotals = useMemo(() => {
    let subtotal = 0;
    let totalVat = 0;
    paymentForm.lines.forEach((line) => {
      const q = parseFloat(line.qty) || 0;
      const p = parseFloat(line.price) || 0;
      const lineSub = q * p;
      const vRate = line.has_vat ? (parseFloat(line.vat_rate) || 0) : 0;
      const lineVat = lineSub * (vRate / 100);
      subtotal += lineSub;
      totalVat += lineVat;
    });
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      grandTotal: Math.round((subtotal + totalVat) * 100) / 100
    };
  }, [paymentForm.lines]);

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.supplier_id) {
      alert("Please select a supplier");
      return;
    }

    // Validate lines
    for (const line of paymentForm.lines) {
      if (!line.item_id) {
        alert("Please select an item for all lines");
        return;
      }
      if (!line.qty || parseFloat(line.qty) <= 0) {
        alert("Please enter a valid quantity greater than 0");
        return;
      }
      if (line.price === "" || parseFloat(line.price) < 0) {
        alert("Please enter a valid price");
        return;
      }
    }

    try {
      if (editingPayment) {
        // Edit single payment
        const line = paymentForm.lines[0];
        const res = await fetch("/api/supplier-payments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingPayment.id,
            invoice_number: paymentForm.invoice_number,
            payment_date: paymentForm.payment_date,
            supplier_id: paymentForm.supplier_id,
            item_id: line.item_id,
            unit: line.unit,
            qty: line.qty,
            price: line.price,
            has_vat: line.has_vat,
            vat_rate: line.has_vat ? Number(line.vat_rate || 11) : 0,
            payment_method: paymentForm.payment_method,
            status: paymentForm.status,
            notes: paymentForm.notes
          })
        });
        const data = await res.json();
        if (data.ok) {
          showToast("Payment updated successfully!");
          setShowPaymentModal(false);
          fetchData();
        } else {
          alert("Error: " + data.error);
        }
      } else {
        // Insert (batch lines)
        const payload = {
          payments: paymentForm.lines.map((l) => ({
            invoice_number: paymentForm.invoice_number,
            payment_date: paymentForm.payment_date,
            supplier_id: paymentForm.supplier_id,
            item_id: l.item_id,
            unit: l.unit,
            qty: l.qty,
            price: l.price,
            has_vat: l.has_vat,
            vat_rate: l.has_vat ? Number(l.vat_rate || 11) : 0,
            payment_method: paymentForm.payment_method,
            status: paymentForm.status,
            notes: paymentForm.notes
          }))
        };

        const res = await fetch("/api/supplier-payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
          showToast(`Recorded ${paymentForm.lines.length} item payment(s) successfully!`);
          setShowPaymentModal(false);
          fetchData();
        } else {
          alert("Error: " + data.error);
        }
      }
    } catch (err) {
      alert("Failed to save payment: " + err.message);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!confirm("Are you sure you want to delete this payment record?")) return;
    try {
      const res = await fetch(`/api/supplier-payments?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        showToast("Payment deleted.");
        fetchData();
      } else {
        alert("Failed to delete payment: " + data.error);
      }
    } catch (err) {
      alert("Failed to delete payment: " + err.message);
    }
  };

  // --- Actions: Suppliers ---
  const handleOpenNewSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: "",
      phone: "",
      contact_person: "",
      address: "",
      category: "",
      notes: ""
    });
    setShowSupplierModal(true);
  };

  const handleOpenEditSupplier = (s) => {
    setEditingSupplier(s);
    setSupplierForm({
      name: s.name || "",
      phone: s.phone || "",
      contact_person: s.contact_person || "",
      address: s.address || "",
      category: s.category || "",
      notes: s.notes || ""
    });
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      alert("Supplier name is required");
      return;
    }
    try {
      const method = editingSupplier ? "PUT" : "POST";
      const body = editingSupplier ? { id: editingSupplier.id, ...supplierForm } : supplierForm;

      const res = await fetch("/api/suppliers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.ok) {
        showToast(editingSupplier ? "Supplier updated!" : "Supplier created!");
        setShowSupplierModal(false);
        fetchData();
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to save supplier: " + err.message);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      const res = await fetch(`/api/suppliers?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        showToast("Supplier deleted.");
        fetchData();
      } else {
        alert("Cannot delete: " + data.error);
      }
    } catch (err) {
      alert("Failed to delete supplier: " + err.message);
    }
  };

  // --- Actions: Items ---
  const handleOpenNewItem = () => {
    setEditingItem(null);
    setItemForm({ name: "", unit: "Kg", category: "", has_vat: false, vat_rate: "11", notes: "" });
    setShowItemModal(true);
  };

  const handleOpenEditItem = (it) => {
    setEditingItem(it);
    setItemForm({
      name: it.name || "",
      unit: it.unit || "Kg",
      category: it.category || "",
      has_vat: Boolean(it.has_vat),
      vat_rate: it.vat_rate !== null && it.vat_rate !== undefined ? String(it.vat_rate) : "11",
      notes: it.notes || ""
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim()) {
      alert("Item name is required");
      return;
    }
    try {
      const method = editingItem ? "PUT" : "POST";
      const body = editingItem ? { id: editingItem.id, ...itemForm } : itemForm;

      const res = await fetch("/api/supplier-items", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.ok) {
        showToast(editingItem ? "Item updated!" : "Item added!");
        setShowItemModal(false);
        fetchData();
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to save item: " + err.message);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const res = await fetch(`/api/supplier-items?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        showToast("Item deleted.");
        fetchData();
      } else {
        alert("Cannot delete: " + data.error);
      }
    } catch (err) {
      alert("Failed to delete item: " + err.message);
    }
  };

  // CSV Export with VAT columns
  const handleExportCSV = () => {
    if (payments.length === 0) {
      alert("No payments to export");
      return;
    }

    let csv = "Date,Invoice Number,Supplier,Item,Unit,Quantity,Unit Price ($),Subtotal ($),VAT Rate (%),VAT Amount ($),Total ($),Payment Method,Status,Notes\n";
    payments.forEach((p) => {
      const date = p.payment_date ? p.payment_date.split("T")[0] : "";
      const inv = (p.invoice_number || "").replace(/"/g, '""');
      const sup = (p.supplier_name || "").replace(/"/g, '""');
      const item = (p.item_name || "").replace(/"/g, '""');
      const notes = (p.notes || "").replace(/"/g, '""');
      const subtotal = Number(p.subtotal_amount || (Number(p.qty) * Number(p.price))).toFixed(2);
      const vatRate = p.has_vat ? Number(p.vat_rate || 11) : 0;
      const vatAmount = Number(p.vat_amount || 0).toFixed(2);
      const total = Number(p.total_amount || 0).toFixed(2);
      csv += `"${date}","${inv}","${sup}","${item}","${p.unit}",${p.qty},${p.price},${subtotal},${vatRate},${vatAmount},${total},"${p.payment_method}","${p.status}","${notes}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supplier_payments_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered payments by search
  const filteredPayments = useMemo(() => {
    if (!searchQuery.trim()) return payments;
    const q = searchQuery.toLowerCase();
    return payments.filter((p) =>
      (p.invoice_number && p.invoice_number.toLowerCase().includes(q)) ||
      (p.supplier_name && p.supplier_name.toLowerCase().includes(q)) ||
      (p.item_name && p.item_name.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q))
    );
  }, [payments, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium text-sm">{successMsg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Supplier Payments &amp; Finances
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage procurement, supplier records, raw material catalog with VAT, and track restaurant gross margins.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === "payments" && (
            <>
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition flex items-center gap-2 text-xs font-semibold"
                title="Export current payments to CSV"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={handleOpenNewPayment}
                className="px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-2 text-sm font-semibold shadow-md shadow-emerald-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            </>
          )}

          {activeTab === "suppliers" && (
            <button
              onClick={handleOpenNewSupplier}
              className="px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-2 text-sm font-semibold shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier</span>
            </button>
          )}

          {activeTab === "items" && (
            <button
              onClick={handleOpenNewItem}
              className="px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-2 text-sm font-semibold shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Raw Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 rounded-xl shadow-sm">
        <button
          onClick={() => setActiveTab("payments")}
          className={`py-4 px-5 text-sm font-semibold border-b-2 flex items-center gap-2.5 transition ${
            activeTab === "payments"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          Payments Log
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
            {payments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("suppliers")}
          className={`py-4 px-5 text-sm font-semibold border-b-2 flex items-center gap-2.5 transition ${
            activeTab === "suppliers"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Truck className="w-4 h-4" />
          Suppliers Directory
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {suppliers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("items")}
          className={`py-4 px-5 text-sm font-semibold border-b-2 flex items-center gap-2.5 transition ${
            activeTab === "items"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <Package className="w-4 h-4" />
          Raw Supply Items
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {items.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("reports")}
          className={`py-4 px-5 text-sm font-semibold border-b-2 flex items-center gap-2.5 transition ${
            activeTab === "reports"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Financial &amp; Stats Report
        </button>
      </div>

      {/* ── TAB 1: PAYMENTS LOG ────────────────────────────────────────────── */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Gross Spend</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">
                  ${(stats?.summary?.totalSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[11px] text-gray-400">Incl. all taxes &amp; VAT</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Net Spend (Excl. VAT)</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">
                  ${((stats?.summary?.netSpend !== undefined ? stats?.summary?.netSpend : (stats?.summary?.totalSpend || 0)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[11px] text-gray-400">{stats?.summary?.totalPayments || payments.length} invoices</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total VAT Paid</p>
                <h3 className="text-2xl font-bold text-amber-700 mt-0.5">
                  ${(stats?.summary?.totalVat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[11px] text-gray-400">Claimable / deductible tax</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Active Suppliers</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">
                  {stats?.summary?.totalSuppliers || suppliers.length}
                </h3>
                <span className="text-[11px] text-gray-400">Avg ${(stats?.summary?.avgPayment || 0).toFixed(2)}/invoice</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 mr-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Date Range:
              </span>
              {[
                { id: "all", label: "All Time" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "august_2026", label: "August 2026" },
                { id: "july_2026", label: "July 2026" },
                { id: "this_week", label: "This Week" },
                { id: "today", label: "Today" },
                { id: "custom", label: "Custom" }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDatePreset(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    datePreset === p.id
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}

              {datePreset === "custom" && (
                <div className="flex items-center gap-2 ml-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-gray-400 text-xs">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search invoice, supplier, item..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                />
              </div>

              {/* Supplier Filter */}
              <select
                value={selectedSupplierFilter}
                onChange={(e) => setSelectedSupplierFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
              >
                <option value="all">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Item Filter */}
              <select
                value={selectedItemFilter}
                onChange={(e) => setSelectedItemFilter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
              >
                <option value="all">All Supply Items</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit}){i.has_vat ? " [VAT]" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payments Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Inv #</th>
                    <th className="py-3.5 px-4">Supplier</th>
                    <th className="py-3.5 px-4">Item</th>
                    <th className="py-3.5 px-4">Unit</th>
                    <th className="py-3.5 px-4 text-right">Qty</th>
                    <th className="py-3.5 px-4 text-right">Unit Price</th>
                    <th className="py-3.5 px-4 text-right">Subtotal</th>
                    <th className="py-3.5 px-4 text-right">VAT</th>
                    <th className="py-3.5 px-4 text-right">Total ($)</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && payments.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="py-12 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                        Loading payments...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="py-12 text-center text-gray-400">
                        <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300 stroke-1" />
                        <p className="font-semibold text-gray-600 text-sm">No payments recorded</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Record Payment" above to add your first entry.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const subtotal = Number(p.subtotal_amount || (Number(p.qty) * Number(p.price)));
                      const vatAmt = Number(p.vat_amount || 0);
                      const hasVat = p.has_vat || vatAmt > 0;
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/80 transition">
                          <td className="py-3.5 px-4 font-medium text-gray-900 whitespace-nowrap">
                            {p.payment_date ? p.payment_date.split("T")[0] : "-"}
                          </td>
                          <td className="py-3.5 px-4 text-gray-500 font-mono">
                            {p.invoice_number || <span className="text-gray-300 italic">None</span>}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-gray-900">
                            {p.supplier_name}
                          </td>
                          <td className="py-3.5 px-4 text-gray-800">
                            {p.item_name}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="bg-gray-100 text-gray-700 font-medium px-2 py-0.5 rounded text-[11px]">
                              {p.unit}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-gray-900 font-mono">
                            {Number(p.qty).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right text-gray-600 font-mono">
                            ${Number(p.price).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right text-gray-700 font-mono font-medium">
                            ${subtotal.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono">
                            {hasVat && vatAmt > 0 ? (
                              <span className="inline-block bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                                +${vatAmt.toFixed(2)} <span className="text-[9px] text-amber-600 font-normal">({Number(p.vat_rate || 11)}%)</span>
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-700 font-mono text-sm">
                            ${Number(p.total_amount).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                p.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenEditPayment(p)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1 text-gray-400 hover:text-rose-600 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SUPPLIERS DIRECTORY ────────────────────────────────────── */}
      {activeTab === "suppliers" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-emerald-200 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{s.name}</h3>
                    {s.category && (
                      <span className="inline-block bg-gray-100 text-gray-600 text-[10px] uppercase font-bold px-2 py-0.5 rounded mt-1">
                        {s.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditSupplier(s)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSupplier(s.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-600">
                  {s.contact_person && (
                    <p className="flex items-center gap-2">
                      <span className="text-gray-400">Contact:</span>
                      <span className="font-medium text-gray-800">{s.contact_person}</span>
                    </p>
                  )}
                  {s.phone && (
                    <p className="flex items-center gap-2 font-mono">
                      <span className="text-gray-400">Phone:</span>
                      <a href={`tel:${s.phone}`} className="text-emerald-600 hover:underline font-semibold">
                        {s.phone}
                      </a>
                    </p>
                  )}
                  {s.address && (
                    <p className="text-gray-500 text-[11px] truncate" title={s.address}>
                      {s.address}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Total Spend</span>
                    <span className="font-bold text-emerald-700 font-mono text-sm">
                      ${Number(s.total_spend || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Invoices</span>
                    <span className="font-semibold text-gray-800">
                      {s.payment_count || 0}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {suppliers.length === 0 && (
              <div className="col-span-full bg-white p-12 rounded-2xl border border-gray-100 text-center text-gray-400">
                <Truck className="w-12 h-12 mx-auto mb-2 text-gray-300 stroke-1" />
                <p className="font-semibold text-gray-600 text-base">No suppliers registered</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add Supplier" above to add vendors.</p>
                <button
                  onClick={handleOpenNewSupplier}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
                >
                  + Add First Supplier
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: RAW ITEMS ──────────────────────────────────────────────── */}
      {activeTab === "items" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Raw Supply Items Directory</h3>
                <p className="text-xs text-gray-500">
                  Ingredients and supplies tracked with designated measurement units and VAT status.
                </p>
              </div>
              <button
                onClick={handleOpenNewItem}
                className="px-3.5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Item Name</th>
                    <th className="py-3.5 px-4">Standard Unit</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-center">VAT Rate</th>
                    <th className="py-3.5 px-4 text-right">Times Purchased</th>
                    <th className="py-3.5 px-4 text-right">Total Qty Bought</th>
                    <th className="py-3.5 px-4 text-right">Avg Unit Price</th>
                    <th className="py-3.5 px-4 text-right">Total Spend ($)</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-gray-400">
                        <Package className="w-10 h-10 mx-auto mb-2 text-gray-300 stroke-1" />
                        <p className="font-semibold text-gray-600 text-sm">No raw items defined</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Add Raw Item" to create tracking items.</p>
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {it.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="bg-emerald-50 text-emerald-800 font-semibold px-2.5 py-1 rounded-md text-[11px]">
                            {it.unit}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-gray-500">
                          {it.category || "-"}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {it.has_vat ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded text-[11px] border border-amber-200/60">
                              <Percent className="w-3 h-3 text-amber-600" />
                              <span>{Number(it.vat_rate || 11)}% VAT</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-gray-400 font-medium px-2 py-0.5 rounded text-[11px] bg-gray-50 border border-gray-100">
                              Exempt (0%)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-gray-700">
                          {it.purchase_count || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-gray-900">
                          {Number(it.total_qty_purchased || 0).toLocaleString()} {it.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-600 font-mono">
                          ${Number(it.avg_unit_price || 0).toFixed(2)} / {it.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700 font-mono text-sm">
                          ${Number(it.total_spend || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEditItem(it)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(it.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: FINANCIAL & STATS REPORT ──────────────────────────────── */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* Top Filter Bar for Reports: Period Selector & Date Presets */}
          <div className="bg-[#181C24] border border-[#262D3D] p-4 sm:p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#eb660c]" />
                <h3 className="text-base font-extrabold text-white">Report Period Filter</h3>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Active Period:{" "}
                <span className="text-white font-bold">
                  {startDate && endDate
                    ? `${startDate} → ${endDate}`
                    : !startDate && !endDate
                    ? "All Recorded History"
                    : startDate
                    ? `From ${startDate}`
                    : `Until ${endDate}`}
                </span>
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "all", label: "All Time" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "august_2026", label: "August 2026" },
                { id: "july_2026", label: "July 2026" },
                { id: "this_week", label: "This Week" },
                { id: "today", label: "Today" },
                { id: "custom", label: "Custom Range" }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setDatePreset(btn.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    datePreset === btn.id
                      ? "bg-[#eb660c] text-white shadow-md"
                      : "bg-[#0F1115] text-gray-400 hover:text-white border border-[#262D3D]"
                  }`}
                >
                  {btn.label}
                </button>
              ))}

              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 bg-[#0F1115] hover:bg-[#262D3D] text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-[#262D3D] transition-all"
                title="Refresh Report Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#eb660c]" : ""}`} />
              </button>
            </div>
          </div>

          {/* Custom Date Inputs (only shown when 'custom' is active) */}
          {datePreset === "custom" && (
            <div className="bg-[#181C24] border border-[#eb660c]/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl animate-in fade-in">
              <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                <div
                  className="flex items-center gap-2 bg-[#0F1115] border border-[#262D3D] px-3 py-2 rounded-xl cursor-pointer hover:border-[#eb660c] transition-colors"
                  onClick={(e) => {
                    const input = e.currentTarget.querySelector('input');
                    if (input && input.showPicker) input.showPicker();
                  }}
                >
                  <Calendar className="w-4 h-4 text-[#eb660c]" />
                  <span className="text-xs text-gray-400 font-extrabold">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent text-white text-xs font-black focus:outline-none cursor-pointer"
                  />
                </div>

                <div
                  className="flex items-center gap-2 bg-[#0F1115] border border-[#262D3D] px-3 py-2 rounded-xl cursor-pointer hover:border-[#eb660c] transition-colors"
                  onClick={(e) => {
                    const input = e.currentTarget.querySelector('input');
                    if (input && input.showPicker) input.showPicker();
                  }}
                >
                  <Calendar className="w-4 h-4 text-[#eb660c]" />
                  <span className="text-xs text-gray-400 font-extrabold">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent text-white text-xs font-black focus:outline-none cursor-pointer"
                  />
                </div>

                <button
                  onClick={fetchData}
                  className="px-4 py-2 bg-[#eb660c] hover:bg-[#d55909] text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  Apply Filter
                </button>
              </div>

              {/* Quick presets inside custom picker */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 font-bold hidden lg:inline">Presets:</span>
                <button
                  onClick={() => { setStartDate("2026-08-01"); setEndDate("2026-08-31"); }}
                  className="px-2.5 py-1 bg-[#0F1115] hover:bg-[#262D3D] text-xs font-bold text-gray-300 rounded-lg border border-[#262D3D]"
                >
                  August 2026
                </button>
                <button
                  onClick={() => { setStartDate("2026-07-01"); setEndDate("2026-07-31"); }}
                  className="px-2.5 py-1 bg-[#0F1115] hover:bg-[#262D3D] text-xs font-bold text-gray-300 rounded-lg border border-[#262D3D]"
                >
                  July 2026
                </button>
                <button
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    setStartDate(d.toISOString().slice(0, 10));
                    setEndDate(today);
                  }}
                  className="px-2.5 py-1 bg-[#0F1115] hover:bg-[#262D3D] text-xs font-bold text-gray-300 rounded-lg border border-[#262D3D]"
                >
                  Last 30 Days
                </button>
              </div>
            </div>
          )}

          {stats ? (
            <>
              {/* Financial Profitability / Cost vs Revenue Overview */}
              <div className="bg-[#181C24] border border-[#262D3D] text-white p-5 sm:p-6 rounded-2xl shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#262D3D] pb-3 gap-2">
              <div>
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#eb660c]" />
                  Financial &amp; Profitability Overview
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Comparing customer sales revenue against raw supplier payments for estimated gross margin and VAT breakdown.
                </p>
              </div>
              <div className="text-xs font-bold text-gray-400 bg-[#0F1115] px-3 py-1.5 rounded-xl border border-[#262D3D] self-start sm:self-auto flex items-center gap-2">
                <span>Food Cost Margin:</span>
                <span className={`font-black ${stats.summary.grossMarginPercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {stats.summary.grossMarginPercent || 0}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Sales Revenue */}
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-4 space-y-2 shadow-sm">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-xs font-bold">Sales Revenue</span>
                  <div className="p-2 rounded-xl bg-[#eb660c]/20 text-[#eb660c]">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white font-mono">
                  ${(stats.summary?.orderRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-gray-400 font-medium flex items-center justify-between">
                  <span>Gross: ${(stats.summary?.grossSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-rose-400 font-semibold">Disc: -${(stats.summary?.orderDiscounts || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Supplier Gross Spend */}
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-4 space-y-2 shadow-sm">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-xs font-bold">Supplier Spend</span>
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-rose-400 font-mono">
                  -${(stats.summary.totalSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-gray-400 font-medium">
                  {stats.summary.totalPayments || 0} invoices (incl. VAT)
                </div>
              </div>

              {/* Net Purchases (Excl. VAT) */}
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-4 space-y-2 shadow-sm">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-xs font-bold">Net Purchases</span>
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-blue-400 font-mono">
                  -${(stats.summary.netSpend || (stats.summary.totalSpend - (stats.summary.totalVat || 0))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-gray-400 font-medium">
                  Excl. VAT raw cost
                </div>
              </div>

              {/* Total VAT Paid */}
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-4 space-y-2 shadow-sm">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-xs font-bold text-amber-400">Total VAT Paid</span>
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-400 font-mono">
                  ${(stats.summary.totalVat || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-gray-400 font-medium">
                  Tax paid to suppliers
                </div>
              </div>

              {/* Gross Margin */}
              <div className="bg-[#0F1115] border border-[#262D3D] rounded-xl p-4 space-y-2 shadow-sm">
                <div className="flex justify-between items-center text-gray-400">
                  <span className="text-xs font-bold">Gross Margin %</span>
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className={`text-2xl font-black font-mono ${stats.summary.grossMarginPercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {stats.summary.grossMarginPercent || 0}%
                </div>
                <div className="text-[11px] text-gray-400 font-medium">
                  ${(stats.summary.grossMargin || 0).toFixed(2)} food margin
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Suppliers by Spend */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  Top Suppliers by Spend
                </span>
                <span className="text-xs font-medium text-gray-500">Share of Total</span>
              </h3>

              <div className="space-y-3.5">
                {(stats.bySupplier || []).map((s) => (
                  <div key={s.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-800">{s.name}</span>
                      <span className="font-mono text-gray-900 font-bold">
                        ${Number(s.total_spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                        <span className="text-gray-400 font-normal">({s.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(s.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}

                {(stats.bySupplier || []).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">No supplier spend data available for this range.</p>
                )}
              </div>
            </div>

            {/* Top Cost Driver Items */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  Top Cost Items (Raw Materials)
                </span>
                <span className="text-xs font-medium text-gray-500">Spend &amp; VAT</span>
              </h3>

              <div className="space-y-3.5">
                {(stats.byItem || []).map((i) => (
                  <div key={i.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                        {i.name}{" "}
                        {i.has_vat && (
                          <span className="text-[9px] bg-amber-50 text-amber-800 font-semibold px-1 rounded border border-amber-200/50">
                            {Number(i.vat_rate || 11)}% VAT
                          </span>
                        )}
                        <span className="text-[10px] font-normal text-gray-400">
                          ({Number(i.total_qty).toLocaleString()} {i.unit} @ ${Number(i.avg_unit_price).toFixed(2)})
                        </span>
                      </span>
                      <span className="font-mono text-gray-900 font-bold">
                        ${Number(i.total_spend).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                        <span className="text-gray-400 font-normal">({i.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(i.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}

                {(stats.byItem || []).length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">No item spend data recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-12 text-center text-gray-400 shadow-lg">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#eb660c] mb-3" />
          <p className="text-sm font-semibold text-white">Loading report data...</p>
        </div>
      )}
        </div>
      )}

      {/* ── MODAL: RECORD / EDIT PAYMENT ──────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                {editingPayment ? "Edit Supplier Payment" : "Record Supplier Payment"}
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              {/* Top Row: Date, Invoice #, Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Invoice Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-0041"
                    value={paymentForm.invoice_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Supplier *</label>
                  <select
                    required
                    value={paymentForm.supplier_id}
                    onChange={(e) => setPaymentForm({ ...paymentForm, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items & Line Details */}
              <div className="space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Purchased Items &amp; VAT
                  </span>
                  {!editingPayment && (
                    <button
                      type="button"
                      onClick={handleAddPaymentLine}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Line
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {paymentForm.lines.map((line, idx) => {
                    const q = parseFloat(line.qty) || 0;
                    const p = parseFloat(line.price) || 0;
                    const lineSub = q * p;
                    const vRate = line.has_vat ? (parseFloat(line.vat_rate) || 0) : 0;
                    const lineVat = lineSub * (vRate / 100);
                    const lineTotal = lineSub + lineVat;

                    return (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-xl border border-gray-200 space-y-2 shadow-xs"
                      >
                        <div className="grid grid-cols-12 gap-2 items-center">
                          {/* Item Dropdown */}
                          <div className="col-span-12 sm:col-span-4">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-medium text-gray-500">Item</span>
                              <button
                                type="button"
                                onClick={handleOpenNewItem}
                                className="text-[10px] text-emerald-600 hover:underline font-semibold"
                              >
                                + New
                              </button>
                            </div>
                            <select
                              value={line.item_id}
                              onChange={(e) => handleLineItemChange(idx, "item_id", e.target.value)}
                              required
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none"
                            >
                              <option value="">Select Item</option>
                              {items.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name} ({i.unit}){i.has_vat ? " [VAT]" : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Unit */}
                          <div className="col-span-6 sm:col-span-2">
                            <span className="text-[10px] font-medium text-gray-500 block mb-1">Unit</span>
                            <select
                              value={line.unit}
                              onChange={(e) => handleLineItemChange(idx, "unit", e.target.value)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none"
                            >
                              {ALLOWED_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Qty */}
                          <div className="col-span-6 sm:col-span-2">
                            <span className="text-[10px] font-medium text-gray-500 block mb-1">Qty</span>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={line.qty}
                              onChange={(e) => handleLineItemChange(idx, "qty", e.target.value)}
                              required
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none font-mono"
                            />
                          </div>

                          {/* Unit Price */}
                          <div className="col-span-6 sm:col-span-2">
                            <span className="text-[10px] font-medium text-gray-500 block mb-1">Price ($)</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.price}
                              onChange={(e) => handleLineItemChange(idx, "price", e.target.value)}
                              required
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none font-mono"
                            />
                          </div>

                          {/* Actions / Remove */}
                          <div className="col-span-6 sm:col-span-2 text-right">
                            <span className="text-[10px] font-medium text-gray-500 block mb-1">Line Total</span>
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-bold text-emerald-700 font-mono text-xs">
                                ${lineTotal.toFixed(2)}
                              </span>
                              {paymentForm.lines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePaymentLine(idx)}
                                  className="p-1 text-gray-400 hover:text-rose-600 transition"
                                  title="Remove line"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* VAT Toggle & Breakdown for this line */}
                        <div className="flex flex-wrap items-center justify-between text-xs pt-1.5 border-t border-gray-100 gap-2 bg-gray-50/70 px-2 py-1 rounded-lg">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={line.has_vat}
                              onChange={(e) => handleLineItemChange(idx, "has_vat", e.target.checked)}
                              className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                            <span className="font-semibold text-gray-700 text-[11px]">Item has VAT</span>
                          </label>

                          {line.has_vat && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500 font-medium">Rate:</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="100"
                                value={line.vat_rate}
                                onChange={(e) => handleLineItemChange(idx, "vat_rate", e.target.value)}
                                className="w-14 px-1.5 py-0.5 text-[11px] border border-gray-300 rounded font-mono outline-none text-center"
                              />
                              <span className="text-[11px] font-bold text-emerald-700">%</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 font-mono text-[11px] text-gray-600 ml-auto">
                            <span>Subtotal: ${lineSub.toFixed(2)}</span>
                            {line.has_vat && (
                              <span className="text-amber-700 font-semibold">
                                + VAT: ${lineVat.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Totals Summary Breakdown */}
                <div className="pt-3 border-t border-gray-200 mt-2 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-600 font-mono">
                    <span>Subtotal (Excl. VAT):</span>
                    <span>${computeTotals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 font-mono font-medium">
                    <span>Total VAT:</span>
                    <span>+${computeTotals.totalVat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-1.5">
                    <span>Grand Total (Incl. VAT):</span>
                    <span className="text-emerald-700 font-mono text-base">
                      ${computeTotals.grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method, Status, Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Credit / Pending">Credit / Pending</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Wish Money">Wish Money</option>
                    <option value="OMT">OMT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Status</label>
                  <select
                    value={paymentForm.status}
                    onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none"
                  >
                    <option value="paid">Paid (Disbursed)</option>
                    <option value="pending">Pending / On Account</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Notes</label>
                <textarea
                  rows="2"
                  placeholder="Receipt reference, delivery notes, or payment terms..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition"
                >
                  {editingPayment ? "Update Payment Record" : "Confirm & Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT SUPPLIER ─────────────────────────────────── */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Supplier / Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Wadi Poultry, Metro Packaging"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 01 234 567 or 70 123 456"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Sales Rep, Delivery Manager"
                  value={supplierForm.contact_person}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Meat, Packaging, Dairy, Bakery, Beverages"
                  value={supplierForm.category}
                  onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="e.g. Sin El Fil, Dekwaneh Industrial"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows="2"
                  placeholder="Payment credit terms, delivery schedules, bank details..."
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-3 py-1.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold transition"
                >
                  {editingSupplier ? "Update Supplier" : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE / EDIT RAW ITEM WITH VAT ─────────────────────────── */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                {editingItem ? "Edit Raw Item" : "Add Raw Material / Supply Item"}
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chicken Breast, Cooking Oil, Burger Bun"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Measurement Unit * <span className="text-gray-400 font-normal">({ALLOWED_UNITS.join(", ")})</span>
                </label>
                <select
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ALLOWED_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* VAT Section */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="item-vat-toggle" className="text-xs font-bold text-gray-800 cursor-pointer flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-amber-600" />
                      Subject to VAT (Value Added Tax)
                    </label>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Check if suppliers bill VAT on this item (Standard in Lebanon: 11%).
                    </p>
                  </div>
                  <input
                    id="item-vat-toggle"
                    type="checkbox"
                    checked={itemForm.has_vat}
                    onChange={(e) => setItemForm({ ...itemForm, has_vat: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                {itemForm.has_vat && (
                  <div className="pt-2 border-t border-gray-200/60 flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">VAT Rate (%):</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={itemForm.vat_rate}
                      onChange={(e) => setItemForm({ ...itemForm, vat_rate: e.target.value })}
                      className="w-24 px-2.5 py-1 text-xs border border-gray-300 rounded-lg outline-none font-mono focus:ring-1 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-emerald-700 font-mono">%</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Meat &amp; Poultry, Dairy, Packaging, Produce"
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows="2"
                  placeholder="Storage requirements, standard packaging size..."
                  value={itemForm.notes}
                  onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-3 py-1.5 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-semibold transition"
                >
                  {editingItem ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
