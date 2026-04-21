"use client";

import type { OrderAssignment } from "@/types/team";

interface AssignmentBadgeProps {
  assignment: OrderAssignment | null;
  onClick?: () => void;
  isLoading?: boolean;
}

export default function AssignmentBadge({
  assignment,
  onClick,
  isLoading = false,
}: AssignmentBadgeProps) {
  if (!assignment) {
    return (
      <button
        onClick={onClick}
        disabled={isLoading}
        className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors cursor-pointer"
        title="Click to assign"
      >
        Unassigned
      </button>
    );
  }

  const displayName = assignment.assignee_name || assignment.assignee_email || "Unknown";

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors cursor-pointer truncate"
      title={`Assigned to ${displayName}. Click to change.`}
    >
      🧑 {displayName}
    </button>
  );
}
