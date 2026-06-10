import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import * as Haptics from "expo-haptics";

export function RewardSection({
  isAuthenticated,
  selectedReward,
  selectedUserReward,
  combinedRewardOptions,
  setShowRewardPicker,
  setSelectedReward,
  setSelectedUserReward,
  colors,
}) {
  if (!isAuthenticated) return null;

  const selectedOptionLabel = selectedUserReward
    ? `${selectedUserReward.title} (Perk)`
    : selectedReward
      ? `${selectedReward.title} (${selectedReward.points_cost} pts)`
      : "None";

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 20,
          color: colors.text,
          marginBottom: 12,
        }}
      >
        Apply Reward
      </Text>

      <TouchableOpacity
        onPress={async () => {
          await Haptics.selectionAsync();
          if (combinedRewardOptions.length === 0) {
            Alert.alert(
              "No Rewards Available",
              "You don't have any rewards you can use right now.",
            );
            return;
          }
          setShowRewardPicker(true);
        }}
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.separator,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 14,
            color: colors.textSecondary,
            marginBottom: 6,
          }}
        >
          Selected
        </Text>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
            color: colors.text,
          }}
        >
          {selectedOptionLabel}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: 8,
          }}
        >
          You can apply one reward per order. Points rewards affect totals. Tier
          perks are attached for staff to honor.
        </Text>
      </TouchableOpacity>

      {(selectedReward || selectedUserReward) && (
        <TouchableOpacity
          onPress={async () => {
            await Haptics.selectionAsync();
            setSelectedReward(null);
            setSelectedUserReward(null);
          }}
          style={{ marginTop: 12, alignSelf: "flex-start" }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: colors.error,
            }}
          >
            Remove reward
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
