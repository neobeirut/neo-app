import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { View, Text } from "react-native";
import { useTheme } from "../../utils/theme";
import { useBranchStore } from "../../utils/branchStore";
import { useAuth } from "../../utils/auth/useAuth";
import { useCartData } from "../../hooks/useCartData";

export default function TabLayout() {
  const { colors } = useTheme();
  const { selectedBranch } = useBranchStore();
  const { isAuthenticated, isReady } = useAuth();

  // Use the same cart source of truth as the Cart screen.
  // (Avoids accidental unauthenticated /api/cart calls that return empty.)
  const { data: cartData } = useCartData(
    selectedBranch,
    isAuthenticated,
    isReady,
  );

  const cartItems = cartData?.cart_items || [];
  const cartItemCount = cartItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: "none",
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu/index"
        options={{
          title: "Menu",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu-outline" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          href: null,
          title: "Favorites",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rewards/index"
        options={{
          title: "Rewards",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star-outline" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="specials"
        options={{
          title: "Specials",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame-outline" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
