import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { listProductAliases } from "@/lib/actions/product-aliases";
import { createAdminClient } from "@/lib/supabaseAdmin";
import AiCapturePageClient from "./AiCapturePageClient";
import PlanLockedFeature from "@/components/PlanLockedFeature";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { getWorkspacePlan, hasAiInboxCopilotAccess } from "@/lib/plans";

export const metadata = { title: "AI Capture Settings" };

export default async function AiCaptureSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) redirect("/login");

  const admin = createAdminClient();
  const currentPlanId = await getWorkspacePlan(admin, workspaceId);

  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return (
      <PlanLockedFeature
        title="AI Capture Settings"
        description="Webhook-based AI parsing, product alias training, and confidence routing are available on Pro only."
        currentPlanId={currentPlanId}
      />
    );
  }

  // Load products for alias mapping
  const { data: products } = await admin
    .from("products")
    .select("id, name")
    .eq("vendor_id", workspaceId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Load existing vendor WhatsApp number
  const { data: vendor } = await admin
    .from("users")
    .select("whatsapp_number")
    .eq("id", workspaceId)
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
