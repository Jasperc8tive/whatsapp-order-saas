"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateProductRecommendations,
  trackProductRecommendationUsage,
} from "@/lib/actions/orders";
import type { ProductRecommendationsResult } from "@/lib/actions/orders";

interface ProductRecommendationsPanelProps {
  customerId: string;
  customerName: string;
  customerPhone: string;
  canUseAiFeatures: boolean;
}

export default function ProductRecommendationsPanel({
  customerId,
  customerName,
  customerPhone,
  canUseAiFeatures,
}: ProductRecommendationsPanelProps) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<ProductRecommendationsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canUseAiFeatures) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Recommended Products
            </h3>
            <p className="text-xs text-gray-500 mt-1">AI-powered product suggestions based on order history</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full">
            <span className="text-xs font-semibold text-purple-700">Pro</span>
          </span>
        </div>
        <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-xs text-purple-900">
            Upgrade to Pro to get AI-powered product recommendations for upselling and cross-selling.
          </p>
        </div>
      </div>
    );
  }

  const handleGenerateRecommendations = async () => {
    setIsLoading(true);
    setError(null);

    const result = await generateProductRecommendations(customerId);
    if (result.error) {
      setError(result.error);
      setRecommendations(null);
    } else if (result.data) {
      setRecommendations(result.data);
      if (result.data.recommendations.length > 0) {
        void trackProductRecommendationUsage(customerId, "impression", {
          surface: "order_detail",
          recommendation_count: result.data.recommendations.length,
          product_ids: result.data.recommendations.map((recommendation) => recommendation.productId),
        });
      }
    }

    setIsLoading(false);
    setHasRequested(true);
  };

  async function handleAcceptRecommendation(
    productId: string,
    productName: string,
    productPrice: number
  ) {
    await trackProductRecommendationUsage(customerId, "accepted", {
      surface: "order_detail",
      target: "new_order",
      product_id: productId,
      product_name: productName,
    });

    const params = new URLSearchParams({
      recommendedProductId: productId,
      recommendedProductName: productName,
      recommendedProductPrice: String(productPrice),
      recommendedCustomerName: customerName,
      recommendedCustomerPhone: customerPhone,
      recommendationSource: "order_detail",
    });

    router.push(`/dashboard/orders?${params.toString()}`);
  }

  function handleViewProduct(productId: string) {
    router.push(`/dashboard/products?highlight=${encodeURIComponent(productId)}`);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Recommended Products
        </h3>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 rounded-full">
          <span className="text-xs font-semibold text-purple-700">Pro</span>
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 mb-3">
          {error}
        </div>
      )}

      {recommendations && recommendations.recommendations.length > 0 ? (
        <div>
          <div className="space-y-2 mb-3">
            {recommendations.recommendations.map((rec, idx) => (
              <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{rec.productName}</p>
                    <p className="text-xs text-gray-500">₦{rec.price.toLocaleString()}</p>
                  </div>
                  <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                    {Math.round(rec.confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-gray-600">{rec.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAcceptRecommendation(rec.productId, rec.productName, rec.price)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    Add To New Order
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewProduct(rec.productId)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    View Product
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleGenerateRecommendations}
            disabled={isLoading}
            className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Regenerate Recommendations
          </button>
        </div>
      ) : hasRequested && recommendations && recommendations.recommendations.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-xs text-gray-500 mb-3">
            No recommendations available for this customer yet.
          </p>
          <button
            onClick={handleGenerateRecommendations}
            disabled={isLoading}
            className="text-xs font-medium px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <button
          onClick={handleGenerateRecommendations}
          disabled={isLoading}
          className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {isLoading ? "Generating..." : "Get Recommendations"}
        </button>
      )}
    </div>
  );
}
