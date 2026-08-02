import React from "react";
import { View, Text } from "react-native";
import { Package } from "lucide-react-native";

export function EmptyState({ selectedStatus, colors }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 60 }}>
      <Package size={64} color={colors.textSecondary} />
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 18,
          color: colors.text,
          marginTop: 16,
        }}
      >
        No orders found
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 14,
          color: colors.textSecondary,
          marginTop: 8,
        }}
      >
        {selectedStatus === "all"
          ? "No orders yet"
          : `No ${selectedStatus} orders`}
      </Text>
    </View>
  );
}
