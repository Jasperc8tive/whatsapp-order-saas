import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { PLANS, DEFAULT_PLAN, getMonthOrderCount, resolvePlanId, type PlanId } from "@/lib/plans";
import { formatCurrency } from "@/lib/utils";
import dynamic from "next/dynamic";

// ── Plan card ──────────────────────────────────────────────────────────────────

const PlanCard = dynamic(() => import("@/components/PlanCard"));

// ── Usage meter ────────────────────────────────────────────────────────────────

interface UsageMeterProps {
  used: number;
  limit: number | null;
  planName: string;
}

function UsageMeter({ used, limit, planName }: UsageMeterProps) {
  if (limit === null) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Monthly usage</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {used.toLocaleString()} orders this month
            </p>
            <p className="text-sm text-gray-500">Unlimited on the {planName} plan</p>
          </div>
        </div>
      </div>
    );
  }

  const pct = Math.min((used / limit) * 100, 100);
  const isWarning = pct >= 80;
  const isFull = pct >= 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <h2 className="font-semibold text-gray-800">Monthly usage</h2>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isFull
              ? "bg-red-100 text-red-700"
              : isWarning
              ? "bg-yellow-100 text-yellow-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {isFull ? "Limit reached" : isWarning ? "Almost full" : "Good"}
        </span>
      </div>

      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-2xl font-extrabold text-gray-900">
          {used.toLocaleString()}
        </span>
        <span className="text-sm text-gray-400">/ {limit.toLocaleString()} orders</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <progress
          className={[
            "w-full h-2 rounded-full overflow-hidden",
            "[&::-webkit-progress-bar]:bg-gray-100 [&::-webkit-progress-bar]:rounded-full",
            "[&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full",
            isFull
              ? "[&::-webkit-progress-value]:bg-red-500 [&::-moz-progress-bar]:bg-red-500"
              : isWarning
              ? "[&::-webkit-progress-value]:bg-yellow-400 [&::-moz-progress-bar]:bg-yellow-400"
              : "[&::-webkit-progress-value]:bg-green-500 [&::-moz-progress-bar]:bg-green-500",
          ].join(" ")}
          value={pct}
          max={100}
          aria-label={`Monthly order usage: ${used} of ${limit}`}
        />
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Resets on the 1st of each month. Upgrade to get more orders.
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ upgraded?: string; error?: string; feature?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendorRow } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const rawPlan = (vendorRow as Record<string, unknown> | null)?.plan;
  const planFromDb = rawPlan === undefined || rawPlan === null ? null : resolvePlanId(rawPlan);

  const currentPlanId = (planFromDb ?? DEFAULT_PLAN) as PlanId;
  const currentPlan = PLANS[currentPlanId] ?? PLANS[DEFAULT_PLAN];
  const upgradesAvailable = planFromDb !== null;

  // Count this month's orders (use admin client to bypass RLS)
  const admin = createAdminClient();
  const used = await getMonthOrderCount(admin, user.id);

  const planOrder: PlanId[] = ["starter", "growth", "pro"];
  const rank = (plan: PlanId) => planOrder.indexOf(plan);
  const resolvedSearchParams = await searchParams;

  return (
    <div className="space-y-6 max-w-4xl">

      {resolvedSearchParams?.upgraded && resolvedSearchParams.upgraded in PLANS && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">
          Plan updated successfully to <span className="font-semibold">{PLANS[resolvedSearchParams.upgraded as PlanId].name}</span>.
        </div>
      )}

      {resolvedSearchParams?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {decodeURIComponent(resolvedSearchParams.error)}
        </div>
      )}

      {resolvedSearchParams?.feature === "ai-inbox-copilot" && currentPlanId !== "pro" && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-xl px-4 py-3">
          AI Inbox Copilot, AI Drafts, and AI Capture Settings are unlocked on the <span className="font-semibold">Pro</span> plan.
        </div>
      )}

      {!upgradesAvailable && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded-xl px-4 py-3">
          Upgrades are disabled in this deployment because the <span className="font-mono">users.plan</span> column is unavailable.
        </div>
      )}

      {/* ── Usage ── */}
      <UsageMeter
        used={used}
        limit={currentPlan.monthlyOrderLimit}
        planName={currentPlan.name}
      />

      {/* ── Plan cards ── */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-4">Available plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {planOrder.map((pid) => {
            const isCurrent = pid === currentPlanId;
            const isUp = rank(pid) > rank(currentPlanId);
            const isDown = rank(pid) < rank(currentPlanId);
            let canDowngrade = true;
            let downgradeBlocker = "";
            if (isDown) {
              const limit = PLANS[pid].monthlyOrderLimit;
              if (limit !== null && used > limit) {
                canDowngrade = false;
                downgradeBlocker = `You have used ${used} orders this month, which exceeds the ${PLANS[pid].name} plan limit of ${limit}. Wait until next month or reduce usage to downgrade.`;
              }
            }
            return (
              <PlanCard
                key={pid}
                plan={PLANS[pid]}
                isCurrentPlan={isCurrent}
                isUpgradable={isUp}
                isDowngradable={isDown}
                canDowngrade={canDowngrade}
                downgradeBlocker={downgradeBlocker}
                upgradesAvailable={upgradesAvailable}
              />
            );
          })}
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Pro AI Upgrade</h2>
            <p className="text-sm text-slate-300 mt-1">
              Unlock AI Inbox Copilot, order-draft review, alias training, and future AI workflow upgrades on Pro.
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider bg-white/10 text-white px-3 py-1 rounded-full">
            Pro only
          </span>
        </div>
        <ul className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
          <li>AI WhatsApp message parsing into structured orders</li>
          <li>Confidence-based draft review queue</li>
          <li>AI Capture Settings and product alias training</li>
          <li>Future smart replies and chat-to-order autofill</li>
        </ul>
      </div>

      {/* ── Note ── */}
      <p className="text-xs text-gray-400">
        Upgrades are processed securely via Paystack checkout. Downgrades are currently disabled from self-serve billing.
      </p>

    </div>
  );
}
