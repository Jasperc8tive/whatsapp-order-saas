import type { Delivery } from "../types/domain";
import { supabase } from "./supabaseClient";

function normalizeDelivery(row: any): Delivery {
  const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
  const customer = order && Array.isArray(order.customers) ? order.customers[0] : order?.customers;

  return {
    ...row,
    orders: order
      ? {
          ...order,
          customers: customer ?? null,
        }
      : undefined,
  } as Delivery;
}

export const deliveryService = {
  async listDeliveries(): Promise<Delivery[]> {
    const { data, error } = await supabase
      .from("deliveries")
      .select(`
        id,
        order_id,
        courier,
        tracking_id,
        delivery_status,
        dispatched_at,
        delivered_at,
        notes,
        created_at,
        updated_at,
        orders(id,order_status,total_amount,created_at,customers(name,phone))
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(normalizeDelivery);
  },

  async updateDeliveryStatus(id: string, status: Delivery["delivery_status"]): Promise<void> {
    const { error } = await supabase.from("deliveries").update({ delivery_status: status }).eq("id", id);
    if (error) throw error;
  },

  subscribeToDeliveries(onChange: () => void): () => void {
    const channel = supabase
      .channel("deliveries-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => onChange()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
