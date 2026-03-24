"use client";

import { useState, useEffect } from "react";
import { assignOrder, unassignOrder, listAssignableMembers } from "@/lib/actions/assignments";
import type { OrderAssignment } from "@/types/team";

interface AssignmentModalProps {
  orderId: string;
  workspaceId: string;
  currentAssignment: OrderAssignment | null;
  onClose: () => void;
  onAssigned?: (assignment: OrderAssignment | null) => void;
}

interface Assignee {
  user_id: string;
  display_name: string | null;
  email: string;
  role: string;
}

export default function AssignmentModal({
  orderId,
  workspaceId,
  currentAssignment,
  onClose,
  onAssigned,
}: AssignmentModalProps) {
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(currentAssignment?.assigned_to ?? "");
  const [reason, setReason] = useState<string>(currentAssignment?.reason ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load available assignees
  useEffect(() => {
    async function load() {
      const result = await listAssignableMembers(workspaceId);
      if (result.error) {
        setError(result.error);
      } else {
        setAssignees(result.members ?? []);
      }
      setIsLoading(false);
    }
    load();
  }, [workspaceId]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    try {
      if (!selectedUserId) {
        setError("Please select a team member.");
        return;
      }

      const result = await assignOrder(orderId, selectedUserId, reason || undefined);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        onAssigned?.(null); // Trigger refetch
        setTimeout(() => onClose(), 1500);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnassign() {
    setError(null);
    setIsSaving(true);

    try {
      const result = await unassignOrder(orderId);
      if (result.error) {
        setError(result.error);
      } else {
        setSelectedUserId("");
        setReason("");
        setSuccess(true);
        onAssigned?.(null); // Trigger refetch
        setTimeout(() => onClose(), 1500);
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          {currentAssignment ? "Update Assignment" : "Assign Order"}
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <svg className="w-6 h-6 animate-spin text-green-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : (
          <>
            {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</p>}
            {success && (
              <p className="mb-4 text-sm text-green-600 bg-green-50 p-3 rounded">
                Assignment {currentAssignment ? "updated" : "created"} successfully!
              </p>
            )}

            <form onSubmit={handleAssign} className="space-y-4">
              {/* Team member selector */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Assign to
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
                >
                  <option value="">Select a team member...</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.user_id} value={assignee.user_id}>
                      {assignee.display_name || assignee.email} ({assignee.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Specialist handling this order"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
                />
              </div>

              {/* Current assignment info */}
              {currentAssignment && (
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                  <p>
                    <strong>Currently assigned to:</strong> {currentAssignment.assignee_name || currentAssignment.assignee_email}
                  </p>
                  {currentAssignment.reason && (
                    <p>
                      <strong>Reason:</strong> {currentAssignment.reason}
                    </p>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving || !selectedUserId}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
                >
                  {isSaving ? "Saving…" : currentAssignment ? "Update" : "Assign"}
                </button>

                {currentAssignment && (
                  <button
                    type="button"
                    onClick={handleUnassign}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-red-100 hover:bg-red-200 disabled:bg-gray-100 text-red-700 font-medium rounded-lg transition-colors"
                  >
                    {isSaving ? "…" : "Unassign"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
