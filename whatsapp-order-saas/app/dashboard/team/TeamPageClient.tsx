"use client";

import { useState, useTransition } from "react";
import {
  inviteTeamMember,
  revokeInvitation,
  removeMember,
  updateMemberRole,
} from "@/lib/actions/team";
import type { WorkspaceMember, WorkspaceInvitation, WorkspaceRole } from "@/types/team";
import { ROLE_LABELS, ROLE_COLORS } from "@/types/team";

interface Props {
  workspaceId: string;
  initialMembers: WorkspaceMember[];
  initialInvitations: WorkspaceInvitation[];
  isOwner: boolean;
}

export default function TeamPageClient({
  workspaceId,
  initialMembers,
  initialInvitations,
  isOwner,
}: Props) {
  const [members, setMembers]           = useState(initialMembers);
  const [invitations, setInvitations]   = useState(initialInvitations);
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteRole, setInviteRole]     = useState<WorkspaceRole>("staff");
  const [formError, setFormError]       = useState<string | null>(null);
  const [formSuccess, setFormSuccess]   = useState<string | null>(null);
  const [isPending, startTransition]    = useTransition();

  // ─── Invite ──────────────────────────────────────────────────────────────
  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const fd = new FormData();
    fd.set("email", inviteEmail);
    fd.set("role", inviteRole);
    startTransition(async () => {
      const result = await inviteTeamMember(fd);
      if (result.error) {
        setFormError(result.error);
      } else {
        setFormSuccess(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        // Note: in production this triggers an email; for now the token is
        // stored in workspace_invitations. Share the accept link manually.
      }
    });
  }

  // ─── Revoke invite ───────────────────────────────────────────────────────
  function handleRevoke(invitationId: string) {
    startTransition(async () => {
      const result = await revokeInvitation(invitationId);
      if (!result.error) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    });
  }

  // ─── Remove member ───────────────────────────────────────────────────────
  function handleRemove(memberId: string) {
    if (!confirm("Remove this team member? They will lose access to the dashboard.")) return;
    startTransition(async () => {
      const result = await removeMember(memberId);
      if (result.error) {
        alert(result.error);
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
      }
    });
  }

  // ─── Update role ─────────────────────────────────────────────────────────
  function handleRoleChange(memberId: string, newRole: WorkspaceRole) {
    startTransition(async () => {
      const result = await updateMemberRole(memberId, newRole);
      if (result.error) {
        alert(result.error);
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage who has access to your workspace and what they can do.
        </p>
      </div>

      {/* ── Invite form (owner only) ── */}
      {isOwner && (
        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Invite a team member</h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="staff">Staff</option>
              <option value="delivery_manager">Delivery Manager</option>
            </select>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Sending…" : "Send Invite"}
            </button>
          </form>

          {formError   && <p className="mt-3 text-sm text-red-600">{formError}</p>}
          {formSuccess && <p className="mt-3 text-sm text-green-600">{formSuccess}</p>}

          <p className="mt-3 text-xs text-gray-400">
            After sending, share the accept link:{" "}
            <span className="font-mono">{process.env.NEXT_PUBLIC_SITE_URL ?? ""}/team/accept?token=TOKEN</span>
          </p>
        </section>
      )}

      {/* ── Current members ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Members <span className="text-gray-400 font-normal">({members.length})</span>
        </h2>
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
          {members.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center text-gray-400">
              No team members yet. Invite someone above.
            </p>
          ) : (
            members.map((member) => (
              <div key={member.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {member.display_name ?? member.email ?? member.user_id.slice(0, 12)}
                  </p>
                  {member.email && member.display_name && (
                    <p className="text-xs text-gray-400 truncate">{member.email}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Role badge / selector */}
                  {member.role === "owner" || !isOwner ? (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[member.role]}`}
                    >
                      {ROLE_LABELS[member.role]}
                    </span>
                  ) : (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value as WorkspaceRole)
                      }
                      disabled={isPending}
                      className="text-xs font-semibold px-2 py-0.5 rounded-full border-0 bg-blue-100 text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                    >
                      <option value="staff">Staff</option>
                      <option value="delivery_manager">Delivery Manager</option>
                    </select>
                  )}

                  {/* Active badge */}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      member.is_active
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {member.is_active ? "Active" : "Inactive"}
                  </span>

                  {/* Remove (owner only, cannot remove self) */}
                  {isOwner && member.role !== "owner" && (
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={isPending}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Pending invitations ── */}
      {isOwner && invitations.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Pending invitations <span className="text-gray-400 font-normal">({invitations.length})</span>
          </h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {invitations.map((inv) => {
              const acceptLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/team/accept?token=${inv.token}`;
              return (
                <div key={inv.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{inv.email}</p>
                      <p className="text-xs text-gray-400">
                        Expires {new Date(inv.expires_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[inv.role]}`}
                      >
                        {ROLE_LABELS[inv.role]}
                      </span>
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        disabled={isPending}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                  
                  {/* Acceptance link */}
                  <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <code className="text-xs text-gray-600 flex-1 overflow-x-auto break-all font-mono">{acceptLink}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(acceptLink);
                      }}
                      className="flex-shrink-0 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                      title="Copy link"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Role legend */}
      <section className="bg-gray-50 rounded-2xl p-5 text-sm text-gray-600">
        <p className="font-semibold text-gray-700 mb-3">Role permissions</p>
        <div className="space-y-2">
          <div><span className="font-medium text-purple-700">Owner</span> — Full access: billing, team management, products, orders, automations.</div>
          <div><span className="font-medium text-blue-700">Staff</span> — Create and manage orders, customers, and products. Cannot change billing or team roles.</div>
          <div><span className="font-medium text-orange-700">Delivery Manager</span> — Manage delivery pipeline only. Cannot change products, billing, or team.</div>
        </div>
      </section>
    </div>
  );
}
