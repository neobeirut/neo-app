import { create } from "zustand";

/**
 * Store for managing post-authentication redirects
 * Tracks where the user intended to go before being prompted to sign in
 */
export const useRedirectStore = create((set, get) => ({
  // The intended destination after authentication
  redirectTo: null,
  redirectParams: null,

  /**
   * Save the intended destination before redirecting to sign in
   * @param {string} route - The route to redirect to (e.g., "/product-detail")
   * @param {object} params - Route parameters (e.g., { id: 123 })
   */
  setRedirect: (route, params = null) => {
    console.log("[REDIRECT STORE] Setting redirect:", { route, params });
    set({
      redirectTo: route,
      redirectParams: params,
    });
  },

  /**
   * Get and clear the redirect destination
   * This should be called after successful authentication
   * @returns {object|null} { route, params } or null if no redirect set
   */
  consumeRedirect: () => {
    const { redirectTo, redirectParams } = get();

    // IMPORTANT: don't spam logs when there is no redirect.
    if (!redirectTo) {
      return null;
    }

    console.log("[REDIRECT STORE] Consuming redirect:", {
      redirectTo,
      redirectParams,
    });

    // Clear the redirect
    set({ redirectTo: null, redirectParams: null });

    return {
      route: redirectTo,
      params: redirectParams,
    };
  },

  /**
   * Clear any saved redirect without consuming it
   */
  clearRedirect: () => {
    console.log("[REDIRECT STORE] Clearing redirect");
    set({ redirectTo: null, redirectParams: null });
  },

  /**
   * Check if there's a pending redirect
   * @returns {boolean}
   */
  hasRedirect: () => {
    return get().redirectTo !== null;
  },
}));
