export const cartKey = (branchId, authFlag) => ["cart", branchId, !!authFlag];

export const activeCartKey = (branchId, isAuth) => cartKey(branchId, isAuth);

export const cartKeysForBranch = (branchId) => [
  cartKey(branchId, true),
  cartKey(branchId, false),
];

// IMPORTANT:
// When applying optimistic updates we should NOT always write to both the
// authenticated + anonymous caches.
//
// If the user is anonymous and we write into the authenticated cache, the
// cart "safety" logic (which sometimes preserves the auth cart during auth
// loading) can accidentally show the wrong cart and make items look merged
// until a later refresh.
export const cartKeysForOptimisticUpdate = (branchId, isAuth) => {
  // Signed-in: keep both caches in sync to prevent flicker when auth briefly
  // reports false.
  if (isAuth) {
    return cartKeysForBranch(branchId);
  }

  // Anonymous: ONLY touch the anonymous cache.
  return [cartKey(branchId, false)];
};
