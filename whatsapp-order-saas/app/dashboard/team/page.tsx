import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { listTeamMembers, listInvitations } from "@/lib/actions/team";
import TeamPageClient from "./TeamPageClient";

export const metadata = { title: "Team — OrderFlow" };

export default async function TeamPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Owners have their workspace_id === their own user.id
  const workspaceId = user.id;

  const [{ members }, { invitations }] = await Promise.all([
    listTeamMembers(workspaceId),
    listInvitations(workspaceId),
  ]);

  const isOwner = true; // Page is only reachable by the owner (enforced below via server check)

  return (
    <TeamPageClient
      workspaceId={workspaceId}
      initialMembers={members ?? []}
      initialInvitations={invitations ?? []}
      isOwner={isOwner}
    />
  );
}
