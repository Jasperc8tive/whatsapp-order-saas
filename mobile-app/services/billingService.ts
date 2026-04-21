import type { PlanId, UserProfile } from "../types/domain";
import { apiRequest } from "./apiClient";
import { supabase } from "./supabaseClient";

export const billingService = {
  async getCurrentSubscription(): Promise<Pick<UserProfile, "plan" | "business_name" | "id">> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from("users")
      .select("id,plan,business_name")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    return data;
  },

  async initializeUpgrade(plan: Exclude<PlanId, "starter">): Promise<{ authorizationUrl?: string }> {
    return apiRequest<{ authorizationUrl?: string }>("/api/paystack", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
  },
};
