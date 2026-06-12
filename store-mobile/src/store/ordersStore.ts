import { create } from 'zustand';

interface OrdersState {
  pendingCount: number;
  setPendingCount: (count: number) => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  pendingCount: 0,
  setPendingCount: (count) => set({ pendingCount: count }),
}));
