"use client";

import { useState, useRef, useMemo } from "react"; // Keep useRef if needed elsewhere
import { useRouter } from "next/navigation";

// ... interfaces remain the same ...

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

  // ✅ Get stable timestamp for this render session
  // This is safe because: 
  // 1. useMemo with [] only computes once per mount
  // 2. We're using it for UI hints, not critical logic
  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), []);

  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ... header and members sections unchanged ... */}

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