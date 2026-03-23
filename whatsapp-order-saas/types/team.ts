export type WorkspaceRole = "owner" | "staff" | "delivery_manager";

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  display_name: string | null;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from auth.users (populated in server queries) */
  email?: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  invited_by: string;
  created_at: string;
}

export interface OrderAssignment {
  id: string;
  order_id: string;
  assigned_to: string;
  assigned_by: string;
  reason: string | null;
  created_at: string;
  /** Joined */
  assignee_name?: string | null;
  assignee_email?: string | null;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  staff: "Staff",
  delivery_manager: "Delivery Manager",
};

export const ROLE_COLORS: Record<WorkspaceRole, string> = {
  owner: "bg-purple-100 text-purple-700",
  staff: "bg-blue-100 text-blue-700",
  delivery_manager: "bg-orange-100 text-orange-700",
};
