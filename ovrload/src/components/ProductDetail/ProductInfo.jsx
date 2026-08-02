import React from "react";
import { View, Text } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

export function ProductInfo({
  product,
  reviewsData,
  colors,
  isAvailable,
  totalPrice,
}) {
  return (
    <View
      style={{
        paddingHorizontal: 24,
        marginBottom: 28,
        opacity: isAvailable ? 1 : 0.6,
      }}
    >
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 28,
          color: isAvailable ? colors.text : colors.textSecondary,
          lineHeight: 34,
        }}
      >
        {product.name}
      </Text>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 16,
          color: colors.textSecondary,
          lineHeight: 22,
          marginBottom: 12,
        }}
      >
        {product.description}
      </Text>

      {/* Price Display - show total price with addons/customizations */}
      <View style={{ marginBottom: 16 }}>
        {product.original_price &&
        parseFloat(product.original_price) > parseFloat(product.price) ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                color: colors.textSecondary,
                textDecorationLine: "line-through",
              }}
            >
              ${product.original_price}
            </Text>
            <Text
              style={{
                fontFamily: "PlayfairDisplay_500Medium",
                fontSize: 18,
                color: isAvailable ? "#ef4444" : colors.textSecondary,
              }}
            >
              ${totalPrice.toFixed(2)}
            </Text>
            {isAvailable && (
              <View
                style={{
                  backgroundColor: "#ef4444",
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 10,
                    color: "white",
                  }}
                >
                  {Math.round(
                    ((parseFloat(product.original_price) -
                      parseFloat(product.price)) /
                      parseFloat(product.original_price)) *
                      100,
                  )}
                  % OFF
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 18,
              color: isAvailable ? colors.primary : colors.textSecondary,
            }}
          >
            ${totalPrice.toFixed(2)}
          </Text>
        )}
      </View>

      {/* Rating Display */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="star" size={14} color={colors.primary} />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 14,
              color: colors.text,
            }}
          >
            {parseFloat(reviewsData?.average_rating || 0).toFixed(1)}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          ({reviewsData?.total_reviews || 0} reviews)
        </Text>
      </View>
    </View>
  );
}
