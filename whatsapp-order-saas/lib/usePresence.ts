import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export interface PresenceUser {
  user_id: string;
  display_name: string | null;
  email: string;
  role: string;
  online_at: string;
}

export function usePresence(workspaceId: string) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  useEffect(() => {
    if (!workspaceId) return;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const channel = supabase.channel(`presence:workspace:${workspaceId}`, {
      config: { presence: { key: workspaceId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const all: PresenceUser[] = [];
        Object.values(state).forEach((arr: any) => {
          arr.forEach((u: any) => all.push(u));
        });
        setUsers(all);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { data } = await supabase.auth.getUser();
          channel.track({
            user_id: data.user?.id,
            display_name: data.user?.user_metadata?.display_name ?? null,
            email: data.user?.email ?? "",
            role: "delivery_manager",
            online_at: new Date().toISOString(),
          });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);
  return users;
}
