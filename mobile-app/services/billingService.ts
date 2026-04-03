import type { PlanId, Subscription, UserProfile } from "../types/domain";
import { apiRequest } from "./apiClient";
import { supabase } from "./supabaseClient";

export const billingService = {
  async getCurrentSubscription(): Promise<Pick<UserProfile, "plan" | "business_name" | "id"> & { subscription?: Subscription | null }> {
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

    // Migration 018 introduced public.subscriptions. Keep a graceful fallback
    // to users.plan so old environments continue to work.
    const { data: subscriptionData } = await supabase
      .from("subscriptions")
      .select("id,vendor_id,plan,status,current_period_start,current_period_end,cancel_at_period_end,cancelled_at,created_at,updated_at")
      .eq("vendor_id", user.id)
      .in("status", ["active", "trialing", "past_due", "paused"])
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      ...data,
      subscription: (subscriptionData as Subscription | null) ?? null,
    };
  },

  async initializeUpgrade(plan: Exclude<PlanId, "starter">): Promise<{ authorizationUrl?: string }> {
    return apiRequest<{ authorizationUrl?: string }>("/api/paystack", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
  },
};
