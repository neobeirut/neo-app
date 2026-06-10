import React from "react";
import { TouchableOpacity, Text } from "react-native";

export function OrderActions({ order, colors, onUpdateStatus }) {
  // Lock should block editing order content, not status transitions.
  // Status transitions should still work until the order is completed/cancelled.
  const isStatusLocked = ["completed", "cancelled"].includes(order.status);

  return (
    <TouchableOpacity
      onPress={() => onUpdateStatus(order.id, order.status)}
      disabled={isStatusLocked}
      style={{
        backgroundColor: isStatusLocked ? colors.surface : colors.primary,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 24,
        alignItems: "center",
        opacity: isStatusLocked ? 0.5 : 1,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 14,
          color: isStatusLocked ? colors.textSecondary : "white",
        }}
      >
        {isStatusLocked ? "🔒 Final" : "Update Status"}
      </Text>
    </TouchableOpacity>
  );
}
