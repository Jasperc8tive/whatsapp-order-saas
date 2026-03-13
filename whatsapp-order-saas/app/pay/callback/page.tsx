"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

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

// ── Status UI atoms ───────────────────────────────────────────────────────────

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

// ── Inner component (uses useSearchParams) ────────────────────────────────────

function CallbackContent() {
  const searchParams = useSearchParams();
  const reference    = searchParams.get("reference") ?? searchParams.get("trxref");

  const [result,  setResult]  = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setLoading(false);
      setFetchErr("No payment reference found in URL.");
      return;
    }

    async function verify() {
      try {
        const res  = await fetch(`/api/verify-payment?reference=${encodeURIComponent(reference!)}`);
        const data = await res.json() as VerifyResult;
        setResult(data);
      } catch {
        setFetchErr("Could not connect to the payment server. Please contact support.");
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [reference]);

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center space-y-4">
        <StatusIcon status="loading" />
        <p className="text-gray-600 font-medium">Verifying your payment…</p>
        <p className="text-sm text-gray-400">Please wait, do not close this page.</p>
      </div>
    );
  }

  // ── Fetch/network error ──────────────────────────────────────────────────
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

  const isPaid   = result.paid;
  const amountFmt = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(result.amount_ngn);

  // ── Success ──────────────────────────────────────────────────────────────
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

        {/* Summary card */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm text-left">
          <div className="flex justify-between px-4 py-3">
            <span className="text-gray-500">Amount paid</span>
            <span className="font-bold text-gray-900">{amountFmt}</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-gray-500">Reference</span>
            <span className="font-mono font-semibold text-gray-700">{result.reference}</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-gray-500">Channel</span>
            <span className="capitalize text-gray-700">{result.gateway_response}</span>
          </div>
          {result.order && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-gray-500">Order ref</span>
              <span className="font-mono font-semibold text-gray-700">
                #{result.order.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 justify-center text-sm text-green-700 bg-green-50 rounded-xl py-3 px-4">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          The vendor will prepare your order and contact you via WhatsApp.
        </div>
      </div>
    );
  }

  // ── Failed / abandoned ───────────────────────────────────────────────────
  return (
    <div className="text-center space-y-5">
      <StatusIcon status="failed" />

      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {result.status === "abandoned" ? "Payment cancelled" : "Payment failed"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {result.status === "abandoned"
            ? "You closed the payment window before completing the transaction."
            : result.gateway_response || "Your payment could not be completed."}
        </p>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm">
        <p className="text-xs text-gray-400 mb-1">Reference</p>
        <p className="font-mono font-semibold text-gray-700">{result.reference}</p>
      </div>

      <p className="text-sm text-gray-500">
        You can try paying again by going back to your order link,
        or contact the vendor on WhatsApp for assistance.
      </p>

      <Link
        href="/"
        className="inline-block text-sm text-green-600 font-medium hover:underline"
      >
        ← Back to OrderFlow
      </Link>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentCallbackPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-500">OrderFlow</span>
        </div>

        {/* Suspense required for useSearchParams() */}
        <Suspense
          fallback={
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          }
        >
          <CallbackContent />
        </Suspense>
      </div>
    </div>
  );
}
