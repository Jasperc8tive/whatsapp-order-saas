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

      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("staff");
      setShowInviteForm(false);

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
    if (!confirm("Remove this team member?")) return;

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
  const pendingInvitationCount = invitations.filter((i) => i.status === "pending").length;

  // ✅ FIX: computed once per render (not inside map)
  const now = Date.now();

  return (
    <div className="max-w-4xl mx-auto space-y-6">

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

                // ✅ SAFE (no Date.now inside render loop)
                const isExpiring =
                  expiresAt.getTime() < now + 24 * 60 * 60 * 1000;

                return (
                  <div key={invitation.id} className="px-6 py-4 flex justify-between">
                    <div>
                      <p className="font-medium">{invitation.email}</p>
                      <span className={isExpiring ? "text-red-600 text-xs" : "text-gray-500 text-xs"}>
                        {isExpiring ? "⚠️ Expiring soon" : "Valid"}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

    </div>
  );
}