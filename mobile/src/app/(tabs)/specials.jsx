import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Flame, ChevronLeft } from "lucide-react-native";
import { useTheme } from "../../utils/theme";
import { useBranchStore } from "../../utils/branchStore";
import { useAuth } from "../../utils/auth/useAuth";
import {
  useFonts,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_800ExtraBold,
} from "@expo-google-fonts/playfair-display";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { useHomeData } from "../../hooks/useHomeData";
import { useHomeActions } from "../../hooks/useHomeActions";
import {
  getProductsForBranch,
  getDiscountedProducts,
} from "../../utils/homeHelpers";
import { ProductCard } from "../../components/Home/ProductCard";
import { LoadingState } from "../../components/Home/LoadingState";

export default function SpecialsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { selectedBranch } = useBranchStore();
  const { isAuthenticated, signIn } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;

  const [loaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const {
    productsData,
    productsLoading,
    productStatusData,
    statusLoading,
    categoriesData,
    categoriesLoading,
    cartData,
  } = useHomeData(selectedBranch);

  const { addToCartMutation, handleProductPress, handleAddToCart } =
    useHomeActions(selectedBranch, null, router, isAuthenticated, signIn);

  if (
    !loaded ||
    productsLoading ||
    categoriesLoading ||
    statusLoading ||
    !selectedBranch
  ) {
    return <LoadingState colors={colors} statusBarStyle={statusBarStyle} />;
  }

  const products = getProductsForBranch(
    productsData,
    productStatusData,
    selectedBranch,
  );
  const categories = categoriesData?.categories || [];

  // Get all special products (discounted + is_special)
  const allSpecials = getDiscountedProducts(
    products,
    categories,
    "Store",
  ).concat(getDiscountedProducts(products, categories, "Bistro"));

  // Remove duplicates
  const uniqueSpecials = Array.from(
    new Map(allSpecials.map((item) => [item.id, item])).values(),
  );

  // Header animation
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -50],
    extrapolate: "clamp",
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      {/* Fixed Header */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: colors.background,
          paddingTop: insets.top,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingVertical: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={{
              padding: 8,
              marginLeft: -8,
            }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Flame size={24} color="#ef4444" fill="#ef4444" />
            <Text
              style={{
                fontFamily: "PlayfairDisplay_500Medium",
                fontSize: 18,
                color: colors.text,
              }}
            >
              Special Offers
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingHorizontal: 24,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        {/* Animated Header */}
        <Animated.View
          style={{
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
            marginBottom: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Flame size={48} color="#ef4444" fill="#ef4444" />
            <Text
              style={{
                fontFamily: "PlayfairDisplay_500Medium",
                fontSize: 24,
                color: colors.text,
                marginTop: 12,
                textAlign: "center",
              }}
            >
              Today's Special Offers
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Limited time deals and featured items
            </Text>
          </View>
        </Animated.View>

        {uniqueSpecials.length > 0 ? (
          uniqueSpecials.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              colors={colors}
              handleProductPress={handleProductPress}
              handleAddToCart={handleAddToCart}
              addToCartMutation={addToCartMutation}
              cartData={cartData}
              branchDiscount={selectedBranch?.discount_percentage || 0}
            />
          ))
        ) : (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Flame size={64} color={colors.textSecondary} />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 16,
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 16,
              }}
            >
              No special offers available right now
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Check back soon for new deals!
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
