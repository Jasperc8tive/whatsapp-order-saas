import { supabase } from "./supabaseClient";
import { apiRequest } from "./apiClient";

export interface LoyaltyCustomerRow {
  id: string;
  name: string;
  phone: string;
  total_orders: number;
  total_spent: number;
  points: number;
  rewardUnits: number;
}

export interface LoyaltyOverview {
  pointsPerOrder: number;
  rewardThreshold: number;
  members: LoyaltyCustomerRow[];
}

export interface LoyaltyTransaction {
  id: string;
  points: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface LoyaltyLedger {
  customerId: string;
  balance: number;
  transactions: LoyaltyTransaction[];
}

export const loyaltyService = {
  async getOverview(): Promise<LoyaltyOverview> {
    return apiRequest<LoyaltyOverview>("/api/loyalty/overview", {
      method: "GET",
    });
  },

  async getCustomerLedger(customerId: string, limit = 20): Promise<LoyaltyLedger> {
    return apiRequest<LoyaltyLedger>(`/api/loyalty/ledger?customerId=${customerId}&limit=${limit}`, {
      method: "GET",
    });
  },

  async awardBonus(customerId: string, points: number, reason?: string): Promise<{ balance: number }> {
    return apiRequest<{ balance: number }>("/api/loyalty/ledger", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        action: "bonus",
        points,
        reason,
      }),
    });
  },

  async redeemReward(customerId: string, points: number, reason?: string): Promise<{ balance: number }> {
    return apiRequest<{ balance: number }>("/api/loyalty/ledger", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        action: "redeem",
        points,
        reason,
      }),
    });
  },
};
