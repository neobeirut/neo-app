import React from "react";
import { View, Text } from "react-native";

export function TierBenefitsCard({ tierBenefits, colors }) {
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
        Your Tier Benefits
      </Text>
      <View style={{ gap: 12 }}>
        {tierBenefits.map((b, idx) => (
          <View
            key={`${idx}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <b.icon size={20} color={colors.primary} />
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 16,
                color: colors.text,
                flex: 1,
              }}
            >
              {b.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
