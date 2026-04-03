import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Order, OrderStatus } from "../types/domain";
import { supabase } from "./supabaseClient";

const ORDER_CACHE_KEY = "whatsorder.orders.cache";

const ORDER_SELECT = `
  id,
  vendor_id,
  customer_id,
  order_status,
  payment_status,
  source,
  total_amount,
  notes,
  whatsapp_msg_id,
  created_at,
  updated_at,
  customers(name,phone,address,email),
  order_items(id,order_id,product_id,product_name,quantity,price,subtotal)
`;

function normalizeOrder(row: any): Order {
  return {
    ...row,
    customers: Array.isArray(row.customers) ? (row.customers[0] ?? null) : row.customers ?? null,
    order_items: Array.isArray(row.order_items) ? row.order_items : [],
  } as Order;
}

export const orderService = {
  async listOrders(): Promise<Order[]> {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      const cached = await AsyncStorage.getItem(ORDER_CACHE_KEY);
      if (cached) return JSON.parse(cached) as Order[];
      throw error;
    }

    const normalized = (data ?? []).map(normalizeOrder);
    await AsyncStorage.setItem(ORDER_CACHE_KEY, JSON.stringify(normalized));
    return normalized;
  },

  async getOrderById(orderId: string): Promise<Order | null> {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .single();

    if (error) throw error;
    if (!data) return null;
    return normalizeOrder(data);
  },

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const { error } = await supabase
      .from("orders")
      .update({ order_status: status })
      .eq("id", orderId);

    if (error) throw error;
  },

  subscribeToOrders(onChange: () => void): () => void {
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => onChange()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
