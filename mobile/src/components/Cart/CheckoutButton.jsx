import React from "react";
import { View, Text, Pressable } from "react-native";

export function CheckoutButton({ colors, insets, subtotal, onCheckout }) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: insets.bottom + 16,
        left: 0,
        right: 0,
        backgroundColor: colors.primary,
        borderRadius: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 15,
        height: 48,
      }}
    >
      <Pressable
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
        onPress={onCheckout}
      >
        <View
          style={{
            flex: 1,
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
            borderRightWidth: 1,
            borderRightColor: "rgba(255, 255, 255, 0.15)",
          }}
        >
          <Text
            style={{
              fontFamily: "PlayfairDisplay_400Regular",
              fontSize: 15,
              color: "white",
              textAlign: "center",
            }}
          >
            ${subtotal.toFixed(2)}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              color: "white",
              textAlign: "center",
            }}
          >
            Checkout
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
