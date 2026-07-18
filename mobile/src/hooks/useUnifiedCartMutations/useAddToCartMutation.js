import { Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { localCartStore } from "../../utils/localCartStore";
import { serverCartBackupStore } from "../../utils/serverCartBackupStore";
import { useRouter } from "expo-router";
import { apiFetch } from "../../utils/apiFetch";
import { getAuthPhone } from "../../utils/auth/getAuthPhone";
import { getBestCachedProduct } from "./productCacheHelpers";
import { buildAddonObjects } from "./addonHelpers";
import { normalizeComment } from "./normalizationHelpers";
import { getCartLineSignature } from "./cartSignatureHelpers";
import {
  cartKey,
  cartKeysForBranch,
  cartKeysForOptimisticUpdate,
} from "./cartKeyHelpers";
import { safeRefetch } from "./refetchHelpers";

export function useAddToCartMutation({
  queryClient,
  isAuth,
  acquireLock,
  releaseLock,
  nextTempId,
}) {
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      product_id,
      branch_id,
      quantity,
      selected_addons = [],
      customizations = [],
      comment = null,
      shouldNavigateBack = false,
    }) => {
      console.log("[ADD_TO_CART] Starting mutation", {
        product_id,
        quantity,
        has_customizations: customizations.length > 0,
        has_addons: selected_addons.length > 0,
        isAuth,
      });

      const lockAcquired = await acquireLock("ADD");
      if (!lockAcquired) {
        throw new Error("Another cart operation is in progress");
      }

      try {
        const normalizedComment =
          comment === null || comment === undefined
            ? null
            : String(comment).trim() || null;

        // Anonymous users -> local storage
        if (!isAuth) {
          console.log("[ADD_TO_CART] Anonymous - using local storage");
          const product = getBestCachedProduct(
            queryClient,
            product_id,
            branch_id,
          );
          const addonObjs = buildAddonObjects(
            queryClient,
            product_id,
            selected_addons,
          );

          await localCartStore.addItem(branch_id, {
            product_id,
            branch_id,
            quantity,
            customizations,
            addons: addonObjs,
            comment: normalizedComment,
            name: product?.name || "Product",
            price:
              product?.price === null || product?.price === undefined
                ? 0
                : product.price,
            image_url: product?.image_url || null,
            inventory_applies: !!product?.inventory_applies,
            quantity_on_hand: product?.quantity_on_hand ?? null,
          });

          const localItems = await localCartStore.getCart(branch_id);
          console.log("[ADD_TO_CART] ✅ Local storage success");
          return { cart_items: localItems, shouldNavigateBack };
        }

        // Signed-in users -> server
        console.log("[ADD_TO_CART] Authenticated - calling API");
        const phone = await getAuthPhone();
        const requestBody = {
          product_id,
          branch_id,
          quantity,
          selected_addons,
          customizations,
          comment: normalizedComment,
          ...(phone ? { phone } : {}),
        };

        console.log("[ADD_TO_CART] Request body:", {
          ...requestBody,
          customizations_count: customizations.length,
          selected_addons_count: selected_addons.length,
        });

        const response = await apiFetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        console.log("[ADD_TO_CART] Response status:", response.status);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          console.error("[ADD_TO_CART] ❌ API error:", error);
          throw new Error(error.error || "Failed to add to cart");
        }

        const data = await response.json();
        console.log("[ADD_TO_CART] ✅ API success:", {
          cart_item_id: data?.cart_item_id,
        });
        return { ...data, shouldNavigateBack };
      } finally {
        // lock released in onSuccess/onError
      }
    },
    onMutate: async ({
      product_id,
      branch_id,
      quantity,
      selected_addons,
      customizations,
      comment,
    }) => {
      console.log("[ADD_TO_CART] onMutate - applying optimistic update");

      // ✅ Only apply optimistic updates to the correct cache(s).
      const keys = cartKeysForOptimisticUpdate(branch_id, isAuth);

      await Promise.all(
        keys.map((k) => queryClient.cancelQueries({ queryKey: k })),
      );

      const previousByKey = new Map();
      keys.forEach((k) => {
        previousByKey.set(JSON.stringify(k), queryClient.getQueryData(k));
      });

      const normalizedComment = normalizeComment(comment);
      const incomingSig = getCartLineSignature({
        productId: product_id,
        customizations,
        selectedAddonIds: selected_addons,
        comment: normalizedComment,
      });

      const applyOptimistic = (old) => {
        const safeOld =
          old && typeof old === "object" ? old : { cart_items: [] };
        const existingItems = safeOld.cart_items || [];

        const existingItemIndex = existingItems.findIndex((item) => {
          const itemSig = getCartLineSignature({
            productId: item.product_id,
            customizations: item.customizations,
            itemForAddonIds: item,
            comment: item.comment,
          });
          return itemSig === incomingSig;
        });

        let newCartItems;
        if (existingItemIndex >= 0) {
          console.log(
            "[ADD_TO_CART] Matching existing item found, incrementing quantity",
          );
          newCartItems = existingItems.map((item, index) =>
            index === existingItemIndex
              ? { ...item, quantity: (item.quantity || 0) + quantity }
              : item,
          );
        } else {
          console.log("[ADD_TO_CART] Creating new optimistic item");
          const product = getBestCachedProduct(
            queryClient,
            product_id,
            branch_id,
          );
          const addonObjs = buildAddonObjects(
            queryClient,
            product_id,
            selected_addons,
          );

          newCartItems = [
            ...existingItems,
            {
              id: nextTempId(),
              product_id: Number(product_id),
              name: product?.name || "Product",
              price:
                product?.price === null || product?.price === undefined
                  ? 0
                  : product.price,
              image_url: product?.image_url || null,
              quantity,
              addons: addonObjs,
              customizations: Array.isArray(customizations)
                ? customizations
                : [],
              comment: normalizedComment,
              inventory_applies: !!product?.inventory_applies,
              quantity_on_hand: product?.quantity_on_hand ?? null,
            },
          ];
        }

        return {
          ...safeOld,
          cart_items: newCartItems,
        };
      };

      keys.forEach((k) => {
        queryClient.setQueryData(k, (old) => applyOptimistic(old));
      });

      console.log("[ADD_TO_CART] ✅ Optimistic update applied");
      return { previousByKey, keys, branch_id, incomingSig };
    },
    onError: (error, variables, context) => {
      console.error("[ADD_TO_CART] ❌ onError - rolling back", error.message);
      if (context?.previousByKey && context?.keys) {
        context.keys.forEach((k) => {
          const prev = context.previousByKey.get(JSON.stringify(k));
          if (prev !== undefined) {
            queryClient.setQueryData(k, prev);
          }
        });
      }
      releaseLock("ADD");
      Alert.alert("Error", error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    onSuccess: async (data, variables, context) => {
      console.log("[ADD_TO_CART] onSuccess - processing server response");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // CRITICAL FIX: Swap temp ID with real ID IMMEDIATELY before any refetch
      try {
        const branchId = variables?.branch_id;
        const realIdRaw = data?.cart_item_id;
        const realId = Number(realIdRaw);

        if (branchId && Number.isFinite(realId) && realId > 0) {
          console.log("[ADD_TO_CART] Swapping temp ID with real ID:", realId);
          const keys = cartKeysForBranch(branchId);
          const incomingSig = context?.incomingSig;

          keys.forEach((k) => {
            queryClient.setQueryData(k, (old) => {
              const safeOld =
                old && typeof old === "object" ? old : { cart_items: [] };
              const items = Array.isArray(safeOld.cart_items)
                ? safeOld.cart_items
                : [];

              // If the cart already has the real id, no need to patch
              if (items.some((it) => Number(it?.id) === realId)) {
                console.log(
                  "[ADD_TO_CART] Real ID already exists, skipping swap",
                );
                return safeOld;
              }

              const nextItems = items.map((it) => {
                // Only patch temp ids (negative) that match the signature we just added.
                const isTemp = Number(it?.id) < 0;
                if (!isTemp) {
                  return it;
                }

                // If we have the signature from context, use it for matching
                if (incomingSig) {
                  const itSig = getCartLineSignature({
                    productId: it?.product_id,
                    customizations: it?.customizations,
                    itemForAddonIds: it,
                    comment: it?.comment,
                  });

                  if (itSig !== incomingSig) {
                    return it;
                  }
                } else {
                  // Fallback: match by product_id only (less precise)
                  if (
                    Number(it?.product_id) !== Number(variables?.product_id)
                  ) {
                    return it;
                  }
                }

                console.log(
                  "[ADD_TO_CART] Swapping temp ID",
                  it.id,
                  "with real ID",
                  realId,
                );
                return { ...it, id: realId };
              });

              return { ...safeOld, cart_items: nextItems };
            });
          });
        }
      } catch (e) {
        console.warn("[ADD_TO_CART] Failed to patch temp id:", e?.message);
      }

      // Write to backup store for authenticated users
      if (isAuth) {
        try {
          const product = getBestCachedProduct(
            queryClient,
            variables.product_id,
            variables.branch_id,
          );

          const addonObjs = buildAddonObjects(
            queryClient,
            variables.product_id,
            variables.selected_addons,
          );

          await serverCartBackupStore.addItem(variables.branch_id, {
            product_id: variables.product_id,
            branch_id: variables.branch_id,
            quantity: variables.quantity,
            addons: addonObjs,
            customizations: variables.customizations || [],
            comment: variables.comment ?? null,
            name: product?.name || "Product",
            price:
              product?.price === null || product?.price === undefined
                ? 0
                : product.price,
            image_url: product?.image_url || null,
            inventory_applies: !!product?.inventory_applies,
            quantity_on_hand: product?.quantity_on_hand ?? null,
          });
        } catch (e) {
          console.warn(
            "[ADD_TO_CART] Failed to write backup cart:",
            e?.message,
          );
        }
      }

      // Delayed refetch to ensure server has processed the request
      if (isAuth) {
        console.log("[ADD_TO_CART] Scheduling delayed refetch (500ms)");
        await safeRefetch(queryClient, variables.branch_id, 500);
      } else {
        queryClient.invalidateQueries({
          queryKey: cartKey(variables.branch_id, false),
        });
      }

      // Invalidate all cart-related queries
      const allKeys = cartKeysForBranch(variables.branch_id);
      allKeys.forEach((k) => {
        queryClient.invalidateQueries({ queryKey: k });
      });

      const shouldGoBack = variables?.shouldNavigateBack === true;
      if (shouldGoBack) {
        router.back();
      }

      releaseLock("ADD");
      console.log("[ADD_TO_CART] ✅ onSuccess complete");
    },
  });
}
