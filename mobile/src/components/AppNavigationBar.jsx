import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Platform } from "react-native";
import { useTheme } from "../utils/theme";
import { usePathname, useRouter } from "expo-router";
import { Home, Clock, Gift, User } from "lucide-react-native";
import { useBottomBarStore } from "../utils/bottomBarStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

export default function AppNavigationBar() {
  const isVisible = useBottomBarStore((state) => state.isVisible);
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : 120, // Slide down completely out of the screen
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [isVisible]);

  const path = pathname || "";

  // Remove parenthesis groups (e.g. /(tabs)) and trailing slashes to standardize paths
  const cleanPath = path.replace(/\/\([^)]+\)/g, "").replace(/\/$/, "");

  // Helper check for active tab - supports /index suffix from expo-router
  const isHome =
    cleanPath === "/" ||
    cleanPath === "/home" ||
    cleanPath.startsWith("/home/");
  const isOrders =
    cleanPath === "/order-history" ||
    cleanPath.startsWith("/order-history/");
  const isRewards =
    cleanPath === "/rewards" ||
    cleanPath.startsWith("/rewards/");
  const isProfile =
    cleanPath === "/profile" ||
    cleanPath.startsWith("/profile/");

  // The bar should only be shown on primary screens
  const isMainScreen = isHome || isOrders || isRewards || isProfile;

  if (!isMainScreen) return null;

  const handlePress = async (route) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    
    // If navigating to home, trigger a reset (clearing active category/search, scrolling to top)
    if (route === "/(tabs)/home") {
      useBottomBarStore.getState().triggerHomeReset();
    }
    
    router.navigate(route);
  };

  const activeColor = colors.primary; // NEO green
  const inactiveColor = colors.textSecondary;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        transform: [{ translateY: slideAnim }],
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: colors.separator,
        paddingTop: 6,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 15,
        zIndex: 9999,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        {/* Home */}
        <Pressable
          onPress={() => handlePress("/(tabs)/home")}
          style={({ pressed }) => ({
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 2,
            flex: 1,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Home size={18} color={isHome ? activeColor : inactiveColor} />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 8.5,
              fontFamily: isHome ? "Inter_600SemiBold" : "Inter_500Medium",
              color: isHome ? activeColor : inactiveColor,
              marginTop: 3,
            }}
          >
            Home
          </Text>
        </Pressable>

        {/* Orders */}
        <Pressable
          onPress={() => handlePress("/order-history")}
          style={({ pressed }) => ({
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 2,
            flex: 1,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Clock size={18} color={isOrders ? activeColor : inactiveColor} />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 8.5,
              fontFamily: isOrders ? "Inter_600SemiBold" : "Inter_500Medium",
              color: isOrders ? activeColor : inactiveColor,
              marginTop: 3,
            }}
          >
            Orders
          </Text>
        </Pressable>

        {/* Rewards */}
        <Pressable
          onPress={() => handlePress("/(tabs)/rewards")}
          style={({ pressed }) => ({
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 2,
            flex: 1,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Gift size={18} color={isRewards ? activeColor : inactiveColor} />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 8.5,
              fontFamily: isRewards ? "Inter_600SemiBold" : "Inter_500Medium",
              color: isRewards ? activeColor : inactiveColor,
              marginTop: 3,
            }}
          >
            Rewards
          </Text>
        </Pressable>

        {/* Profile */}
        <Pressable
          onPress={() => handlePress("/(tabs)/profile")}
          style={({ pressed }) => ({
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 2,
            flex: 1,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <User size={18} color={isProfile ? activeColor : inactiveColor} />
          <Text
            numberOfLines={1}
            style={{
              fontSize: 8.5,
              fontFamily: isProfile ? "Inter_600SemiBold" : "Inter_500Medium",
              color: isProfile ? activeColor : inactiveColor,
              marginTop: 3,
            }}
          >
            Profile
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
