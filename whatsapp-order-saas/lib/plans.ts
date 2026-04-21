import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanId = "starter" | "growth" | "pro";

export const PLAN_ORDER: PlanId[] = ["starter", "growth", "pro"];

export interface Plan {
  id: PlanId;
  name: string;
  monthlyOrderLimit: number | null; // null = unlimited
  price: number;                    // NGN/month (0 = free tier)
  description: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthlyOrderLimit: 50,
    price: 0,
    description: "Perfect for new businesses just getting started.",
    features: [
      "Up to 50 orders/month",
      "Public order form",
      "WhatsApp notifications",
      "Basic dashboard analytics",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthlyOrderLimit: 200,
    price: 9900,
    description: "For growing businesses with increasing order volume.",
    features: [
      "Up to 200 orders/month",
      "Everything in Starter",
      "Paystack payment integration",
      "Order status tracking",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyOrderLimit: null,
    price: 24900,
    description: "Unlimited orders for established businesses.",
    features: [
      "Unlimited orders",
      "Everything in Growth",
      "AI Inbox Copilot and smart order drafts",
      "AI capture settings and alias training",
      "Priority support",
      "Advanced analytics",
    ],
  },
};

export const DEFAULT_PLAN: PlanId = "starter";
export const HIGHEST_PLAN_ID: PlanId = "pro";

export function resolvePlanId(rawPlan: unknown): PlanId {
  return typeof rawPlan === "string" && rawPlan in PLANS
    ? (rawPlan as PlanId)
    : DEFAULT_PLAN;
}

export function isPlanAtLeast(currentPlan: PlanId, requiredPlan: PlanId): boolean {
  return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}

export function hasAiInboxCopilotAccess(plan: PlanId): boolean {
  return isPlanAtLeast(plan, HIGHEST_PLAN_ID);
}

export async function getWorkspacePlan(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<PlanId> {
  const { data, error } = await supabase
    .from("users")
    .select("plan")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("[plans] getWorkspacePlan error:", error.message);
    return DEFAULT_PLAN;
  }

  return resolvePlanId((data as { plan?: unknown } | null)?.plan);
}

/**
 * Returns how many orders this vendor has created in the current calendar month.
 */
export async function getMonthOrderCount(
  supabase: SupabaseClient,
  vendorId: string
): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) {
    console.error("[plans] getMonthOrderCount error:", error.message);
    return 0; // fail open so a DB hiccup doesn't block every order
  }

  return count ?? 0;
}

/**
 * Checks whether a vendor is allowed to create another order.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export async function checkPlanLimit(
  supabase: SupabaseClient,
  vendorId: string,
  plan: PlanId
): Promise<{ allowed: boolean; reason?: string; used?: number; limit?: number | null }> {
  const planConfig = PLANS[plan] ?? PLANS[DEFAULT_PLAN];

  if (planConfig.monthlyOrderLimit === null) {
    return { allowed: true };
  }

  const used = await getMonthOrderCount(supabase, vendorId);

  if (used >= planConfig.monthlyOrderLimit) {
    return {
      allowed: false,
      used,
      limit: planConfig.monthlyOrderLimit,
      reason: `This store has reached its ${planConfig.monthlyOrderLimit}-order monthly limit on the ${planConfig.name} plan. Please try again next month.`,
    };
  }

  return { allowed: true, used, limit: planConfig.monthlyOrderLimit };
}
