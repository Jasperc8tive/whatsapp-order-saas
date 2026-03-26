import Link from "next/link";
import { PLANS, HIGHEST_PLAN_ID, type PlanId } from "@/lib/plans";

interface PlanLockedFeatureProps {
  title: string;
  description: string;
  currentPlanId: PlanId;
}

export default function PlanLockedFeature({
  title,
  description,
  currentPlanId,
}: PlanLockedFeatureProps) {
  const currentPlan = PLANS[currentPlanId];
  const requiredPlan = PLANS[HIGHEST_PLAN_ID];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2h-1V9a5 5 0 00-10 0v2H6a2 2 0 00-2 2v6a2 2 0 002 2zm3-10V9a3 3 0 016 0v2H9z" />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-gray-900">Upgrade to {requiredPlan.name} to unlock this AI feature</h2>
        <p className="mt-2 text-sm text-gray-600">
          Your current plan is <span className="font-semibold">{currentPlan.name}</span>. AI-powered capture and automation are reserved for the highest billing tier.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Current plan</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{currentPlan.name}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Required plan</p>
            <p className="mt-1 text-lg font-semibold text-emerald-900">{requiredPlan.name}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/billing?feature=ai-inbox-copilot"
            className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
          >
            Upgrade in Billing
          </Link>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View plans
          </Link>
        </div>
      </div>
    </div>
  );
}