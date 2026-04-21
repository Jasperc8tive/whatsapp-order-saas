import type { WorkspaceMember, WorkspaceRole } from "../types/domain";
import { apiRequest } from "./apiClient";
import { supabase } from "./supabaseClient";

export const teamService = {
  async listMembers(): Promise<WorkspaceMember[]> {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("id,workspace_id,user_id,role,display_name,is_active,created_at,updated_at")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as WorkspaceMember[];
  },

  async inviteMember(email: string, role: WorkspaceRole): Promise<void> {
    await apiRequest("/api/team", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  },
};
