import React from "react";
import { View, Text } from "react-native";
import { CustomizationCard } from "./CustomizationCard";

export function CustomizationsSection({
  customizations = [],
  colors,
  isAvailable,
  canAddToCart,
  selectedCustomizations,
  onToggleCustomization,
}) {
  if (!customizations || customizations.length === 0) {
    return null;
  }

  const addons = customizations.filter((c) => c.customization_type === "addon");
  const removals = customizations.filter(
    (c) => c.customization_type === "remove",
  );

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 16,
          color: "#1B5E20",
          marginBottom: 16,
        }}
      >
        Customize
      </Text>

      {/* Add-ons */}
      {addons.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 12,
              color: colors.text,
              marginBottom: 8,
            }}
          >
            Add-ons
          </Text>
          {addons.map((customization) => (
            <CustomizationCard
              key={customization.id}
              customization={customization}
              colors={colors}
              isAvailable={isAvailable}
              canAddToCart={canAddToCart}
              isSelected={selectedCustomizations.includes(customization.id)}
              onToggle={() => onToggleCustomization(customization.id)}
            />
          ))}
        </View>
      )}

      {/* Removals */}
      {removals.length > 0 && (
        <View>
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 12,
              color: colors.text,
              marginBottom: 8,
            }}
          >
            Remove Items
          </Text>
          {removals.map((customization) => (
            <CustomizationCard
              key={customization.id}
              customization={customization}
              colors={colors}
              isAvailable={isAvailable}
              canAddToCart={canAddToCart}
              isSelected={selectedCustomizations.includes(customization.id)}
              onToggle={() => onToggleCustomization(customization.id)}
              isRemoval={true}
            />
          ))}
        </View>
      )}
    </View>
  );
}
