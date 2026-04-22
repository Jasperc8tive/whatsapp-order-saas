"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

// ✅ Interfaces must be defined at module scope (outside component)
interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: "owner" | "staff" | "delivery_manager";
  display_name: string;
  is_active: boolean;
  created_at: string;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: "owner" | "staff" | "delivery_manager";
  status: string;
  expires_at: string;
}

// ✅ Constants at module scope
const ROLE_COLORS = {
  owner: { bg: "bg-purple-100", text: "text-purple-700" },
  staff: { bg: "bg-blue-100", text: "text-blue-700" },
  delivery_manager: { bg: "bg-orange-100", text: "text-orange-700" },
} as const;

const ROLE_LABELS = {
  owner: "Owner",
  staff: "Staff",
  delivery_manager: "Delivery Manager",
} as const;

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
  const [loading, setLoading] = useState(false);

  // ✅ Stable timestamp for UI hints only
  // eslint-disable-next-line react-hooks/purity -- Safe: useMemo ensures stable value per mount; used for non-critical UI hint only
  const now = useMemo(() => Date.now(), []);

  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
        <p className="text-sm text-gray-500">Manage team members and invitations</p>
      </div>

      {/* Members */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Active Members</h3>

        {members.filter((m) => m.is_active).length === 0 ? (
          <p className="text-sm text-gray-500">No active members</p>
        ) : (
          <div className="space-y-3">
            {members
              .filter((m) => m.is_active)
              .map((member) => (
                <div key={member.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      {member.display_name || member.email}
                    </p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>

                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      ROLE_COLORS[member.role].bg
                    } ${ROLE_COLORS[member.role].text}`}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="border-b border-gray-200 bg-amber-50 px-6 py-3">
            <h3 className="font-semibold text-gray-900">Pending Invitations</h3>
          </div>

          <div className="divide-y divide-gray-200">
            {pendingInvitations.map((invitation) => {
              const expiresAt = new Date(invitation.expires_at);
              const isExpiring = expiresAt.getTime() < now + 24 * 60 * 60 * 1000;

              return (
                <div
                  key={invitation.id}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {invitation.email}
                    </p>

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
                        {isExpiring ? "⚠️ Expiring soon" : "Valid"}
                      </span>
                    </div>
                  </div>

                  {isOwner && (
                    <button
                      disabled={loading}
                      className="text-xs text-red-600 hover:text-red-800"
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
    </div>
  );
}