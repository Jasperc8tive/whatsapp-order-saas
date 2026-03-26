import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { listDrafts } from "@/lib/actions/drafts";
import DraftsPageClient from "./DraftsPageClient";
import PlanLockedFeature from "@/components/PlanLockedFeature";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { getWorkspacePlan, hasAiInboxCopilotAccess } from "@/lib/plans";

export const metadata = { title: "AI Order Drafts" };

export default async function DraftsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getCurrentWorkspaceId(user.id);
  if (!workspaceId) redirect("/login");

  const currentPlanId = await getWorkspacePlan(createAdminClient(), workspaceId);
  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return (
      <PlanLockedFeature
        title="AI Order Drafts"
        description="AI order capture, smart draft review, and automated parsing are unlocked on the Pro plan only."
        currentPlanId={currentPlanId}
      />
    );
  }

  const { drafts = [], error } = await listDrafts("pending_review");

  return (
    <DraftsPageClient
      initialDrafts={drafts}
      fetchError={error}
    />
  );
}
