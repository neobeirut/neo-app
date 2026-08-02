import React from "react";
import { TouchableOpacity, Text, View, Platform } from "react-native";
import * as Haptics from "expo-haptics";

export function CustomizationCard({
  customization,
  colors,
  isAvailable,
  canAddToCart,
  isSelected,
  onToggle,
  isRemoval = false,
}) {
  const handlePress = async () => {
    if (!canAddToCart) return;

    if (Platform.OS !== "web") {
      try {
        await Haptics.selectionAsync();
      } catch (e) {
        // ignore haptics errors
      }
    }

    onToggle();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!canAddToCart}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: isSelected ? colors.primary + "15" : colors.surface,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isSelected ? colors.primary : colors.separator,
        opacity: canAddToCart ? 1 : 0.5,
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginRight: 12,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 12,
            color: colors.text,
          }}
        >
          {isRemoval
            ? `No ${customization.ingredient}`
            : customization.ingredient}
        </Text>
        {!isRemoval && parseFloat(customization.price || 0) > 0 && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: colors.textSecondary,
            }}
          >
            +${parseFloat(customization.price || 0).toFixed(2)}
          </Text>
        )}
      </View>

      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: isSelected ? colors.primary : colors.separator,
          backgroundColor: isSelected ? colors.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isSelected && (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: "#FFFFFF",
            }}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}
