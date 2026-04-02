import { ENV } from "../lib/env";
import { apiRequest } from "./apiClient";

export interface MarketplaceVendor {
  id: string;
  businessName: string;
  slug: string;
  whatsappNumber: string | null;
}

export const marketplaceService = {
  async listVendors(query: string): Promise<MarketplaceVendor[]> {
    const q = encodeURIComponent(query.trim());
    const result = await apiRequest<{ vendors: MarketplaceVendor[] }>(`/api/marketplace/vendors?q=${q}&limit=40`, {
      method: "GET",
    });
    return result.vendors.map((vendor) => ({
      ...vendor,
      slug: vendor.slug,
    }));
  },

  vendorStoreLink(slug: string): string {
    return `${ENV.API_BASE_URL}/store/${slug}`;
  },
};
