import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { getImageSource } from "@/utils/apiFetch";
import * as Haptics from "expo-haptics";

// Removed upsell label chip and reason text to keep the upsell UI compact.

export function RecommendationsSection({
  recommendations,
  colors,
  onPressProduct,
  onAddProduct,
  title = "You might also like",
  showTitle = true,
  addLabel = "Add",
  loading = false,
  skeletonCount = 3,
}) {
  const hasAny = Array.isArray(recommendations) && recommendations.length > 0;
  const shouldShowTitle = !!showTitle && !!title;
  const shouldShowSkeleton = !!loading && !hasAny;

  // Build simple skeleton items without hooks (fast + SSR-safe)
  const skeletonItems = [];
  const safeSkeletonCount =
    Number.isFinite(Number(skeletonCount)) && Number(skeletonCount) > 0
      ? Math.min(8, Number(skeletonCount))
      : 3;
  for (let i = 0; i < safeSkeletonCount; i += 1) {
    skeletonItems.push(i);
  }

  // If we're not loading and there's nothing to show, don't render the section.
  if (!hasAny && !shouldShowSkeleton) {
    return null;
  }

  const skeletonBlockColor = colors?.separator || "#E5E7EB";
  const skeletonSurface = colors?.surface || "#FFFFFF";

  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
      {shouldShowTitle ? (
        <Text
          style={{
            fontFamily: "PlayfairDisplay_500Medium",
            fontSize: 18,
            color: colors.text,
            marginBottom: 12,
          }}
        >
          {title}
        </Text>
      ) : null}

      <ScrollView
        horizontal
        style={{ flexGrow: 0 }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 12,
          paddingRight: 8,
          paddingTop: shouldShowTitle ? 0 : 4,
        }}
      >
        {shouldShowSkeleton
          ? skeletonItems.map((i) => (
              <View
                key={`rec-skeleton-${i}`}
                style={{
                  width: 180,
                  backgroundColor: skeletonSurface,
                  borderRadius: 14,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: skeletonBlockColor,
                }}
              >
                <View
                  style={{
                    width: "100%",
                    height: 90,
                    backgroundColor: skeletonBlockColor,
                  }}
                />

                <View style={{ padding: 10 }}>
                  <View
                    style={{
                      height: 12,
                      width: "90%",
                      borderRadius: 6,
                      backgroundColor: skeletonBlockColor,
                    }}
                  />
                  <View
                    style={{
                      marginTop: 8,
                      height: 12,
                      width: "70%",
                      borderRadius: 6,
                      backgroundColor: skeletonBlockColor,
                    }}
                  />

                  <View
                    style={{
                      marginTop: 14,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        height: 12,
                        width: 50,
                        borderRadius: 6,
                        backgroundColor: skeletonBlockColor,
                      }}
                    />
                    <View
                      style={{
                        height: 26,
                        width: 52,
                        borderRadius: 999,
                        backgroundColor: skeletonBlockColor,
                      }}
                    />
                  </View>
                </View>
              </View>
            ))
          : recommendations.map((rec) => {
              const p = rec?.product;
              if (!p) {
                return null;
              }

              const imageSource = getImageSource(
                p.image_url,
                "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=300&fit=crop",
              );

              const price = Number(p.price || 0);
              const priceText = Number.isFinite(price)
                ? `$${price.toFixed(2)}`
                : "";

              const handleCardPress = async () => {
                await Haptics.selectionAsync().catch(() => {});
                onPressProduct?.(p);
              };

              const handleAddPress = async () => {
                await Haptics.selectionAsync().catch(() => {});
                if (onAddProduct) {
                  onAddProduct(p);
                  return;
                }
                onPressProduct?.(p);
              };

              return (
                <TouchableOpacity
                  key={String(rec.product_id)}
                  onPress={handleCardPress}
                  style={{
                    width: 180,
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: colors.separator,
                  }}
                >
                  <Image
                    source={imageSource}
                    style={{ width: "100%", height: 90 }}
                    contentFit="cover"
                    transition={200}
                  />

                  <View style={{ padding: 10 }}>
                    <Text
                      style={{
                        fontFamily: "PlayfairDisplay_500Medium",
                        fontSize: 13,
                        color: colors.text,
                      }}
                      numberOfLines={2}
                    >
                      {rec.product_name}
                    </Text>

                    <View
                      style={{
                        marginTop: 10,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 13,
                          color: colors.primary,
                        }}
                      >
                        {priceText}
                      </Text>

                      <TouchableOpacity
                        onPress={handleAddPress}
                        style={{
                          backgroundColor: colors.primary,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "Inter_600SemiBold",
                            fontSize: 12,
                            color: "white",
                          }}
                        >
                          {addLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
      </ScrollView>
    </View>
  );
}
