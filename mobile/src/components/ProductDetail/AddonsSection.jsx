import React from "react";
import { View, Text } from "react-native";
import { CustomizationCard } from "./CustomizationCard";

export function AddonsSection({
  addons,
  colors,
  isAvailable,
  canAddToCart,
  selectedAddons,
  onToggleAddon,
}) {
  if (!addons || addons.length === 0) {
    return null;
  }

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 16,
          color: isAvailable ? colors.text : colors.textSecondary,
          marginBottom: 16,
        }}
      >
        Add-ons
      </Text>

      {addons.map((addon) => {
        // Reuse the same row UI as removals/customizations for a tighter layout.
        const customizationShape = {
          id: addon.id,
          ingredient: addon.name,
          price: addon.price,
        };

        return (
          <CustomizationCard
            key={addon.id}
            customization={customizationShape}
            colors={colors}
            isAvailable={isAvailable}
            canAddToCart={canAddToCart}
            isSelected={selectedAddons.includes(addon.id)}
            onToggle={() => onToggleAddon(addon.id)}
          />
        );
      })}
    </View>
  );
}
