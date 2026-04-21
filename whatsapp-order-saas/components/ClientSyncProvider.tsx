"use client";
import { useSyncOfflineOrders } from "@/lib/useSyncOfflineOrders";
import { OfflineIndicator } from "@/components/OfflineIndicator";

export default function ClientSyncProvider() {
  useSyncOfflineOrders();
  return <OfflineIndicator />;
}
