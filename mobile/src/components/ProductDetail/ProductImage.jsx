import React from "react";
import { View, Text, Dimensions } from "react-native";
import { Image } from "expo-image";
import { AlertCircle } from "lucide-react-native";
import { getImageSource } from "@/utils/apiFetch";

const { width: screenWidth } = Dimensions.get("window");

export function ProductImage({
  product,
  colors,
  isAvailable,
  getStatusColor,
  imageContainerRef,
}) {
  const imageSource = getImageSource(
    product.image_url,
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop",
  );

  return (
    <View
      style={{
        alignItems: "center",
        paddingHorizontal: 24,
        marginBottom: 32,
        opacity: isAvailable ? 1 : 0.6,
      }}
    >
      <View
        ref={imageContainerRef}
        style={{
          width: screenWidth * 0.82,
          height: screenWidth * 0.6,
          position: "relative",
        }}
      >
        <Image
          source={imageSource}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 12,
          }}
          contentFit="cover"
          transition={200}
        />
        {/* Status Badge */}
        {!isAvailable && (
          <View
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              backgroundColor: getStatusColor(product.status),
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} color="white" />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 11,
                color: "white",
                textAlign: "center",
              }}
            >
              {product.status}
            </Text>
          </View>
        )}
        <View
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            backgroundColor: colors.primaryMuted,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 11,
              color: colors.text,
            }}
          >
            {product.prep_time || "Fresh Made"}
          </Text>
        </View>
      </View>
    </View>
  );
}
