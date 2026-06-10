import { Alert, Platform } from "react-native";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { localCartStore } from "../../utils/localCartStore";
import { apiFetch } from "../../utils/apiFetch";
import { getAuthPhone } from "../../utils/auth/getAuthPhone";
import { buildAddonObjects } from "./addonHelpers";
import { normalizeComment } from "./normalizationHelpers";
import {
  cartKey,
  cartKeysForBranch,
  cartKeysForOptimisticUpdate,
} from "./cartKeyHelpers";
import { safeRefetch } from "./refetchHelpers";

export function useUpdateItemDetailsMutation({
  queryClient,
  selectedBranch,
  isAuth,
  acquireLock,
  releaseLock,
}) {
  const safeNotify = (type) => {
    if (Platform.OS === "web") return;
    Haptics.notificationAsync(type).catch(() => {});
  };

  return useMutation({
    mutationFn: async ({
      cart_item_id,
      quantity,
      customizations,
      comment,
      selected_addons,
    }) => {
      console.log("[UPDATE_ITEM_DETAILS] Starting mutation");
      console.log("[UPDATE_ITEM_DETAILS] cart_item_id:", cart_item_id);
      console.log("[UPDATE_ITEM_DETAILS] Params:", {
        has_quantity: quantity !== undefined,
        quantity_value: quantity,
        has_customizations: customizations !== undefined,
        customizations_count: Array.isArray(customizations)
          ? customizations.length
          : "N/A",
        has_comment: comment !== undefined,
        comment_value: comment,
        has_selected_addons: selected_addons !== undefined,
        selected_addons_count: Array.isArray(selected_addons)
          ? selected_addons.length
          : "N/A",
        selected_addons,
      });

      const lockAcquired = await acquireLock("UPDATE_DETAILS");
      if (!lockAcquired) {
        throw new Error("Another cart operation is in progress");
      }

      try {
        if (!selectedBranch?.id) {
          throw new Error("No branch selected");
        }

        const normalizedComment =
          comment === null || comment === undefined
            ? null
            : String(comment).trim() || null;

        // Ensure selected_addons is properly formatted as array of numbers
        const addonIds =
          selected_addons !== undefined
            ? Array.isArray(selected_addons)
              ? selected_addons
                  .map((x) => Number(x))
                  .filter((x) => Number.isFinite(x))
              : []
            : undefined;

        console.log("[UPDATE_ITEM_DETAILS] Normalized addonIds:", addonIds);

        // Anonymous users
        if (!isAuth) {
          console.log(
            "[UPDATE_ITEM_DETAILS] Anonymous user - using local storage",
          );
          let addonObjs;
          if (addonIds !== undefined) {
            const localItems = await localCartStore.getCart(selectedBranch.id);
            const localItem = (localItems || []).find(
              (it) => it.id === cart_item_id,
            );
            const pid = localItem?.product_id;
            addonObjs = buildAddonObjects(queryClient, pid, addonIds);
          }

          const updates = {};
          if (quantity !== undefined) {
            updates.quantity = Number(quantity);
          }
          if (customizations !== undefined) {
            updates.customizations = customizations;
          }
          if (comment !== undefined) {
            updates.comment = normalizedComment;
          }
          if (addonIds !== undefined) {
            updates.addons = addonObjs;
          }

          await localCartStore.updateItemDetails(
            selectedBranch.id,
            cart_item_id,
            updates,
          );

          const refreshed = await localCartStore.getCart(selectedBranch.id);
          console.log(
            "[UPDATE_ITEM_DETAILS] ✅ Local storage update successful",
          );
          return { cart_items: refreshed };
        }

        // Signed-in users
        console.log("[UPDATE_ITEM_DETAILS] Authenticated user - calling API");
        const phone = await getAuthPhone();
        console.log(
          "[UPDATE_ITEM_DETAILS] Phone:",
          phone ? "Present" : "Missing",
        );

        const requestBody = {
          cart_item_id: Number(cart_item_id),
          ...(quantity !== undefined ? { quantity: Number(quantity) } : {}),
          ...(customizations !== undefined ? { customizations } : {}),
          ...(comment !== undefined ? { comment: normalizedComment } : {}),
          ...(addonIds !== undefined ? { selected_addons: addonIds } : {}),
          ...(phone ? { phone } : {}),
        };

        console.log("[UPDATE_ITEM_DETAILS] Request body:", {
          cart_item_id: requestBody.cart_item_id,
          has_quantity: "quantity" in requestBody,
          quantity_value: requestBody.quantity,
          has_customizations: "customizations" in requestBody,
          customizations_count: requestBody.customizations?.length,
          has_comment: "comment" in requestBody,
          has_selected_addons: "selected_addons" in requestBody,
          selected_addons_count: requestBody.selected_addons?.length,
          has_phone: "phone" in requestBody,
        });

        const response = await apiFetch("/api/cart/update", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        console.log(
          "[UPDATE_ITEM_DETAILS] Response status:",
          response.status,
          response.ok ? "OK" : "ERROR",
        );

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
            console.error(
              "[UPDATE_ITEM_DETAILS] ❌ Error response:",
              errorData,
            );
          } catch (e) {
            console.error(
              "[UPDATE_ITEM_DETAILS] ❌ Failed to parse error response",
            );
            const text = await response.text().catch(() => "");
            console.error("[UPDATE_ITEM_DETAILS] Response text:", text);
            errorData = {};
          }

          const errorMessage =
            errorData.error ||
            `Failed to update cart (status ${response.status})`;
          throw new Error(errorMessage);
        }

        const result = await response.json().catch(() => ({}));
        console.log("[UPDATE_ITEM_DETAILS] ✅ Success:", result);
        return result;
      } catch (error) {
        console.error("[UPDATE_ITEM_DETAILS] ❌ Exception:", {
          message: error.message,
          stack: error.stack,
        });
        throw error;
      } finally {
        // lock released in onSuccess/onError
      }
    },
    onMutate: async ({
      cart_item_id,
      quantity,
      customizations,
      comment,
      selected_addons,
    }) => {
      console.log(
        "[UPDATE_ITEM_DETAILS] onMutate - applying optimistic update",
      );
      const branchId = selectedBranch?.id;

      // ✅ Only apply optimistic updates to the correct cache(s).
      const keys = cartKeysForOptimisticUpdate(branchId, isAuth);

      await Promise.all(
        keys.map((k) => queryClient.cancelQueries({ queryKey: k })),
      );

      const previousByKey = new Map();
      keys.forEach((k) => {
        previousByKey.set(JSON.stringify(k), queryClient.getQueryData(k));
      });

      const normalizedComment =
        comment === null || comment === undefined
          ? null
          : String(comment).trim() || null;

      // Ensure selected_addons is properly formatted
      const addonIds =
        selected_addons !== undefined
          ? Array.isArray(selected_addons)
            ? selected_addons
                .map((x) => Number(x))
                .filter((x) => Number.isFinite(x))
            : []
          : undefined;

      const applyOptimistic = (old) => {
        const safeOld =
          old && typeof old === "object" ? old : { cart_items: [] };
        const existingItems = safeOld.cart_items || [];

        const nextItems = existingItems.map((it) => {
          if (it.id !== cart_item_id) {
            return it;
          }

          const next = { ...it };

          // ✅ Update quantity if provided
          if (quantity !== undefined) {
            next.quantity = Number(quantity);
          }

          if (customizations !== undefined) {
            next.customizations = Array.isArray(customizations)
              ? customizations
              : [];
          }

          if (comment !== undefined) {
            next.comment = normalizedComment;
          }

          // ✅ iOS FIX: Properly handle addons update with correct structure
          if (addonIds !== undefined) {
            const addonObjs = buildAddonObjects(
              queryClient,
              next.product_id,
              addonIds,
            );

            // ✅ CRITICAL: Ensure we're setting the correct property
            // The server returns 'addons' not 'selected_addons'
            next.addons = addonObjs;

            // ✅ iOS FIX: Force a new object reference to trigger re-render
            // This ensures React Native properly detects the change on iOS
            next.addons = [...addonObjs];
          }

          // ✅ iOS FIX: Return a completely new object to ensure state update
          return { ...next };
        });

        // ✅ iOS FIX: Return new array reference to trigger re-render
        return { ...safeOld, cart_items: [...nextItems] };
      };

      keys.forEach((k) => {
        queryClient.setQueryData(k, (old) => applyOptimistic(old));
      });

      console.log("[UPDATE_ITEM_DETAILS] ✅ Optimistic update applied");
      return { previousByKey, keys, branchId };
    },
    onError: (err, variables, context) => {
      console.error(
        "[UPDATE_ITEM_DETAILS] ❌ onError - rolling back",
        err.message,
      );
      if (context?.previousByKey && context?.keys) {
        context.keys.forEach((k) => {
          const prev = context.previousByKey.get(JSON.stringify(k));
          if (prev !== undefined) {
            queryClient.setQueryData(k, prev);
          }
        });
      }

      releaseLock("UPDATE_DETAILS");

      // Show more detailed error message
      const errorMsg = err.message || "Failed to update cart item";
      Alert.alert("Update Failed", errorMsg);
      safeNotify(Haptics.NotificationFeedbackType.Error);
    },
    onSuccess: async (_data, variables) => {
      console.log("[UPDATE_ITEM_DETAILS] onSuccess");
      safeNotify(Haptics.NotificationFeedbackType.Success);

      if (selectedBranch?.id) {
        // ✅ iOS FIX: DON'T invalidate before refetching
        // Invalidating clears the optimistic update before the backend is ready
        // Instead, let the refetch naturally update the cache

        if (isAuth) {
          console.log("[UPDATE_ITEM_DETAILS] Scheduling refetch");

          // ✅ iOS FIX: Longer delay on iOS to ensure DB transaction is fully committed
          // iOS seems to execute faster, so we need to wait for the backend
          const delay = Platform.OS === "ios" ? 800 : 500;

          console.log(
            `[UPDATE_ITEM_DETAILS] Waiting ${delay}ms before refetch`,
          );
          await safeRefetch(queryClient, selectedBranch.id, delay);

          // ✅ NOW invalidate to ensure cache is fresh after successful refetch
          const keys = cartKeysForBranch(selectedBranch.id);
          keys.forEach((k) => {
            queryClient.invalidateQueries({ queryKey: k });
          });
        } else {
          // For anonymous users, just invalidate to reload from local storage
          queryClient.invalidateQueries({
            queryKey: cartKey(selectedBranch.id, false),
          });
        }
      }

      releaseLock("UPDATE_DETAILS");
      console.log("[UPDATE_ITEM_DETAILS] ✅ onSuccess complete");
    },
  });
}
