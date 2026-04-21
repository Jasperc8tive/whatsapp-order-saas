"use client";
import dynamic from "next/dynamic";

const BillingHealthCheckPanelWrapper = dynamic(() => import("@/components/BillingHealthCheckPanelWrapper"), { ssr: false });

export default function BillingHealthCheckClientEntry() {
  return <BillingHealthCheckPanelWrapper />;
}
