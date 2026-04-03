import { ENV } from "../lib/env";
import { supabase } from "./supabaseClient";

const MAX_RATE_LIMIT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 5_000;

export class ApiRequestError extends Error {
  status: number;
  code: "RATE_LIMITED" | "REQUEST_FAILED";

  constructor(message: string, status: number, code: "RATE_LIMITED" | "REQUEST_FAILED") {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

function friendlyRateLimitMessage(): string {
  return "We are receiving too many requests right now. Please wait a few seconds and try again.";
}

function parseRetryAfterMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) {
    return Math.min(DEFAULT_RETRY_DELAY_MS * (attempt + 1), MAX_RETRY_DELAY_MS);
  }

  const numericSeconds = Number(retryAfter);
  if (!Number.isNaN(numericSeconds) && numericSeconds >= 0) {
    return Math.min(numericSeconds * 1_000, MAX_RETRY_DELAY_MS);
  }

  const retryDateMs = Date.parse(retryAfter);
  if (!Number.isNaN(retryDateMs)) {
    return Math.min(Math.max(retryDateMs - Date.now(), 0), MAX_RETRY_DELAY_MS);
  }

  return Math.min(DEFAULT_RETRY_DELAY_MS * (attempt + 1), MAX_RETRY_DELAY_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(`${ENV.API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep(parseRetryAfterMs(response, attempt));
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429) {
        throw new ApiRequestError(friendlyRateLimitMessage(), 429, "RATE_LIMITED");
      }
      throw new ApiRequestError(`Request failed: ${response.status} ${body}`, response.status, "REQUEST_FAILED");
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  throw new ApiRequestError(friendlyRateLimitMessage(), 429, "RATE_LIMITED");
}
