import type { WorkspaceRole } from "../types/domain";
import { supabase } from "./supabaseClient";

export const workspaceService = {
  async getCurrentRole(): Promise<WorkspaceRole | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const ownerRes = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (ownerRes.error) throw ownerRes.error;
    if (ownerRes.data) return "owner";

    const memberRes = await supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (memberRes.error) throw memberRes.error;

    return (memberRes.data?.role as WorkspaceRole | undefined) ?? null;
  },
};
