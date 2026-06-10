import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";

export function AddToCartButton({
  totalPrice,
  canAddToCart,
  onPress,
  colors,
  actionLabel,
  isSaving = false,
  isEditMode = false,
}) {
  // Disable button if:
  // 1. Product is not available, OR
  // 2. Currently saving (prevents double-taps)
  const isDisabled = !canAddToCart || isSaving;

  const label = canAddToCart ? actionLabel || "Add to cart" : "Unavailable";

  // Show "Saving..." when in edit mode and saving
  const displayLabel = isSaving && isEditMode ? "Saving..." : label;

  return (
    <View
      style={{
        height: 48,
        backgroundColor: isDisabled ? colors.textSecondary : colors.primary,
        borderRadius: 24,
        marginTop: 32,
        marginHorizontal: 15,
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      <Pressable
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
        }}
        onPress={onPress}
        disabled={isDisabled}
      >
        <View
          style={{
            flex: 1,
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
            borderRightWidth: 1,
            borderRightColor: "rgba(255, 255, 255, 0.15)",
          }}
        >
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 14,
              color: "white",
            }}
          >
            ${totalPrice.toFixed(2)}
          </Text>
        </View>
        <View
          style={{
            flex: 1,
            height: "100%",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          {isSaving && <ActivityIndicator size="small" color="white" />}
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
              color: "white",
            }}
          >
            {displayLabel}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
