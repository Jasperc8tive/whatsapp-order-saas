import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { verifyTransaction } from "@/lib/paystack";
import { PLANS, type PlanId } from "@/lib/plans";

const BILLING_PATH = "/dashboard/billing";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");

    if (!reference) {
      return NextResponse.redirect(
        new URL(`${BILLING_PATH}?error=${encodeURIComponent("Missing payment reference.")}`, request.url)
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const verification = await verifyTransaction(reference);
    if (!verification.status) {
      return NextResponse.redirect(
        new URL(`${BILLING_PATH}?error=${encodeURIComponent(verification.message || "Payment verification failed.")}`, request.url)
      );
    }

    const tx = verification.data;
    const metadata = (tx.metadata ?? {}) as Record<string, unknown>;
    const source = metadata.source as string | undefined;
    const metadataUserId = metadata.user_id as string | undefined;
    const targetPlanRaw = metadata.target_plan as string | undefined;

    if (source !== "whatsorder-billing-upgrade") {
      return NextResponse.redirect(
        new URL(`${BILLING_PATH}?error=${encodeURIComponent("This payment is not a billing upgrade transaction.")}`, request.url)
      );
    }

    if (metadataUserId !== user.id) {
      return NextResponse.redirect(
        new URL(`${BILLING_PATH}?error=${encodeURIComponent("This transaction does not belong to your account.")}`, request.url)
      );
    }

    if (tx.status !== "success") {
      return NextResponse.redirect(
        new URL(`${BILLING_PATH}?error=${encodeURIComponent(`Upgrade payment is ${tx.status}.`)}`, request.url)
      );
    }

    if (!targetPlanRaw || !(targetPlanRaw in PLANS)) {
      return NextResponse.redirect(
        new URL(`${BILLING_PATH}?error=${encodeURIComponent("Invalid target plan in payment metadata.")}`, request.url)
      );
    }

    const targetPlan = targetPlanRaw as PlanId;

    const { error: updateErr } = await supabase
      .from("users")
      .update({ plan: targetPlan })
      .eq("id", user.id);

    if (updateErr) {
      return NextResponse.redirect(
        new URL(`${BILLING_PATH}?error=${encodeURIComponent(updateErr.message)}`, request.url)
      );
    }

    return NextResponse.redirect(new URL(`${BILLING_PATH}?upgraded=${targetPlan}`, request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not complete upgrade callback.";
    return NextResponse.redirect(
      new URL(`${BILLING_PATH}?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
