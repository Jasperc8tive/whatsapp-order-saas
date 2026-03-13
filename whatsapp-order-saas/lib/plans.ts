export type PlanId = "starter" | "growth" | "pro";

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
      "Priority support",
      "Advanced analytics",
    ],
  },
};

export const DEFAULT_PLAN: PlanId = "starter";

/**
 * Returns how many orders this vendor has created in the current calendar month.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMonthOrderCount(supabase: any, vendorId: string): Promise<number> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
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
