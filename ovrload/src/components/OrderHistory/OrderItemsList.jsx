import React from "react";
import { View, Text } from "react-native";
import { OrderItemCard } from "./OrderItemCard";

export function OrderItemsList({ items, colors }) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 14,
          color: colors.text,
          marginBottom: 8,
        }}
      >
        Items ({items.length})
      </Text>
      {items.map((item, index) => (
        <OrderItemCard key={index} item={item} colors={colors} />
      ))}
    </View>
  );
}
