export const statusOptions = [
  { value: "all", label: "All", color: "#000000" },
  { value: "pending", label: "Pending", color: "#F59E0B" },
  { value: "accepted", label: "Accepted", color: "#3B82F6" },
  { value: "preparing", label: "Preparing", color: "#8B5CF6" },
  { value: "ready", label: "Ready", color: "#10B981" },
  { value: "out_for_delivery", label: "Out for Delivery", color: "#06B6D4" },
  { value: "completed", label: "Completed", color: "#059669" },
  { value: "cancelled", label: "Cancelled", color: "#EF4444" },
];

export const nextStatuses = {
  pending: ["preparing", "cancelled"],
  // kept for backwards compatibility if any existing orders still have this status
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  // NOTE: "ready" is handled dynamically based on order_type in useOrderActions
  ready: [],
  out_for_delivery: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function getStatusColor(status) {
  const option = statusOptions.find((opt) => opt.value === status);
  return option?.color || "#666666";
}

export function filterOrdersByStatus(orders, selectedStatus) {
  return selectedStatus === "all"
    ? orders
    : orders.filter((order) => order.status === selectedStatus);
}

export function getOrderCount(orders, status) {
  return status === "all"
    ? orders.length
    : orders.filter((o) => o.status === status).length;
}
