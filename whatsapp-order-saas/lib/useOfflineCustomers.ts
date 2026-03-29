import { useEffect, useState } from "react";
import { offlineDB } from "@/lib/utils";

export function useOfflineCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const all = await offlineDB.getCustomers?.() || [];
      if (mounted) setCustomers(all.filter((c) => c.offline));
    }
    load();
    window.addEventListener("offline-customer-changed", load);
    return () => {
      mounted = false;
      window.removeEventListener("offline-customer-changed", load);
    };
  }, []);
  return customers;
}
