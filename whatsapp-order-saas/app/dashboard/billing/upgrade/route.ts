import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { PLANS, type PlanId } from "@/lib/plans";
import { initializeTransaction, toKobo } from "@/lib/paystack";

const BILLING_PATH = "/dashboard/billing";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const formData = await request.formData();
    const requestedPlanRaw = formData.get("plan");
    const requestedPlan =
      typeof requestedPlanRaw === "string" ? requestedPlanRaw : "";

    if (!(requestedPlan in PLANS)) {
      return NextResponse.redirect(
        new URL(`${BILLING_PATH}?error=${encodeURIComponent("Invalid plan selected.")}`, request.url)
      );
    }

    const plan = requestedPlan as PlanId;
    const targetPlan = PLANS[plan];

    // Fetch current plan (if available in this deployment)
    const { data: vendorRow, error: vendorErr } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (vendorErr || !vendorRow) {
      return NextResponse.redirect(
        new URL(
          `${BILLING_PATH}?error=${encodeURIComponent("Could not load your billing profile.")}`,
          request.url
        )
      );
    }

    const rawPlan = (vendorRow as Record<string, unknown>).plan;
    const currentPlan =
      typeof rawPlan === "string" && rawPlan in PLANS
        ? (rawPlan as PlanId)
        : null;

    if (!currentPlan) {
      return NextResponse.redirect(
        new URL(
          `${BILLING_PATH}?error=${encodeURIComponent("Plan upgrades are unavailable in this environment.")}`,
          request.url
        )
      );
    }

    const order: PlanId[] = ["starter", "growth", "pro"];
    if (order.indexOf(plan) <= order.indexOf(currentPlan)) {
      return NextResponse.redirect(
        new URL(
          `${BILLING_PATH}?error=${encodeURIComponent("You can only upgrade to a higher plan.")}`,
          request.url
        )
      );
    }

    // Starter is free; if somehow requested as an upgrade target, apply directly.
    if (targetPlan.price <= 0) {
      const { error: updateErr } = await supabase
        .from("users")
        .update({ plan })
        .eq("id", user.id);

      if (updateErr) {
        return NextResponse.redirect(
          new URL(
            `${BILLING_PATH}?error=${encodeURIComponent(updateErr.message)}`,
            request.url
          )
        );
      }

      return NextResponse.redirect(new URL(`${BILLING_PATH}?upgraded=${plan}`, request.url));
    }

    const callbackUrl = new URL("/dashboard/billing/callback", request.url);
    callbackUrl.searchParams.set("plan", plan);

    const reference = `SUB-${user.id.replace(/-/g, "").slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const paystack = await initializeTransaction({
      email: user.email ?? `user-${user.id}@whatsorder.local`,
      amount: toKobo(targetPlan.price),
      reference,
      callback_url: callbackUrl.toString(),
      metadata: {
        source: "whatsorder-billing-upgrade",
        user_id: user.id,
        current_plan: currentPlan,
        target_plan: plan,
      },
    });

    if (!paystack.status || !paystack.data?.authorization_url) {
      return NextResponse.redirect(
        new URL(
          `${BILLING_PATH}?error=${encodeURIComponent(paystack.message || "Could not start checkout.")}`,
          request.url
        )
      );
    }

    return NextResponse.redirect(paystack.data.authorization_url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start upgrade checkout.";
    return NextResponse.redirect(
      new URL(`${BILLING_PATH}?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
