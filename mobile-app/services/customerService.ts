import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Customer } from "../types/domain";
import { supabase } from "./supabaseClient";

const CUSTOMER_CACHE_KEY = "whatsorder.customers.cache";

export const customerService = {
  async listCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase
      .from("customers")
      .select("id,vendor_id,name,phone,email,address,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      const cached = await AsyncStorage.getItem(CUSTOMER_CACHE_KEY);
      if (cached) return JSON.parse(cached) as Customer[];
      throw error;
    }

    await AsyncStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(data));

    const ids = (data ?? []).map((c) => c.id);
    if (!ids.length) return (data ?? []) as Customer[];

    const { data: stats } = await supabase
      .from("v_customer_stats")
      .select("customer_id,total_orders,total_spent")
      .in("customer_id", ids);

    const statMap = new Map((stats ?? []).map((row: any) => [row.customer_id, row]));

    return (data ?? []).map((customer: any) => ({
      ...customer,
      total_orders: statMap.get(customer.id)?.total_orders ?? 0,
      total_spent: Number(statMap.get(customer.id)?.total_spent ?? 0),
    })) as Customer[];
  },

  async getCustomerById(customerId: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from("customers")
      .select("id,vendor_id,name,phone,email,address,created_at,updated_at")
      .eq("id", customerId)
      .single();
    if (error) throw error;
    return (data as Customer) ?? null;
  },

  async createCustomer(payload: {
    name: string;
    phone: string;
    email?: string | null;
    address?: string | null;
  }): Promise<void> {
    const { error } = await supabase.from("customers").insert(payload);
    if (error) throw error;
  },

  async updateCustomer(
    customerId: string,
    payload: {
      name: string;
      phone: string;
      email?: string | null;
      address?: string | null;
    }
  ): Promise<void> {
    const { error } = await supabase.from("customers").update(payload).eq("id", customerId);
    if (error) throw error;
  },

  async deleteCustomer(customerId: string): Promise<void> {
    const { error } = await supabase.from("customers").delete().eq("id", customerId);
    if (error) throw error;
  },
};
