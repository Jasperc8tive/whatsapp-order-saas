"use client";

import { useState, useTransition } from "react";
import { createProductAlias, deleteProductAlias } from "@/lib/actions/product-aliases";
import type { ProductAlias } from "@/lib/actions/product-aliases";

interface Product {
  id: string;
  name: string;
}

interface Props {
  products: Product[];
  initialAliases: ProductAlias[];
  whatsappNumber: string | null;
  webhookUrl: string;
}

export default function AiCapturePageClient({
  products,
  initialAliases,
  whatsappNumber,
  webhookUrl,
}: Props) {
  const [aliases, setAliases]         = useState(initialAliases);
  const [selectedProduct, setSelected] = useState(products[0]?.id ?? "");
  const [aliasInput, setAliasInput]   = useState("");
  const [formError, setFormError]     = useState<string | null>(null);
  const [toast, setToast]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleAddAlias(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selectedProduct) return;
    startTransition(async () => {
      const result = await createProductAlias(selectedProduct, aliasInput.trim());
      if (result.error) {
        setFormError(result.error);
      } else {
        const product = products.find((p) => p.id === selectedProduct);
        setAliases((prev) => [
          ...prev,
          {
            id:           Date.now().toString(),
            product_id:   selectedProduct,
            alias:        aliasInput.trim().toLowerCase(),
            product_name: product?.name,
            created_at:   new Date().toISOString(),
          },
        ]);
        setAliasInput("");
        showToast("Alias added.");
      }
    });
  }

  function handleDeleteAlias(aliasId: string) {
    startTransition(async () => {
      const result = await deleteProductAlias(aliasId);
      if (result.error) {
        showToast(result.error);
      } else {
        setAliases((prev) => prev.filter((a) => a.id !== aliasId));
        showToast("Alias removed.");
      }
    });
  }

  // Group aliases by product
  const aliasesByProduct: Record<string, { productName: string; aliases: ProductAlias[] }> = {};
  for (const alias of aliases) {
    const pid = alias.product_id;
    if (!aliasesByProduct[pid]) {
      aliasesByProduct[pid] = {
        productName: alias.product_name ?? products.find((p) => p.id === pid)?.name ?? pid,
        aliases: [],
      };
    }
    aliasesByProduct[pid].aliases.push(alias);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-green-600 text-white text-sm font-medium rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Order Capture</h1>
        <p className="mt-1 text-sm text-gray-500">
          When customers message your WhatsApp number, the AI reads their message and automatically creates orders.
        </p>
      </div>

      {/* Setup guide */}
      <section className="bg-blue-50 border border-blue-200 rounded-2xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-blue-900">Setup Guide</h2>
        <ol className="space-y-3 text-sm text-blue-800 list-decimal list-inside">
          <li>
            Go to{" "}
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Meta for Developers
            </a>{" "}
            → Your App → WhatsApp → Configuration → Webhook
          </li>
          <li>
            Set the <strong>Webhook URL</strong> to:
            <div className="mt-1.5 flex items-center gap-2">
              <code className="text-xs bg-white border border-blue-200 px-3 py-1.5 rounded-lg font-mono break-all flex-1">
                {webhookUrl}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(webhookUrl); showToast("Copied!"); }}
                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </li>
          <li>
            Set the <strong>Verify Token</strong> to the value of{" "}
            <code className="text-xs bg-white border border-blue-200 px-1.5 py-0.5 rounded font-mono">
              WHATSAPP_WEBHOOK_VERIFY_TOKEN
            </code>{" "}
            in your <code className="text-xs font-mono">.env.local</code>
          </li>
          <li>
            Make sure{" "}
            <code className="text-xs font-mono">WHATSAPP_APP_SECRET</code>,{" "}
            <code className="text-xs font-mono">OPENAI_API_KEY</code>, and{" "}
            <code className="text-xs font-mono">WHATSAPP_PHONE_NUMBER_ID</code>{" "}
            are set in your environment.
          </li>
          <li>
            Set your <strong>WhatsApp Number</strong> in{" "}
            <a href="/dashboard/settings" className="underline font-medium">
              General Settings
            </a>{" "}
            so inbound messages route to your workspace.
            {whatsappNumber ? (
              <span className="ml-2 text-green-700 font-semibold">✓ {whatsappNumber}</span>
            ) : (
              <span className="ml-2 text-orange-600 font-semibold">⚠ Not set</span>
            )}
          </li>
        </ol>
      </section>

      {/* Confidence thresholds explanation */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">How AI routing works</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">✓</span>
            <div>
              <p className="font-medium text-gray-800">≥ 85% confidence → Auto-create order</p>
              <p className="text-gray-500">Customer gets an immediate confirmation message.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold">~</span>
            <div>
              <p className="font-medium text-gray-800">55–84% confidence → Draft for review</p>
              <p className="text-gray-500">Appears on this page for your staff to approve or reject.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">?</span>
            <div>
              <p className="font-medium text-gray-800">&lt; 55% confidence → Ask for clarification</p>
              <p className="text-gray-500">AI replies to the customer asking them to clarify their order.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Product aliases */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Product Aliases</h2>
          <p className="text-sm text-gray-500 mt-1">
            Map customer phrases to products (e.g. "shawarma" → Chicken Shawarma).
            Aliases improve AI accuracy significantly.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-6 text-sm text-gray-400 text-center">
            No active products found.{" "}
            <a href="/dashboard/products" className="text-green-600 underline">Add products</a>{" "}
            first.
          </div>
        ) : (
          <>
            {/* Add alias form */}
            <form
              onSubmit={handleAddAlias}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Add alias</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelected(e.target.value)}
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder='Customer phrase (e.g. "shawarma")'
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                />
                <button
                  type="submit"
                  disabled={isPending || !aliasInput.trim()}
                  className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
              {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
            </form>

            {/* Existing aliases */}
            {Object.entries(aliasesByProduct).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No aliases configured yet.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
                {Object.entries(aliasesByProduct).map(([, group]) => (
                  group.aliases.map((alias) => (
                    <div key={alias.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <span className="text-sm font-mono font-medium text-gray-800">{alias.alias}</span>
                        <span className="text-xs text-gray-400 ml-2">→ {group.productName}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteAlias(alias.id)}
                        disabled={isPending}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
