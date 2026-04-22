"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface VerifyResult {
  reference: string;
  status: "success" | "failed" | "abandoned" | "pending";
  paid: boolean;
  amount_ngn: number;
  currency: string;
  gateway_response: string;
  paid_at: string | null;
  customer: { email: string; first_name?: string; last_name?: string };
  order: { id: string; payment_status: string; order_status: string } | null;
  error?: string;
}

// ── Status UI ─────────────────────────────────────────────

function StatusIcon({ status }: { status: VerifyResult["status"] | "loading" }) {
  if (status === "loading") {
    return (
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
        <svg className="w-7 h-7 text-gray-400 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
      <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  );
}

// ── Main Logic ─────────────────────────────────────────────

function CallbackContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  const hasReference = !!reference;

  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(hasReference);
  const [fetchErr, setFetchErr] = useState<string | null>(
    hasReference ? null : "No payment reference found in URL."
  );

  useEffect(() => {
    if (!reference) return;

    const verify = async () => {
      try {
        const res = await fetch(`/api/verify-payment?reference=${encodeURIComponent(reference)}`);
        const data = (await res.json()) as VerifyResult;
        setResult(data);
      } catch {
        setFetchErr("Could not connect to the payment server. Please contact support.");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [reference]);

  // ── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center space-y-4">
        <StatusIcon status="loading" />
        <p className="text-gray-600 font-medium">Verifying your payment…</p>
        <p className="text-sm text-gray-400">Please wait, do not close this page.</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────
  if (fetchErr || result?.error) {
    return (
      <div className="text-center space-y-4">
        <StatusIcon status="failed" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Verification failed</h2>
          <p className="text-sm text-gray-500 mt-1">{fetchErr ?? result?.error}</p>
        </div>
        {reference && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 text-sm text-gray-600">
            <p className="text-xs text-gray-400 mb-1">Reference</p>
            <p className="font-mono font-semibold">{reference}</p>
          </div>
        )}
        <p className="text-xs text-gray-400">
          Share this reference with the vendor if you need assistance.
        </p>
      </div>
    );
  }

  if (!result) return null;

  const isPaid = result.paid;

  const amountFmt = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(result.amount_ngn);

  // ── Success ─────────────────────────────────────────────
  if (isPaid) {
    return (
      <div className="text-center space-y-5">
        <StatusIcon status="success" />

        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payment successful!</h2>
          <p className="text-sm text-gray-500 mt-1">
            Your order has been paid and is now being processed.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y text-sm text-left">
          <div className="flex justify-between px-4 py-3">
            <span>Amount paid</span>
            <span className="font-bold">{amountFmt}</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span>Reference</span>
            <span className="font-mono">{result.reference}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Failed ──────────────────────────────────────────────
  return (
    <div className="text-center space-y-5">
      <StatusIcon status="failed" />

      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {result.status === "abandoned" ? "Payment cancelled" : "Payment failed"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {result.gateway_response || "Your payment could not be completed."}
        </p>
      </div>

      <Link href="/" className="text-green-600 text-sm font-medium hover:underline">
        ← Back to WhatsOrder
      </Link>
    </div>
  );
}

// ── Page Wrapper ──────────────────────────────────────────

export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow">
        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <CallbackContent />
        </Suspense>
      </div>
    </div>
  );
}