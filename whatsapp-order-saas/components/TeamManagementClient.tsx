"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: "owner" | "staff" | "delivery_manager";
  display_name: string;
  is_active: boolean;
  created_at: string;
  isOwner?: boolean;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: "owner" | "staff" | "delivery_manager";
  status: string;
  expires_at: string;
}

const ROLE_COLORS = {
  owner: { bg: "bg-purple-100", text: "text-purple-700", badge: "bg-purple-500" },
  staff: { bg: "bg-blue-100", text: "text-blue-700", badge: "bg-blue-500" },
  delivery_manager: { bg: "bg-orange-100", text: "text-orange-700", badge: "bg-orange-500" },
};

const ROLE_LABELS = {
  owner: "Owner",
  staff: "Staff",
  delivery_manager: "Delivery Manager",
};

export default function TeamManagementClient({
  initialMembers = [],
  initialInvitations = [],
  isOwner = false,
}: {
  initialMembers?: TeamMember[];
  initialInvitations?: TeamInvitation[];
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [invitations, setInvitations] = useState<TeamInvitation[]>(initialInvitations);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"staff" | "delivery_manager">("staff");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [updatingRole, setUpdatingRole] = useState<Record<string, string>>({});

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setError("Email is required");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      const data = await res.json();
      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("staff");
      setShowInviteForm(false);

      // Refresh invitations list
      const invRes = await fetch("/api/team/invitations");
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData.invitations || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateRole(memberId: string, newRole: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? { ...m, role: newRole as "owner" | "staff" | "delivery_manager" }
            : m
        )
      );
      setEditingMemberId(null);
      setSuccess("Role updated");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remove this team member? They will lose access to this workspace."))
      return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setSuccess("Team member removed");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!confirm("Revoke this invitation?")) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/team/invitations/${invitationId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to revoke invitation");

      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      setSuccess("Invitation revoked");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const activeMemberCount = members.filter((m) => m.is_active).length;
  const pendingInvitationCount = invitations.filter(
    (i) => i.status === "pending"
  ).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage team members and invite new staff
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowInviteForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Invite Member
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInviteForm(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h2>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "staff" | "delivery_manager")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  <option value="staff">Staff (Can create/manage orders)</option>
                  <option value="delivery_manager">
                    Delivery Manager (Can update deliveries)
                  </option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  They will receive an invitation link to join
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  {loading ? "Sending..." : "Send Invitation"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-900 font-medium py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">Active Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeMemberCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">Pending Invites</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{pendingInvitationCount}</p>
        </div>
      </div>

      {/* Members */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
          <h3 className="font-semibold text-gray-900">Team Members</h3>
        </div>

        {members.filter((m) => m.is_active).length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            No active team members yet
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {members
              .filter((m) => m.is_active)
              .map((member) => (
                <div
                  key={member.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.display_name || member.email}
                        </p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    {editingMemberId === member.id ? (
                      <select
                        value={updatingRole[member.id] || member.role}
                        onChange={(e) => {
                          setUpdatingRole((prev) => ({
                            ...prev,
                            [member.id]: e.target.value,
                          }));
                        }}
                        onBlur={() => {
                          const newRole = updatingRole[member.id] || member.role;
                          if (newRole !== member.role) {
                            handleUpdateRole(member.id, newRole);
                          } else {
                            setEditingMemberId(null);
                          }
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      >
                        <option value="staff">Staff</option>
                        <option value="delivery_manager">Delivery Manager</option>
                      </select>
                    ) : (
                      <span
                        onClick={() => isOwner && setEditingMemberId(member.id)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          ROLE_COLORS[member.role].bg
                        } ${ROLE_COLORS[member.role].text} ${
                          isOwner ? "cursor-pointer hover:opacity-80" : ""
                        }`}
                      >
                        {ROLE_LABELS[member.role]}
                      </span>
                    )}

                    {isOwner && member.role !== "owner" && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={loading}
                        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {pendingInvitationCount > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="border-b border-gray-200 bg-amber-50 px-6 py-3">
            <h3 className="font-semibold text-gray-900">Pending Invitations</h3>
          </div>

          <div className="divide-y divide-gray-200">
            {invitations
              .filter((i) => i.status === "pending")
              .map((invitation) => {
                const expiresAt = new Date(invitation.expires_at);
                const isExpiring = expiresAt < new Date(Date.now() + 24 * 60 * 60 * 1000);

                return (
                  <div
                    key={invitation.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{invitation.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            ROLE_COLORS[invitation.role].bg
                          } ${ROLE_COLORS[invitation.role].text}`}
                        >
                          {ROLE_LABELS[invitation.role]}
                        </span>
                        <span
                          className={`text-xs ${
                            isExpiring ? "text-red-600" : "text-gray-500"
                          }`}
                        >
                          {isExpiring ? "⚠️ " : ""}
                          Expires{" "}
                          {expiresAt.toLocaleDateString("en-NG", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {isOwner && (
                      <button
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        disabled={loading}
                        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-900">
          <strong>Tip:</strong> Staff members can create and manage orders. Delivery
          managers can only update delivery status. To change a member&apos;s role, click
          on their role badge.
        </p>
      </div>
    </div>
  );
}
