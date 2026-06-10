import React, { useState, useRef } from "react";
import { View, Text, Animated, TouchableOpacity } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../utils/theme";
import { useBranchStore } from "../../../utils/branchStore";
import { useAuth } from "../../../utils/auth/useAuth";
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
import { useMenuData } from "../../../hooks/useMenuData";
import { useMenuActions } from "../../../hooks/useMenuActions";
import {
  getProductsForBranch,
  getDiscountedProducts,
  filterProducts,
  sortProducts,
} from "../../../utils/menuHelpers";
import { ProductCard } from "../../../components/Menu/ProductCard";
import { LoadingState } from "../../../components/Menu/LoadingState";
import { SortingButton } from "../../../components/Menu/SortingButton";

export default function CategoryProductsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, statusBarStyle } = useTheme();
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const { isAuthenticated, isReady, signIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSort, setSelectedSort] = useState("default");
  const scrollY = useRef(new Animated.Value(0)).current;

  const categoryId = params.categoryId ? parseInt(params.categoryId) : null;
  const categoryName = params.categoryName || "";
  const selectedSection = params.section || "Store";

  const [loaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Fetch data
  const {
    productsData,
    productsLoading,
    productStatusData,
    statusLoading,
    categoriesData,
    categoriesLoading,
    cartData,
  } = useMenuData(selectedBranch, isAuthenticated, isReady);

  // Actions
  const { addToCartMutation, handleProductPress, handleAddToCart } =
    useMenuActions(
      selectedBranch,
      setSelectedBranch,
      isAuthenticated,
      isReady,
      signIn,
    );

  if (
    !loaded ||
    productsLoading ||
    categoriesLoading ||
    statusLoading ||
    !selectedBranch
  ) {
    return <LoadingState colors={colors} statusBarStyle={statusBarStyle} />;
  }

  const headerHeight = 100;

  // Filter products based on branch status
  const products = getProductsForBranch(
    productsData,
    productStatusData,
    selectedBranch,
  );
  const categories = categoriesData?.categories || [];

  const filteredProducts = filterProducts(
    products,
    categories,
    selectedSection,
    categoryId || "all",
    searchQuery,
  );

  // Apply sorting
  const sortedProducts = sortProducts(
    filteredProducts,
    selectedSort,
    selectedBranch?.discount_percentage || 0,
  );

  const handleBack = async () => {
    await Haptics.selectionAsync();
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      {/* Header */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          paddingTop: insets.top + 16,
          paddingBottom: 16,
          paddingHorizontal: 24,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
          zIndex: 100,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={handleBack}
            style={{
              marginRight: 12,
              padding: 8,
            }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text
            style={{
              flex: 1,
              fontFamily: "PlayfairDisplay_800ExtraBold",
              fontSize: 24,
              color: colors.text,
            }}
          >
            {categoryName}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + headerHeight + 16,
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
        {/* Sorting button */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            marginBottom: 12,
          }}
        >
          <SortingButton
            colors={colors}
            selectedSort={selectedSort}
            onSortChange={setSelectedSort}
          />
        </View>

        {/* Products */}
        {sortedProducts.length > 0 ? (
          sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              colors={colors}
              onPress={handleProductPress}
              onAddToCart={handleAddToCart}
              isAddingToCart={addToCartMutation.isPending}
              cartData={cartData}
              branchDiscount={selectedBranch?.discount_percentage || 0}
            />
          ))
        ) : (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 16,
                color: colors.textSecondary,
                textAlign: "center",
              }}
            >
              No items found in this category
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
