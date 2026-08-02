import React from "react";
import {
  Clock,
  CheckCircle,
  Package,
  ShoppingBag,
  Truck,
  XCircle,
} from "lucide-react-native";

export function OrderStatusIcon({ status, size = 20, color }) {
  switch (status) {
    case "pending":
      return <Clock size={size} color={color || "#F59E0B"} />;
    case "confirmed":
      return <CheckCircle size={size} color={color || "#3B82F6"} />;
    case "preparing":
      return <Package size={size} color={color || "#8B5CF6"} />;
    case "ready":
      return <ShoppingBag size={size} color={color || "#10B981"} />;
    case "out_for_delivery":
      return <Truck size={size} color={color || "#10B981"} />;
    case "completed":
      return <CheckCircle size={size} color={color || "#059669"} />;
    case "cancelled":
      return <XCircle size={size} color={color || "#EF4444"} />;
    default:
      return <Clock size={size} color={color || "#6B6B6B"} />;
  }
}
