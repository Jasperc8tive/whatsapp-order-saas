import type { Product } from "../types/domain";
import { supabase } from "./supabaseClient";

export const productService = {
  async listProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from("products")
      .select("id,vendor_id,name,description,price,image_url,is_active,track_inventory,stock_quantity,low_stock_threshold,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as Product[];
  },

  async createProduct(
    payload: Pick<Product, "name" | "price" | "description" | "track_inventory" | "stock_quantity" | "low_stock_threshold">
  ): Promise<void> {
    const { error } = await supabase.from("products").insert(payload);
    if (error) throw error;
  },

  async updateProduct(
    id: string,
    payload: Partial<Pick<Product, "name" | "price" | "description" | "is_active" | "track_inventory" | "stock_quantity" | "low_stock_threshold">>
  ): Promise<void> {
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) throw error;
  },

  async deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  },
};
