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
  AlertCircle
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

  // Filters for Payments
  const [datePreset, setDatePreset] = useState("this_month");
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
      { item_id: "", unit: "Kg", qty: "1", price: "0" }
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
    } else if (datePreset === "this_week") {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      setStartDate(monday.toISOString().split("T")[0]);
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
    setPaymentForm({
      invoice_number: "",
      payment_date: new Date().toISOString().split("T")[0],
      supplier_id: suppliers.length > 0 ? String(suppliers[0].id) : "",
      payment_method: "Cash",
      status: "paid",
      notes: "",
      lines: [
        { 
          item_id: items.length > 0 ? String(items[0].id) : "", 
          unit: items.length > 0 ? items[0].unit : "Kg", 
          qty: "1", 
          price: "0" 
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
          price: String(p.price)
        }
      ]
    });
    setShowPaymentModal(true);
  };

  const handleLineItemChange = (index, field, value) => {
    const updated = [...paymentForm.lines];
    updated[index][field] = value;

    // If item changed, automatically set the unit to item's default unit
    if (field === "item_id") {
      const matched = items.find((i) => String(i.id) === String(value));
      if (matched && matched.unit) {
        updated[index].unit = matched.unit;
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
          price: "0"
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

  const computeGrandTotal = useMemo(() => {
    return paymentForm.lines.reduce((sum, line) => {
      const q = parseFloat(line.qty) || 0;
      const p = parseFloat(line.price) || 0;
      return sum + q * p;
    }, 0);
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
        showToast("Payment record deleted.");
        fetchData();
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to delete payment: " + err.message);
    }
  };

  // --- Actions: Suppliers ---
  const handleOpenNewSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({ name: "", phone: "", contact_person: "", address: "", category: "", notes: "" });
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
    setItemForm({ name: "", unit: "Kg", category: "", notes: "" });
    setShowItemModal(true);
  };

  const handleOpenEditItem = (it) => {
    setEditingItem(it);
    setItemForm({
      name: it.name || "",
      unit: it.unit || "Kg",
      category: it.category || "",
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

  // CSV Export
  const handleExportCSV = () => {
    if (payments.length === 0) {
      alert("No payments to export");
      return;
    }

    let csv = "Date,Invoice Number,Supplier,Item,Unit,Quantity,Price ($),Total ($),Payment Method,Status,Notes\n";
    payments.forEach((p) => {
      const date = p.payment_date ? p.payment_date.split("T")[0] : "";
      const inv = (p.invoice_number || "").replace(/"/g, '""');
      const sup = (p.supplier_name || "").replace(/"/g, '""');
      const item = (p.item_name || "").replace(/"/g, '""');
      const notes = (p.notes || "").replace(/"/g, '""');
      csv += `"${date}","${inv}","${sup}","${item}","${p.unit}",${p.qty},${p.price},${p.total_amount},"${p.payment_method}","${p.status}","${notes}"\n`;
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
            Track raw item purchases, manage food &amp; beverage suppliers, and analyze cost stats.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition flex items-center gap-2 text-sm font-medium"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {activeTab === "payments" && (
            <>
              <button
                onClick={handleExportCSV}
                className="px-4 py-2.5 text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition flex items-center gap-2 text-sm font-medium shadow-sm"
              >
                <Download className="w-4 h-4 text-gray-500" />
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
          Suppliers
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
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
          Raw Supplies (Items)
          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
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
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Spend</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">
                  ${(stats?.summary?.totalSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Payments</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">
                  {stats?.summary?.totalPayments || payments.length}
                </h3>
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
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Average Payment</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">
                  ${(stats?.summary?.avgPayment || 0).toFixed(2)}
                </h3>
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
                { id: "today", label: "Today" },
                { id: "this_week", label: "This Week" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "all", label: "All Time" },
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
                    {i.name} ({i.unit})
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
                    <th className="py-3.5 px-4 text-right">Total ($)</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && payments.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-12 text-center text-gray-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                        Loading payments...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-12 text-center text-gray-400">
                        <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300 stroke-1" />
                        <p className="font-semibold text-gray-600 text-sm">No payments recorded</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Record Payment" above to add your first entry.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => (
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
                        <td className="py-3.5 px-4 text-right font-medium text-gray-900">
                          {Number(p.qty).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-600 font-mono">
                          ${Number(p.price).toFixed(2)}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: SUPPLIERS ──────────────────────────────────────────────── */}
      {activeTab === "suppliers" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{s.name}</h3>
                      {s.contact_person && (
                        <p className="text-xs text-gray-500 mt-0.5">Contact: {s.contact_person}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditSupplier(s)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(s.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-gray-50 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {s.phone && (
                    <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
                      <span className="font-medium text-gray-400">Phone:</span> {s.phone}
                    </p>
                  )}
                  {s.address && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      <span className="font-medium text-gray-400">Address:</span> {s.address}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Spent</span>
                    <span className="text-base font-bold text-emerald-600 font-mono">
                      ${Number(s.total_spend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Orders</span>
                    <span className="text-xs font-semibold text-gray-700">
                      {s.total_payments || 0} invoices
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {suppliers.length === 0 && (
              <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-gray-100 p-8">
                <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <h3 className="text-base font-bold text-gray-700">No suppliers yet</h3>
                <p className="text-xs text-gray-400 mt-1 mb-4">Add your food, packaging, and beverage vendors.</p>
                <button
                  onClick={handleOpenNewSupplier}
                  className="px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-semibold transition"
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
                  Ingredients and supplies tracked with designated measurement units: {ALLOWED_UNITS.join(", ")}.
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
                      <td colSpan="8" className="py-12 text-center text-gray-400">
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
      {activeTab === "reports" && stats && (
        <div className="space-y-6">
          {/* Financial Profitability / Cost vs Revenue Overview */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-850 text-white p-6 rounded-2xl shadow-xl">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Financial &amp; Profitability Overview
            </h2>
            <p className="text-xs text-gray-400 mb-6">
              Comparing customer sales revenue against raw supplier payments for estimated gross margin.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Customer Sales Revenue</span>
                <div className="text-2xl font-bold text-white font-mono mt-1">
                  ${(stats.summary.orderRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-gray-400 mt-0.5 block">{stats.summary.orderCount || 0} completed orders</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Supplier Expenses</span>
                <div className="text-2xl font-bold text-rose-400 font-mono mt-1">
                  -${(stats.summary.totalSpend || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-gray-400 mt-0.5 block">{stats.summary.totalPayments || 0} supplier invoices</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Estimated Gross Margin ($)</span>
                <div className={`text-2xl font-bold font-mono mt-1 ${stats.summary.grossMargin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  ${(stats.summary.grossMargin || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-gray-400 mt-0.5 block">Revenue minus Supplier Costs</span>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Gross Margin %</span>
                <div className={`text-2xl font-bold font-mono mt-1 ${stats.summary.grossMarginPercent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {stats.summary.grossMarginPercent || 0}%
                </div>
                <span className="text-[11px] text-gray-400 mt-0.5 block">Estimated food profitability</span>
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
                <span className="text-xs font-medium text-gray-500">Spend Share</span>
              </h3>

              <div className="space-y-3.5">
                {(stats.byItem || []).map((i) => (
                  <div key={i.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-gray-800">
                        {i.name}{" "}
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
                  <p className="text-xs text-gray-400 text-center py-6">No item expense data available for this range.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: RECORD PAYMENT ─────────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                {editingPayment ? "Edit Payment Record" : "Record Supplier Payment"}
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Invoice # <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-10492"
                    value={paymentForm.invoice_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-gray-700">Supplier *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentModal(false);
                        handleOpenNewSupplier();
                      }}
                      className="text-[10px] text-emerald-600 hover:underline font-semibold"
                    >
                      + New
                    </button>
                  </div>
                  <select
                    value={paymentForm.supplier_id}
                    onChange={(e) => setPaymentForm({ ...paymentForm, supplier_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
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

              {/* Items Table in Modal */}
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Itemized Line Items</span>
                  {!editingPayment && (
                    <button
                      type="button"
                      onClick={handleAddPaymentLine}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Line Item
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {paymentForm.lines.map((line, idx) => {
                    const lineTotal = (parseFloat(line.qty) || 0) * (parseFloat(line.price) || 0);
                    return (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm grid grid-cols-12 gap-2.5 items-center text-xs"
                      >
                        <div className="col-span-12 sm:col-span-4">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-medium text-gray-500">Item</span>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPaymentModal(false);
                                handleOpenNewItem();
                              }}
                              className="text-[10px] text-emerald-600 hover:underline"
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
                                {i.name} ({i.unit})
                              </option>
                            ))}
                          </select>
                        </div>

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

                        <div className="col-span-6 sm:col-span-2">
                          <span className="text-[10px] font-medium text-gray-500 block mb-1">Qty</span>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={line.qty}
                            onChange={(e) => handleLineItemChange(idx, "qty", e.target.value)}
                            required
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none"
                          />
                        </div>

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

                        <div className="col-span-5 sm:col-span-1 text-right">
                          <span className="text-[10px] font-medium text-gray-500 block mb-1">Total</span>
                          <span className="font-bold text-emerald-700 font-mono">
                            ${lineTotal.toFixed(2)}
                          </span>
                        </div>

                        <div className="col-span-1 text-right">
                          {paymentForm.lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePaymentLine(idx)}
                              className="p-1 text-gray-400 hover:text-rose-600 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex justify-between items-center text-sm font-bold text-gray-900 border-t border-gray-200">
                  <span>Grand Total:</span>
                  <span className="text-emerald-700 font-mono text-base">
                    ${computeGrandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

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
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    value={paymentForm.status}
                    onChange={(e) => setPaymentForm({ ...paymentForm, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none"
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows="2"
                  placeholder="Additional delivery or invoice details..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-md shadow-emerald-600/20"
                >
                  {editingPayment ? "Update Payment" : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD/EDIT SUPPLIER ─────────────────────────────────────── */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al Wadi Al Akhdar"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 70 123 456"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Fadi"
                  value={supplierForm.contact_person}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Address / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Dora, Beirut"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Notes</label>
                <textarea
                  rows="2"
                  placeholder="Terms, delivery days..."
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
                  {editingSupplier ? "Update" : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD/EDIT ITEM ─────────────────────────────────────────── */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">
                {editingItem ? "Edit Raw Item" : "Add Raw Supply Item"}
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 mt-4 text-xs">
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
