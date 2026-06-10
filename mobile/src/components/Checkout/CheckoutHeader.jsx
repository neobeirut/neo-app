import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export function CheckoutHeader({ insets, colors, onGoBack }) {
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingVertical: 16,
        }}
      >
        <TouchableOpacity
          style={{
            width: 44,
            height: 44,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
          onPress={onGoBack}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 24,
            color: colors.text,
          }}
        >
          Checkout
        </Text>
      </View>
    </View>
  );
}
