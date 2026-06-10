import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Star, Plus } from "lucide-react-native";
import { calculateDiscountedPrice } from "@/utils/homeHelpers";

export function FeaturedSection({
  featuredProducts,
  colors,
  handleProductPress,
  handleAddToCart,
  addToCartMutation,
  cartData,
  branchDiscount = 0,
}) {
  if (featuredProducts.length === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize: 18,
          color: colors.text,
          marginBottom: 12,
        }}
      >
        ⭐ Featured Products
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 24, paddingLeft: 4 }}
      >
        {featuredProducts.map((product) => {
          // Calculate prices
          const branchDiscountedPrice = calculateDiscountedPrice(
            product.price,
            branchDiscount,
          );
          const finalPrice = branchDiscountedPrice || product.price;
          const originalPrice = product.original_price || product.price;
          const hasDiscount =
            parseFloat(originalPrice) > parseFloat(finalPrice);

          // Find quantity in cart for this product
          const cartItem = cartData?.items?.find(
            (item) => item.product_id === product.id,
          );
          const quantityInCart = cartItem?.quantity || 0;

          return (
            <View
              key={`featured-${product.id}`}
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                overflow: "hidden",
                width: 160,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
                elevation: 2,
                borderWidth: 1.5,
                borderColor: "#fbbf24",
              }}
            >
              <TouchableOpacity onPress={() => handleProductPress(product)}>
                <View style={{ position: "relative" }}>
                  <Image
                    source={{
                      uri:
                        product.image_url ||
                        "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop",
                    }}
                    style={{
                      width: "100%",
                      height: 100,
                    }}
                    contentFit="cover"
                    transition={200}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 6,
                      backgroundColor: "#fbbf24",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Star size={10} color="white" fill="white" />
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 10,
                        color: "white",
                      }}
                    >
                      FEATURED
                    </Text>
                  </View>
                </View>
                <View style={{ padding: 10 }}>
                  <Text
                    style={{
                      fontFamily: "PlayfairDisplay_500Medium",
                      fontSize: 13,
                      color: colors.text,
                      marginBottom: 3,
                    }}
                    numberOfLines={1}
                  >
                    {product.name}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    {hasDiscount && (
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 10,
                          color: colors.textSecondary,
                          textDecorationLine: "line-through",
                        }}
                      >
                        ${parseFloat(originalPrice).toFixed(2)}
                      </Text>
                    )}
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 13,
                        color: hasDiscount ? "#ef4444" : colors.primary,
                      }}
                    >
                      ${parseFloat(finalPrice).toFixed(2)}
                    </Text>
                  </View>
                  {product.rating > 0 && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        marginBottom: 6,
                      }}
                    >
                      <Star size={10} color={colors.primary} />
                      <Text
                        style={{
                          fontFamily: "Inter_400Regular",
                          fontSize: 10,
                          color: colors.textSecondary,
                        }}
                      >
                        {product.rating}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  marginHorizontal: 10,
                  marginBottom: 10,
                  borderRadius: 16,
                  paddingVertical: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddToCart(product);
                }}
                disabled={addToCartMutation.isPending}
              >
                <Plus size={14} color="white" />
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 11,
                    color: "white",
                  }}
                >
                  {quantityInCart > 0 ? `Add (${quantityInCart})` : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
