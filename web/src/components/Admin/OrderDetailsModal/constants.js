export const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const CONTENT_LOCKED_STATUSES = [
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
];

export const STATUS_LOCKED_STATUSES = ["completed", "cancelled"];
