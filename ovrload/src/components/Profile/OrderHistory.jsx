import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import {
  Clock,
  ChevronRight,
  Package,
  Truck,
  ShoppingBag,
  CheckCircle,
  XCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { OrderDetailModal } from "./OrderDetailModal";
import { useRouter } from "expo-router";
import { apiFetch } from "@/utils/apiFetch";
import { getAuthPhone } from "@/utils/auth/getAuthPhone";

export function OrderHistory({ colors }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const router = useRouter();

  // Fetch user's orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ["user-orders"],
    queryFn: async () => {
      const phone = await getAuthPhone();
      const url = phone
        ? `/api/orders?phone=${encodeURIComponent(phone)}`
        : "/api/orders";

      const response = await apiFetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      return response.json();
    },
  });

  const orders = ordersData?.orders || [];
  const recentOrders = orders.slice(0, 5); // Show latest 5 orders

  const getStatusIcon = (status) => {
    switch (status) {
      case "pending":
        return <Clock size={16} color="#F59E0B" />;
      case "confirmed":
      case "preparing":
        return <Package size={16} color="#3B82F6" />;
      case "ready":
      case "completed":
        return <CheckCircle size={16} color="#10B981" />;
      case "cancelled":
        return <XCircle size={16} color="#EF4444" />;
      default:
        return <Clock size={16} color={colors.textSecondary} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "confirmed":
      case "preparing":
        return "#3B82F6";
      case "ready":
      case "completed":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      default:
        return colors.textSecondary;
    }
  };

  const handleOrderPress = async (order) => {
    await Haptics.selectionAsync();
    setSelectedOrder(order);
  };

  if (isLoading) {
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 20,
            color: colors.text,
            marginBottom: 16,
          }}
        >
          Order History
        </Text>
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <Package size={48} color={colors.textSecondary} />
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 12,
            }}
          >
            No orders yet
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 20,
            color: colors.text,
            marginBottom: 16,
          }}
        >
          Order History
        </Text>

        {recentOrders.map((order) => (
          <TouchableOpacity
            key={order.id}
            onPress={() => handleOrderPress(order)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.separator,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: getStatusColor(order.status) + "20",
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              {order.order_type === "delivery" ? (
                <Truck size={20} color={getStatusColor(order.status)} />
              ) : (
                <ShoppingBag size={20} color={getStatusColor(order.status)} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 2,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: colors.text,
                  }}
                >
                  Order #{order.id}
                </Text>
                {getStatusIcon(order.status)}
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: getStatusColor(order.status),
                    textTransform: "capitalize",
                  }}
                >
                  {order.status}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                {new Date(order.created_at).toLocaleDateString()} • $
                {parseFloat(order.total_amount).toFixed(2)}
              </Text>
            </View>

            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}

        {orders.length > 5 && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: 12,
            }}
          >
            Showing {recentOrders.length} of {orders.length} orders
          </Text>
        )}

        {/* View All Orders Button */}
        <TouchableOpacity
          onPress={async () => {
            await Haptics.selectionAsync();
            router.push("/order-history");
          }}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginTop: 16,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: "white",
            }}
          >
            View All Orders
          </Text>
        </TouchableOpacity>
      </View>

      <OrderDetailModal
        order={selectedOrder}
        visible={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        colors={colors}
      />
    </>
  );
}
