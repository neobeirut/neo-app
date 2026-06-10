import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { MapPin, ChevronRight, Phone, AlertCircle } from "lucide-react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "../utils/theme";
import { useBranchStore } from "../utils/branchStore";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  useFonts,
  PlayfairDisplay_800ExtraBold,
} from "@expo-google-fonts/playfair-display";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import {
  apiFetch,
  getImageSource,
  API_FETCH_VERSION,
  getChosenApiBaseUrl,
  resolveApiUrl,
} from "../utils/apiFetch";
import { useAuth } from "../utils/auth/useAuth";
import { useCartData } from "../hooks/useCartData";

export default function SelectBranchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const queryClient = useQueryClient();
  const { isAuthenticated, isReady } = useAuth();

  // Log build/API base info once (helps debug EAS Android "undefined/api" crashes)
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    try {
      const chosenBase = getChosenApiBaseUrl();
      const branchesUrl = resolveApiUrl("/api/branches");
      console.log("[SELECT-BRANCH] apiFetch version:", API_FETCH_VERSION);
      console.log("[SELECT-BRANCH] chosen API base:", chosenBase);
      console.log("[SELECT-BRANCH] resolved /api/branches:", branchesUrl);
    } catch (e) {
      console.error("[SELECT-BRANCH] Failed to compute API base:", e);
    }
  }, []);

  const [loaded] = useFonts({
    PlayfairDisplay_800ExtraBold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const [logoSrcOverride, setLogoSrcOverride] = useState(null);
  const [backgroundSrcOverride, setBackgroundSrcOverride] = useState(null);

  const withVersionParam = (url, updatedAt) => {
    if (!url) {
      return null;
    }
    const version = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    const joinChar = url.includes("?") ? "&" : "?";
    return `${url}${joinChar}v=${encodeURIComponent(String(version))}`;
  };

  // Fetch logo
  const { data: logoData } = useQuery({
    queryKey: ["logo"],
    queryFn: async () => {
      try {
        console.log("[SELECT-BRANCH] Fetching logo...");
        const response = await apiFetch("/api/logo");
        console.log("[SELECT-BRANCH] Logo response status:", response.status);
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`Failed to fetch logo (${response.status}) ${text}`);
        }
        return response.json();
      } catch (e) {
        console.error("[SELECT-BRANCH] Logo fetch failed:", e);
        // In web preview, don't crash the screen if logo fails.
        if (Platform.OS === "web") {
          return null;
        }
        throw e;
      }
    },
    retry: Platform.OS === "web" ? 0 : 1,
  });

  // Fetch branch background
  const { data: backgroundData } = useQuery({
    queryKey: ["branch-background"],
    queryFn: async () => {
      try {
        console.log("[SELECT-BRANCH] Fetching branch background...");
        const response = await apiFetch("/api/settings/branch-background");
        console.log(
          "[SELECT-BRANCH] Background response status:",
          response.status,
        );
        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(
            `Failed to fetch background (${response.status}) ${text}`,
          );
        }
        return response.json();
      } catch (e) {
        console.error("[SELECT-BRANCH] Background fetch failed:", e);
        if (Platform.OS === "web") {
          return null;
        }
        throw e;
      }
    },
    retry: Platform.OS === "web" ? 0 : 1,
  });

  const preferredLogoUrl = useMemo(() => {
    if (!logoData) {
      return null;
    }

    // Native: prefer rawUrl (avoids proxy edge cases on some Android devices)
    const isNative = Platform.OS !== "web";
    const rawVersioned = withVersionParam(logoData.rawUrl, logoData.updatedAt);
    const urlVersioned = withVersionParam(logoData.url, logoData.updatedAt);

    if (isNative && rawVersioned) {
      return rawVersioned;
    }

    return urlVersioned || rawVersioned || null;
  }, [logoData]);

  const preferredBackgroundUrl = useMemo(() => {
    if (!backgroundData) {
      return null;
    }

    const isNative = Platform.OS !== "web";
    const rawVersioned = withVersionParam(
      backgroundData.rawUrl,
      backgroundData.updatedAt,
    );
    const urlVersioned = withVersionParam(
      backgroundData.url,
      backgroundData.updatedAt,
    );

    // Native: prefer rawUrl first, fallback to proxy
    if (isNative && rawVersioned) {
      return rawVersioned;
    }

    return urlVersioned || rawVersioned || null;
  }, [backgroundData]);

  const logoUrlToRender = logoSrcOverride || preferredLogoUrl;
  const backgroundUrlToRender = backgroundSrcOverride || preferredBackgroundUrl;

  const backgroundImageSource = backgroundUrlToRender
    ? getImageSource(backgroundUrlToRender)
    : null;
  const logoImageSource = logoUrlToRender
    ? getImageSource(logoUrlToRender)
    : null;

  const handleLogoImageError = () => {
    // If our preferred source fails, try the other URL once.
    if (logoSrcOverride) {
      return;
    }

    const fallback = withVersionParam(logoData?.url, logoData?.updatedAt);
    if (fallback) {
      setLogoSrcOverride(fallback);
    }
  };

  const handleBackgroundImageError = () => {
    if (backgroundSrcOverride) {
      return;
    }

    const fallback = withVersionParam(
      backgroundData?.url,
      backgroundData?.updatedAt,
    );
    if (fallback) {
      setBackgroundSrcOverride(fallback);
    }
  };

  // Fetch branches
  const {
    data: branchesData,
    isLoading: branchesLoading,
    error: branchesError,
  } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      console.log("[SELECT-BRANCH] 🏪 Fetching branches...");

      try {
        const response = await apiFetch("/api/branches");
        console.log(
          "[SELECT-BRANCH] Branches response status:",
          response.status,
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch branches (${response.status}): ${errorText}`,
          );
        }

        return response.json();
      } catch (err) {
        console.error("[SELECT-BRANCH] ❌ Branch fetch failed:", err);

        if (err?.name === "TypeError") {
          throw new Error(
            "Cannot connect to server in web preview. Try restarting the dev server (power button) or use Expo Go QR testing.",
          );
        }

        throw err;
      }
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // Prefetch products and categories for faster navigation
  useEffect(() => {
    if (!branchesLoading && branchesData) {
      queryClient.prefetchQuery({
        queryKey: ["products"],
        queryFn: async () => {
          const response = await apiFetch("/api/products");
          if (!response.ok) throw new Error("Failed to fetch products");
          return response.json();
        },
      });

      queryClient.prefetchQuery({
        queryKey: ["categories"],
        queryFn: async () => {
          const response = await apiFetch("/api/categories");
          if (!response.ok) throw new Error("Failed to fetch categories");
          return response.json();
        },
      });

      if (selectedBranch) {
        queryClient.prefetchQuery({
          queryKey: ["product-status", selectedBranch.id],
          queryFn: async () => {
            const response = await apiFetch(
              `/api/product-branch-status?branch_id=${selectedBranch.id}`,
            );
            if (!response.ok)
              throw new Error("Failed to fetch product statuses");
            return response.json();
          },
        });
      }
    }
  }, [branchesLoading, branchesData, selectedBranch, queryClient]);

  // Fetch cart items for current branch using the app's single cart source of truth.
  // This prevents "empty cart" issues for phone-auth users (where the backend needs phone identity).
  const { data: cartData } = useCartData(
    selectedBranch,
    isAuthenticated,
    isReady,
  );

  // Clear cart mutation
  const clearCartMutation = useMutation({
    mutationFn: async (branchId) => {
      const response = await apiFetch("/api/cart/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch_id: branchId }),
      });
      if (!response.ok) throw new Error("Failed to clear cart");
      return response.json();
    },
    onSuccess: (_, branchId) => {
      // Invalidate all cart queries for this branch (both auth and guest variants)
      queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey?.[0] === "cart" && q.queryKey?.[1] === branchId,
      });
    },
  });

  if (!loaded || branchesLoading) {
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
          Loading branches...
        </Text>
      </View>
    );
  }

  // Show error state if branches failed to load
  if (branchesError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <StatusBar style={statusBarStyle} />
        <AlertCircle size={64} color={colors.error || "#EF4444"} />
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 20,
            color: colors.text,
            marginTop: 24,
            textAlign: "center",
          }}
        >
          Unable to Load Branches
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 14,
            color: colors.textSecondary,
            marginTop: 8,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          {branchesError.message ||
            "Please check your internet connection and try again."}
        </Text>
        <TouchableOpacity
          onPress={() =>
            queryClient.invalidateQueries({ queryKey: ["branches"] })
          }
          style={{
            marginTop: 32,
            backgroundColor: colors.primary,
            paddingHorizontal: 32,
            paddingVertical: 16,
            borderRadius: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              color: "white",
            }}
          >
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const branches = branchesData?.branches || [];
  const activeBranches = branches.filter((branch) => branch.is_active);

  const handleBranchSelect = async (branch) => {
    await Haptics.selectionAsync();

    // Prefetch product statuses for the selected branch
    queryClient.prefetchQuery({
      queryKey: ["product-status", branch.id],
      queryFn: async () => {
        const response = await apiFetch(
          `/api/product-branch-status?branch_id=${branch.id}`,
        );
        if (!response.ok) throw new Error("Failed to fetch product statuses");
        return response.json();
      },
    });

    // Check if user is changing branches and has cart items
    const cartItems = cartData?.cart_items || [];
    const hasCartItems = cartItems.length > 0;
    const isDifferentBranch = selectedBranch && selectedBranch.id !== branch.id;

    if (isDifferentBranch && hasCartItems) {
      Alert.alert(
        "Change Branch?",
        "Changing your location will clear all items from your cart. Do you want to continue?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () =>
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              ),
          },
          {
            text: "Clear Cart & Continue",
            style: "destructive",
            onPress: async () => {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              await clearCartMutation.mutateAsync(selectedBranch.id);
              setSelectedBranch(branch);
              router.replace("/(tabs)/home");
            },
          },
        ],
        { cancelable: true },
      );
    } else {
      // No cart items or same branch, proceed directly
      setSelectedBranch(branch);
      // Small delay to ensure state propagates before navigation (Android fix)
      setTimeout(() => {
        router.replace("/(tabs)/home");
      }, 50);
    }
  };

  const handleWhatsApp = async (phone, event) => {
    if (event) {
      event.stopPropagation();
    }
    if (!phone) return;

    await Haptics.selectionAsync();

    // Remove all non-numeric characters
    const cleanPhone = phone.replace(/\D/g, "");

    // WhatsApp URL
    const whatsappUrl = `whatsapp://send?phone=${cleanPhone}`;

    try {
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to web WhatsApp
        const webUrl = `https://wa.me/${cleanPhone}`;
        await Linking.openURL(webUrl);
      }
    } catch (err) {
      console.error("Error opening WhatsApp:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleMapLocation = async (location, name, event) => {
    if (event) {
      event.stopPropagation();
    }
    if (!location) return;

    await Haptics.selectionAsync();

    // Try to open in native maps app
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });

    const latLng = `${location}`;
    const label = encodeURIComponent(name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        // Fallback to Google Maps web
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latLng}`;
        await Linking.openURL(googleMapsUrl);
      }
    } catch (err) {
      console.error("Error opening Maps:", err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={statusBarStyle} />

      {/* Background Image */}
      {backgroundImageSource?.uri ? (
        <Image
          source={backgroundImageSource}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          pointerEvents="none"
          onError={handleBackgroundImageError}
        />
      ) : null}

      {/* Semi-transparent overlay for better text readability */}
      <View
        style={{
          ...StyleSheet.absoluteFill,
          backgroundColor: backgroundData?.url
            ? "rgba(0, 0, 0, 0.4)"
            : colors.background,
        }}
        pointerEvents="none"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 40,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        {logoImageSource?.uri ? (
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <Image
              source={logoImageSource}
              style={{
                width: 180,
                height: 180,
                borderRadius: 20,
              }}
              contentFit="contain"
              transition={200}
              onError={handleLogoImageError}
            />
          </View>
        ) : null}

        {/* Header */}
        <View style={{ marginBottom: 40, alignItems: "center" }}>
          <Text
            style={{
              fontFamily: "PlayfairDisplay_800ExtraBold",
              fontSize: 24,
              color: backgroundData?.url ? "white" : colors.text,
              textAlign: "center",
              marginBottom: 8,
              textShadowColor: backgroundData?.url
                ? "rgba(0, 0, 0, 0.3)"
                : "transparent",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            Choose the location you'd like to order from
          </Text>
        </View>

        {/* Branch List */}
        {activeBranches.length > 0 ? (
          activeBranches.map((branch) => (
            <View
              key={branch.id}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                marginBottom: 16,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
                borderWidth: selectedBranch?.id === branch.id ? 2 : 0,
                borderColor: colors.primary,
                overflow: "visible",
                minHeight: 120, // Ensure enough height for both action icons
              }}
            >
              {/* Main Card - Branch Selection */}
              <TouchableOpacity
                style={{
                  padding: 20,
                  flexDirection: "row",
                  alignItems: "center",
                  minHeight: 120, // Match parent minimum height
                }}
                onPress={() => handleBranchSelect(branch)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 18,
                      color: colors.text,
                      marginBottom: 4,
                    }}
                  >
                    {branch.name}
                  </Text>
                  {branch.address && (
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 14,
                        color: colors.textSecondary,
                        lineHeight: 20,
                      }}
                    >
                      {branch.address}
                    </Text>
                  )}
                </View>

                {/* Vertical Divider */}
                <View
                  style={{
                    width: 1,
                    height: "100%",
                    backgroundColor: colors.separator,
                    marginRight: 16,
                  }}
                />

                {/* Spacer for action icons */}
                <View style={{ width: 60 }} />
              </TouchableOpacity>

              {/* Action Icons - Absolute Positioned */}
              <View
                style={{
                  position: "absolute",
                  right: 20,
                  top: 0,
                  bottom: 0,
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 120, // Ensure container height matches
                }}
              >
                {/* Phone/WhatsApp Icon */}
                {branch.phone && (
                  <TouchableOpacity
                    onPress={(e) => handleWhatsApp(branch.phone, e)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.surface,
                      justifyContent: "center",
                      alignItems: "center",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                    activeOpacity={0.6}
                  >
                    <Phone size={20} color="#25D366" />
                  </TouchableOpacity>
                )}

                {/* Location/Maps Icon */}
                {branch.location && (
                  <TouchableOpacity
                    onPress={(e) =>
                      handleMapLocation(branch.location, branch.name, e)
                    }
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.surface,
                      justifyContent: "center",
                      alignItems: "center",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2,
                    }}
                    activeOpacity={0.6}
                  >
                    <MapPin size={20} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 16,
                color: backgroundData?.url ? "white" : colors.textSecondary,
                textAlign: "center",
              }}
            >
              No branches available at the moment
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
