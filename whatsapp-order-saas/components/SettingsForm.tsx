"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateSettings, type SettingsState } from "@/lib/actions/settings";

interface SettingsFormProps {
  businessName: string;
  slug: string;
  siteOrigin: string;
  whatsappNumber: string | null;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2"
    >
      {pending && (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {pending ? "Saving…" : "Save Changes"}
    </button>
  );
}

export default function SettingsForm({ businessName, slug, siteOrigin, whatsappNumber }: SettingsFormProps) {
  const [state, formAction] = useFormState<SettingsState, FormData>(updateSettings, {});

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your store and WhatsApp configuration</p>
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          Settings saved successfully.
        </div>
      )}

      {/* Store Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Store Information</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="business_name" className="block text-sm font-medium text-gray-700 mb-1">
              Store Name <span className="text-red-400">*</span>
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              defaultValue={businessName}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
              Store URL Slug <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">
              <span className="bg-gray-50 px-3 py-2 text-sm text-gray-500 border-r border-gray-300 whitespace-nowrap">
                {siteOrigin.replace(/\/$/, "")}/order/
              </span>
              <input
                id="slug"
                name="slug"
                type="text"
                defaultValue={slug}
                required
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers and hyphens.</p>
          </div>
        </div>
      </div>

      {/* WhatsApp Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">WhatsApp Notifications</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Your WhatsApp Number (to receive order alerts)
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              placeholder="+2348012345678"
              defaultValue={whatsappNumber ?? ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Include country code, e.g. +2348012345678</p>
          </div>
        </div>
      </div>

      <SaveButton />
    </form>
  );
}
