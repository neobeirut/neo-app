import React from "react";
import { View, Text } from "react-native";

export function UserRewardHistoryItem({ userReward, colors }) {
  const status = String(userReward.status || "");
  const date =
    userReward.redeemed_at || userReward.expires_at || userReward.issued_at;
  const dateText = date ? new Date(date).toLocaleDateString() : "";

  const badge =
    status === "redeemed"
      ? { bg: "#DCFCE7", fg: "#166534", label: "Redeemed" }
      : status === "expired"
        ? { bg: "#FEE2E2", fg: "#991B1B", label: "Expired" }
        : status === "reserved"
          ? { bg: "#E0F2FE", fg: "#075985", label: "In use" }
          : { bg: colors.surface, fg: colors.textSecondary, label: status };

  return (
    <View
      key={`${userReward.id}-${status}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: colors.card,
        borderRadius: 12,
        marginBottom: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 15,
            color: colors.text,
            marginBottom: 4,
          }}
        >
          {userReward.title}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: colors.textSecondary,
          }}
        >
          {dateText}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: badge.bg,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 12,
            color: badge.fg,
          }}
        >
          {badge.label}
        </Text>
      </View>
    </View>
  );
}
