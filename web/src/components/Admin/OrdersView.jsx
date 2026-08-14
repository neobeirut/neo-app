import React, { useState } from "react";
import {
  Eye,
  CheckCircle,
  MessageCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Package,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Building2,
  DollarSign,
  Tag,
  Calendar
} from "lucide-react";
import { toast } from "sonner";
import OrderDetailsModal from "@/components/Admin/OrderDetailsModal";

const statusColors = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  accepted: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-purple-100 text-purple-800 border-purple-200",
  ready: "bg-emerald-100 text-emerald-800 border-emerald-200",
  out_for_delivery: "bg-indigo-100 text-indigo-800 border-indigo-200",
  completed: "bg-slate-100 text-slate-800 border-slate-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
};

export default function OrdersView({
  orders,
  onStatusChange,
  onDelete,
  onUpdateItems,
}) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("");
  const [range, setRange] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [openWhatsAppOnMount, setOpenWhatsAppOnMount] = useState(false);
  
  // Track expanded order IDs for inline row expansion
  const [expandedOrderIds, setExpandedOrderIds] = useState({});

  const toggleExpand = (orderId, e) => {
    // If click originated from action buttons, do not toggle expand
    if (e && e.target && (e.target.closest("button") || e.target.closest("a"))) {
      return;
    }
    setExpandedOrderIds((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleDeleteClick = (e, orderId) => {
    e.stopPropagation();
    if (
      window.confirm(
        "Are you sure you want to delete this order? This will permanently delete the order and its products."
      )
    ) {
      onDelete(orderId);
    }
  };

  const getOriginBadge = (order) => {
    const raw = String(order.order_source || order.origin || order.channel || order.source || order.order_type || "App").toLowerCase();
    
    if (raw.includes("toters")) {
      return { label: "Toters", emoji: "🛵", className: "bg-amber-50 text-amber-800 border-amber-300" };
    }
    if (raw.includes("noknok") || raw.includes("nok")) {
      return { label: "NokNok", emoji: "📦", className: "bg-pink-50 text-pink-800 border-pink-300" };
    }
    if (raw.includes("whatsapp") || raw.includes("wa")) {
      return { label: "WhatsApp", emoji: "💬", className: "bg-emerald-50 text-emerald-800 border-emerald-300" };
    }
    if (raw.includes("store") || raw.includes("pos") || raw.includes("instore") || raw.includes("in-store")) {
      return { label: "In-Store", emoji: "🏪", className: "bg-slate-100 text-slate-800 border-slate-300" };
    }
    if (raw.includes("app") || raw.includes("web") || raw.includes("online")) {
      return { label: "App", emoji: "📱", className: "bg-indigo-50 text-indigo-800 border-indigo-300" };
    }
    return { label: order.order_source || order.origin || "App", emoji: "🌐", className: "bg-slate-100 text-slate-700 border-slate-200" };
  };

  const getBeirutDateStr = (dateInput) => {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Beirut" });
  };

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Beirut" });

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Beirut" });
  };

  const getNDaysAgoStr = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Beirut" });
  };

  const getFirstOfMonthStr = () => {
    const d = new Date();
    const monthStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Beirut" }).slice(0, 7);
    return `${monthStr}-01`;
  };

  const filteredOrders = orders.filter((order) => {
    if (filterStatus && order.status !== filterStatus) return false;
    
    if (filterOrigin) {
      const raw = String(order.order_source || order.origin || order.channel || order.source || order.order_type || "").toLowerCase();
      if (filterOrigin === "toters" && !raw.includes("toters")) return false;
      if (filterOrigin === "noknok" && !raw.includes("noknok") && !raw.includes("nok")) return false;
      if (filterOrigin === "whatsapp" && !raw.includes("whatsapp") && !raw.includes("wa")) return false;
      if (filterOrigin === "in-store" && !raw.includes("store") && !raw.includes("pos") && !raw.includes("instore")) return false;
      if (filterOrigin === "app" && !raw.includes("app") && !raw.includes("web") && !raw.includes("online")) return false;
    }

    // Date Range Filter (Matching Reports View)
    if (range !== "all") {
      const orderDateStr = getBeirutDateStr(order.created_at || order.scheduled_date);
      if (orderDateStr) {
        if (range === "today" && orderDateStr !== todayStr) return false;
        if (range === "yesterday" && orderDateStr !== getYesterdayStr()) return false;
        if (range === "7days" && orderDateStr < getNDaysAgoStr(7)) return false;
        if (range === "thismonth" && orderDateStr < getFirstOfMonthStr()) return false;
        if (range === "custom") {
          if (startDate && orderDateStr < startDate) return false;
          if (endDate && orderDateStr > endDate) return false;
        }
      }
    }

    return true;
  });

  const formatDateTime = (dateStr, scheduledTime) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    const formattedDate = isNaN(date.getTime())
      ? dateStr
      : date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

    if (scheduledTime) {
      return `${formattedDate} (${scheduledTime})`;
    }
    return formattedDate;
  };

  const handleQuickAccept = async (orderId) => {
    if (confirm("Accept this order?")) {
      await onStatusChange(orderId, "preparing");
    }
  };

  const isOrderLocked = (status) => {
    return ["ready", "out_for_delivery", "completed", "cancelled"].includes(status);
  };

  const handleOpenOrder = (order, { openWhatsApp } = {}) => {
    setSelectedOrder(order);
    setOpenWhatsAppOnMount(!!openWhatsApp);
  };

  const handleWhatsAppRowClick = (order) => {
    const isClosed = ["cancelled", "completed"].includes(order.status);
    if (isClosed) {
      const ok = confirm(
        "This order is closed/cancelled. Do you still want to send WhatsApp to the store?"
      );
      if (!ok) return;
    }
    handleOpenOrder(order, { openWhatsApp: true });
    toast.message("Preparing WhatsApp preview…");
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filter Bar (Same as Reports View) */}
      <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#eb660c]/20 text-[#eb660c] flex items-center justify-center font-bold">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">Filter Orders by Date</h2>
            <p className="text-xs text-gray-400">Select date window for order records (Asia/Beirut Time)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "7days", label: "Last 7 Days" },
            { id: "thismonth", label: "This Month" },
            { id: "all", label: "All Time" },
            { id: "custom", label: "Custom Range" }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setRange(btn.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                range === btn.id
                  ? "bg-[#eb660c] text-white shadow-md"
                  : "bg-[#0F1115] text-gray-400 hover:text-white border border-[#262D3D]"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Inputs (when Custom Range selected) */}
      {range === "custom" && (
        <div className="bg-[#181C24] border border-[#262D3D] rounded-2xl p-4 flex flex-wrap items-end gap-4 shadow-sm text-white">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-[#0F1115] border border-[#262D3D] text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#eb660c] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-[#0F1115] border border-[#262D3D] text-white rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-[#eb660c] outline-none"
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Filter Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Filter Origin
          </label>
          <select
            value={filterOrigin}
            onChange={(e) => setFilterOrigin(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
          >
            <option value="">All Origins (Toters, NokNok, WhatsApp, In-Store, App)</option>
            <option value="toters">🛵 Toters</option>
            <option value="noknok">📦 NokNok</option>
            <option value="whatsapp">💬 WhatsApp</option>
            <option value="in-store">🏪 In-Store</option>
            <option value="app">📱 App</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  #order
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Origin
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wider sticky right-0 bg-slate-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] z-10 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 font-medium">
                    No orders found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isExpanded = !!expandedOrderIds[order.id];
                  const originBadge = getOriginBadge(order);

                  return (
                    <React.Fragment key={order.id}>
                      {/* Order Main Row */}
                      <tr
                        onClick={(e) => toggleExpand(order.id, e)}
                        className={`cursor-pointer transition-colors duration-150 ${
                          isExpanded ? "bg-indigo-50/40" : "hover:bg-slate-50"
                        }`}
                      >
                        {/* #order Column with Expand Toggle Indicator */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(order.id);
                              }}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
                              title={isExpanded ? "Collapse Details" : "Expand Details"}
                            >
                              {isExpanded ? (
                                <ChevronUp size={16} className="text-indigo-600" />
                              ) : (
                                <ChevronDown size={16} />
                              )}
                            </button>
                            <span className="font-bold text-slate-900 text-sm">
                              #{order.id}
                            </span>
                          </div>
                        </td>

                        {/* Customer Column */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-900">
                            {order.customer_name || "Guest Customer"}
                          </div>
                          {order.customer_phone && (
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone size={12} className="text-slate-400" />
                              {order.customer_phone}
                            </div>
                          )}
                          {order.customer_email && (
                            <div className="text-xs text-slate-400 truncate max-w-[180px]">
                              {order.customer_email}
                            </div>
                          )}
                        </td>

                        {/* Origin Column */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border shadow-xs ${originBadge.className}`}>
                            <span>{originBadge.emoji}</span>
                            <span>{originBadge.label}</span>
                            {order.branch_name ? <span className="opacity-75 font-normal">({order.branch_name})</span> : ""}
                          </span>
                        </td>

                        {/* Date & Time Column */}
                        <td className="px-4 py-4 text-xs text-slate-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium text-slate-900">
                            <Clock size={13} className="text-slate-400" />
                            {formatDateTime(
                              order.created_at || order.scheduled_date,
                              order.scheduled_time
                            )}
                          </div>
                        </td>

                        {/* Total Column */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                          ${parseFloat(order.total_amount || 0).toFixed(2)}
                        </td>

                        {/* Status Column */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full border capitalize shadow-xs ${
                              statusColors[order.status] || "bg-slate-100 text-slate-800 border-slate-200"
                            }`}
                          >
                            {(order.status || "pending").replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Action Column (Kept on the far right) */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] z-10 text-right">
                          <div
                            className="flex gap-2 items-center justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {order.status === "pending" && (
                              <button
                                onClick={() => handleQuickAccept(order.id)}
                                className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors"
                                title="Accept Order (Set to Preparing)"
                              >
                                <CheckCircle size={18} />
                              </button>
                            )}

                            <button
                              onClick={() => handleWhatsAppRowClick(order)}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                              title="Send WhatsApp for Delivery"
                            >
                              <MessageCircle size={18} />
                            </button>

                            <button
                              onClick={() =>
                                handleOpenOrder(order, { openWhatsApp: false })
                              }
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              title={
                                isOrderLocked(order.status)
                                  ? "View Details Modal (items locked)"
                                  : "View / Edit Order Modal"
                              }
                            >
                              <Eye size={18} />
                            </button>

                            <button
                              onClick={(e) => handleDeleteClick(e, order.id)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                              title="Delete Order"
                            >
                              <Trash2 size={18} />
                            </button>

                            {isOrderLocked(order.status) && (
                              <span
                                className="text-slate-400 text-xs"
                                title="Items are locked for this order"
                              >
                                🔒
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Order Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan="7" className="p-4 md:p-6">
                            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm space-y-5">
                              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                  <Package className="text-indigo-600" size={20} />
                                  <h4 className="font-bold text-slate-900 text-base">
                                    Order Details — #{order.id}
                                  </h4>
                                </div>
                                <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                                  {(order.items || []).length} Item(s)
                                </div>
                              </div>

                              {/* Items & Addons List */}
                              <div className="space-y-3">
                                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  Ordered Items
                                </h5>
                                {(!order.items || order.items.length === 0) ? (
                                  <p className="text-sm text-slate-400 italic py-2">
                                    No item details found for this order.
                                  </p>
                                ) : (
                                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
                                    {order.items.map((item, idx) => (
                                      <div
                                        key={item.id || idx}
                                        className="p-3.5 bg-slate-50/50 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                                      >
                                        <div className="space-y-1">
                                          <div className="font-bold text-slate-800 flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                                              {item.quantity}x
                                            </span>
                                            {item.product_name || item.name || "Product Item"}
                                          </div>

                                          {/* Customizations / Addons */}
                                          {item.addons && item.addons.length > 0 && (
                                            <div className="text-xs text-slate-500 pl-8 space-y-0.5">
                                              <span className="font-semibold text-slate-600">Addons: </span>
                                              {item.addons.map((addon) => (
                                                <span
                                                  key={addon.id || addon.name}
                                                  className="inline-block bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded text-[11px] mr-1.5"
                                                >
                                                  +{addon.name} (${parseFloat(addon.price || 0).toFixed(2)})
                                                </span>
                                              ))}
                                            </div>
                                          )}

                                          {/* Customizations Text */}
                                          {item.customizations && (
                                            <div className="text-xs text-indigo-600 italic pl-8">
                                              Notes: {typeof item.customizations === "string" ? item.customizations : JSON.stringify(item.customizations)}
                                            </div>
                                          )}

                                          {/* Item Comment */}
                                          {item.comment && (
                                            <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200/60 pl-8 mt-1">
                                              Instruction: {item.comment}
                                            </div>
                                          )}
                                        </div>

                                        <div className="text-right font-bold text-slate-900 whitespace-nowrap pl-8 sm:pl-0">
                                          ${parseFloat(item.total_price || (item.unit_price * item.quantity) || 0).toFixed(2)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Order Metadata & Summary Details Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-100 text-xs">
                                {/* Customer & Delivery Info */}
                                <div className="space-y-2 bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                                    <User size={14} className="text-indigo-600" />
                                    Customer & Address
                                  </div>
                                  <div className="text-slate-700">
                                    <span className="font-semibold">Name: </span>
                                    {order.customer_name || "N/A"}
                                  </div>
                                  <div className="text-slate-700">
                                    <span className="font-semibold">Phone: </span>
                                    {order.customer_phone || "N/A"}
                                  </div>
                                  <div className="text-slate-700">
                                    <span className="font-semibold">Delivery Address: </span>
                                    {order.address_line1 || order.delivery_address || (
                                      <span className="text-slate-400 italic">Pickup Order / No Address</span>
                                    )}
                                  </div>
                                  {order.building && (
                                    <div className="text-slate-600">
                                      Building: {order.building} {order.company_name ? `(${order.company_name})` : ""}
                                    </div>
                                  )}
                                  {order.latitude && order.longitude && (
                                    <a
                                      href={`https://maps.google.com/?q=${order.latitude},${order.longitude}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold mt-1"
                                    >
                                      <MapPin size={12} />
                                      View Map Location ({Number(order.latitude).toFixed(4)}, {Number(order.longitude).toFixed(4)})
                                    </a>
                                  )}
                                </div>

                                {/* Order Summary Breakdown */}
                                <div className="space-y-2 bg-slate-50 p-3.5 rounded-lg border border-slate-200/60 flex flex-col justify-between">
                                  <div className="space-y-2">
                                    <div className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                                      <DollarSign size={14} className="text-emerald-600" />
                                      Financial Summary
                                    </div>
                                    <div className="flex justify-between text-slate-600">
                                      <span>Origin Channel:</span>
                                      <span className="font-semibold capitalize text-slate-800">{originText}</span>
                                    </div>
                                    {order.reward_title && (
                                      <div className="flex justify-between text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                                        <span className="flex items-center gap-1">
                                          <Tag size={11} /> Reward Applied:
                                        </span>
                                        <span>{order.reward_title}</span>
                                      </div>
                                    )}
                                    {order.delivery_fee > 0 && (
                                      <div className="flex justify-between text-slate-600">
                                        <span>Delivery Fee:</span>
                                        <span>${parseFloat(order.delivery_fee).toFixed(2)}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold text-slate-900">
                                    <span>Total Amount:</span>
                                    <span className="text-base text-emerald-700">
                                      ${parseFloat(order.total_amount || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal (when explicitly opened via Eye/Edit button) */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => {
            setSelectedOrder(null);
            setOpenWhatsAppOnMount(false);
          }}
          onStatusChange={onStatusChange}
          onUpdateItems={onUpdateItems}
          openWhatsAppOnMount={openWhatsAppOnMount}
          onWhatsAppAutoOpenHandled={() => setOpenWhatsAppOnMount(false)}
        />
      )}
    </div>
  );
}
