import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export function EmptyCart({ colors, onBrowseMenu }) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 80,
      }}
    >
      <Ionicons name="cart-outline" size={64} color={colors.textSecondary} />
      <Text
        style={{
          fontFamily: "PlayfairDisplay_400Regular",
          fontSize: 20,
          color: colors.text,
          marginTop: 16,
        }}
      >
        Your cart is empty
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 14,
          color: colors.textSecondary,
          marginTop: 6,
          textAlign: "center",
        }}
      >
        Add some delicious items to get started
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: colors.primary,
          borderRadius: 20,
          paddingHorizontal: 24,
          paddingVertical: 12,
          marginTop: 24,
        }}
        onPress={onBrowseMenu}
      >
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 13,
            color: "white",
          }}
        >
          Browse Menu
        </Text>
      </TouchableOpacity>
    </View>
  );
}
