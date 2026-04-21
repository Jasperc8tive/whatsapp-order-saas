"use client";
import BillingHealthCheckPanel from "@/components/BillingHealthCheckPanel";
import dynamic from "next/dynamic";
const BillingDiagnosticsPanels = dynamic(() => import("@/components/BillingDiagnosticsPanels"), { ssr: false });

export default function DiagnosticsPage() {
  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Admin Diagnostics</h1>
      <BillingHealthCheckPanel />
      <BillingDiagnosticsPanels />
    </div>
  );
}
