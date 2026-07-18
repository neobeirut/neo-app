import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export function renderRewardOption(option, selectedValue, onSelect, colors) {
  const isSelected =
    selectedValue &&
    String(selectedValue.kind) === String(option.kind) &&
    String(selectedValue.id) === String(option.id);

  const isPerk = option.kind === "user";

  let rightText = "";
  let subText = "";

  if (isPerk) {
    rightText = option.source === "welcome" ? "Welcome" : "Perk";
    const expiresAt = option.expires_at ? new Date(option.expires_at) : null;
    subText = expiresAt ? `Expires ${expiresAt.toLocaleDateString()}` : "";
  } else {
    rightText = `${option.points_cost} pts`;
    const discountValue = Math.max(
      Number.parseFloat(option.discount_amount || 0) || 0,
      0,
    );
    const hasDiscount = discountValue > 0;
    const freeDelivery = option.free_delivery === true;

    if (hasDiscount && freeDelivery) {
      subText = `$${discountValue.toFixed(2)} off + Free Delivery`;
    } else if (hasDiscount) {
      subText = `$${discountValue.toFixed(2)} off`;
    } else if (freeDelivery) {
      subText = "Free Delivery";
    } else {
      subText = "Free item (attached to your order)";
    }
  }

  return (
    <TouchableOpacity
      key={`${option.kind}-${option.id}`}
      onPress={() => {
        onSelect(option);
      }}
      style={{
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
        backgroundColor: isSelected ? colors.surface : "transparent",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 16,
            color: colors.text,
            flex: 1,
            marginRight: 12,
          }}
        >
          {option.title}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 14,
            color: isPerk ? colors.primary : colors.primary,
          }}
        >
          {rightText}
        </Text>
      </View>
      {!!subText && (
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: 6,
          }}
        >
          {subText}
        </Text>
      )}
    </TouchableOpacity>
  );
}
