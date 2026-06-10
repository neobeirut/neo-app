import { useState } from "react";
import { Eye, CheckCircle, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import OrderDetailsModal from "@/components/Admin/OrderDetailsModal";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  preparing: "bg-purple-100 text-purple-800",
  ready: "bg-green-100 text-green-800",
  out_for_delivery: "bg-indigo-100 text-indigo-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function OrdersView({
  orders,
  onStatusChange,
  onDelete,
  onUpdateItems,
}) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const [openWhatsAppOnMount, setOpenWhatsAppOnMount] = useState(false);

  const filteredOrders = orders.filter((order) => {
    if (filterStatus && order.status !== filterStatus) return false;
    if (filterType && order.order_type !== filterType) return false;
    return true;
  });

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleQuickAccept = async (orderId) => {
    if (confirm("Accept this order?")) {
      await onStatusChange(orderId, "preparing");
    }
  };

  const isOrderLocked = (status) => {
    // Locked means items can’t be edited, but the order can still be viewed.
    return ["ready", "out_for_delivery", "completed", "cancelled"].includes(
      status,
    );
  };

  const handleOpenOrder = (order, { openWhatsApp } = {}) => {
    setSelectedOrder(order);
    setOpenWhatsAppOnMount(!!openWhatsApp);
  };

  const handleWhatsAppRowClick = (order) => {
    const isClosed = ["cancelled", "completed"].includes(order.status);

    if (isClosed) {
      const ok = confirm(
        "This order is closed/cancelled. Do you still want to send WhatsApp to the store?",
      );
      if (!ok) {
        return;
      }
    }

    // We open the order details modal and auto-open the WhatsApp preview.
    handleOpenOrder(order, { openWhatsApp: true });

    toast.message("Preparing WhatsApp preview…");
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex gap-4 bg-white p-4 rounded-lg shadow-sm">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order Type
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order #
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Branch
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scheduled
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] z-10">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{order.id}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.customer_name || "Guest"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.customer_email}
                      </div>
                      {order.customer_phone && (
                        <div className="text-sm text-gray-500">
                          {order.customer_phone}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.branch_name || "N/A"}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span className="capitalize text-sm text-gray-900">
                        {order.order_type}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-900 max-w-[160px]">
                      {order.order_type === "delivery" ? (
                        <div>
                          {order.address_line1 || order.delivery_address ? (
                            <>
                              <div className="font-medium truncate max-w-[140px]">
                                {order.address_line1 || order.delivery_address}
                              </div>
                              {order.city && order.state && (
                                <div className="text-gray-500 text-xs">
                                  {order.city}, {order.state}
                                </div>
                              )}
                              {order.latitude && order.longitude && (
                                <div className="text-blue-600 text-xs">
                                  📍 {Number(order.latitude).toFixed(4)},{" "}
                                  {Number(order.longitude).toFixed(4)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">No address</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Pickup</span>
                      )}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {new Date(order.scheduled_date).toLocaleDateString()}
                      </div>
                      <div className="text-gray-500">
                        {order.scheduled_time}
                      </div>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${parseFloat(order.total_amount).toFixed(2)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium sticky right-0 bg-white shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] z-10">
                      <div className="flex gap-2 items-center">
                        {order.status === "pending" && (
                          <button
                            onClick={() => handleQuickAccept(order.id)}
                            className="text-purple-600 hover:text-purple-900"
                            title="Accept Order (Set to Preparing)"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}

                        {/* WhatsApp (row action) */}
                        <button
                          onClick={() => handleWhatsAppRowClick(order)}
                          className="text-green-600 hover:text-green-900"
                          title="Send WhatsApp for Delivery"
                        >
                          <MessageCircle size={18} />
                        </button>

                        {/* Always allow viewing an order, even if it's locked */}
                        <button
                          onClick={() =>
                            handleOpenOrder(order, { openWhatsApp: false })
                          }
                          className="text-blue-600 hover:text-blue-900"
                          title={
                            isOrderLocked(order.status)
                              ? "View (items locked)"
                              : "View / Edit"
                          }
                        >
                          <Eye size={18} />
                        </button>

                        {isOrderLocked(order.status) ? (
                          <span
                            className="text-gray-400 text-xs italic"
                            title="Items are locked for this order"
                          >
                            🔒
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
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
