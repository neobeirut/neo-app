import { useQueryClient } from "@tanstack/react-query";
import { useMutationLock } from "./mutationLock";
import { useTempIdGenerator } from "./tempIdGenerator";
import { useAddToCartMutation } from "./useAddToCartMutation";
import { useUpdateQuantityMutation } from "./useUpdateQuantityMutation";
import { useRemoveItemMutation } from "./useRemoveItemMutation";
import { useUpdateItemDetailsMutation } from "./useUpdateItemDetailsMutation";
import { useRemoveCustomizationMutation } from "./useRemoveCustomizationMutation";

/**
 * Unified cart mutation system to prevent race conditions and ensure
 * consistent behavior across all cart operations.
 *
 * IMPORTANT:
 * - We keep cart query keys consistent everywhere: ["cart", branchId, isAuthenticated]
 * - We support both anonymous carts (local storage) and signed-in carts (server)
 */
export function useUnifiedCartMutations(selectedBranch, isAuthenticated) {
  const queryClient = useQueryClient();

  // Treat the auth flag as a boolean everywhere to avoid key splits.
  const isAuth = !!isAuthenticated;

  const { acquireLock, releaseLock, isLocked, isMutating } = useMutationLock();
  const { nextTempId } = useTempIdGenerator();

  const addToCartMutation = useAddToCartMutation({
    queryClient,
    isAuth,
    acquireLock,
    releaseLock,
    nextTempId,
  });

  const updateQuantityMutation = useUpdateQuantityMutation({
    queryClient,
    selectedBranch,
    isAuthenticated,
    isAuth,
    isLocked,
  });

  const removeItemMutation = useRemoveItemMutation({
    queryClient,
    selectedBranch,
    isAuth,
    acquireLock,
    releaseLock,
  });

  const updateItemDetailsMutation = useUpdateItemDetailsMutation({
    queryClient,
    selectedBranch,
    isAuth,
    acquireLock,
    releaseLock,
  });

  const removeCustomizationMutation = useRemoveCustomizationMutation({
    queryClient,
    selectedBranch,
    isAuth,
    acquireLock,
    releaseLock,
  });

  return {
    addToCartMutation,
    updateQuantityMutation,
    removeItemMutation,
    removeCustomizationMutation,
    updateItemDetailsMutation,
    isMutating,
  };
}
