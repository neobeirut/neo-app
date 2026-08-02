import React from "react";
import { View, TouchableOpacity, Animated, Text, Platform } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ShoppingCart } from "lucide-react-native";
import * as Haptics from "expo-haptics";

export function ProductHeader({
  insets,
  colors,
  scrollY,
  isFavorite,
  setIsFavorite,
  onGoBack,
  onCartPress,
  cartItemCount = 0,
  cartIconRef,
}) {
  const headerHeight = 88;

  const safeHaptic = async () => {
    if (Platform.OS === "web") return;
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      // ignore
    }
  };

  const handleGoBack = async () => {
    await safeHaptic();
    onGoBack();
  };

  const handleFavoritePress = async () => {
    await safeHaptic();
    setIsFavorite();
  };

  const handleCartPress = async () => {
    await safeHaptic();
    if (onCartPress) {
      onCartPress();
    }
  };

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: colors.cream,
        paddingTop: insets.top,
        borderBottomWidth: scrollY.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
          extrapolate: "clamp",
        }),
        borderBottomColor: colors.separator,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingVertical: 16,
          height: headerHeight,
        }}
      >
        <TouchableOpacity
          style={{
            width: 44,
            height: 44,
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={handleGoBack}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            style={{
              width: 44,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={handleFavoritePress}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite ? colors.primary : colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            ref={cartIconRef}
            style={{
              width: 44,
              height: 44,
              justifyContent: "center",
              alignItems: "center",
              position: "relative",
            }}
            onPress={handleCartPress}
          >
            <ShoppingCart size={24} color={colors.text} />
            {cartItemCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  backgroundColor: colors.primary,
                  borderRadius: 10,
                  width: 18,
                  height: 18,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 10,
                    color: "white",
                  }}
                >
                  {cartItemCount > 9 ? "9+" : cartItemCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
