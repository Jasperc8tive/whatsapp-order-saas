import * as FileSystem from "expo-file-system";

import { ENV } from "../lib/env";
import { supabase } from "./supabaseClient";
import { apiRequest } from "./apiClient";

export type AnalyticsRange = "7d" | "30d" | "90d";

export interface AnalyticsOverview {
  range: AnalyticsRange;
  from: string;
  to: string;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
  topCustomers: Array<{
    customerId: string;
    name: string;
    phone: string;
    totalOrders: number;
    totalSpent: number;
  }>;
  topProducts: Array<{
    productName: string;
    unitsSold: number;
    revenue: number;
  }>;
  ordersPerDay: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
}

export const analyticsService = {
  async getOverview(range: AnalyticsRange): Promise<AnalyticsOverview> {
    return apiRequest<AnalyticsOverview>(`/api/analytics/overview?range=${range}`, {
      method: "GET",
    });
  },

  async downloadOverviewCsv(range: AnalyticsRange): Promise<{ fileUri: string; fileName: string }> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers = new Headers();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    const response = await fetch(`${ENV.API_BASE_URL}/api/analytics/overview?range=${range}&format=csv`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CSV export failed: ${response.status} ${body}`);
    }

    const csv = await response.text();
    const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDirectory) {
      throw new Error("No writable directory available on device");
    }

    const fileName = `analytics_${range}_${Date.now()}.csv`;
    const fileUri = `${baseDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return { fileUri, fileName };
  },
};
