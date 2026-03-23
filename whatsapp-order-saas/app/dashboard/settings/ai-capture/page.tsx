import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { listProductAliases } from "@/lib/actions/product-aliases";
import { createAdminClient } from "@/lib/supabaseAdmin";
import AiCapturePageClient from "./AiCapturePageClient";

export const metadata = { title: "AI Capture Settings" };

export default async function AiCaptureSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load products for alias mapping
  const admin = createAdminClient();
  const { data: products } = await admin
    .from("products")
    .select("id, name")
    .eq("vendor_id", user.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Load existing vendor WhatsApp number
  const { data: vendor } = await admin
    .from("users")
    .select("whatsapp_number")
    .eq("id", user.id)
    .maybeSingle();

  const { aliases = [] } = await listProductAliases();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const webhookUrl = siteUrl
    ? new URL("/api/whatsapp/webhook", siteUrl).toString()
    : "/api/whatsapp/webhook";

  return (
    <AiCapturePageClient
      products={(products ?? []).map((p) => ({ id: p.id as string, name: p.name as string }))}
      initialAliases={aliases}
      whatsappNumber={(vendor?.whatsapp_number as string) ?? null}
      webhookUrl={webhookUrl}
    />
  );
}
