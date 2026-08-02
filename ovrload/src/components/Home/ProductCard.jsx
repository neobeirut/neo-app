import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Star, Clock, AlertCircle } from "lucide-react-native";
import { getStatusColor, calculateDiscountedPrice } from "@/utils/homeHelpers";
import { getImageSource, apiFetch } from "@/utils/apiFetch";
import { useQueryClient } from "@tanstack/react-query";

export function ProductCard({
  product,
  colors,
  handleProductPress,
  handleAddToCart,
  addToCartMutation,
  cartData,
  branchDiscount = 0,
}) {
  const queryClient = useQueryClient();

  const isAvailable = product.status === "Available";
  const canAddToCart = product.status === "Available";
  const cardOpacity = isAvailable ? 1 : 0.7;

  // Check if product has customizations (options/removals/add-ons)
  const hasCustomizations = product.has_customizations || false;

  // Prefetch product addons and customizations for faster loading
  React.useEffect(() => {
    if (!product?.id) return;

    const pid = String(product.id);

    // Delay prefetch slightly to prioritize main content
    const timeoutId = setTimeout(() => {
      // Prefetch addons
      queryClient.prefetchQuery({
        queryKey: ["product-addons", pid],
        queryFn: async () => {
          try {
            const response = await apiFetch(`/api/products/${pid}/addons`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.addons || [];
          } catch (error) {
            return [];
          }
        },
        staleTime: 5 * 60 * 1000,
      });

      // Prefetch customizations
      queryClient.prefetchQuery({
        queryKey: ["product-customizations", pid],
        queryFn: async () => {
          try {
            const response = await apiFetch(
              `/api/products/${pid}/customizations`,
            );
            if (!response.ok) return [];
            const data = await response.json();
            return data.customizations || [];
          } catch (error) {
            return [];
          }
        },
        staleTime: 5 * 60 * 1000,
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [product?.id, queryClient]);

  // Find quantity in cart for this product (sum across lines; customizations/add-ons can create multiple lines)
  const quantityInCart = (cartData?.cart_items || [])
    .filter((item) => item.product_id === product.id)
    .reduce((sum, item) => sum + (item?.quantity || 0), 0);

  // Calculate discounted price based on branch discount
  const discountedPrice = calculateDiscountedPrice(
    product.price,
    branchDiscount,
  );
  const hasDiscount = discountedPrice !== null;

  // Get display status text
  const getStatusText = (status) => {
    if (status === "Unavailable Until Further Notice") {
      return "On Hold";
    }
    return status;
  };

  const imageSource = getImageSource(
    product.image_url,
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop",
  );

  return (
    <TouchableOpacity
      key={product.id}
      activeOpacity={1}
      style={{
        backgroundColor: colors.card,
        borderRadius: 12,
        marginBottom: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
        opacity: cardOpacity,
      }}
      onPress={() => handleProductPress(product)}
    >
      <View style={{ position: "relative" }}>
        <Image
          source={imageSource}
          style={{
            width: "100%",
            height: 120,
          }}
          contentFit="cover"
        />
        {/* Featured Badge */}
        {product.is_featured && (
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: "#fbbf24",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Star size={10} color="white" fill="white" />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 9,
                color: "white",
              }}
            >
              FEATURED
            </Text>
          </View>
        )}
        {/* Special Badge */}
        {product.is_special && !product.is_featured && (
          <View
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              backgroundColor: "#ef4444",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 9,
                color: "white",
              }}
            >
              🔥 SPECIAL
            </Text>
          </View>
        )}
      </View>
      <View style={{ padding: 12 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 6,
          }}
        >
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 14,
              color: colors.text,
              flex: 1,
              marginRight: 8,
            }}
          >
            {product.name}
          </Text>
          <View style={{ alignItems: "flex-end" }}>
            {hasDiscount ? (
              <>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 9,
                    color: colors.textSecondary,
                    textDecorationLine: "line-through",
                  }}
                >
                  ${parseFloat(product.price).toFixed(2)}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                    color: isAvailable ? "#ef4444" : colors.textSecondary,
                  }}
                >
                  ${discountedPrice.toFixed(2)}
                </Text>
              </>
            ) : product.original_price &&
              parseFloat(product.original_price) > parseFloat(product.price) ? (
              <>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 9,
                    color: colors.textSecondary,
                    textDecorationLine: "line-through",
                  }}
                >
                  ${product.original_price}
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 12,
                    color: isAvailable ? "#ef4444" : colors.textSecondary,
                  }}
                >
                  ${product.price}
                </Text>
              </>
            ) : (
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 12,
                  color: isAvailable ? colors.primary : colors.textSecondary,
                }}
              >
                ${product.price}
              </Text>
            )}
          </View>
        </View>

        {product.description && (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: colors.textSecondary,
              marginBottom: 8,
              lineHeight: 14,
            }}
            numberOfLines={2}
          >
            {product.description}
          </Text>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {product.rating > 0 && (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
              >
                <Star size={12} color={colors.primary} />
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    color: colors.text,
                  }}
                >
                  {product.rating}
                </Text>
              </View>
            )}
          </View>

          {!canAddToCart ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                backgroundColor: getStatusColor(product.status, colors),
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderRadius: 10,
              }}
            >
              <AlertCircle size={10} color="white" />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 10,
                  color: "white",
                }}
              >
                {getStatusText(product.status)}
              </Text>
            </View>
          ) : (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {/* Add button (always available) */}
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 16,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  flexDirection: "row",
                  alignItems: "center",
                }}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddToCart(product, { hasCustomizations });
                }}
                disabled={addToCartMutation.isPending}
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

              {/* Customize button */}
              {hasCustomizations ? (
                <TouchableOpacity
                  style={{
                    backgroundColor: "#FF8C00",
                    borderRadius: 16,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleProductPress(product);
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
              ) : null}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
