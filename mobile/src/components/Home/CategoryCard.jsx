import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { getImageSource } from "@/utils/apiFetch";

export function CategoryCard({ category, colors, onPress }) {
  const handlePress = async () => {
    await Haptics.selectionAsync();
    onPress(category);
  };

  const hasImage = !!category.image_url;
  const imageSource = getImageSource(category.image_url);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        marginBottom: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Category Image */}
      {hasImage ? (
        <View style={{ position: "relative", width: "100%", height: 200 }}>
          <Image
            source={imageSource}
            style={{
              width: "100%",
              height: 200,
            }}
            contentFit="cover"
          />
          {/* Text positioned towards the bottom */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 16,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Arboria_500Medium",
                fontSize: 13,
                color: "#FFFFFF",
                textShadowColor: "rgba(0, 0, 0, 0.8)",
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 10,
                textTransform: "uppercase",
              }}
            >
              {category.name}
            </Text>
          </View>
        </View>
      ) : (
        <View
          style={{
            width: "100%",
            height: 200,
            backgroundColor: colors.separator,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: colors.textSecondary,
            }}
          >
            No Image
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
