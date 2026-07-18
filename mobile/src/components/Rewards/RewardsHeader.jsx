import React from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Menu } from "lucide-react-native";

// Increase headerHeight so the large title never clips on small screens.
export const headerHeight = 86;

export function RewardsHeader({
  insets,
  colors,
  scrollY,
  onMenuPress,
  onHowItWorksPress,
}) {
  const handleHowItWorksPress = onHowItWorksPress || (() => {});

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
          minHeight: headerHeight,
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
          <Text
            style={{
              fontFamily: "PlayfairDisplay_800ExtraBold",
              fontSize: 32,
              lineHeight: 36,
              color: colors.text,
              letterSpacing: -0.5,
              // Helps prevent clipping on some Android devices
              includeFontPadding: false,
            }}
          >
            Rewards
          </Text>
        </View>

        {/* Replaced the star/info icon with a clear button */}
        <TouchableOpacity
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.separator,
            backgroundColor: colors.card,
          }}
          onPress={handleHowItWorksPress}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
              color: colors.text,
              includeFontPadding: false,
            }}
          >
            How It Works
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
