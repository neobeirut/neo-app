import React from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Menu } from "lucide-react-native";

export function CartHeader({
  colors,
  insets,
  scrollY,
  headerHeight,
  totalItems,
  onMenuPress,
  onClose,
  onTitleLongPress,
}) {
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: colors.background,
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
          paddingVertical: 12,
          height: headerHeight,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={onMenuPress}
            style={{
              padding: 8,
            }}
          >
            <Menu size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Long-press "Cart" title to toggle debug (optional) */}
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={onTitleLongPress}
            delayLongPress={500}
            disabled={!onTitleLongPress}
          >
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text
                style={{
                  fontFamily: "PlayfairDisplay_400Regular",
                  fontSize: 26,
                  color: colors.text,
                }}
              >
                Cart
              </Text>
              {totalItems > 0 && (
                <Text
                  style={{
                    fontFamily: "PlayfairDisplay_400Regular",
                    fontSize: 26,
                    color: colors.textSecondary,
                    marginLeft: 6,
                  }}
                >
                  , {totalItems} {totalItems === 1 ? "item" : "items"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={{
            width: 36,
            height: 36,
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={onClose}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
