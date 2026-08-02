import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Heart, ShoppingCart, Star, Menu } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../utils/theme";
import { useAuth } from "../../utils/auth/useAuth";
import { useBranchStore } from "../../utils/branchStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import { PlayfairDisplay_500Medium } from "@expo-google-fonts/playfair-display";
import { phoneAuth } from "../../utils/auth/phoneAuth";
import { SlideMenu } from "../../components/Home/SlideMenu";
import { apiFetch } from "../../utils/apiFetch";
import { getAuthPhone } from "../../utils/auth/getAuthPhone";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, statusBarStyle } = useTheme();
  const { isAuthenticated, isReady, signIn } = useAuth();
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_500Medium,
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

  // Fetch favorites
  const {
    data: favoritesData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["user-favorites"],
    queryFn: async () => {
      const phone = await getAuthPhone();
      const url = phone
        ? `/api/favorites?phone=${encodeURIComponent(phone)}`
        : "/api/favorites";

      const response = await apiFetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch favorites");
      }
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Remove from favorites mutation
  const removeFavoriteMutation = useMutation({
    mutationFn: async (productId) => {
      const phone = await getAuthPhone();
      const params = new URLSearchParams({ product_id: String(productId) });
      if (phone) params.append("phone", phone);

      const response = await apiFetch(`/api/favorites?${params.toString()}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove from favorites");
      return response.json();
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries(["user-favorites"]);
      const previousFavorites = queryClient.getQueryData(["user-favorites"]);

      queryClient.setQueryData(["user-favorites"], (old) => {
        if (!old?.favorites) return old;
        return {
          ...old,
          favorites: old.favorites.filter(
            (fav) => fav.product_id !== productId,
          ),
        };
      });

      return { previousFavorites };
    },
    onError: async (error, variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(["user-favorites"], context.previousFavorites);
      }
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error?.message || "Failed to remove from favorites");
    },
    onSuccess: async () => {
      await safeHaptics.notify(Haptics.NotificationFeedbackType.Success);
    },
    onSettled: () => {
      queryClient.invalidateQueries(["user-favorites"]);
    },
  });

  if (!loaded) {
    return null;
  }

  const handleProductPress = async (productId) => {
    await safeHaptics.selection();
    router.push(`/product-detail?id=${productId}`);
  };

  const handleRemoveFavorite = async (productId) => {
    await safeHaptics.selection();
    removeFavoriteMutation.mutate(productId);
  };

  const toggleCategory = async (categoryName) => {
    await safeHaptics.selection();
    setExpandedCategory(
      expandedCategory === categoryName ? null : categoryName,
    );
  };

  const handleMenuPress = async () => {
    await safeHaptics.selection();
    setMenuVisible(true);
  };

  const handleChangeLocation = async () => {
    // If no branch yet, just go to branch picker.
    if (!selectedBranch?.id) {
      router.push("/select-branch");
      return;
    }

    // Check if there are items in the cart
    const cartResponse = await fetch(
      `/api/cart?branch_id=${selectedBranch.id}`,
    );
    if (cartResponse.ok) {
      const cartData = await cartResponse.json();
      if (cartData.cart_items && cartData.cart_items.length > 0) {
        // Show warning that cart will be cleared
        // For now, just navigate - you can add a confirmation modal if needed
      }
    }
    router.push("/select-branch");
  };

  // Group favorites by category
  const favoritesByCategory = {};
  if (favoritesData?.favorites) {
    favoritesData.favorites.forEach((fav) => {
      const categoryName = fav.category_name || "Uncategorized";
      if (!favoritesByCategory[categoryName]) {
        favoritesByCategory[categoryName] = [];
      }
      favoritesByCategory[categoryName].push(fav);
    });
  }

  const categories = Object.keys(favoritesByCategory);

  // Not authenticated view
  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={statusBarStyle} />

        {/* Slide Menu */}
        <SlideMenu
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          colors={colors}
          selectedBranch={selectedBranch}
          onChangeLocation={handleChangeLocation}
          onHomePress={() => router.push("/(tabs)/home")}
        />

        <View
          style={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 24,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Menu Button on the left */}
          <TouchableOpacity
            onPress={handleMenuPress}
            style={{
              position: "absolute",
              left: 24,
              top: insets.top + 16,
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Menu size={24} color={colors.text} />
          </TouchableOpacity>

          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 28,
              color: colors.text,
              textAlign: "center",
            }}
          >
            My Favorites
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <Heart size={64} color={colors.textSecondary} />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 20,
              color: colors.text,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            Sign in to save favorites
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
            Mark your favorite items with a heart to quickly find them later
          </Text>
          <TouchableOpacity
            onPress={() => signIn()}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingHorizontal: 32,
              paddingVertical: 12,
              marginTop: 24,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: "white",
              }}
            >
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusBar style={statusBarStyle} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 16,
            color: colors.textSecondary,
            marginTop: 16,
          }}
        >
          Loading your favorites...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      {/* Slide Menu */}
      <SlideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        colors={colors}
        selectedBranch={selectedBranch}
        onChangeLocation={handleChangeLocation}
        onHomePress={() => router.push("/(tabs)/home")}
      />

      {/* Header with Menu Button */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Menu Button on the left */}
        <TouchableOpacity
          onPress={handleMenuPress}
          style={{
            position: "absolute",
            left: 24,
            top: insets.top + 16,
            width: 40,
            height: 40,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Menu size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Centered Title */}
        <View style={{ alignItems: "center" }}>
          <Text
            style={{
              fontFamily: "PlayfairDisplay_500Medium",
              fontSize: 28,
              color: colors.text,
              textAlign: "center",
            }}
          >
            My Favorites
          </Text>
          {favoritesData?.favorites && favoritesData.favorites.length > 0 && (
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 14,
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 4,
              }}
            >
              {favoritesData.favorites.length} item
              {favoritesData.favorites.length !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      </View>

      {/* Empty state */}
      {categories.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <Heart size={64} color={colors.textSecondary} />
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 20,
              color: colors.text,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            No favorites yet
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
            Start adding items to your favorites by tapping the heart icon
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/home")}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingHorizontal: 32,
              paddingVertical: 12,
              marginTop: 24,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 16,
                color: "white",
              }}
            >
              Browse Menu
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 24,
            paddingBottom: insets.bottom + 24,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        >
          {categories.map((categoryName) => {
            const items = favoritesByCategory[categoryName];
            const isExpanded = expandedCategory === categoryName;

            return (
              <View
                key={categoryName}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  marginBottom: 16,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: colors.separator,
                }}
              >
                {/* Category Header */}
                <TouchableOpacity
                  onPress={() => toggleCategory(categoryName)}
                  style={{
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: colors.surface,
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontFamily: "Inter_600SemiBold",
                        fontSize: 18,
                        color: colors.text,
                      }}
                    >
                      {categoryName}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 14,
                        color: colors.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 24,
                      color: colors.primary,
                    }}
                  >
                    {isExpanded ? "−" : "+"}
                  </Text>
                </TouchableOpacity>

                {/* Category Items */}
                {isExpanded && (
                  <View style={{ padding: 12 }}>
                    {items.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleProductPress(item.product_id)}
                        style={{
                          flexDirection: "row",
                          backgroundColor: colors.background,
                          borderRadius: 12,
                          marginBottom: 12,
                          overflow: "hidden",
                          borderWidth: 1,
                          borderColor: colors.separator,
                        }}
                      >
                        {/* Product Image */}
                        {item.image_url ? (
                          <Image
                            source={{ uri: item.image_url }}
                            style={{
                              width: 100,
                              height: 100,
                              backgroundColor: colors.surface,
                            }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: 100,
                              height: 100,
                              backgroundColor: colors.surface,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <ShoppingCart
                              size={32}
                              color={colors.textSecondary}
                            />
                          </View>
                        )}

                        {/* Product Info */}
                        <View
                          style={{
                            flex: 1,
                            padding: 12,
                            justifyContent: "space-between",
                          }}
                        >
                          <View>
                            <Text
                              style={{
                                fontFamily: "Inter_600SemiBold",
                                fontSize: 16,
                                color: colors.text,
                              }}
                              numberOfLines={2}
                            >
                              {item.name}
                            </Text>
                            {item.description && (
                              <Text
                                style={{
                                  fontFamily: "Inter_400Regular",
                                  fontSize: 12,
                                  color: colors.textSecondary,
                                  marginTop: 4,
                                }}
                                numberOfLines={2}
                              >
                                {item.description}
                              </Text>
                            )}
                          </View>

                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginTop: 8,
                            }}
                          >
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <Text
                                style={{
                                  fontFamily: "Inter_600SemiBold",
                                  fontSize: 16,
                                  color: colors.primary,
                                }}
                              >
                                ${parseFloat(item.price).toFixed(2)}
                              </Text>
                              {item.rating > 0 && (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <Star
                                    size={14}
                                    color="#F59E0B"
                                    fill="#F59E0B"
                                  />
                                  <Text
                                    style={{
                                      fontFamily: "Inter_500Medium",
                                      fontSize: 12,
                                      color: colors.textSecondary,
                                    }}
                                  >
                                    {parseFloat(item.rating).toFixed(1)}
                                  </Text>
                                </View>
                              )}
                            </View>

                            {/* Remove Heart */}
                            <TouchableOpacity
                              onPress={() =>
                                handleRemoveFavorite(item.product_id)
                              }
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: colors.surface,
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <Heart size={20} color="#EF4444" fill="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
