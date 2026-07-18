import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Plus } from "lucide-react-native";
import { calculateDiscountedPrice } from "@/utils/homeHelpers";

export function SpecialOffersSection({
  discountedProducts,
  colors,
  handleProductPress,
  handleAddToCart,
  addToCartMutation,
  cartData,
  branchDiscount = 0,
}) {
  if (discountedProducts.length === 0) return null;

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
        🔥 Special Offers
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 24, paddingLeft: 4 }}
      >
        {discountedProducts.map((product) => {
          // Check if there's a branch discount
          const branchDiscountedPrice = calculateDiscountedPrice(
            product.price,
            branchDiscount,
          );
          const finalPrice = branchDiscountedPrice || product.price;
          const originalPrice = product.original_price || product.price;

          const hasActualDiscount =
            parseFloat(originalPrice) > parseFloat(finalPrice);
          const savings = hasActualDiscount
            ? (parseFloat(originalPrice) - parseFloat(finalPrice)).toFixed(2)
            : null;
          const percentSavings = hasActualDiscount
            ? Math.round(
                ((parseFloat(originalPrice) - parseFloat(finalPrice)) /
                  parseFloat(originalPrice)) *
                  100,
              )
            : null;

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
                borderRadius: 12,
                overflow: "hidden",
                width: 160,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 3,
                elevation: 2,
                borderWidth: 1.5,
                borderColor: "#ef4444",
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
                  {percentSavings ? (
                    <View
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        backgroundColor: "#ef4444",
                        paddingHorizontal: 6,
                        paddingVertical: 3,
                        borderRadius: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 10,
                          color: "white",
                        }}
                      >
                        {percentSavings}% OFF
                      </Text>
                    </View>
                  ) : product.is_special ? (
                    <View
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        backgroundColor: "#ef4444",
                        paddingHorizontal: 6,
                        paddingVertical: 3,
                        borderRadius: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 10,
                          color: "white",
                        }}
                      >
                        SPECIAL
                      </Text>
                    </View>
                  ) : null}
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
                    {hasActualDiscount && (
                      <>
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
                        <Text
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 13,
                            color: "#ef4444",
                          }}
                        >
                          ${parseFloat(finalPrice).toFixed(2)}
                        </Text>
                      </>
                    )}
                    {!hasActualDiscount && (
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 13,
                          color: "#ef4444",
                        }}
                      >
                        ${parseFloat(finalPrice).toFixed(2)}
                      </Text>
                    )}
                  </View>
                  {savings && (
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 10,
                        color: "#22c55e",
                        marginBottom: 6,
                      }}
                    >
                      Save ${savings}
                    </Text>
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
