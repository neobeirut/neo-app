export const DEFAULT_PROMO = {
  enabled: false,
  image_url: null,
  destination_type: "page",
  destination_value: "/(tabs)/home",
  start_at: null,
  end_at: null,
  show_frequency: "once_per_session",
};

export const TEMPLATE_STATUSES = [
  { key: "pending", label: "Order Received" },
  { key: "preparing", label: "Preparing" },
  { key: "ready_pickup", label: "Ready for Pickup" },
  { key: "ready_delivery", label: "Ready for Delivery" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export const PAGE_OPTIONS = [
  { label: "Home", value: "/(tabs)/home" },
  { label: "Menu", value: "/(tabs)/menu" },
  { label: "Favorites", value: "/(tabs)/favorites" },
  { label: "Cart", value: "/(tabs)/cart" },
  { label: "Rewards", value: "/(tabs)/rewards" },
  { label: "Events", value: "/events" },
];
