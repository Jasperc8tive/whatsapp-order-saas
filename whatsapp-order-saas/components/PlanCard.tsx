"use client";
import { useRef } from "react";
import { formatCurrency } from "@/lib/utils";
import type { PlanId } from "@/lib/plans";

interface PlanCardProps {
  plan: any;
  isCurrentPlan: boolean;
  isUpgradable: boolean;
  isDowngradable: boolean;
  canDowngrade: boolean;
  downgradeBlocker?: string;
  upgradesAvailable: boolean;
}

export default function PlanCard({ plan, isCurrentPlan, isUpgradable, isDowngradable, canDowngrade, downgradeBlocker, upgradesAvailable }: PlanCardProps) {
  const formRef = useRef<HTMLFormElement>(null);
  function handleConfirm(e: React.MouseEvent<HTMLButtonElement>, action: "upgrade" | "downgrade") {
    e.preventDefault();
    const msg = action === "upgrade"
      ? `Are you sure you want to upgrade to the ${plan.name} plan?`
      : `Are you sure you want to downgrade to the ${plan.name} plan?`;
    if (window.confirm(msg)) {
      formRef.current?.submit();
    }
  }
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
        {plan.features.map((f: string) => (
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

      {/* Upgrade logic */}
      {!isCurrentPlan && isUpgradable && upgradesAvailable && (
        <form ref={formRef} action="/dashboard/billing/upgrade" method="post" className="mt-auto">
          <input type="hidden" name="plan" value={plan.id} />
          <button
            className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-black transition-colors"
            type="submit"
            onClick={(e) => handleConfirm(e, "upgrade")}
          >
            Upgrade to {plan.name}
          </button>
        </form>
      )}

      {/* Downgrade logic */}
      {!isCurrentPlan && isDowngradable && (
        canDowngrade ? (
          <form ref={formRef} action="/dashboard/billing/upgrade" method="post" className="mt-auto">
            <input type="hidden" name="plan" value={plan.id} />
            <button
              className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 transition-colors"
              type="submit"
              onClick={(e) => handleConfirm(e, "downgrade")}
            >
              Downgrade to {plan.name}
            </button>
          </form>
        ) : (
          <button
            disabled
            className="mt-auto w-full py-2 rounded-lg text-sm font-semibold text-white bg-gray-900 opacity-50 cursor-not-allowed"
            title={downgradeBlocker || "You cannot downgrade due to usage limits."}
          >
            Downgrade unavailable
          </button>
        )
      )}

      {/* Not available for plans above current */}
      {!isCurrentPlan && !isUpgradable && !isDowngradable && (
        <button
          disabled
          className="mt-auto w-full py-2 rounded-lg text-sm font-semibold text-white bg-gray-900 opacity-50 cursor-not-allowed"
          title="You can only move to a higher or lower plan"
        >
          Not available
        </button>
      )}
    </div>
  );
}
