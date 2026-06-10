import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Image } from "expo-image";
import { ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

export function RewardCard({ reward, currentPoints, colors }) {
  const router = useRouter();

  const discount = Math.max(
    Number.parseFloat(reward.discount_amount || 0) || 0,
    0,
  );
  const freeDelivery = reward.free_delivery === true;
  const hasBenefit = discount > 0 || freeDelivery;

  let benefitText = "";
  if (discount > 0 && freeDelivery)
    benefitText = `$${discount.toFixed(2)} off + Free Delivery`;
  else if (discount > 0) benefitText = `$${discount.toFixed(2)} off`;
  else if (freeDelivery) benefitText = "Free Delivery";
  else benefitText = "Free item (attached to your order)";

  const canAfford = currentPoints >= reward.points_cost;

  const handleUseRewardAtCheckout = async () => {
    if (!canAfford) {
      Alert.alert(
        "Not Enough Points",
        `You need ${reward.points_cost - currentPoints} more points to use this reward.`,
        [{ text: "OK" }],
      );
      return;
    }

    await Haptics.selectionAsync();

    const body = hasBenefit
      ? "We'll apply this reward when you place your order. Points are deducted at checkout, and you earn points when your order is completed."
      : "We'll attach this reward to your order so staff can honor it. Points are deducted at checkout.";

    Alert.alert("Use Reward", body, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Go to Checkout",
        onPress: () => router.push(`/checkout?applyRewardId=${reward.id}`),
      },
    ]);
  };

  const statusText = canAfford ? "Use at checkout" : "Need more points";

  return (
    <TouchableOpacity
      key={reward.id}
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
        opacity: canAfford ? 1 : 0.6,
      }}
      onPress={handleUseRewardAtCheckout}
      accessibilityRole="button"
      accessibilityLabel={reward.title}
    >
      {reward.image_url && (
        <Image
          source={{ uri: reward.image_url }}
          style={{
            width: "100%",
            height: 120,
          }}
          contentFit="cover"
          transition={200}
        />
      )}
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
            {reward.title}
          </Text>
          <View
            style={{
              backgroundColor: colors.primaryMuted,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: colors.primary,
              }}
            >
              {reward.points_cost} pts
            </Text>
          </View>
        </View>

        {!!benefitText && (
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: hasBenefit ? colors.success : colors.textSecondary,
              marginBottom: 8,
            }}
          >
            {benefitText}
          </Text>
        )}

        {reward.description && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.textSecondary,
              marginBottom: 12,
              lineHeight: 20,
            }}
          >
            {reward.description}
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
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: canAfford ? colors.success : colors.textMuted,
            }}
          >
            {statusText}
          </Text>
          <ChevronRight size={20} color={colors.textSecondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
