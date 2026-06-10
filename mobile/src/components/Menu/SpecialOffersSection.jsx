import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Plus } from "lucide-react-native";
import { calculateDiscountedPrice } from "@/utils/menuHelpers";

export function SpecialOffersSection({
  discountedProducts,
  colors,
  onProductPress,
  onAddToCart,
  isAddingToCart,
  cartData,
  branchDiscount = 0,
}) {
  if (discountedProducts.length === 0) {
    return null;
  }

  return (
    <View style={{ marginBottom: 32 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 24,
          color: colors.text,
          marginBottom: 16,
        }}
      >
        🔥 Special Offers
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingRight: 24, paddingLeft: 4 }}
      >
        {discountedProducts.map((product) => {
          // Check if there's a branch discount
          const branchDiscountedPrice = calculateDiscountedPrice(
            product.price,
            branchDiscount,
          );
          const finalPrice = branchDiscountedPrice || product.price;
          const originalPrice = product.original_price || product.price;

          const savings = (
            parseFloat(originalPrice) - parseFloat(finalPrice)
          ).toFixed(2);
          const percentSavings = Math.round(
            ((parseFloat(originalPrice) - parseFloat(finalPrice)) /
              parseFloat(originalPrice)) *
              100,
          );

          // Find quantity in cart for this product
          const cartItem = cartData?.items?.find(
            (item) => item.product_id === product.id,
          );
          const quantityInCart = cartItem?.quantity || 0;

          return (
            <View
              key={`special-${product.id}`}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                overflow: "hidden",
                width: 200,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
                borderWidth: 2,
                borderColor: "#ef4444",
              }}
            >
              <TouchableOpacity onPress={() => onProductPress(product)}>
                <View style={{ position: "relative" }}>
                  <Image
                    source={{
                      uri:
                        product.image_url ||
                        "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop",
                    }}
                    style={{
                      width: "100%",
                      height: 120,
                    }}
                    contentFit="cover"
                    transition={200}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      backgroundColor: "#ef4444",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 12,
                        color: "white",
                      }}
                    >
                      {percentSavings}% OFF
                    </Text>
                  </View>
                </View>
                <View style={{ padding: 12 }}>
                  <Text
                    style={{
                      fontFamily: "PlayfairDisplay_500Medium",
                      fontSize: 16,
                      color: colors.text,
                      marginBottom: 4,
                    }}
                    numberOfLines={1}
                  >
                    {product.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 12,
                        color: colors.textSecondary,
                        textDecorationLine: "line-through",
                      }}
                    >
                      ${parseFloat(originalPrice).toFixed(2)}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 16,
                        color: "#ef4444",
                      }}
                    >
                      ${parseFloat(finalPrice).toFixed(2)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 11,
                      color: "#22c55e",
                      marginBottom: 8,
                    }}
                  >
                    Save ${savings}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  marginHorizontal: 12,
                  marginBottom: 12,
                  borderRadius: 20,
                  paddingVertical: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
                onPress={(e) => {
                  e.stopPropagation();
                  onAddToCart(product);
                }}
                disabled={isAddingToCart}
              >
                <Plus size={16} color="white" />
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 14,
                    color: "white",
                  }}
                >
                  {quantityInCart > 0
                    ? `Add (${quantityInCart})`
                    : "Add to Cart"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
