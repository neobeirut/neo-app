import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { localCartStore } from "../utils/localCartStore";
import { useRedirectStore } from "../utils/redirectStore";
import { apiFetch } from "../utils/apiFetch";
import { getAuthPhone } from "../utils/auth/getAuthPhone";
import {
  buildCustomizationsPayload,
  getDefaultSelectedOptions,
} from "../utils/productDetailHelpers";
// ✅ Use the unified cart system so cart line uniqueness (customizations + add-ons + comment)
// is consistent across Home/Menu/Product Detail.
import { useUnifiedCartMutations } from "./useUnifiedCartMutations";

export function useHomeActions(
  selectedBranch,
  setSelectedBranch,
  router,
  isAuthenticated,
  isReady,
) {
  const queryClient = useQueryClient();
  const { setRedirect } = useRedirectStore();

  const cartKey = (branchId, authFlag) => ["cart", branchId, !!authFlag];

  // Prefer authenticated cache when available (prevents “qty looks wrong” during auth flickers)
  const getCachedCartItemsForBranch = (branchId) => {
    const authCart = queryClient.getQueryData(cartKey(branchId, true));
    const authItems = authCart?.cart_items || [];
    if (authItems.length > 0) {
      return authItems;
    }

    const anonCart = queryClient.getQueryData(cartKey(branchId, false));
    return anonCart?.cart_items || [];
  };

  const showLimitedAvailability = (product, maxAvailable) => {
    const name = product?.name || "This item";
    const branchName = selectedBranch?.name || "this branch";

    const raw =
      maxAvailable === null || maxAvailable === undefined
        ? 0
        : Number(maxAvailable);

    const available = Number.isFinite(raw) && raw >= 0 ? raw : 0;

    Alert.alert(
      "Limited availability",
      `Only ${available} ${name}(s) are available today at ${branchName}.\nPlease adjust your quantity to continue.`,
    );
  };

  const getInCartQtyForProduct = (productId) => {
    if (!selectedBranch?.id) return 0;
    const cartItems = getCachedCartItemsForBranch(selectedBranch.id);
    return cartItems
      .filter((i) => Number(i.product_id) === Number(productId))
      .reduce((sum, i) => sum + (i.quantity || 0), 0);
  };

  const getInventoryRemainingForProduct = (product) => {
    if (!product?.inventory_applies) {
      return null; // unlimited
    }

    const qoh =
      product.quantity_on_hand === null ||
      product.quantity_on_hand === undefined
        ? 0
        : Number(product.quantity_on_hand);

    const inCart = getInCartQtyForProduct(product.id);
    return Math.max(0, qoh - inCart);
  };

  const getBestCachedProduct = (productId) => {
    const pid = Number(productId);
    const productsData = queryClient.getQueryData(["products"]);
    const list = productsData?.products || [];
    return list.find((p) => Number(p.id) === pid) || null;
  };

  // ✅ Use unified cart mutations (instead of Home-specific mutation) to avoid
  // incorrectly merging “same product, different customizations/add-ons” into one line.
  const { addToCartMutation } = useUnifiedCartMutations(
    selectedBranch,
    isAuthenticated,
  );

  // Clear cart mutation
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBranch?.id) {
        throw new Error("No branch selected");
      }

      // Anonymous users -> local clear
      if (!isAuthenticated) {
        await localCartStore.clearCart(selectedBranch.id);
        return { ok: true };
      }

      const phone = await getAuthPhone();
      const requestBody = {
        branch_id: selectedBranch.id,
        ...(phone ? { phone } : {}),
      };

      const response = await apiFetch("/api/cart/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to clear cart");
      }
      return response.json();
    },
    onSuccess: () => {
      // Keep cart caches fresh, but do NOT clear selectedBranch here.
      // We want the branch picker screen to show the current branch as selected,
      // and we don't want Home to briefly render "No categories available".
      if (selectedBranch?.id) {
        queryClient.invalidateQueries({
          queryKey: cartKey(selectedBranch.id, true),
        });
        queryClient.invalidateQueries({
          queryKey: cartKey(selectedBranch.id, false),
        });
      }

      // Send user to the branch picker ("branch page") after clearing.
      router.replace("/select-branch");
    },
  });

  const safeHaptics = {
    selection: () => {
      if (Platform.OS === "web") return;
      Haptics.selectionAsync().catch(() => {});
    },
    warning: () => {
      if (Platform.OS === "web") return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
    },
    success: () => {
      if (Platform.OS === "web") return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    },
  };

  const prefetchProductDetail = (productId) => {
    if (!selectedBranch?.id) return;

    const pid = String(productId);
    const branchId = selectedBranch.id;

    // Prefetch in background (do NOT await; keep navigation instant)
    queryClient
      .prefetchQuery({
        queryKey: ["product", pid, branchId],
        queryFn: async () => {
          const response = await apiFetch(
            `/api/products/${pid}?branch_id=${branchId}`,
          );
          if (!response.ok) throw new Error("Failed to fetch product");
          const data = await response.json();
          return data.product;
        },
        staleTime: 30 * 1000,
      })
      .catch(() => {});

    queryClient
      .prefetchQuery({
        queryKey: ["product-addons", pid],
        queryFn: async () => {
          const response = await apiFetch(`/api/products/${pid}/addons`);
          if (!response.ok) return [];
          const data = await response.json();
          return data.addons || [];
        },
        staleTime: 60 * 1000,
      })
      .catch(() => {});

    queryClient
      .prefetchQuery({
        queryKey: ["product-customizations", pid],
        queryFn: async () => {
          const response = await apiFetch(
            `/api/products/${pid}/customizations`,
          );
          if (!response.ok) return [];
          const data = await response.json();
          return data.customizations || [];
        },
        staleTime: 60 * 1000,
      })
      .catch(() => {});

    // Prefetch "You might also like" so it shows up quickly on the product page.
    queryClient
      .prefetchQuery({
        queryKey: ["recommendations", Number(branchId), Number(pid), "", 4],
        queryFn: async () => {
          const response = await apiFetch("/api/recommendations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              branch_id: Number(branchId),
              current_product_id: Number(pid),
              cart_product_ids: [],
              max_suggestions: 4,
            }),
          });
          if (!response.ok) {
            throw new Error("Failed to fetch recommendations");
          }
          return response.json();
        },
        staleTime: 2 * 60 * 1000,
      })
      .catch(() => {});
  };

  const handleProductPress = async (product) => {
    safeHaptics.selection();

    // Allow navigation for Available and Unavailable Today products
    if (
      product.status === "Available" ||
      product.status === "Unavailable Today"
    ) {
      prefetchProductDetail(product.id);
      router.push({
        pathname: "/product-detail",
        params: { id: String(product.id) },
      });
      return;
    }

    if (
      product.status === "Unavailable Until Further Notice" ||
      product.status === "Hide from Menu"
    ) {
      safeHaptics.warning();
      const statusText =
        product.status === "Unavailable Until Further Notice"
          ? "on hold"
          : product.status.toLowerCase();
      Alert.alert(
        "Product Unavailable",
        `${product.name} is currently ${statusText}. This item cannot be ordered at this time.`,
        [{ text: "OK", style: "cancel" }],
      );
      return;
    }

    safeHaptics.warning();
  };

  const getOrFetchProductCustomizations = async (productId) => {
    const pid = String(Number(productId));

    const key = ["product-customizations", pid];

    const cached = queryClient.getQueryData(key);
    if (Array.isArray(cached)) {
      return cached;
    }

    try {
      const response = await apiFetch(`/api/products/${pid}/customizations`);
      if (!response.ok) {
        queryClient.setQueryData(key, []);
        return [];
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        queryClient.setQueryData(key, []);
        return [];
      }

      const data = await response.json();
      const list = Array.isArray(data?.customizations)
        ? data.customizations
        : [];
      queryClient.setQueryData(key, list);
      return list;
    } catch (e) {
      console.warn("[HomeActions] Failed to fetch product customizations", e);
      queryClient.setQueryData(key, []);
      return [];
    }
  };

  const buildDefaultOptionsPayloadForProduct = async (productId) => {
    const list = await getOrFetchProductCustomizations(productId);
    const defaults = getDefaultSelectedOptions(list);

    const hasDefaults =
      defaults &&
      typeof defaults === "object" &&
      Object.keys(defaults).length > 0;

    if (!hasDefaults) {
      return [];
    }

    return buildCustomizationsPayload({
      customizations: list,
      selectedCustomizations: [],
      selectedOptions: defaults,
    });
  };

  const handleAddToCart = async (product, meta) => {
    safeHaptics.selection();

    // Inventory guard (best-effort client-side)
    const remaining = getInventoryRemainingForProduct(product);
    if (remaining !== null && remaining <= 0) {
      showLimitedAvailability(product, remaining);
      return;
    }

    // Check if product is completely unavailable
    if (
      product.status === "Unavailable Until Further Notice" ||
      product.status === "Hide from Menu"
    ) {
      const statusText =
        product.status === "Unavailable Until Further Notice"
          ? "on hold"
          : product.status.toLowerCase();
      Alert.alert(
        "Product Unavailable",
        `${product.name} is currently ${statusText}.`,
      );
      return;
    }

    const hasCustomizationsHint =
      meta?.hasCustomizations === true || product?.has_customizations === true;

    // If the product has option groups, add it with default option selections.
    // (This keeps the cart item valid and matches the Product Details defaults.)
    let defaultCustomizationsPayload = [];
    if (hasCustomizationsHint) {
      defaultCustomizationsPayload = await buildDefaultOptionsPayloadForProduct(
        product.id,
      );
    }

    const addPayload = {
      product_id: Number(product.id),
      branch_id: Number(selectedBranch.id),
      quantity: 1,
      // Home “Add” should NEVER carry add-ons/notes.
      selected_addons: [],
      comment: null,
      customizations: defaultCustomizationsPayload,
      shouldNavigateBack: false,
    };

    // Check if product is unavailable today
    if (product.status === "Unavailable Today") {
      if (remaining !== null && remaining <= 0) {
        showLimitedAvailability(product, remaining);
        return;
      }

      Alert.alert(
        "Unavailable Today",
        `${product.name} is unavailable for orders today. If you schedule delivery/pickup for today, you will not receive this item.`,
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
            text: "Add Anyway",
            onPress: () => {
              addToCartMutation.mutate(addPayload);
            },
          },
        ],
      );
      return;
    }

    // Product is available, add directly
    addToCartMutation.mutate(addPayload);
  };

  const handleChangeLocation = async (cartData) => {
    safeHaptics.selection();

    const hasCartItems = cartData?.cart_items && cartData.cart_items.length > 0;

    if (hasCartItems) {
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
            text: "Change Branch",
            style: "destructive",
            onPress: async () => {
              safeHaptics.success();

              // Navigate immediately to the branch picker.
              // If clearing fails, Select Branch will still prompt before switching.
              router.replace("/select-branch");
              clearCartMutation.mutate();
            },
          },
        ],
        { cancelable: true },
      );
    } else {
      // Go to the branch picker without clearing selectedBranch first.
      // Clearing it first causes Home to render an empty state ("No categories available").
      router.replace("/select-branch");
    }
  };

  return {
    addToCartMutation,
    clearCartMutation,
    handleProductPress,
    handleAddToCart,
    handleChangeLocation,
  };
}
