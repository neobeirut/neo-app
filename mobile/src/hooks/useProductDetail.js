import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Platform } from "react-native";
import { useRedirectStore } from "@/utils/redirectStore";
import { useUnifiedCartMutations } from "./useUnifiedCartMutations";
import { apiFetch } from "@/utils/apiFetch";
import { getAuthPhone } from "@/utils/auth/getAuthPhone";
import { getDefaultSelectedOptions } from "@/utils/productDetailHelpers";

function getCustomizationType(c) {
  return c?.type || c?.customization_type || null;
}

export function useProductDetail(
  productId,
  selectedBranch,
  isAuthenticated,
  signIn,
  router,
  initialCartItem, // optional: cart item to preload selections from
) {
  const queryClient = useQueryClient();
  const pid = String(productId);
  const branchId = selectedBranch?.id ? String(selectedBranch.id) : null;
  const { setRedirect } = useRedirectStore();

  const [selectedAddons, setSelectedAddons] = useState([]);
  const [selectedCustomizations, setSelectedCustomizations] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [userRating, setUserRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Use unified cart mutations (supports anonymous + signed-in)
  const {
    addToCartMutation,
    updateQuantityMutation,
    updateItemDetailsMutation,
  } = useUnifiedCartMutations(selectedBranch, isAuthenticated);

  // Hydrate state when opening Product Details from a cart line item
  const hydratedCartItemIdRef = useRef(null);
  useEffect(() => {
    const cartItem = initialCartItem;
    if (!cartItem?.id) {
      hydratedCartItemIdRef.current = null;
      return;
    }

    // Only hydrate once per cart item id so we don't overwrite user edits
    if (hydratedCartItemIdRef.current === cartItem.id) {
      return;
    }

    hydratedCartItemIdRef.current = cartItem.id;

    // quantity
    const q = Number(cartItem.quantity || 1);
    setQuantity(Number.isFinite(q) && q > 0 ? q : 1);

    // product add-ons (product_addons table)
    const existingAddons = Array.isArray(cartItem.addons)
      ? cartItem.addons
      : [];
    const addonIds = existingAddons
      .map((a) => a?.addon_id ?? a?.id)
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x));
    setSelectedAddons(addonIds);

    // customizations (options/removals/customization-addons)
    const current = Array.isArray(cartItem.customizations)
      ? cartItem.customizations
      : [];

    const optionEntries = current.filter(
      (c) => getCustomizationType(c) === "option",
    );
    const otherEntries = current.filter((c) => {
      const t = getCustomizationType(c);
      return t === "addon" || t === "remove";
    });

    const optionsByGroup = {};
    optionEntries.forEach((opt) => {
      const group = opt?.option_group_name || "Options";
      const id = Number(opt?.id);
      if (!Number.isFinite(id)) return;
      if (!Array.isArray(optionsByGroup[group])) {
        optionsByGroup[group] = [];
      }
      optionsByGroup[group].push(id);
    });

    const customIds = otherEntries
      .map((c) => Number(c?.id))
      .filter((x) => Number.isFinite(x));

    setSelectedOptions(optionsByGroup);
    setSelectedCustomizations(customIds);
  }, [initialCartItem?.id]);

  const cartKey = selectedBranch?.id
    ? ["cart", selectedBranch.id, !!isAuthenticated]
    : null;

  const getInCartQtyForThisProduct = () => {
    if (!cartKey) return 0;
    const cart = queryClient.getQueryData(cartKey);
    const cartItems = cart?.cart_items || [];
    return cartItems
      .filter((i) => i.product_id === Number(productId))
      .reduce((sum, i) => sum + (i.quantity || 0), 0);
  };

  const getMaxAddableFromStock = (prod) => {
    if (!prod?.inventory_applies) return null;
    const qoh =
      prod.quantity_on_hand === null || prod.quantity_on_hand === undefined
        ? 0
        : Number(prod.quantity_on_hand);
    const inCart = getInCartQtyForThisProduct();
    return Math.max(0, qoh - inCart);
  };

  const showLimitedAvailability = (prod, maxAvailable) => {
    const name = prod?.name || "This item";
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

  // Fetch product details with branch-specific status
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ["product", pid, branchId],
    queryFn: async () => {
      if (!selectedBranch) return null;
      const response = await apiFetch(
        `/api/products/${pid}?branch_id=${selectedBranch.id}`,
      );
      if (!response.ok) throw new Error("Failed to fetch product");
      const data = await response.json();
      return data.product;
    },
    enabled: !!selectedBranch,
    staleTime: 30 * 1000, // Reduced to 30s to enable real-time inventory updates
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds for inventory
    refetchOnWindowFocus: true, // Refetch when returning to product detail
    refetchOnMount: true, // Always refetch latest data on mount
    initialData: () => {
      if (!selectedBranch?.id) return undefined;

      // Try to build a fast placeholder from caches so the screen opens instantly.
      const productsData = queryClient.getQueryData(["products"]);
      const base = productsData?.products?.find(
        (p) => String(p.id) === String(pid),
      );

      const statusData = queryClient.getQueryData([
        "product-status",
        selectedBranch.id,
      ]);
      const branchRow = statusData?.products?.find(
        (p) => String(p.id) === String(pid),
      );

      if (!base && !branchRow) return undefined;

      const merged = {
        ...(base || {}),
        ...(branchRow || {}),
      };

      // Ensure important fields exist even if only one source had them
      if (merged.price === undefined || merged.price === null) {
        merged.price = base?.price ?? branchRow?.price ?? 0;
      }
      if (merged.status === undefined || merged.status === null) {
        merged.status = branchRow?.status ?? base?.status ?? "Available";
      }

      return merged;
    },
  });

  // Fetch product add-ons - OPTIMIZED for real-time inventory
  const { data: addons = [] } = useQuery({
    queryKey: ["product-addons", pid],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await apiFetch(`/api/products/${pid}/addons`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(
            `[useProductDetail] Addons fetch failed with status ${response.status}`,
          );
          return [];
        }
        const data = await response.json();
        return data.addons || [];
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          console.error(
            `[useProductDetail] Addons fetch timed out for product ${pid}`,
          );
        } else {
          console.error(`[useProductDetail] Addons fetch error:`, error);
        }
        return [];
      }
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Fetch product customizations - OPTIMIZED for real-time inventory
  const { data: customizations = [] } = useQuery({
    queryKey: ["product-customizations", pid],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await apiFetch(`/api/products/${pid}/customizations`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          console.error(
            `[useProductDetail] Failed to fetch customizations for product ${pid} (status ${response.status}) ${text}`,
          );
          return [];
        }
        const data = await response.json();
        return data.customizations || [];
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
          console.error(
            `[useProductDetail] Customizations fetch timed out for product ${pid}`,
          );
        } else {
          console.error(
            `[useProductDetail] Customizations fetch error:`,
            error,
          );
        }
        return [];
      }
    },
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // NEW: default options (must run AFTER customizations load)
  const defaultOptionsForProductRef = useRef(null);
  useEffect(() => {
    const cartItem = initialCartItem;
    if (cartItem?.id) {
      // Editing a cart item: do not override the user's existing selections.
      defaultOptionsForProductRef.current = null;
      return;
    }

    if (!productId) {
      defaultOptionsForProductRef.current = null;
      return;
    }

    if (!Array.isArray(customizations) || customizations.length === 0) {
      return;
    }

    const key = String(productId);
    if (defaultOptionsForProductRef.current === key) {
      return;
    }

    const hasAnySelected =
      selectedOptions &&
      typeof selectedOptions === "object" &&
      Object.values(selectedOptions).some(
        (arr) => Array.isArray(arr) && arr.length > 0,
      );

    if (hasAnySelected) {
      defaultOptionsForProductRef.current = key;
      return;
    }

    const defaults = getDefaultSelectedOptions(customizations);
    const hasDefaults =
      defaults &&
      typeof defaults === "object" &&
      Object.keys(defaults).length > 0;

    if (hasDefaults) {
      setSelectedOptions(defaults);
    }

    defaultOptionsForProductRef.current = key;
  }, [productId, customizations, initialCartItem?.id]);

  // Fetch reviews and ratings
  const { data: reviewsData } = useQuery({
    queryKey: ["product-reviews", pid],
    queryFn: async () => {
      const response = await apiFetch(`/api/products/${pid}/reviews`);
      if (!response.ok)
        return { reviews: [], average_rating: 0, total_reviews: 0 };
      return response.json();
    },
    staleTime: 30 * 1000,
  });

  // Rating submission mutation
  const ratingMutation = useMutation({
    mutationFn: async ({ rating, review_text }) => {
      const phone = await getAuthPhone();

      // In Anything web preview, cookies are omitted, so phone is required.
      // On native, a session cookie may work even without phone.
      if (!phone && Platform.OS === "web") {
        throw new Error("Authentication required");
      }

      const response = await apiFetch(`/api/products/${pid}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, review_text, phone }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit rating");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["product-reviews", pid]);
      queryClient.invalidateQueries(["product", pid, branchId]);
      setUserRating(0);
      setReviewText("");
      Alert.alert("Success", "Your rating has been submitted!");
    },
    onError: (err) => {
      const message = err?.message || "Failed to submit rating";
      Alert.alert("Error", message);
    },
  });

  const toggleAddon = (addonId, canAddToCart) => {
    if (!canAddToCart) return;

    setSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId],
    );
  };

  const toggleCustomization = (customizationId, canAddToCart) => {
    if (!canAddToCart) return;

    setSelectedCustomizations((prev) =>
      prev.includes(customizationId)
        ? prev.filter((id) => id !== customizationId)
        : [...prev, customizationId],
    );
  };

  const toggleOption = (groupName, optionId, isMultiSelect = false) => {
    setSelectedOptions((prev) => {
      const currentSelections = prev[groupName] || [];

      if (isMultiSelect) {
        if (currentSelections.includes(optionId)) {
          return {
            ...prev,
            [groupName]: currentSelections.filter((id) => id !== optionId),
          };
        }
        return {
          ...prev,
          [groupName]: [...currentSelections, optionId],
        };
      }

      if (currentSelections.includes(optionId)) {
        return {
          ...prev,
          [groupName]: [],
        };
      }

      return {
        ...prev,
        [groupName]: [optionId],
      };
    });
  };

  const increaseQuantity = () => {
    // Inventory guard (best-effort client-side)
    const maxAddable = getMaxAddableFromStock(product);
    if (maxAddable !== null) {
      if (maxAddable <= 0) {
        showLimitedAvailability(product, maxAddable);
        return;
      }
      if (quantity >= maxAddable) {
        showLimitedAvailability(product, maxAddable);
        return;
      }
    }

    setQuantity((prev) => prev + 1);
  };

  const decreaseQuantity = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const submitRating = (isAuthForRating) => {
    if (!isAuthForRating) {
      setRedirect("/product-detail", { id: productId });

      Alert.alert("Sign In Required", "Please sign in to rate this product", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => signIn() },
      ]);
      return;
    }

    if (userRating === 0) {
      Alert.alert("Rating Required", "Please select a rating");
      return;
    }

    ratingMutation.mutate({
      rating: userRating,
      review_text: reviewText.trim() || undefined,
    });
  };

  return {
    product,
    productLoading,
    addons,
    customizations,
    reviewsData,
    selectedAddons,
    selectedCustomizations,
    selectedOptions,
    quantity,
    setQuantity,
    setSelectedAddons,
    setSelectedCustomizations,
    setSelectedOptions,
    increaseQuantity,
    decreaseQuantity,
    userRating,
    setUserRating,
    reviewText,
    setReviewText,
    toggleAddon,
    toggleCustomization,
    toggleOption,
    submitRating,
    ratingMutation,
    addToCartMutation,
    updateQuantityMutation,
    updateItemDetailsMutation,
  };
}
