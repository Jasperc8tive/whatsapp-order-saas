
"use client";
import { useEffect, useState } from "react";
import { offlineDB } from "@/lib/utils";

export function useOfflineOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const all = await offlineDB.getOrders();
      if (mounted) setOrders(all.filter((o) => o.offline));
    }
    load();
    window.addEventListener("offline-order-changed", load);
    return () => {
      mounted = false;
      window.removeEventListener("offline-order-changed", load);
    };
  }, []);
  return orders;
}
