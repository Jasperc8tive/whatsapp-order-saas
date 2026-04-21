import { apiRequest } from "./apiClient";

export type Segment = "all_customers" | "repeat_buyers";

export interface CampaignResponse {
  segment: Segment;
  recipientCount: number;
  sent: number;
  failed: number;
  deliveryStatusReport: Record<string, number>;
  historyId: string | null;
  createdAt: string | null;
}

export interface CampaignHistoryItem {
  id: string;
  segment: Segment;
  message: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  delivery_status_report: Record<string, number>;
  created_at: string;
}

export const marketingService = {
  async sendCampaign(message: string, segment: Segment): Promise<CampaignResponse> {
    return apiRequest<CampaignResponse>("/api/notify/campaign", {
      method: "POST",
      body: JSON.stringify({ message, segment }),
    });
  },

  async listCampaignHistory(limit = 25): Promise<CampaignHistoryItem[]> {
    const result = await apiRequest<{ history: CampaignHistoryItem[] }>(`/api/notify/campaign?limit=${limit}`, {
      method: "GET",
    });
    return result.history;
  },
};
