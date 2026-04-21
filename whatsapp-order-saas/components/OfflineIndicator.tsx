import { useOnlineStatus } from "@/lib/useOnlineStatus";

export function OfflineIndicator() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded shadow-lg animate-pulse">
      You are offline. Orders will be saved locally and synced when online.
    </div>
  );
}
