import { create } from "zustand";

// A tiny UI store to show/hide the pre-permission popup from anywhere.
// (We keep it separate from AsyncStorage state so screens/hooks can trigger it without prop drilling.)
export const useNotificationPermissionUIStore = create((set) => ({
  prePromptVisible: false,
  prePromptTrigger: null,
  toastMessage: null,

  showPrePrompt: (trigger) =>
    set({ prePromptVisible: true, prePromptTrigger: trigger || null }),
  hidePrePrompt: () => set({ prePromptVisible: false, prePromptTrigger: null }),

  showToast: (message) => set({ toastMessage: message || null }),
  clearToast: () => set({ toastMessage: null }),
}));

export function showNotificationPrePrompt(trigger) {
  useNotificationPermissionUIStore.getState().showPrePrompt(trigger);
}

export function hideNotificationPrePrompt() {
  useNotificationPermissionUIStore.getState().hidePrePrompt();
}

export function showNotificationToast(message) {
  useNotificationPermissionUIStore.getState().showToast(message);
}

export function clearNotificationToast() {
  useNotificationPermissionUIStore.getState().clearToast();
}
