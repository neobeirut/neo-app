import React from "react";
import {
  Clock,
  CheckCircle,
  Package,
  ShoppingBag,
  XCircle,
  Truck,
} from "lucide-react-native";

export function OrderStatusIcon({ status, colors }) {
  switch (status) {
    case "pending":
      return <Clock size={20} color="#F59E0B" />;
    case "accepted":
      return <CheckCircle size={20} color="#3B82F6" />;
    case "preparing":
      return <Package size={20} color="#8B5CF6" />;
    case "ready":
      return <ShoppingBag size={20} color="#10B981" />;
    case "out_for_delivery":
      return <Truck size={20} color="#06B6D4" />;
    case "completed":
      return <CheckCircle size={20} color="#059669" />;
    case "cancelled":
      return <XCircle size={20} color="#EF4444" />;
    default:
      return <Clock size={20} color={colors.textSecondary} />;
  }
}
