import React, { useState, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  Animated,
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useTheme } from "../../../utils/theme";
import { useAuth } from "../../../utils/auth/useAuth";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
} from "@expo-google-fonts/playfair-display";
import { useBranchStore } from "../../../utils/branchStore";
import { SlideMenu } from "../../../components/Home/SlideMenu";
import { useCartData } from "../../../hooks/useCartData";
import { useUnifiedCartMutations } from "../../../hooks/useUnifiedCartMutations";
import { useCartActions } from "../../../hooks/useCartActions";
import { CartHeader } from "../../../components/Cart/CartHeader";
import { EmptyCart } from "../../../components/Cart/EmptyCart";
import { CartItem } from "../../../components/Cart/CartItem";
import { CartSummary } from "../../../components/Cart/CartSummary";
import { CheckoutButton } from "../../../components/Cart/CheckoutButton";
import { calculateCartTotals } from "../../../utils/cartHelpers";
import {
  apiFetch,
  API_FETCH_VERSION,
  getChosenApiBaseUrl,
  resolveApiUrl,
} from "../../../utils/apiFetch";
import { getAuthPhone } from "../../../utils/auth/getAuthPhone";

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, statusBarStyle } = useTheme();
  const { selectedBranch, setSelectedBranch } = useBranchStore();
  const { isAuthenticated, isReady, auth } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [menuVisible, setMenuVisible] = useState(false);

  // Debug toggle (long-press "Cart" title)
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugCartResponse, setDebugCartResponse] = useState(null);
  const [debugCartError, setDebugCartError] = useState(null);

  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
  });

  const { data: cartData, isLoading } = useCartData(
    selectedBranch,
    isAuthenticated,
    isReady,
  );

  // We keep cartItems for rendering the cart.
  const cartItems = cartData?.cart_items || [];

  const {
    updateQuantityMutation,
    removeItemMutation,
    removeCustomizationMutation,
    isMutating,
  } = useUnifiedCartMutations(selectedBranch, isAuthenticated);

  const {
    handleCloseCart,
    handleCheckout,
    handleMenuPress,
    handleChangeLocation,
    updateQuantity,
    removeItem,
    removeCustomization,
  } = useCartActions(
    selectedBranch,
    setSelectedBranch,
    router,
    isAuthenticated,
    isReady,
    isMutating,
  );

  const toggleDebug = () => {
    setDebugVisible((v) => !v);
  };

  const openCartItemInEditMode = (item) => {
    if (!item?.product_id || !item?.id) {
      console.warn(
        "[Cart] Cannot open item in edit mode - missing product_id or item id",
        item,
      );
      return;
    }

    try {
      const productId = String(item.product_id);
      const cartItemId = String(item.id);

      console.log("[Cart] Opening item in edit mode:", {
        productId,
        cartItemId,
        platform: Platform.OS,
      });

      router.push({
        pathname: "/product-detail",
        params: {
          id: productId,
          cart_item_id: cartItemId,
        },
      });
    } catch (error) {
      console.error("[Cart] Failed to open item in edit mode:", error);
    }
  };

  useEffect(() => {
    if (!selectedBranch) {
      router.replace("/(tabs)/home");
    }
  }, [selectedBranch]);

  // When debug is open, fetch a "debug=1" copy of the cart response so we can see
  // resolved user_id / header presence even in production builds.
  useEffect(() => {
    let cancelled = false;

    const fetchDebug = async () => {
      if (!debugVisible || !selectedBranch) {
        return;
      }

      setDebugCartError(null);

      try {
        const phone = await getAuthPhone();

        const params = new URLSearchParams({
          branch_id: String(selectedBranch.id),
          debug: "1",
        });

        if (phone) {
          params.append("phone", phone);
        }

        const url = `/api/cart?${params.toString()}`;
        const resolvedUrl = resolveApiUrl(url);

        const response = await apiFetch(url);

        const contentType = response.headers.get("content-type") || "";
        let data = null;
        let rawTextPreview = null;
        let jsonParsed = false;

        // Read as JSON when possible, otherwise capture a short text preview.
        try {
          if (contentType.includes("application/json")) {
            data = await response.json();
            jsonParsed = true;
          } else {
            const txt = await response.text();
            rawTextPreview = String(txt || "").slice(0, 240);
          }
        } catch (e) {
          try {
            const txt = await response.text();
            rawTextPreview = String(txt || "").slice(0, 240);
          } catch (e2) {
            // ignore
          }
        }

        if (cancelled) {
          return;
        }

        setDebugCartResponse({
          ok: response.ok,
          status: response.status,
          contentType,
          jsonParsed,
          data,
          rawTextPreview,
          requestedUrl: url,
          resolvedUrl,
          finalUrl: response.url || null,
        });
      } catch (e) {
        if (cancelled) {
          return;
        }

        console.error("[CART DEBUG] Failed to fetch debug cart:", e);
        setDebugCartError(String(e?.message || e));
        setDebugCartResponse(null);
      }
    };

    fetchDebug();

    return () => {
      cancelled = true;
    };
  }, [debugVisible, selectedBranch?.id]);

  if (!loaded || !selectedBranch) {
    return null;
  }

  const headerHeight = 72;
  const { totalItems, subtotal } = calculateCartTotals(cartItems);

  // Inventory helper: sum quantities per product across cart lines
  const productQtyMap = {};
  cartItems.forEach((item) => {
    const pid = item.product_id;
    if (!pid) return;
    productQtyMap[pid] = (productQtyMap[pid] || 0) + (item.quantity || 0);
  });

  const debugRows = [];

  if (debugVisible) {
    const apiBase = getChosenApiBaseUrl();
    const authUserId = auth?.user?.id === undefined ? null : auth?.user?.id;
    const authPhone = auth?.phone || auth?.user?.phone || null;

    const debugResolvedUserId =
      debugCartResponse?.data?.debug?.resolved_user_id;
    const debugBranchId = debugCartResponse?.data?.debug?.branch_id;

    debugRows.push({ label: "Platform", value: String(Platform.OS) });
    debugRows.push({ label: "__DEV__", value: String(!!global.__DEV__) });
    debugRows.push({
      label: "API_FETCH_VERSION",
      value: String(API_FETCH_VERSION),
    });
    debugRows.push({ label: "Chosen API base", value: String(apiBase) });

    debugRows.push({ label: "isReady", value: String(!!isReady) });
    debugRows.push({
      label: "isAuthenticated",
      value: String(!!isAuthenticated),
    });
    debugRows.push({
      label: "auth.user.id",
      value: authUserId === null ? "null" : String(authUserId),
    });
    debugRows.push({
      label: "auth.phone",
      value: authPhone === null ? "null" : String(authPhone),
    });
    debugRows.push({
      label: "selectedBranch.id",
      value: String(selectedBranch?.id),
    });

    if (debugCartResponse) {
      debugRows.push({
        label: "Debug GET status",
        value: `${debugCartResponse.ok ? "OK" : "FAIL"} (${debugCartResponse.status})`,
      });
      debugRows.push({
        label: "Debug GET url",
        value: String(debugCartResponse.requestedUrl),
      });
      debugRows.push({
        label: "Resolved url",
        value: String(debugCartResponse.resolvedUrl || "(missing)"),
      });
      debugRows.push({
        label: "Final url (after redirects)",
        value: debugCartResponse.finalUrl
          ? String(debugCartResponse.finalUrl)
          : "(missing)",
      });
      debugRows.push({
        label: "Content-Type",
        value: String(debugCartResponse.contentType || "(missing)"),
      });
      debugRows.push({
        label: "JSON parsed",
        value: String(!!debugCartResponse.jsonParsed),
      });

      // If JSON parsing failed, show the first chunk of the response body.
      if (!debugCartResponse.jsonParsed && debugCartResponse.rawTextPreview) {
        debugRows.push({
          label: "Body preview",
          value: String(debugCartResponse.rawTextPreview),
        });
      }

      debugRows.push({
        label: "Backend resolved_user_id",
        value:
          debugResolvedUserId === null || debugResolvedUserId === undefined
            ? "(missing)"
            : String(debugResolvedUserId),
      });
      debugRows.push({
        label: "Backend branch_id",
        value:
          debugBranchId === null || debugBranchId === undefined
            ? "(missing)"
            : String(debugBranchId),
      });
      debugRows.push({
        label: "Backend unauthenticated",
        value: String(!!debugCartResponse?.data?.unauthenticated),
      });
      debugRows.push({
        label: "Backend items",
        value: String(
          Array.isArray(debugCartResponse?.data?.cart_items)
            ? debugCartResponse.data.cart_items.length
            : 0,
        ),
      });

      const hasAuthPhoneHeader =
        debugCartResponse?.data?.debug?.has_auth_phone_header;
      const hasAuthUserIdHeader =
        debugCartResponse?.data?.debug?.has_auth_user_id_header;

      debugRows.push({
        label: "Backend has_auth_phone_header",
        value:
          hasAuthPhoneHeader === null || hasAuthPhoneHeader === undefined
            ? "(missing)"
            : String(!!hasAuthPhoneHeader),
      });
      debugRows.push({
        label: "Backend has_auth_user_id_header",
        value:
          hasAuthUserIdHeader === null || hasAuthUserIdHeader === undefined
            ? "(missing)"
            : String(!!hasAuthUserIdHeader),
      });
    }

    if (debugCartError) {
      debugRows.push({ label: "Debug error", value: String(debugCartError) });
    }
  }

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={statusBarStyle} />

      <SlideMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        colors={colors}
        selectedBranch={selectedBranch}
        onChangeLocation={() => handleChangeLocation(cartData)}
      />

      <CartHeader
        colors={colors}
        insets={insets}
        scrollY={scrollY}
        headerHeight={headerHeight}
        totalItems={totalItems}
        onMenuPress={() => handleMenuPress(setMenuVisible)}
        onClose={handleCloseCart}
        onTitleLongPress={toggleDebug}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + headerHeight + 12,
          paddingBottom: insets.bottom + 80,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        {/* Debug panel (long-press "Cart" title to toggle) */}
        {debugVisible && (
          <View
            style={{
              marginHorizontal: 24,
              marginBottom: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.separator,
              borderRadius: 14,
              backgroundColor: colors.card,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  color: colors.text,
                  fontSize: 14,
                }}
              >
                Debug (Cart)
              </Text>
              <TouchableOpacity onPress={toggleDebug} style={{ padding: 6 }}>
                <Text
                  style={{
                    fontFamily: "Inter_500Medium",
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  Hide
                </Text>
              </TouchableOpacity>
            </View>

            {debugRows.map((row) => {
              const rowKey = `${row.label}`;
              return (
                <View
                  key={rowKey}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: "Inter_500Medium",
                      color: colors.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    {row.label}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: "Inter_400Regular",
                      color: colors.text,
                      fontSize: 12,
                      textAlign: "right",
                    }}
                    numberOfLines={3}
                  >
                    {row.value}
                  </Text>
                </View>
              );
            })}

            <Text
              style={{
                marginTop: 10,
                fontFamily: "Inter_400Regular",
                color: colors.textSecondary,
                fontSize: 11,
                lineHeight: 14,
              }}
            >
              Tip: long-press the "Cart" title again to toggle this panel.
            </Text>
          </View>
        )}

        {cartItems.length === 0 ? (
          <EmptyCart
            colors={colors}
            onBrowseMenu={() => router.push("/(tabs)/home")}
          />
        ) : (
          <>
            <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
              {cartItems.map((item) => {
                const inventoryApplies = !!item.inventory_applies;
                const qohRaw = item.quantity_on_hand;
                const qoh =
                  qohRaw === null || qohRaw === undefined ? 0 : Number(qohRaw);

                const totalForProduct = productQtyMap[item.product_id] || 0;
                const otherLines = Math.max(
                  0,
                  totalForProduct - (item.quantity || 0),
                );

                const maxQuantity = inventoryApplies
                  ? Math.max(0, qoh - otherLines)
                  : undefined;

                // ✅ iOS FIX: Create a unique key that changes when addons/customizations change
                // This forces React Native to properly re-render the component
                const addonsKey = Array.isArray(item.addons)
                  ? item.addons.map((a) => a.addon_id || a.id).join(",")
                  : "no-addons";

                const customizationsKey = Array.isArray(item.customizations)
                  ? item.customizations.map((c) => c.id).join(",")
                  : "no-customizations";

                const itemKey = `${item.id}-${item.quantity}-${addonsKey}-${customizationsKey}-${item.comment || ""}`;

                return (
                  <CartItem
                    key={itemKey}
                    item={item}
                    colors={colors}
                    maxQuantity={maxQuantity}
                    onRemove={(id) => removeItem(id, removeItemMutation)}
                    onUpdateQuantity={(id, qty) =>
                      updateQuantity(id, qty, updateQuantityMutation)
                    }
                    onPressImage={openCartItemInEditMode}
                  />
                );
              })}
            </View>

            {/* Cart should NOT show recommendations */}

            <CartSummary colors={colors} subtotal={subtotal} />
          </>
        )}
      </ScrollView>

      {cartItems.length > 0 && (
        <CheckoutButton
          colors={colors}
          insets={insets}
          subtotal={subtotal}
          onCheckout={() => handleCheckout(cartData)}
        />
      )}
    </View>
  );
}
