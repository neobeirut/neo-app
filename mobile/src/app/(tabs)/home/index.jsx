import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ChevronLeft, Search, Home } from "lucide-react-native";
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
import { Arboria_500Medium } from "@expo-google-fonts/arboria";
import { useHomeData } from "../../../hooks/useHomeData";
import { useHomeActions } from "../../../hooks/useHomeActions";
import { getProductsForBranch } from "../../../utils/homeHelpers";
import { HomeHeader } from "../../../components/Home/HomeHeader";
import { LoadingState } from "../../../components/Home/LoadingState";
import { SlideMenu } from "../../../components/Home/SlideMenu";
import { CategoryCard } from "../../../components/Home/CategoryCard";
import { SimpleProductCard } from "../../../components/Home/SimpleProductCard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../utils/apiFetch";
import { getAuthPhone } from "../../../utils/auth/getAuthPhone";
import { useFocusEffect } from "expo-router/react-navigation";
import { usePromoPopupSettings } from "../../../hooks/usePromoPopupSettings";
import PromoPopup from "../../../components/Home/PromoPopup";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, statusBarStyle } = useTheme();
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const { isAuthenticated, isReady } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const categoryScrollRef = useRef(null);
  const categoryButtonRefs = useRef({});
  const mainScrollRef = useRef(null);

  // Prevent Android hardware back from closing the app while on Home.
  // Instead, use it to close the slide menu / go back to categories.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") {
        return () => {};
      }

      const onBackPress = () => {
        if (menuVisible) {
          setMenuVisible(false);
          return true;
        }

        if (selectedCategory) {
          setSelectedCategory(null);
          setSearchQuery("");
          return true;
        }

        // Swallow the back press so Android doesn't exit the app.
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => {
        subscription.remove();
      };
    }, [menuVisible, selectedCategory]),
  );

  const lastAuthDebugKeyRef = useRef(null);

  const [loaded] = useFonts({
    PlayfairDisplay_500Medium,
    PlayfairDisplay_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Arboria_500Medium,
  });

  const safeHaptics = {
    selection: async () => {
      if (Platform.OS === "web") return;
      try {
        await Haptics.selectionAsync();
      } catch (e) {
        // ignore
      }
    },
    notify: async (type) => {
      if (Platform.OS === "web") return;
      try {
        await Haptics.notificationAsync(type);
      } catch (e) {
        // ignore
      }
    },
  };

  // Debug effect to check phone auth state
  useEffect(() => {
    const isDev =
      (typeof globalThis !== "undefined" && !!globalThis.__DEV__) ||
      process.env.NODE_ENV !== "production";

    // In web preview this debug log can look like an "infinite loop".
    // Keep the preview usable by disabling this dev-only spam on web.
    if (!isDev || Platform.OS === "web") {
      return;
    }

    const checkAuthState = async () => {
      const phone = await getAuthPhone();
      const branchId = selectedBranch?.id ?? null;
      const debugKey = `${phone || ""}|${String(isAuthenticated)}|${String(isReady)}|${String(branchId)}`;

      // Avoid spamming logs on every re-render.
      if (lastAuthDebugKeyRef.current === debugKey) {
        return;
      }
      lastAuthDebugKeyRef.current = debugKey;

      console.log("[HOME DEBUG] ========== AUTH STATE CHECK ==========");
      console.log("[HOME DEBUG] Phone from storage:", phone);
      console.log("[HOME DEBUG] useAuth isAuthenticated:", isAuthenticated);
      console.log("[HOME DEBUG] useAuth isReady:", isReady);
      console.log("[HOME DEBUG] Selected branch:", branchId);
      console.log("[HOME DEBUG] ========================================");
    };

    checkAuthState();
  }, [isAuthenticated, isReady, selectedBranch?.id]);

  // Fetch all data - PASS isAuthenticated to prevent cart fetch for unauthenticated users
  const {
    logoData,
    productsData,
    productsLoading,
    productStatusData,
    statusLoading,
    categoriesData,
    categoriesLoading,
    cartData,
  } = useHomeData(selectedBranch, isAuthenticated, isReady);

  // Actions
  const {
    handleProductPress,
    handleAddToCart,
    addToCartMutation,
    handleChangeLocation,
  } = useHomeActions(
    selectedBranch,
    setSelectedBranch,
    router,
    isAuthenticated,
    isReady,
  );

  const { signIn } = useAuth();

  const headerHeight = 80;

  // Filter products based on branch status
  const products = getProductsForBranch(
    productsData,
    productStatusData,
    selectedBranch,
  );
  const categories = categoriesData?.categories || [];

  // Show all active categories
  const activeCategories = categories.filter((cat) => cat.is_active);

  // Filter products by selected category
  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory.id)
    : [];

  // Filter products by search query - search across ALL products when there's a search query
  const searchFilteredProducts = searchQuery
    ? products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : filteredProducts;

  const handleCategoryPress = async (category) => {
    await safeHaptics.selection();
    setSelectedCategory(category);
    setSearchQuery(""); // Reset search when category is clicked
    // Scroll to top when category is selected
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ y: 0, animated: false });
    }
  };

  // Auto-scroll to selected category
  useEffect(() => {
    if (
      selectedCategory &&
      categoryScrollRef.current &&
      categoryButtonRefs.current[selectedCategory.id]
    ) {
      categoryButtonRefs.current[selectedCategory.id].measureLayout(
        categoryScrollRef.current,
        (x, y, width, height) => {
          categoryScrollRef.current.scrollTo({
            x: Math.max(0, x - 20),
            animated: true,
          });
        },
        () => {},
      );
    }
  }, [selectedCategory]);

  const handleBackToCategories = async () => {
    await safeHaptics.selection();
    setSelectedCategory(null);
    setSearchQuery(""); // Clear search when going back
  };

  const handleMenuPress = async () => {
    await safeHaptics.selection();
    setMenuVisible(true);
  };

  // Fetch favorites
  const { data: favoritesData } = useQuery({
    queryKey: ["user-favorites"],
    queryFn: async () => {
      try {
        const phone = await getAuthPhone();
        const url = phone
          ? `/api/favorites?phone=${encodeURIComponent(phone)}`
          : "/api/favorites";

        const response = await apiFetch(url);
        if (!response.ok) {
          return { favorites: [] };
        }
        return response.json();
      } catch (error) {
        console.error("Error fetching favorites:", error);
        return { favorites: [] };
      }
    },
    enabled: isReady && isAuthenticated,
    retry: false,
    staleTime: 30000,
  });

  // Toggle favorite mutation - with comprehensive logging and optimistic updates
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ productId, isFavorite }) => {
      const phone = await getAuthPhone();

      // If we have no phone, we still might be session-authenticated on native.
      // But in web preview cookies are omitted, so phone is required there.
      if (!phone && Platform.OS === "web") {
        throw new Error("Authentication failed. Please sign in again.");
      }

      if (isFavorite) {
        const params = new URLSearchParams({ product_id: String(productId) });
        if (phone) params.append("phone", phone);

        const response = await apiFetch(`/api/favorites?${params.toString()}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to remove from favorites");
        }

        return response.json();
      }

      const requestBody = { product_id: productId };
      if (phone) requestBody.phone = phone;

      const response = await apiFetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Failed to add to favorites");
      }

      return response.json();
    },
    onMutate: async ({ productId, isFavorite }) => {
      console.log("[HOME FAVORITE OPTIMISTIC] Updating cache optimistically");
      await queryClient.cancelQueries(["user-favorites"]);
      const previousFavorites = queryClient.getQueryData(["user-favorites"]);

      queryClient.setQueryData(["user-favorites"], (old) => {
        if (!old?.favorites) return old;
        if (isFavorite) {
          // Remove from favorites
          console.log("[HOME FAVORITE OPTIMISTIC] Removing from favorites");
          return {
            ...old,
            favorites: old.favorites.filter(
              (fav) => fav.product_id !== productId,
            ),
          };
        } else {
          // Add to favorites - create optimistic entry
          console.log("[HOME FAVORITE OPTIMISTIC] Adding to favorites");

          // Get product details from products cache
          const productsData = queryClient.getQueryData(["products"]);
          const product = productsData?.products?.find(
            (p) => p.id === productId,
          );

          if (!product) {
            console.warn(
              "[HOME FAVORITE OPTIMISTIC] Product not found in cache",
            );
            return old;
          }

          return {
            ...old,
            favorites: [
              ...old.favorites,
              {
                id: Date.now(), // Temporary ID
                product_id: productId,
                name: product.name,
                description: product.description,
                price: product.price,
                original_price: product.original_price,
                image_url: product.image_url,
                category_id: product.category_id,
                rating: product.rating,
                prep_time: product.prep_time,
                created_at: new Date().toISOString(),
              },
            ],
          };
        }
      });

      return { previousFavorites };
    },
    onError: async (error, variables, context) => {
      console.error("[HOME FAVORITE ERROR] ❌ Mutation failed:", error.message);
      if (context?.previousFavorites) {
        queryClient.setQueryData(["user-favorites"], context.previousFavorites);
      }
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
    },
    onSuccess: async () => {
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: ["user-favorites"],
          type: "active",
        });
      }, 300);
    },
  });

  const toggleFavorite = async (productId) => {
    if (!isAuthenticated || !isReady) {
      signIn();
      return;
    }
    await safeHaptics.selection();
    const isFav = favoritesData?.favorites?.some(
      (fav) => fav.product_id === productId,
    );
    toggleFavoriteMutation.mutate({ productId, isFavorite: !!isFav });
  };

  // Fetch product customizations in bulk (MUCH faster than individual calls)
  const { data: customizationsCheck } = useQuery({
    queryKey: [
      "customizations-bulk-check",
      products
        .map((p) => p.id)
        .sort()
        .join(","),
    ],
    queryFn: async () => {
      if (!products.length) return {};

      try {
        const productIds = products.map((p) => p.id).join(",");
        const response = await apiFetch(
          `/api/products/has-customizations?product_ids=${productIds}`,
        );

        if (!response.ok) {
          console.error("Failed to fetch customizations check");
          return {};
        }

        const data = await response.json();
        return data.products || {};
      } catch (error) {
        console.error("Error checking customizations:", error);
        return {};
      }
    },
    enabled: products.length > 0,
    retry: false,
    staleTime: 300000, // Cache for 5 minutes since customizations don't change often
  });

  // Create a map of favorited product IDs for quick lookup
  const favoritesMap = {};
  if (favoritesData?.favorites) {
    favoritesData.favorites.forEach((fav) => {
      favoritesMap[fav.product_id] = true;
    });
  }

  // Calculate cart item count
  const cartItemCount =
    cartData?.cart_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  // Show inline loading indicator for data
  const isLoadingData = categoriesLoading || productsLoading || statusLoading;

  const categoryMenuHeight = 70; // Increased to prevent text cutoff

  const { data: promoPopupData } = usePromoPopupSettings();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />
      {/* Home promo popup (best-effort; never block the screen) */}
      {promoPopupData?.promo_popup ? (
        <PromoPopup
          settings={promoPopupData.promo_popup}
          updatedAt={promoPopupData.updated_at}
          colors={colors}
        />
      ) : null}
      <HomeHeader
        colors={colors}
        insets={insets}
        logoData={logoData}
        onMenuPress={handleMenuPress}
        cartItemCount={cartItemCount}
        selectedBranch={selectedBranch}
        onBranchPress={() => handleChangeLocation(cartData)}
      />
      <SlideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        colors={colors}
        selectedBranch={selectedBranch}
        onChangeLocation={() => handleChangeLocation(cartData)}
        onHomePress={handleBackToCategories}
        logoData={logoData}
      />
      {/* Floating Back Button - now on the bottom */}
      {selectedCategory && (
        <TouchableOpacity
          onPress={handleBackToCategories}
          style={{
            position: "absolute",
            bottom: insets.bottom + 20,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
            zIndex: 1000,
          }}
        >
          <Home size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      {/* Sticky Horizontal Category Menu - only show when category is selected */}
      {selectedCategory && (
        <View
          style={{
            position: "absolute",
            top: insets.top + headerHeight,
            left: 0,
            right: 0,
            height: categoryMenuHeight,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
            zIndex: 100,
          }}
        >
          <ScrollView
            ref={categoryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
              gap: 6,
              paddingHorizontal: 24,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            {activeCategories.map((category) => {
              const isActive = category.id === selectedCategory.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  ref={(ref) => (categoryButtonRefs.current[category.id] = ref)}
                  onPress={() => handleCategoryPress(category)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 12,
                      color: isActive ? "#F97316" : "#2D5F3F",
                      lineHeight: 16,
                    }}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
      <ScrollView
        ref={mainScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: selectedCategory
            ? insets.top + headerHeight + categoryMenuHeight + 20
            : insets.top + headerHeight + 20,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingData ? (
          // Show inline loading indicator
          (<View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>)
        ) : !selectedCategory ? (
          // Show categories
          (<>
            {activeCategories.length > 0 ? (
              activeCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  colors={colors}
                  onPress={handleCategoryPress}
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
                  No categories available
                </Text>
              </View>
            )}
          </>)
        ) : (
          // Show products in selected category
          (<>
            {/* Search Input - much smaller */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: colors.surface,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.separator,
              }}
            >
              <Search size={16} color={colors.textSecondary} />
              <TextInput
                style={{
                  flex: 1,
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.text,
                  marginLeft: 8,
                  paddingVertical: 2,
                }}
                placeholder="Search all products..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            {searchFilteredProducts.length > 0 ? (
              searchFilteredProducts.map((product) => (
                <SimpleProductCard
                  key={product.id}
                  product={product}
                  colors={colors}
                  onPress={handleProductPress}
                  branchDiscount={selectedBranch?.discount_percentage || 0}
                  onAddToCart={handleAddToCart}
                  isAddingToCart={addToCartMutation.isPending}
                  cartData={cartData}
                  isFavorite={favoritesMap[product.id] || false}
                  onToggleFavorite={() => toggleFavorite(product.id)}
                  hasCustomizations={customizationsCheck?.[product.id] || false}
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
                  {searchQuery
                    ? "No products match your search"
                    : "No products in this category"}
                </Text>
              </View>
            )}
          </>)
        )}
      </ScrollView>
    </View>
  );
}
