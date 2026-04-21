import crypto from "crypto";
import { requireEnvValue } from "@/lib/env";

const PAYSTACK_BASE = "https://api.paystack.co";

function isPlaceholderSecret(secret: string): boolean {
  const normalized = secret.trim().toLowerCase();

  return (
    /x{8,}/.test(normalized) ||
    normalized.includes("your-") ||
    normalized.includes("replace-")
  );
}

function getSecret(): string {
  const configuredSecret =
    process.env.PAYSTACK_SECRET_KEY ??
    process.env.PAYSTACK_SK;

  const secret = requireEnvValue(configuredSecret, "PAYSTACK_SECRET_KEY").trim();

  if (secret.startsWith("pk_")) {
    throw new Error(
      "Invalid PAYSTACK_SECRET_KEY: expected a secret key (sk_test_... or sk_live_...), but got a public key (pk_...)."
    );
  }

  if (!/^sk_(test|live)_/i.test(secret)) {
    throw new Error(
      "Invalid PAYSTACK_SECRET_KEY format. Expected key to start with sk_test_ or sk_live_."
    );
  }

  if (isPlaceholderSecret(secret)) {
    throw new Error(
      "Invalid PAYSTACK_SECRET_KEY: a template or placeholder value is configured. Replace it with a real sk_test_... or sk_live_... key before starting checkout."
    );
  }

  return secret;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InitializeTransactionInput {
  email: string;
  /** Amount in kobo (1 NGN = 100 kobo) */
  amount: number;
  reference: string;
  callback_url: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeTransactionResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: "success" | "failed" | "abandoned" | "pending";
    reference: string;
    amount: number;         // in kobo
    currency: string;
    paid_at: string | null;
    channel: string;
    gateway_response: string;
    customer: {
      email: string;
      first_name?: string;
      last_name?: string;
    };
    metadata: Record<string, unknown> | null;
  };
}

export interface PaystackWebhookEvent {
  event: string;
  data: VerifyTransactionResponse["data"];
}

// ── API helpers ───────────────────────────────────────────────────────────────

/**
 * Initialize a Paystack transaction and return the checkout URL.
 */
export async function initializeTransaction(
  input: InitializeTransactionInput
): Promise<InitializeTransactionResponse> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paystack initialize failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<InitializeTransactionResponse>;
}

/**
 * Verify a Paystack transaction by its reference.
 * Used both in the webhook handler (double-check) and the verify-payment route.
 */
export async function verifyTransaction(
  reference: string,
  timeoutMs = 8000
): Promise<VerifyTransactionResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${getSecret()}` },
        // Disable Next.js data cache — payment state must always be live
        cache: "no-store",
        signal: controller.signal,
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Paystack verify request failed: ${message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paystack verify failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<VerifyTransactionResponse>;
}

/**
 * Verify the HMAC-SHA512 signature Paystack sends in the
 * `x-paystack-signature` request header.
 *
 * @param rawBody   The raw request body string (do NOT parse as JSON first)
 * @param signature The value of the `x-paystack-signature` header
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha512", getSecret())
    .update(rawBody)
    .digest("hex");

  // Use timingSafeEqual to prevent timing-based attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Convert NGN naira to kobo (Paystack's smallest unit).
 */
export const toKobo = (naira: number) => Math.round(naira * 100);

/**
 * Convert kobo back to naira.
 */
export const fromKobo = (kobo: number) => kobo / 100;

/**
 * Generate a unique Paystack transaction reference.
 * Format: OF-{orderId-prefix}-{timestamp}
 */
export function generateReference(orderId: string): string {
  const prefix = orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `OF-${prefix}-${ts}`;
}
