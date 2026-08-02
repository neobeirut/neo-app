import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export function PlaceOrderButton({
  insets,
  colors,
  total,
  isPending,
  onPlaceOrder,
}) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.background,
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: insets.bottom + 16,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
      }}
    >
      <TouchableOpacity
        style={{
          backgroundColor: colors.primary,
          borderRadius: 24,
          paddingVertical: 16,
          alignItems: "center",
          opacity: isPending ? 0.7 : 1,
        }}
        onPress={onPlaceOrder}
        disabled={isPending}
      >
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
            color: "white",
          }}
        >
          {isPending
            ? "Placing Order..."
            : `Place Order - $${total.toFixed(2)}`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
