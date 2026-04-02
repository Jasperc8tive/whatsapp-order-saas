import { create } from "zustand";

import type { Order, OrderStatus } from "../types/domain";

interface OrderState {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  upsertOrder: (order: Order) => void;
  patchOrderStatus: (orderId: string, status: OrderStatus) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  setOrders: (orders) => set({ orders }),
  upsertOrder: (order) =>
    set((state) => {
      const existingIndex = state.orders.findIndex((o) => o.id === order.id);
      if (existingIndex === -1) return { orders: [order, ...state.orders] };
      const copy = [...state.orders];
      copy[existingIndex] = { ...copy[existingIndex], ...order };
      return { orders: copy };
    }),
  patchOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, order_status: status } : order
      ),
    })),
}));
