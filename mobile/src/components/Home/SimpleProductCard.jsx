import React from "react";
import { TouchableOpacity, Text, View } from "react-native";
import { Image } from "expo-image";
import { Star, AlertCircle, Heart } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { getImageSource } from "@/utils/apiFetch";

export function SimpleProductCard({
  product,
  colors,
  onPress,
  branchDiscount,
  onAddToCart,
  isAddingToCart,
  cartData,
  isFavorite,
  onToggleFavorite,
  hasCustomizations,
}) {
  const handlePress = async () => {
    await Haptics.selectionAsync();
    onPress(product);
  };

  const isAvailable = product.status === "Available";
  const canAddToCart = product.status === "Available";

  const finalPrice =
    branchDiscount > 0
      ? (product.price * (1 - branchDiscount / 100)).toFixed(2)
      : product.price;

  const hasDiscount =
    branchDiscount > 0 ||
    (product.original_price && product.original_price > product.price);

  // Find quantity in cart for this product - fix cart data structure
  const cartItem = cartData?.cart_items?.find(
    (item) => item.product_id === product.id,
  );
  const quantityInCart = cartItem?.quantity || 0;

  // Get display status text
  const getStatusText = (status) => {
    if (status === "Unavailable Until Further Notice") {
      return "On Hold";
    }
    return status;
  };

  const handleFavoritePress = async (e) => {
    e.stopPropagation();
    await Haptics.selectionAsync();
    onToggleFavorite?.();
  };

  const hasImage = !!product.image_url;
  const imageSource = getImageSource(product.image_url);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={1}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginBottom: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Full Width Image */}
      {hasImage ? (
        <Image
          source={imageSource}
          style={{
            width: "100%",
            height: 220,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: 220,
            backgroundColor: colors.separator,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 11,
              color: colors.textSecondary,
            }}
          >
            No Image
          </Text>
        </View>
      )}

      {/* Product Details */}
      <View style={{ padding: 12 }}>
        {/* Product Name */}
        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 14,
            color: "#1B5E20",
            marginBottom: 6,
          }}
          numberOfLines={2}
        >
          {product.name}
        </Text>

        {/* Description */}
        {product.description && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: colors.textSecondary,
              marginBottom: 12,
              lineHeight: 15,
            }}
            numberOfLines={2}
          >
            {product.description}
          </Text>
        )}

        {/* Buttons Row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left Side: Action Buttons */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {!canAddToCart ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: "#ef4444",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 16,
                }}
              >
                <AlertCircle size={10} color="white" />
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 10,
                    color: "white",
                  }}
                >
                  {getStatusText(product.status)}
                </Text>
              </View>
            ) : (
              <>
                {/* Add Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 5,
                  }}
                  onPress={(e) => {
                    e.stopPropagation();
                    onAddToCart?.(product, {
                      hasCustomizations: !!hasCustomizations,
                    });
                  }}
                  disabled={isAddingToCart}
                >
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

                {/* Customize Button - only show if product has customizations */}
                {hasCustomizations && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: "#FF8C00",
                      borderRadius: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                    }}
                    onPress={async (e) => {
                      e.stopPropagation();
                      await Haptics.selectionAsync();
                      onPress(product);
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 11,
                        color: "white",
                      }}
                    >
                      Customize
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Heart Icon */}
                <TouchableOpacity onPress={handleFavoritePress}>
                  <Heart
                    size={18}
                    color={isFavorite ? colors.primary : colors.textSecondary}
                    fill={isFavorite ? colors.primary : "transparent"}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Right Side: Price */}
          <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
            {hasDiscount ? (
              <>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 10,
                    color: colors.textSecondary,
                    textDecorationLine: "line-through",
                  }}
                >
                  ${product.original_price || product.price}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 11,
                    color: colors.primary,
                  }}
                >
                  ${finalPrice}
                </Text>
              </>
            ) : (
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                  color: colors.primary,
                }}
              >
                ${finalPrice}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
