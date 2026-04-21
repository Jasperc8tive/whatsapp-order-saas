import type { UserProfile } from "../types/domain";
import { supabase } from "./supabaseClient";

export const settingsService = {
  async getProfile(): Promise<UserProfile> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("users")
      .select("id,business_name,email,phone,plan,whatsapp_number,slug,loyalty_points_per_order,loyalty_reward_threshold,created_at,updated_at")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    return data as UserProfile;
  },

  async updateProfile(
    payload: Partial<
      Pick<
        UserProfile,
        "business_name" | "slug" | "whatsapp_number" | "loyalty_points_per_order" | "loyalty_reward_threshold"
      >
    >
  ): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Not authenticated");

    const updatePayload: Record<string, string | number | null> = {};

    if (payload.business_name !== undefined) updatePayload.business_name = payload.business_name;
    if (payload.slug !== undefined) updatePayload.slug = payload.slug;
    if (payload.whatsapp_number !== undefined) {
      updatePayload.whatsapp_number = payload.whatsapp_number;
      updatePayload.phone = payload.whatsapp_number;
    }
    if (payload.loyalty_points_per_order !== undefined) {
      updatePayload.loyalty_points_per_order = payload.loyalty_points_per_order;
    }
    if (payload.loyalty_reward_threshold !== undefined) {
      updatePayload.loyalty_reward_threshold = payload.loyalty_reward_threshold;
    }

    const { error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", user.id);

    if (error) throw error;
  },
};
