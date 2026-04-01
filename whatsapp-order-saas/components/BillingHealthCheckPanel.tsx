"use client";
import { useEffect, useState } from "react";


export default function BillingHealthCheckPanel() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing-health")
      .then((r) => r.json())
      .then((data) => {
        setResult(data);
        setLoading(false);
      });
  }, []);

  async function handleFix() {
    setFixing(true);
    setFixError(null);
    try {
      const res = await fetch("/api/billing-health/fix-users-plan", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Unknown error");
      // Re-run health check
      setLoading(true);
      fetch("/api/billing-health")
        .then((r) => r.json())
        .then((data) => {
          setResult(data);
          setLoading(false);
        });
    } catch (e: any) {
      setFixError(e.message || "Unknown error");
    } finally {
      setFixing(false);
    }
  }

  if (loading) return <div className="text-sm">Checking billing schema…</div>;
  if (!result) return <div className="text-red-600 text-sm">Could not check billing schema.</div>;
  if (result.ok) return <div className="text-green-700 text-sm">Billing schema is healthy.</div>;

  return (
    <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
      <div className="font-semibold mb-1">Billing schema issue:</div>
      <div>{result.error}</div>
      {result.users && (
        <ul className="mt-2 list-disc list-inside">
          {result.users.map((u: any) => (
            <li key={u.id}>{u.email}</li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center gap-3">
        <button
          className="px-3 py-1 rounded bg-blue-700 text-white text-xs font-semibold disabled:opacity-60"
          onClick={handleFix}
          disabled={fixing}
        >
          {fixing ? "Fixing…" : "Fix Now"}
        </button>
        {fixError && <span className="text-xs text-red-700">{fixError}</span>}
      </div>
      <div className="mt-2 text-xs text-gray-500">See admin diagnostics for remediation steps.</div>
    </div>
  );
}
