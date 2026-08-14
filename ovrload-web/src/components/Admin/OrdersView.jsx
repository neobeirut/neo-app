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
            <h2 className="text-base font-black text-[#ffffff]">Filter Orders by Date</h2>
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
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-sm">
                            ${Number(order.total_amount || 0).toFixed(2)}
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <select
                            value={order.status}
                            onChange={(e) => onStatusChange(order.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isOrderLocked(order.status)}
                            className={`border rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                              statusColors[order.status] || "bg-slate-100 text-slate-800"
                            } ${isOrderLocked(order.status) ? "opacity-80 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="accepted">Accepted</option>
                            <option value="preparing">Preparing</option>
                            <option value="ready">Ready</option>
                            <option value="out_for_delivery">Out for Delivery</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>

                        {/* Action Column */}
                        <td className="px-4 py-4 whitespace-nowrap text-right sticky right-0 bg-white shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] z-10">
                          <div className="flex items-center justify-end gap-2">
                            {/* Quick Accept Button for Pending Orders */}
                            {order.status === "pending" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAccept(order.id);
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1"
                              >
                                <CheckCircle size={14} />
                                Accept
                              </button>
                            )}

                            {/* View Details Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenOrder(order);
                              }}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye size={18} />
                            </button>

                            {/* WhatsApp Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWhatsAppRowClick(order);
                              }}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Send WhatsApp"
                            >
                              <MessageCircle size={18} />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={(e) => handleDeleteClick(e, order.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Order"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Order Items / Details Row */}
                      {isExpanded && (
                        <tr className="bg-indigo-50/30 border-b border-indigo-100">
                          <td colSpan="7" className="px-6 py-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                  <Package size={14} className="text-indigo-600" />
                                  Order Items ({order.items?.length || 0})
                                </h4>
                                {order.delivery_address && (
                                  <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                                    <MapPin size={12} className="text-slate-400" />
                                    Address: {order.delivery_address}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {(order.items || []).map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs shadow-2xs"
                                  >
                                    <div className="font-semibold text-slate-900 flex justify-between">
                                      <span>
                                        {item.quantity}x {item.product_name || item.name}
                                      </span>
                                      <span className="text-slate-600">
                                        ${Number(item.total_price || (item.unit_price * item.quantity) || 0).toFixed(2)}
                                      </span>
                                    </div>
                                    {item.addons && item.addons.length > 0 && (
                                      <div className="mt-1 text-[11px] text-slate-500 space-y-0.5 pl-2 border-l-2 border-slate-200">
                                        {item.addons.map((a, ai) => (
                                          <div key={ai}>
                                            + {a.ingredient || a.name} (${Number(a.price || 0).toFixed(2)})
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
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

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={onStatusChange}
          onUpdateItems={onUpdateItems}
          openWhatsAppOnMount={openWhatsAppOnMount}
          onWhatsAppAutoOpenHandled={() => setOpenWhatsAppOnMount(false)}
        />
      )}
    </div>
  );
}
