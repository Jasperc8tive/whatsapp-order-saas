// Priority scoring for orders
// Score = age (min) + customer tier + amount + promised ETA risk
// Higher score = higher priority

import type { Order } from "@/types/order";

// Example: customer tier map (could be fetched from DB or passed in)
const CUSTOMER_TIER_WEIGHTS: Record<string, number> = {
  vip: 30,
  premium: 20,
  regular: 10,
  unknown: 0,
};

// Amount weight: 1 point per 1000 NGN
function getAmountWeight(amount: number): number {
  return Math.floor(amount / 1000);
}

// ETA risk: 0 (no ETA), 20 (ETA in past), 10 (ETA within 30min)
function getEtaRisk(order: Order): number {
  if (!('promised_eta' in order) || !order.promised_eta) return 0;
  const eta = new Date(order.promised_eta as string);
  const now = new Date();
  if (eta < now) return 20;
  const diffMin = (eta.getTime() - now.getTime()) / 60000;
  if (diffMin < 30) return 10;
  return 0;
}

// Main scoring function
export function getOrderPriorityScore(order: Order, customerTier: string = "unknown"): number {
  // Age in minutes
  const created = new Date(order.created_at);
  const now = new Date();
  const ageMin = Math.floor((now.getTime() - created.getTime()) / 60000);
  const tierWeight = CUSTOMER_TIER_WEIGHTS[customerTier] ?? 0;
  const amountWeight = getAmountWeight(order.total_amount);
  const etaRisk = getEtaRisk(order);
  return ageMin + tierWeight + amountWeight + etaRisk;
}

// Optionally, export helpers for UI
export { CUSTOMER_TIER_WEIGHTS, getAmountWeight, getEtaRisk };
