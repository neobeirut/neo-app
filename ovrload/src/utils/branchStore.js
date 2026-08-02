import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { apiFetch } from "@/utils/apiFetch";

const branchKey = `${process.env.EXPO_PUBLIC_PROJECT_GROUP_ID || "bakery"}-selected-branch`;

/**
 * This store manages the selected branch state of the application.
 */
export const useBranchStore = create((set, get) => ({
  selectedBranch: null,
  branches: [],
  isLoading: true,

  setSelectedBranch: async (branch) => {
    if (branch) {
      await SecureStore.setItemAsync(branchKey, JSON.stringify(branch));
    } else {
      await SecureStore.deleteItemAsync(branchKey);
    }
    set({ selectedBranch: branch });
  },

  setBranches: (branches) => set({ branches }),

  setLoading: (loading) => set({ isLoading: loading }),

  loadSelectedBranch: async () => {
    try {
      const saved = await SecureStore.getItemAsync(branchKey);
      if (saved) {
        const branch = JSON.parse(saved);
        set({ selectedBranch: branch });
      }
    } catch (error) {
      console.log("Error loading saved branch:", error);
    }
  },

  // Clear branch selection (useful for signout)
  clearBranch: async () => {
    try {
      console.log("[BRANCH STORE] Clearing branch selection");
      await SecureStore.deleteItemAsync(branchKey);
      set({ selectedBranch: null });
    } catch (error) {
      console.error("[BRANCH STORE] Error clearing branch:", error);
    }
  },

  fetchBranches: async () => {
    try {
      set({ isLoading: true });
      const response = await apiFetch("/api/branches");
      if (response.ok) {
        const data = await response.json();
        const activeBranches = data.branches.filter(
          (branch) => branch.is_active,
        );
        set({ branches: activeBranches });

        // If no branch is selected and we have branches, don't auto-select
        // Let user choose manually
        return activeBranches;
      }
      return [];
    } catch (error) {
      console.error("Error fetching branches:", error);
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  hasSelectedBranch: () => {
    const state = get();
    return state.selectedBranch !== null;
  },
}));
