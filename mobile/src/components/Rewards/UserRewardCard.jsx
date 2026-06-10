import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

export function UserRewardCard({ userReward, colors }) {
  const router = useRouter();
  const expiresAt = userReward.expires_at
    ? new Date(userReward.expires_at)
    : null;
  const expiresText = expiresAt
    ? `Expires ${expiresAt.toLocaleDateString()}`
    : "";

  return (
    <TouchableOpacity
      key={userReward.id}
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        marginBottom: 16,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
      onPress={async () => {
        await Haptics.selectionAsync();
        Alert.alert(
          "Use Reward",
          "We'll attach this reward to your next order.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Go to Checkout",
              onPress: () =>
                router.push(`/checkout?applyUserRewardId=${userReward.id}`),
            },
          ],
        );
      }}
    >
      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 18,
              color: colors.text,
              flex: 1,
              marginRight: 8,
            }}
          >
            {userReward.title}
          </Text>
          <View
            style={{
              backgroundColor: colors.primaryMuted,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: colors.primary,
              }}
            >
              {userReward.source === "welcome" ? "Welcome" : "Perk"}
            </Text>
          </View>
        </View>

        {userReward.description ? (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: 10,
            }}
          >
            {userReward.description}
          </Text>
        ) : null}

        {!!expiresText && (
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              color: colors.textMuted,
              marginBottom: 10,
            }}
          >
            {expiresText}
          </Text>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: colors.success,
            }}
          >
            Use at checkout
          </Text>
          <ChevronRight size={20} color={colors.textSecondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
