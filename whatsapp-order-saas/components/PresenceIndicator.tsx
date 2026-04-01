import { usePresence } from "@/lib/usePresence";
import type { WorkspaceMember } from "@/types/team";

export function PresenceIndicator({ workspaceId, members }: { workspaceId: string; members: WorkspaceMember[] }) {
  const users = usePresence(workspaceId);
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {members
        .filter((m) => m.role === "delivery_manager")
        .map((m) => {
          const online = users.some((u) => u.user_id === m.user_id);
          return (
            <span
              key={m.user_id}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${online ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
              title={online ? "Online" : "Offline"}
            >
              <span className={`w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-gray-300"}`}></span>
              {m.display_name || m.email || m.user_id}
              {online ? "(Online)" : "(Offline)"}
            </span>
          );
        })}
    </div>
  );
}
