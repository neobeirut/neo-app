import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ChevronDown, Truck, ShoppingBag } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { getStatusColor } from "@/utils/orderHistoryHelpers";
import { OrderStatusIcon } from "./OrderStatusIcon";
import { OrderDetailsSection } from "./OrderDetailsSection";
import { OrderItemsList } from "./OrderItemsList";
import { ReorderButton } from "./ReorderButton";

export function OrderCard({
  order,
  colors,
  isExpanded,
  onToggleExpand,
  onReorder,
  isReordering,
}) {
  const items = order.items || [];
  const statusColor = getStatusColor(order.status);

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
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          onToggleExpand(order.id);
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
            backgroundColor: statusColor + "20",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {order.order_type === "delivery" ? (
            <Truck size={20} color={statusColor} />
          ) : (
            <ShoppingBag size={20} color={statusColor} />
          )}
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
            <OrderStatusIcon status={order.status} />
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: statusColor,
                textTransform: "capitalize",
              }}
            >
              {order.status.replace("_", " ")}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            ${parseFloat(order.total_amount).toFixed(2)} • {items.length} item
            {items.length !== 1 ? "s" : ""}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: colors.textSecondary,
              marginTop: 2,
            }}
          >
            {new Date(order.created_at).toLocaleDateString()}
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

      {isExpanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.separator,
            padding: 16,
          }}
        >
          <OrderDetailsSection order={order} colors={colors} />
          <OrderItemsList items={items} colors={colors} />
          <ReorderButton
            colors={colors}
            onPress={() => onReorder(order)}
            isLoading={isReordering}
          />
        </View>
      )}
    </View>
  );
}
