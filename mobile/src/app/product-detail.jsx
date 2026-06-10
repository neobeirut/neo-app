import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useTheme } from "../utils/theme";
import { useAuth } from "../utils/auth/useAuth";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { PlayfairDisplay_500Medium } from "@expo-google-fonts/playfair-display";
import { useBranchStore } from "../utils/branchStore";
import { useProductDetail } from "../hooks/useProductDetail";
import { useCartData } from "../hooks/useCartData";
import { ProductHeader } from "@/components/ProductDetail/ProductHeader";
import { ProductImage } from "@/components/ProductDetail/ProductImage";
import { ProductInfo } from "@/components/ProductDetail/ProductInfo";
import { RatingSection } from "@/components/ProductDetail/RatingSection";
import { NutritionalInfo } from "@/components/ProductDetail/NutritionalInfo";
import { OptionsSection } from "@/components/ProductDetail/OptionsSection";
import { AddonsSection } from "@/components/ProductDetail/AddonsSection";
import { AddToCartButton } from "@/components/ProductDetail/AddToCartButton";
import { CustomizationsSection } from "@/components/ProductDetail/CustomizationsSection";
import { RecommendationsSection } from "@/components/ProductDetail/RecommendationsSection";
import {
  getStatusColor,
  calculateTotalPrice,
  handleAddToCart,
} from "../utils/productDetailHelpers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { apiFetch, getImageSource } from "../utils/apiFetch";
import { getAuthPhone } from "../utils/auth/getAuthPhone";
import KeyboardAvoidingAnimatedView from "../components/KeyboardAvoidingAnimatedView";
import { useRecommendations } from "../hooks/useRecommendations";

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const productId = params?.id ? String(params.id) : "1";

  const editCartItemIdRaw = params?.cart_item_id;
  const editCartItemId = editCartItemIdRaw ? Number(editCartItemIdRaw) : null;
  const isEditingCartItem = Number.isFinite(editCartItemId);

  const { colors, statusBarStyle } = useTheme();
  const { selectedBranch } = useBranchStore();
  const scrollY = useRef(new Animated.Value(0)).current;
  const { isAuthenticated, isReady, signIn } = useAuth();
  const queryClient = useQueryClient();

  const imageContainerRef = useRef(null);
  const cartIconRef = useRef(null);

  // Add local state to prevent double-taps on Save button
  const [isSaving, setIsSaving] = useState(false);

  const { data: cartData } = useCartData(
    selectedBranch,
    isAuthenticated,
    isReady,
  );

  const editingCartItem = useMemo(() => {
    if (!isEditingCartItem) return null;
    const items = cartData?.cart_items || [];
    return items.find((i) => Number(i.id) === Number(editCartItemId)) || null;
  }, [cartData, editCartItemId, isEditingCartItem]);

  const cartItemCount = useMemo(() => {
    const items = cartData?.cart_items || [];
    return items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  }, [cartData]);

  const flySize = 28;
  const flyPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const flyScale = useRef(new Animated.Value(1)).current;
  const flyOpacity = useRef(new Animated.Value(0)).current;
  const [flyVisible, setFlyVisible] = useState(false);

  const measureInWindowAsync = (ref) => {
    return new Promise((resolve) => {
      const node = ref?.current;
      if (!node || typeof node.measureInWindow !== "function") {
        resolve(null);
        return;
      }

      node.measureInWindow((x, y, w, h) => {
        if (
          [x, y, w, h].some(
            (v) => v === null || v === undefined || Number.isNaN(Number(v)),
          )
        ) {
          resolve(null);
          return;
        }
        resolve({ x, y, w, h });
      });
    });
  };

  const triggerFlyToCart = async () => {
    // Measuring isn't reliable in web preview.
    if (Platform.OS === "web") {
      return;
    }

    try {
      const startRect = await measureInWindowAsync(imageContainerRef);
      const endRect = await measureInWindowAsync(cartIconRef);
      if (!startRect || !endRect) {
        return;
      }

      const startX = startRect.x + startRect.w / 2 - flySize / 2;
      const startY = startRect.y + startRect.h / 2 - flySize / 2;
      const endX = endRect.x + endRect.w / 2 - flySize / 2;
      const endY = endRect.y + endRect.h / 2 - flySize / 2;

      flyPosition.setValue({ x: startX, y: startY });
      flyScale.setValue(1);
      flyOpacity.setValue(1);
      setFlyVisible(true);

      Animated.parallel([
        Animated.timing(flyPosition, {
          toValue: { x: endX, y: endY },
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(flyScale, {
          toValue: 0.3,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(flyOpacity, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setFlyVisible(false);
      });
    } catch (e) {
      console.error("[ProductDetail] fly-to-cart animation failed", e);
    }
  };

  const [itemComment, setItemComment] = useState("");
  const hydratedCommentRef = useRef(null);
  useEffect(() => {
    if (!isEditingCartItem) {
      hydratedCommentRef.current = null;
      setItemComment("");
      return;
    }

    if (!editingCartItem?.id) {
      return;
    }

    if (hydratedCommentRef.current === editingCartItem.id) {
      return;
    }

    hydratedCommentRef.current = editingCartItem.id;

    const commentText =
      editingCartItem.comment === null || editingCartItem.comment === undefined
        ? ""
        : String(editingCartItem.comment);
    setItemComment(commentText);
  }, [isEditingCartItem, editingCartItem?.id]);

  const {
    product,
    productLoading,
    addons,
    customizations,
    reviewsData,
    selectedAddons,
    selectedCustomizations,
    selectedOptions,
    quantity,
    increaseQuantity,
    decreaseQuantity,
    userRating,
    setUserRating,
    toggleAddon,
    toggleCustomization,
    toggleOption,
    submitRating,
    ratingMutation,
    addToCartMutation,
    updateQuantityMutation,
    updateItemDetailsMutation,
  } = useProductDetail(
    productId,
    selectedBranch,
    isAuthenticated,
    signIn,
    router,
    editingCartItem,
  );

  const {
    data: recommendations = [],
    isLoading: recommendationsLoading,
    error: recommendationsError,
  } = useRecommendations({
    selectedBranch,
    // Start fetching immediately based on the route param instead of waiting
    // for the full product object to load.
    currentProductId: Number(productId),
    cartData,
    maxSuggestions: 4,
    enabled: Number.isFinite(Number(productId)),
  });

  const handlePressRecommendedProduct = (p) => {
    if (!p?.id) {
      return;
    }
    router.push({ pathname: "/product-detail", params: { id: String(p.id) } });
  };

  const handleAddRecommendedProduct = (p) => {
    if (!p?.id || !selectedBranch?.id) {
      return;
    }

    // Quick-add: add 1 unit of the base item (no add-ons/options)
    addToCartMutation.mutate({
      product_id: Number(p.id),
      branch_id: Number(selectedBranch.id),
      quantity: 1,
      selected_addons: [],
      customizations: [],
      comment: null,
      shouldNavigateBack: false,
    });
  };

  const flyImageSource = useMemo(() => {
    return getImageSource(
      product?.image_url,
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&h=200&fit=crop",
    );
  }, [product?.image_url]);

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

  // Fetch favorites to check if this product is favorited
  const { data: favoritesData } = useQuery({
    queryKey: ["user-favorites"],
    queryFn: async () => {
      try {
        const phone = await getAuthPhone();
        const url = phone
          ? `/api/favorites?phone=${encodeURIComponent(phone)}`
          : "/api/favorites";

        const response = await apiFetch(url);
        if (!response.ok) return { favorites: [] };
        return response.json();
      } catch (error) {
        console.error("Error fetching favorites:", error);
        return { favorites: [] };
      }
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // Check if current product is in favorites
  const isFavorite =
    favoritesData?.favorites?.some(
      (fav) => fav.product_id === parseInt(productId),
    ) || false;

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ productId, isFavorite }) => {
      const phone = await getAuthPhone();

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
      console.log("[FAVORITE OPTIMISTIC UPDATE] Updating cache optimistically");
      await queryClient.cancelQueries(["user-favorites"]);
      const previousFavorites = queryClient.getQueryData(["user-favorites"]);

      queryClient.setQueryData(["user-favorites"], (old) => {
        if (!old?.favorites) return old;
        if (isFavorite) {
          // Remove from favorites
          console.log("[FAVORITE OPTIMISTIC UPDATE] Removing from favorites");
          return {
            ...old,
            favorites: old.favorites.filter(
              (fav) => fav.product_id !== productId,
            ),
          };
        } else {
          // Add to favorites - create optimistic entry
          console.log("[FAVORITE OPTIMISTIC UPDATE] Adding to favorites");
          return {
            ...old,
            favorites: [
              ...old.favorites,
              {
                id: Date.now(), // Temporary ID
                product_id: productId,
                created_at: new Date().toISOString(),
              },
            ],
          };
        }
      });

      return { previousFavorites };
    },
    onError: async (error, variables, context) => {
      console.error("[FAVORITE ERROR] ❌ Mutation failed:", error.message);
      if (context?.previousFavorites) {
        queryClient.setQueryData(["user-favorites"], context.previousFavorites);
      }
      Alert.alert("Error", error.message);
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

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      signIn();
      return;
    }
    await safeHaptics.selection();
    toggleFavoriteMutation.mutate({
      productId: parseInt(productId),
      isFavorite,
    });
  };

  // Redirect to home if no branch is selected
  useEffect(() => {
    if (!selectedBranch) {
      router.replace("/(tabs)/home");
    }
  }, [selectedBranch]);

  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_500Medium,
  });

  // IMPORTANT: don't block the whole screen on productLoading if we already have cached initialData.
  if (!loaded || !selectedBranch) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontFamily: "Inter_400Regular", color: colors.text }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!product && productLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontFamily: "Inter_400Regular", color: colors.text }}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontFamily: "Inter_400Regular", color: colors.text }}>
          Product not found
        </Text>
      </View>
    );
  }

  // Check if product is available
  const isAvailable = product.status === "Available";
  const canAddToCart =
    product.status === "Available" || product.status === "Unavailable Today";

  const headerHeight = 88;

  const totalPrice = calculateTotalPrice(
    product,
    addons,
    selectedAddons,
    customizations,
    selectedCustomizations,
    selectedOptions,
  );

  const buildPayloadCustomizations = () => {
    const formattedCustomizations = selectedCustomizations.map((id) => {
      const customization = customizations.find((c) => c.id === id);
      if (!customization) return null;
      return {
        id: customization.id,
        type: customization.customization_type,
        ingredient: customization.ingredient,
        price: parseFloat(customization.price || 0),
      };
    });

    const selectedOptionIds = Object.values(selectedOptions).flat();
    const formattedOptions = selectedOptionIds.map((id) => {
      const option = customizations.find((c) => c.id === id);
      if (!option) return null;
      return {
        id: option.id,
        type: "option",
        ingredient: option.ingredient,
        price: parseFloat(option.price || 0),
        option_group_name: option.option_group_name,
      };
    });

    return [...formattedCustomizations, ...formattedOptions].filter(Boolean);
  };

  const validateRequiredOptions = () => {
    const options = customizations.filter(
      (c) => c.customization_type === "option",
    );
    const requiredGroups = {};

    options.forEach((option) => {
      const groupName = option.option_group_name || "Options";
      if (option.is_required) {
        requiredGroups[groupName] = true;
      }
    });

    for (const groupName in requiredGroups) {
      if (
        !selectedOptions[groupName] ||
        selectedOptions[groupName].length === 0
      ) {
        Alert.alert(
          "Required Selection",
          `Please select an option for "${groupName}"`,
        );
        return false;
      }
    }

    return true;
  };

  const onSaveEdits = async () => {
    if (!isEditingCartItem || !editingCartItem?.id) {
      return;
    }

    // Prevent double-taps by checking and setting state immediately
    if (isSaving) {
      console.log("[ProductDetail] ⚠️ Save already in progress, ignoring");
      return;
    }

    if (!canAddToCart) {
      Alert.alert("Unavailable", "This product is currently unavailable.");
      return;
    }

    if (!validateRequiredOptions()) {
      return;
    }

    // Set saving state IMMEDIATELY to disable button
    setIsSaving(true);

    const normalizedComment =
      itemComment === null || itemComment === undefined
        ? null
        : String(itemComment).trim() || null;

    console.log("[ProductDetail] Saving cart item edits with SINGLE API call");
    console.log("[ProductDetail] cart_item_id:", editingCartItem.id);
    console.log("[ProductDetail] quantity:", quantity);
    console.log("[ProductDetail] selected_addons:", selectedAddons);
    console.log(
      "[ProductDetail] customizations count:",
      buildPayloadCustomizations().length,
    );

    try {
      // ✅ CRITICAL FIX for iOS: Wait for mutation to complete BEFORE navigating
      await updateItemDetailsMutation.mutateAsync({
        cart_item_id: editingCartItem.id,
        quantity: quantity,
        selected_addons: selectedAddons,
        customizations: buildPayloadCustomizations(),
        comment: normalizedComment,
      });

      console.log("[ProductDetail] ✅ Cart item saved successfully");

      // ✅ iOS FIX: Add small delay before navigation to ensure state updates complete
      if (Platform.OS === "ios") {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // ✅ Check if we can go back (prevent double-back issues on iOS)
      if (router.canGoBack()) {
        router.back();
      } else {
        // Fallback: go to cart if we can't go back
        router.replace("/(tabs)/cart");
      }
    } catch (e) {
      console.error("[ProductDetail] ❌ Failed to save cart edits", e);

      // Reset saving state on error so user can retry
      setIsSaving(false);

      // ✅ Show more detailed error on iOS
      const errorMsg = String(e?.message || e);
      Alert.alert(
        "Failed to Save",
        errorMsg || "Could not save changes. Please try again.",
        [
          {
            text: "OK",
            style: "default",
          },
        ],
      );
    }
  };

  const onAddToCart = () => {
    // ✅ iOS FIX: Navigate back IMMEDIATELY for instant responsiveness
    // The mutation will complete in the background with optimistic updates
    const canGoBack = router.canGoBack();

    handleAddToCart({
      product,
      selectedBranch,
      isAuthenticated,
      isReady,
      signIn,
      productId,
      quantity,
      selectedAddons,
      selectedCustomizations,
      selectedOptions,
      customizations,
      addToCartMutation,
      router,
      comment: itemComment,
      onWillAdd: triggerFlyToCart,
    });

    // Navigate back immediately (optimistic navigation)
    // The mutation has already applied optimistic updates to the cart
    if (canGoBack) {
      router.back();
    } else {
      router.replace("/(tabs)/cart");
    }

    // Reset state
    setItemComment("");
  };

  const actionLabel = isEditingCartItem ? "Save" : "Add to cart";
  const actionHandler = isEditingCartItem ? onSaveEdits : onAddToCart;

  return (
    <KeyboardAvoidingAnimatedView style={{ flex: 1 }} behavior="padding">
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <StatusBar style={statusBarStyle} />

        {/* Fly-to-cart overlay */}
        {flyVisible ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              zIndex: 5000,
              width: flySize,
              height: flySize,
              borderRadius: flySize / 2,
              overflow: "hidden",
              backgroundColor: colors.primary,
              opacity: flyOpacity,
              transform: [
                { translateX: flyPosition.x },
                { translateY: flyPosition.y },
                { scale: flyScale },
              ],
            }}
          >
            {flyImageSource?.uri ? (
              <Image
                source={flyImageSource}
                style={{ width: flySize, height: flySize }}
                contentFit="cover"
              />
            ) : null}
          </Animated.View>
        ) : null}

        <ProductHeader
          insets={insets}
          colors={colors}
          scrollY={scrollY}
          isFavorite={isFavorite}
          setIsFavorite={handleToggleFavorite}
          onGoBack={() => router.back()}
          onCartPress={() => router.push("/(tabs)/cart")}
          cartItemCount={cartItemCount}
          cartIconRef={cartIconRef}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + headerHeight + 16,
            paddingBottom: insets.bottom + 20,
          }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false },
          )}
          scrollEventThrottle={16}
        >
          {/* Editing banner */}
          {isEditingCartItem ? (
            <View
              style={{
                marginHorizontal: 24,
                marginBottom: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.separator,
                backgroundColor: colors.surface,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: colors.text,
                }}
              >
                Editing item in cart
              </Text>
            </View>
          ) : null}

          <ProductImage
            product={product}
            colors={colors}
            isAvailable={isAvailable}
            getStatusColor={(status) => getStatusColor(status, colors)}
            imageContainerRef={imageContainerRef}
          />

          <ProductInfo
            product={product}
            reviewsData={reviewsData}
            colors={colors}
            isAvailable={isAvailable}
            totalPrice={totalPrice}
          />

          {/* Recommendations (show a fast skeleton while loading) */}
          {!recommendationsError ? (
            <RecommendationsSection
              recommendations={recommendations}
              colors={colors}
              onPressProduct={handlePressRecommendedProduct}
              onAddProduct={handleAddRecommendedProduct}
              loading={recommendationsLoading}
              skeletonCount={3}
            />
          ) : null}

          {/* User Rating Section */}
          {isAuthenticated && canAddToCart && (
            <RatingSection
              colors={colors}
              userRating={userRating}
              setUserRating={setUserRating}
              onSubmitRating={() => submitRating(isAuthenticated)}
              isSubmitting={ratingMutation.isPending}
              reviews={reviewsData?.reviews || []}
              isAuthenticated={isAuthenticated}
              signIn={signIn}
            />
          )}

          <NutritionalInfo
            product={product}
            colors={colors}
            isAvailable={isAvailable}
          />

          {/* Options Section - NEW (shown first) */}
          <OptionsSection
            customizations={customizations}
            colors={colors}
            isAvailable={isAvailable}
            canAddToCart={canAddToCart}
            selectedOptions={selectedOptions}
            onToggleOption={(groupName, optionId) => {
              // Find the option to check if multi-select
              const option = customizations.find((c) => c.id === optionId);
              const isMultiSelect = option?.is_multi_select || false;
              toggleOption(groupName, optionId, isMultiSelect);
            }}
          />

          {/* Add-ons Section (shown second) */}
          <AddonsSection
            addons={addons}
            colors={colors}
            isAvailable={isAvailable}
            canAddToCart={canAddToCart}
            selectedAddons={selectedAddons}
            onToggleAddon={(addonId) => toggleAddon(addonId, canAddToCart)}
          />

          {/* Customizations Section - removals (shown third) */}
          <CustomizationsSection
            customizations={customizations}
            colors={colors}
            isAvailable={isAvailable}
            canAddToCart={canAddToCart}
            selectedCustomizations={selectedCustomizations}
            onToggleCustomization={(id) =>
              toggleCustomization(id, canAddToCart)
            }
          />

          {/* Per-item comment (shown after customization options) */}
          {canAddToCart && (
            <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
              <Text
                style={{
                  fontFamily: "PlayfairDisplay_500Medium",
                  fontSize: 18,
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                Item note
              </Text>
              <TextInput
                value={itemComment}
                onChangeText={setItemComment}
                placeholder="Add a note for this item (optional)"
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={200}
                style={{
                  minHeight: 90,
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.separator,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: colors.text,
                  textAlignVertical: "top",
                }}
              />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 6,
                }}
              >
                {itemComment.length}/200
              </Text>
            </View>
          )}

          {/* Quantity Selector */}
          {canAddToCart && (
            <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
              <Text
                style={{
                  fontFamily: "PlayfairDisplay_500Medium",
                  fontSize: 18,
                  color: colors.text,
                  marginBottom: 12,
                }}
              >
                Quantity
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    // If editing a cart line, allow quantity to drop to 1 (same UX as before)
                    decreaseQuantity();
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.primary,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 22,
                      color: "white",
                    }}
                  >
                    −
                  </Text>
                </TouchableOpacity>
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 20,
                    color: colors.text,
                    minWidth: 40,
                    textAlign: "center",
                  }}
                >
                  {quantity}
                </Text>
                <TouchableOpacity
                  onPress={increaseQuantity}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.primary,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 22,
                      color: "white",
                    }}
                  >
                    +
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <AddToCartButton
            totalPrice={totalPrice}
            canAddToCart={canAddToCart}
            onPress={actionHandler}
            colors={colors}
            actionLabel={actionLabel}
            isSaving={isSaving}
            isEditMode={isEditingCartItem}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingAnimatedView>
  );
}
