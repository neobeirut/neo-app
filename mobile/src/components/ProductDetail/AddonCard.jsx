import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getImageSource } from "@/utils/apiFetch";

export function AddonCard({
  addon,
  colors,
  canAddToCart,
  isSelected,
  onToggle,
  size = 140,
}) {
  const imageSource = getImageSource(
    addon.image_url,
    "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=400&h=400&fit=crop",
  );

  const imageSize = size;

  return (
    <View
      key={addon.id}
      style={{
        alignItems: "center",
        width: size,
        opacity: canAddToCart ? 1 : 0.5,
      }}
    >
      <View
        style={{
          width: imageSize,
          height: imageSize,
          backgroundColor: colors.cream,
          borderRadius: 12,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Image
          source={imageSource}
          style={{
            width: "100%",
            height: "100%",
          }}
          contentFit="cover"
          transition={200}
        />

        <TouchableOpacity
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: isSelected ? colors.text : colors.primary,
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
            opacity: canAddToCart ? 1 : 0.5,
          }}
          onPress={onToggle}
          disabled={!canAddToCart}
        >
          <Ionicons
            name={isSelected ? "checkmark" : "add"}
            size={18}
            color="white"
          />
        </TouchableOpacity>
      </View>

      <Text
        numberOfLines={2}
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 12,
          lineHeight: 16,
          color: canAddToCart ? colors.text : colors.textSecondary,
          marginTop: 8,
          textAlign: "center",
          minHeight: 32, // keeps price aligned even when names wrap
          paddingHorizontal: 4,
        }}
      >
        {addon.name}
      </Text>

      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          color: colors.textSecondary,
          marginTop: 2,
          textAlign: "center",
        }}
      >
        +${parseFloat(addon.price).toFixed(2)}
      </Text>
    </View>
  );
}
