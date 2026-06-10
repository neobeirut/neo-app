import React from "react";
import { View, Text } from "react-native";
import { ShoppingBag, Gift, Star } from "lucide-react-native";

export function HowItWorksCard({ colors }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 20,
          color: colors.text,
          marginBottom: 16,
        }}
      >
        How Rewards Work
      </Text>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <ShoppingBag size={20} color={colors.primary} />
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.text,
              flex: 1,
            }}
          >
            Earn 1 point for every $1 spent
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Gift size={20} color={colors.primary} />
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.text,
              flex: 1,
            }}
          >
            Redeem points for free items
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Star size={20} color={colors.primary} />
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.text,
              flex: 1,
            }}
          >
            Earn bonus points on special days
          </Text>
        </View>
      </View>
    </View>
  );
}
