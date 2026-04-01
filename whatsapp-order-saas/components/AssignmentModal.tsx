"use client";

import { assignOrder, unassignOrder, listAssignableMembers } from "@/lib/actions/assignments";
import { useEffect } from "react";
import { useState } from "react";
// Fetch suggested assignee from backend
async function fetchSuggestedAssignee(order: any, managers: any[], vendorId: string) {
  const res = await fetch("/api/orders/suggested-assignee", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order, managers, vendorId })
  });
  if (!res.ok) return null;
  return await res.json();
}
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
  // Optimistic assignment state
  const [optimisticAssignment, setOptimisticAssignment] = useState<OrderAssignment | null>(currentAssignment);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(currentAssignment?.assigned_to ?? "");
  const [suggested, setSuggested] = useState<any | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(true);
  const [reason, setReason] = useState<string>(currentAssignment?.reason ?? "");
  // Track if override is required (auto-assigned and user is changing assignee)
  const [overrideRequired, setOverrideRequired] = useState(false);
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
        setIsLoading(false);
        return;
      }
      setAssignees(result.members ?? []);
      // Try to fetch suggested assignee if orderId and members available
      if (orderId && result.members && result.members.length > 0) {
        // Fetch order details from parent if available, else minimal stub
        const order = { id: orderId, vendor_id: workspaceId };
        const vendorId = workspaceId;
        const suggestion = await fetchSuggestedAssignee(order, result.members, vendorId);
        if (suggestion && suggestion.assignedTo) {
          setSuggested(suggestion);
          setSelectedUserId((prev) => prev || suggestion.assignedTo);
        }
      }
      setIsLoading(false);
    }
    load();
  }, [workspaceId, orderId]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSaving(true);

    // Check if override reason is required
    const isAutoAssigned = currentAssignment?.reason?.toLowerCase().includes("auto-assigned");
    const isOverride = !!(isAutoAssigned && selectedUserId && selectedUserId !== currentAssignment?.assigned_to);
    setOverrideRequired(isOverride);
    if (isOverride && !reason.trim()) {
      setError("Reason is required when overriding an auto-assigned assignment.");
      setIsSaving(false);
      return;
    }

    // Optimistic update
    const prevAssignment = optimisticAssignment;
    setOptimisticAssignment({
      id: "pending",
      order_id: orderId,
      assigned_to: selectedUserId,
      assigned_by: "me",
      reason: reason || null,
      created_at: new Date().toISOString(),
      assignee_name: assignees.find(a => a.user_id === selectedUserId)?.display_name ?? null,
      assignee_email: assignees.find(a => a.user_id === selectedUserId)?.email ?? null,
    });

    try {
      if (!selectedUserId) {
        setError("Please select a team member.");
        setOptimisticAssignment(prevAssignment);
        return;
      }

      const result = await assignOrder(orderId, selectedUserId, reason || undefined);
      if (result.error) {
        setError(result.error);
        setOptimisticAssignment(prevAssignment); // Rollback
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
    const prevAssignment = optimisticAssignment;
    setOptimisticAssignment(null);
    try {
      const result = await unassignOrder(orderId);
      if (result.error) {
        setError(result.error);
        setOptimisticAssignment(prevAssignment); // Rollback
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

            {suggested && showSuggestion && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="font-medium text-blue-800 mb-1">Suggested assignee</div>
                <div className="text-sm text-blue-900">
                  {assignees.find(a => a.user_id === suggested.assignedTo)?.display_name || "Manager"}
                  {suggested.reason && (
                    <>
                      <br />
                      <span className="text-xs text-blue-700">Reason: {suggested.reason}</span>
                    </>
                  )}
                  {suggested.explanations && suggested.explanations.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-blue-600">Show scoring details</summary>
                      <ul className="text-xs text-blue-900 mt-1">
                        {suggested.explanations.map((ex: any) => (
                          <li key={ex.managerId}>
                            <b>{assignees.find(a => a.user_id === ex.managerId)?.display_name || ex.managerId}:</b> Score {ex.score} ({ex.reason})
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="button" className="px-3 py-1 bg-blue-600 text-white rounded text-xs" onClick={() => { setSelectedUserId(suggested.assignedTo); setShowSuggestion(false); }}>Accept</button>
                  <button type="button" className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs" onClick={() => setShowSuggestion(false)}>Dismiss</button>
                </div>
              </div>
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

              {/* Reason (required if overriding auto-assigned) */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Reason{overrideRequired ? " (required for override)" : " (optional)"}
                </label>
                <input
                  type="text"
                  placeholder={overrideRequired ? "Required: explain override" : "e.g., Specialist handling this order"}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSaving}
                  required={overrideRequired}
                  className={["w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm",
                    overrideRequired ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:ring-green-400"
                  ].join(" ")}
                />
                {overrideRequired && !reason.trim() && (
                  <p className="text-xs text-red-600 mt-1">Reason is required when overriding an auto-assigned assignment.</p>
                )}
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
