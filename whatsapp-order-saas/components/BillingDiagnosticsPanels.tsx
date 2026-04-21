"use client";
import { useEffect, useState } from "react";

function Panel({ title, status, children }: any) {
  return (
    <div className={`rounded border p-4 mb-4 ${status ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="font-semibold mb-1">{title}</div>
      {children}
    </div>
  );
}

export default function BillingDiagnosticsPanels() {
  const [payment, setPayment] = useState<any>(null);
  const [webhook, setWebhook] = useState<any>(null);
  const [env, setEnv] = useState<any>(null);

  useEffect(() => {
    fetch("/api/billing-health/payment-status").then(r => r.json()).then(setPayment);
    fetch("/api/billing-health/webhook-status").then(r => r.json()).then(setWebhook);
    fetch("/api/billing-health/env-status").then(r => r.json()).then(setEnv);
  }, []);

  return (
    <div>
      <Panel title="Payment Provider Status" status={payment?.providers?.[0]?.ok}>
        {payment ? (
          <div>
            {payment.providers.map((p: any) => (
              <div key={p.provider} className="mb-2">
                <span>{p.provider}: {p.message}</span>
                {!p.ok && (
                  <div className="mt-1">
                    <a
                      href="https://dashboard.paystack.com/settings/developer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-700 underline font-semibold"
                    >
                      How to Fix: Check Paystack API keys
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : "Checking..."}
      </Panel>
      <Panel title="Webhook Delivery Status" status={webhook?.webhook?.ok}>
        {webhook ? (
          <div>
            {webhook.webhook.message} <span className="block text-xs text-gray-500">{webhook.webhook.url}</span>
            {!webhook.webhook.ok && (
              <div className="mt-1">
                <button
                  className="text-xs text-blue-700 underline font-semibold"
                  onClick={() => {
                    navigator.clipboard.writeText(webhook.webhook.url);
                  }}
                >
                  Copy Webhook URL
                </button>
                <span className="ml-2 text-xs text-gray-600">Paste this in your payment provider dashboard.</span>
              </div>
            )}
          </div>
        ) : "Checking..."}
      </Panel>
      <Panel title="Environment Variables" status={env?.ok}>
        {env ? (
          env.ok ? env.message : <div>
            <div className="text-amber-800">{env.message}</div>
            <ul className="mt-1 list-disc list-inside text-xs text-gray-700">
              {env.missing.map((v: string) => <li key={v}>{v}</li>)}
            </ul>
            <button
              className="mt-2 px-2 py-1 rounded bg-blue-700 text-white text-xs font-semibold"
              onClick={() => {
                const exportLines = env.missing.map((v: string) => `export ${v}=`).join("\n");
                navigator.clipboard.writeText(exportLines);
              }}
            >
              Copy export commands
            </button>
            <span className="ml-2 text-xs text-gray-600">Paste into your .env or server config.</span>
          </div>
        ) : "Checking..."}
      </Panel>
    </div>
  );
}
