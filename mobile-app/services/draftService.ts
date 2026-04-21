import type { OrderDraft } from "../types/domain";
import { apiRequest } from "./apiClient";
import { supabase } from "./supabaseClient";

export const draftService = {
  async listDrafts(): Promise<OrderDraft[]> {
    const { data, error } = await supabase
      .from("order_drafts")
      .select("id,workspace_id,inbound_message_id,customer_phone,customer_name,items,notes,confidence,status,reviewed_at,created_order_id,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as OrderDraft[];
  },

  async reviewDraft(draftId: string, action: "approve" | "reject"): Promise<void> {
    const path =
      action === "approve"
        ? `/api/orders/drafts/${draftId}/approve`
        : `/api/orders/drafts/${draftId}/reject`;

    await apiRequest(path, {
      method: "POST",
      body:
        action === "approve"
          ? JSON.stringify({ notes: "Approved from mobile" })
          : JSON.stringify({ reason: "Rejected from mobile" }),
    });
  },
};
