import React from "react";
import { View, Text } from "react-native";

export function CartSummary({ colors, subtotal }) {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 10,
          padding: 16,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.text,
            }}
          >
            Subtotal
          </Text>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              color: colors.text,
            }}
          >
            ${subtotal.toFixed(2)}
          </Text>
        </View>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.separator,
            paddingTop: 10,
            marginTop: 10,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: "PlayfairDisplay_400Regular",
                fontSize: 15,
                color: colors.text,
              }}
            >
              Total
            </Text>
            <Text
              style={{
                fontFamily: "PlayfairDisplay_400Regular",
                fontSize: 15,
                color: colors.primary,
              }}
            >
              ${subtotal.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
