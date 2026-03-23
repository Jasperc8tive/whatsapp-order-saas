import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { PLANS, DEFAULT_PLAN, getMonthOrderCount, type PlanId } from "@/lib/plans";
import { formatCurrency } from "@/lib/utils";

// ── Plan card ──────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: (typeof PLANS)[PlanId];
  isCurrentPlan: boolean;
  isUpgradable: boolean;
  upgradesAvailable: boolean;
}

function PlanCard({ plan, isCurrentPlan, isUpgradable, upgradesAvailable }: PlanCardProps) {
  return (
    <div
      className={`relative rounded-xl border p-6 flex flex-col gap-4 ${
        isCurrentPlan
          ? "border-green-500 bg-green-50 ring-2 ring-green-500/20"
          : "border-gray-200 bg-white"
      }`}
    >
      {isCurrentPlan && (
        <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
          Current plan
        </span>
      )}

      <div>
        <p className="text-lg font-bold text-gray-900">{plan.name}</p>
        <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>
      </div>

      <div>
        {plan.price === 0 ? (
          <p className="text-2xl font-extrabold text-gray-900">Free</p>
        ) : (
          <p className="text-2xl font-extrabold text-gray-900">
            {formatCurrency(plan.price)}
            <span className="text-sm font-normal text-gray-500"> / month</span>
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <svg
              className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {!isCurrentPlan && isUpgradable && upgradesAvailable && (
        <form action="/dashboard/billing/upgrade" method="post" className="mt-auto">
          <input type="hidden" name="plan" value={plan.id} />
          <button
            className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-black transition-colors"
            type="submit"
          >
            Upgrade to {plan.name}
          </button>
        </form>
      )}

      {!isCurrentPlan && isUpgradable && !upgradesAvailable && (
        <button
          disabled
          className="mt-auto w-full py-2 rounded-lg text-sm font-semibold text-white bg-gray-900 opacity-50 cursor-not-allowed"
          title="Upgrades unavailable until users.plan exists in this deployment"
        >
          Upgrade unavailable
        </button>
      )}

      {!isCurrentPlan && !isUpgradable && (
        <button
          disabled
          className="mt-auto w-full py-2 rounded-lg text-sm font-semibold text-white bg-gray-900 opacity-50 cursor-not-allowed"
          title="You can only move to a higher plan"
        >
          Not available
        </button>
      )}
    </div>
  );
}

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
        <div
          className={`h-full rounded-full transition-all ${
            isFull ? "bg-red-500" : isWarning ? "bg-yellow-400" : "bg-green-500"
          }`}
          style={{ width: `${pct}%` }}
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
  searchParams?: { upgraded?: string; error?: string };
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
  const planFromDb =
    typeof rawPlan === "string" && rawPlan in PLANS
      ? (rawPlan as PlanId)
      : null;

  const currentPlanId = (planFromDb ?? DEFAULT_PLAN) as PlanId;
  const currentPlan = PLANS[currentPlanId] ?? PLANS[DEFAULT_PLAN];
  const upgradesAvailable = planFromDb !== null;

  // Count this month's orders (use admin client to bypass RLS)
  const admin = createAdminClient();
  const used = await getMonthOrderCount(admin, user.id);

  const planOrder: PlanId[] = ["starter", "growth", "pro"];
  const rank = (plan: PlanId) => planOrder.indexOf(plan);

  return (
    <div className="space-y-6 max-w-4xl">

      {searchParams?.upgraded && searchParams.upgraded in PLANS && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">
          Plan updated successfully to <span className="font-semibold">{PLANS[searchParams.upgraded as PlanId].name}</span>.
        </div>
      )}

      {searchParams?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {decodeURIComponent(searchParams.error)}
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
          {planOrder.map((pid) => (
            <PlanCard
              key={pid}
              plan={PLANS[pid]}
              isCurrentPlan={pid === currentPlanId}
              isUpgradable={rank(pid) > rank(currentPlanId)}
              upgradesAvailable={upgradesAvailable}
            />
          ))}
        </div>
      </div>

      {/* ── Note ── */}
      <p className="text-xs text-gray-400">
        Upgrades are processed securely via Paystack checkout. Downgrades are currently disabled from self-serve billing.
      </p>

    </div>
  );
}
