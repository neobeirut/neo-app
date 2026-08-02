import React from "react";
import { View, Text } from "react-native";

export function PointsCard({
  currentPoints,
  totalSpent,
  membershipTier,
  tierBadgeColor,
  tierProgress,
  nextTierLabel,
  tierProgressPct,
  tierRemaining,
  colors,
  formatMoney,
}) {
  const nextThreshold = tierProgress?.nextThreshold || 0;

  return (
    <View
      style={{
        backgroundColor: colors.primary,
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <View>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.8)",
              marginBottom: 4,
            }}
          >
            Your Points
          </Text>
          <Text
            style={{
              fontFamily: "PlayfairDisplay_800ExtraBold",
              fontSize: 48,
              color: "white",
              lineHeight: 52,
            }}
          >
            {currentPoints}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.8)",
              marginTop: 4,
            }}
          >
            Lifetime spend: {formatMoney(totalSpent)}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: tierBadgeColor.bg,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: tierBadgeColor.fg,
              textAlign: "center",
            }}
          >
            {membershipTier}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.9)",
              textAlign: "center",
            }}
          >
            Member
          </Text>
        </View>
      </View>

      {/* Tier progress (based on points) */}
      <View style={{ marginBottom: 10 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.8)",
            }}
          >
            {nextTierLabel
              ? `Progress to ${nextTierLabel}`
              : "Top tier reached"}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: "white",
            }}
          >
            {nextTierLabel ? `${currentPoints} / ${nextThreshold} pts` : "100%"}
          </Text>
        </View>
        <View
          style={{
            height: 6,
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${Math.min(Math.max(tierProgressPct, 0), 100)}%`,
              backgroundColor: colors.secondary,
              borderRadius: 3,
            }}
          />
        </View>
      </View>

      {nextTierLabel ? (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: "rgba(255, 255, 255, 0.8)",
            textAlign: "center",
          }}
        >
          {tierRemaining} pts until {nextTierLabel}
        </Text>
      ) : (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: "rgba(255, 255, 255, 0.8)",
            textAlign: "center",
          }}
        >
          You're at our top tier.
        </Text>
      )}
    </View>
  );
}
