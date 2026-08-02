import { create } from "zustand";

/**
 * Global store to track visibility of the custom bottom navigation/status bar.
 * This allows different scrollable screens to show/hide the bar dynamically.
 */
export const useBottomBarStore = create((set) => ({
  isVisible: true,
  setVisible: (visible) => set({ isVisible: visible }),
  homeResetCounter: 0,
  triggerHomeReset: () => set((state) => ({ homeResetCounter: state.homeResetCounter + 1 })),
}));
