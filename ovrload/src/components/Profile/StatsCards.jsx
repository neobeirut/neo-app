import React from "react";
import { View, Text } from "react-native";
import { Star, Trophy } from "lucide-react-native";

export function StatsCards({ user, colors }) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        marginBottom: 32,
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          alignItems: "center",
        }}
      >
        <Star size={24} color={colors.primary} style={{ marginBottom: 8 }} />
        <Text
          style={{
            fontFamily: "PlayfairDisplay_800ExtraBold",
            fontSize: 32,
            color: colors.text,
            marginBottom: 4,
          }}
        >
          {user?.points || 0}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          Points
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          alignItems: "center",
        }}
      >
        <Trophy
          size={24}
          color={colors.secondary}
          style={{ marginBottom: 8 }}
        />
        <Text
          style={{
            fontFamily: "PlayfairDisplay_800ExtraBold",
            fontSize: 20,
            color: colors.text,
            marginBottom: 4,
          }}
        >
          {user?.membership_tier || "Bronze"}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          Member
        </Text>
      </View>
    </View>
  );
}
