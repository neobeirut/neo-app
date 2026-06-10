import React from "react";
import { View, Text } from "react-native";

export function DeliveryInfoBanner({
  orderType,
  deliveryInfoText,
  isDeliverableForSelectedBranch,
  colors,
}) {
  if (orderType !== "delivery" || !deliveryInfoText) {
    return null;
  }

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor:
            isDeliverableForSelectedBranch === false
              ? colors.error
              : colors.separator,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 13,
            color:
              isDeliverableForSelectedBranch === false
                ? colors.error
                : colors.textSecondary,
            lineHeight: 18,
          }}
        >
          {deliveryInfoText}
        </Text>
      </View>
    </View>
  );
}
