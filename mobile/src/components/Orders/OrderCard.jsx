import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  ChevronDown,
  Truck,
  ShoppingBag,
  CheckCircle,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { OrderStatusIcon } from "./OrderStatusIcon";
import { getStatusColor } from "@/utils/orderHelpers";

export function OrderCard({ order, isExpanded, onToggle, colors, children }) {
  const isDelivery = order.order_type === "delivery";

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        marginBottom: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.separator,
      }}
    >
      {/* Order Header */}
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          onToggle(order.id);
        }}
        style={{
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: getStatusColor(order.status) + "20",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <OrderStatusIcon status={order.status} colors={colors} />
        </View>

        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: colors.text,
              }}
            >
              Order #{order.id}
            </Text>
            {isDelivery ? (
              <Truck size={16} color={colors.textSecondary} />
            ) : (
              <ShoppingBag size={16} color={colors.textSecondary} />
            )}
          </View>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            ${parseFloat(order.total_amount).toFixed(2)} •{" "}
            {order.customer_name || "Guest"}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            {new Date(order.created_at).toLocaleString()}
          </Text>
        </View>

        <ChevronDown
          size={24}
          color={colors.textSecondary}
          style={{
            transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
          }}
        />
      </TouchableOpacity>

      {/* Expanded Details */}
      {isExpanded && children}
    </View>
  );
}
