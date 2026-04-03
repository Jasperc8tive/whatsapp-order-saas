import { NextRequest, NextResponse } from "next/server";

/**
 * API Rate Limiting Middleware
 *
 * Applies a sliding-window rate limit per client IP to all /api/* routes.
 * Uses module-level in-memory state — effective on a single Vercel instance.
 *
 * ⚠️  Production upgrade path:
 *   For multi-region deployments replace the `RateLimitStore` class with
 *   @upstash/ratelimit + @upstash/redis for a distributed counter that
 *   spans all edge instances without coordination latency.
 *
 * Rate limits:
 *   /api/whatsapp/* and /api/paystack/* — 30 req / 60 s  (heavy/webhook routes)
 *   All other /api/* routes             — 120 req / 60 s (general API)
 *   /api/jobs/worker                    — skipped (authenticated by WORKER_SECRET)
 */

// ── Sliding-window store ──────────────────────────────────────────────────────

interface Bucket {
  /** timestamps of requests within the current window */
  timestamps: number[];
}

const store = new Map<string, Bucket>();
const STORE_MAX_ENTRIES = 10_000;

/** Remove entries older than `windowMs` and prune the store if it grows large. */
function getCount(key: string, windowMs: number, now: number): number {
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    store.set(key, bucket);
  }

  // evict timestamps outside the window
  const cutoff = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  // simple size guard — flush oldest 20% when store grows too large
  if (store.size > STORE_MAX_ENTRIES) {
    let deleted = 0;
    for (const [k] of store) {
      store.delete(k);
      if (++deleted > STORE_MAX_ENTRIES * 0.2) break;
    }
  }

  return bucket.timestamps.length;
}

function record(key: string, now: number): void {
  const bucket = store.get(key);
  if (bucket) bucket.timestamps.push(now);
}

// ── Route-specific limits ─────────────────────────────────────────────────────

interface Limit {
  max: number;
  windowMs: number;
}

function getLimitForPath(pathname: string): Limit | null {
  // Worker endpoint: skip — authenticated via WORKER_SECRET
  if (pathname.startsWith("/api/jobs/worker")) return null;

  // Webhook / AI-heavy routes: tighter limit
  if (
    pathname.startsWith("/api/whatsapp") ||
    pathname.startsWith("/api/paystack")
  ) {
    return { max: 30, windowMs: 60_000 };
  }

  // General API
  if (pathname.startsWith("/api/")) {
    return { max: 120, windowMs: 60_000 };
  }

  return null;
}

// ── Client IP extraction ──────────────────────────────────────────────────────

function getClientIp(request: NextRequest): string {
  // Vercel sets x-forwarded-for; fall back to a static token so we never crash
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const limit = getLimitForPath(pathname);
  if (!limit) return NextResponse.next();

  const ip = getClientIp(request);
  const key = `${ip}:${pathname.split("/").slice(0, 3).join("/")}`;
  const now = Date.now();

  const count = getCount(key, limit.windowMs, now);

  if (count >= limit.max) {
    const retryAfterSec = Math.ceil(limit.windowMs / 1000);
    return new NextResponse(
      JSON.stringify({ error: "Too many requests. Please slow down." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(limit.max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((now + limit.windowMs) / 1000)),
        },
      }
    );
  }

  record(key, now);

  const remaining = limit.max - count - 1;
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(limit.max));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
