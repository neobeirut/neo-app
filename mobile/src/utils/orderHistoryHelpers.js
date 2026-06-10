export const statusOptions = [
  { value: "all", label: "All Orders" },
  { value: "active", label: "Active" },
  { value: "ready", label: "Ready for Pickup" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function getFilteredOrders(orders, selectedStatus) {
  if (selectedStatus === "all") {
    return orders;
  } else if (selectedStatus === "active") {
    return orders.filter((o) =>
      ["pending", "confirmed", "preparing"].includes(o.status),
    );
  } else if (selectedStatus === "ready") {
    return orders.filter((o) =>
      ["ready", "out_for_delivery"].includes(o.status),
    );
  } else {
    return orders.filter((o) => o.status === selectedStatus);
  }
}

export function getStatusColor(status) {
  switch (status) {
    case "pending":
      return "#F59E0B";
    case "confirmed":
      return "#3B82F6";
    case "preparing":
      return "#8B5CF6";
    case "ready":
    case "out_for_delivery":
      return "#10B981";
    case "completed":
      return "#059669";
    case "cancelled":
      return "#EF4444";
    default:
      return "#6B6B6B";
  }
}

export function getStatusCount(orders, statusValue) {
  if (statusValue === "all") {
    return orders.length;
  } else if (statusValue === "active") {
    return orders.filter((o) =>
      ["pending", "confirmed", "preparing"].includes(o.status),
    ).length;
  } else if (statusValue === "ready") {
    return orders.filter((o) =>
      ["ready", "out_for_delivery"].includes(o.status),
    ).length;
  } else {
    return orders.filter((o) => o.status === statusValue).length;
  }
}
