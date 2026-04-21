"use client";
import { useEffect, useState } from "react";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import type { WorkspaceMember } from "@/types/team";

export function PresenceBar({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/team/members`)
      .then((r) => r.json())
      .then((data) => setMembers(data.members || []));
  }, [workspaceId]);
  if (!workspaceId) return null;
  return (
    <div className="mb-4">
      <PresenceIndicator workspaceId={workspaceId} members={members} />
    </div>
  );
}
