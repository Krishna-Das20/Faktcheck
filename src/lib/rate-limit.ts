import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";

// =====================================================
// SMART RATE LIMITER
// =====================================================
//
// Strategy for college WiFi compatibility (100-200 users sharing one IP):
//
// 1. AUTHENTICATED routes  → rate-limit by userId (from JWT)
//    - Completely avoids the shared-IP problem
//    - Each user gets their own quota regardless of network
//
// 2. UNAUTHENTICATED routes (login, register, forgot-password, etc.)
//    → rate-limit by IP:email composite key
//    - Different users from the same IP get independent quotas
//    - Brute-force per-email is still caught (e.g., 10 failed logins for same email)
//    - Generous IP-only fallback for routes without an email body (e.g., GET)
//
// 3. PUBLIC READ routes (GET /contests, etc.)
//    → generous IP-based limits (high ceiling)
//    - Read-only endpoints don't need strict per-user limits
//
// Storage: In-memory Map with automatic TTL cleanup via a periodic sweep.
//          For single-server deployment (which FK uses), this is ideal.
//          For multi-server, swap to Redis.
// =====================================================

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix timestamp (ms)
}

// In-memory store: key → { count, resetAt }
const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 60 seconds to evict expired entries
let cleanupScheduled = false;
function ensureCleanupScheduled() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;

  // Only schedule in Node.js runtime, not during build/edge
  if (typeof setInterval !== "undefined") {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store) {
        if (now > entry.resetAt) {
          store.delete(key);
        }
      }
      // Safety: if store is totally empty for a while, don't leak the interval
      if (store.size === 0) {
        clearInterval(interval);
        cleanupScheduled = false;
      }
    }, 60_000);

    // Allow process to exit cleanly (no dangling timer)
    if (interval.unref) interval.unref();
  }
}

/**
 * Check rate limit for a key. Returns { allowed, remaining, resetAt }.
 */
function checkLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  ensureCleanupScheduled();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // Window expired or first request — start fresh
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Get client IP from request (handles proxies like Vercel/nginx).
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

// =====================================================
// PRESET CONFIGURATIONS
// =====================================================

export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Key strategy */
  keyStrategy: "user" | "ip" | "ip-email" | "ip-identifier";
  /** Optional identifier field name in request body (for ip-identifier strategy) */
  identifierField?: string;
}

/** Presets for common route categories */
export const RATE_LIMIT_PRESETS = {
  // Auth routes: per email+IP composite. Generous per-IP.
  // 15 attempts per email per 15 minutes (prevents brute force on specific account)
  // But 500 total per IP per 15 minutes (allows many users from same WiFi)
  AUTH_LOGIN: {
    maxRequests: 15,
    windowMs: 15 * 60 * 1000,
    keyStrategy: "ip-identifier" as const,
    identifierField: "email",
  },

  // Registration: similar to login but slightly lower
  AUTH_REGISTER: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    keyStrategy: "ip-identifier" as const,
    identifierField: "email",
  },

  // OTP/Password reset: tighter limit per email
  AUTH_SENSITIVE: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    keyStrategy: "ip-identifier" as const,
    identifierField: "email",
  },

  // Authenticated API calls: per user
  // 200 requests per minute — very generous for normal usage
  API_STANDARD: {
    maxRequests: 200,
    windowMs: 60 * 1000,
    keyStrategy: "user" as const,
  },

  // Code submission: generous for self-hosted Judge0
  // 10 testcases per problem × ~15 problems = 150 covers full contest comfortably
  API_SUBMIT: {
    maxRequests: 150,
    windowMs: 60 * 1000,
    keyStrategy: "user" as const,
  },

  // Judge0 execution (test run, check-all): self-hosted, generous limits
  // 10 testcases × multiple retries = needs room for rapid iteration
  API_EXECUTE: {
    maxRequests: 150,
    windowMs: 60 * 1000,
    keyStrategy: "user" as const,
  },

  // Public read endpoints: generous IP-based
  PUBLIC_READ: {
    maxRequests: 500,
    windowMs: 60 * 1000,
    keyStrategy: "ip" as const,
  },

  // Upload: tighter limit
  API_UPLOAD: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    keyStrategy: "user" as const,
  },
} as const;

// =====================================================
// MAIN RATE LIMIT FUNCTION
// =====================================================

/**
 * Apply rate limiting to an API route handler.
 *
 * @example
 * // In a route handler:
 * export async function POST(request: NextRequest) {
 *   const limited = await rateLimit(request, RATE_LIMIT_PRESETS.AUTH_LOGIN);
 *   if (limited) return limited; // Returns 429 response
 *   // ... normal handler logic
 * }
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const ip = getClientIP(request);
  let key: string;

  switch (config.keyStrategy) {
    case "user": {
      // Extract userId from JWT — if not authenticated, fall back to IP
      const user = await getAuthUser(request);
      key = user ? `user:${user._id}` : `ip:${ip}`;
      break;
    }

    case "ip-identifier": {
      // Parse body to get the identifier (e.g., email)
      // Clone the request to avoid consuming the body
      try {
        const cloned = request.clone();
        const body = await cloned.json();
        const identifier = body?.[config.identifierField || "email"] || "";
        // Composite: IP + identifier
        // This means: different emails from the same IP = different buckets
        key = identifier
          ? `ip-id:${ip}:${String(identifier).toLowerCase().trim()}`
          : `ip:${ip}`;
      } catch {
        // If body can't be parsed, fall back to IP-only with generous limits
        key = `ip:${ip}`;
      }
      break;
    }

    case "ip-email": {
      // Same as ip-identifier but hardcoded to "email"
      try {
        const cloned = request.clone();
        const body = await cloned.json();
        const email = body?.email || "";
        key = email
          ? `ip-email:${ip}:${String(email).toLowerCase().trim()}`
          : `ip:${ip}`;
      } catch {
        key = `ip:${ip}`;
      }
      break;
    }

    case "ip":
    default:
      key = `ip:${ip}`;
      break;
  }

  // Add route prefix for isolation between different endpoints
  const pathname = request.nextUrl.pathname;
  const fullKey = `${pathname}:${key}`;

  const result = checkLimit(fullKey, config.maxRequests, config.windowMs);

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);

    return NextResponse.json(
      {
        success: false,
        message: "Too many requests. Please try again later.",
        retryAfter: retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetAt),
        },
      }
    );
  }

  // Allowed — return null (no response = proceed)
  return null;
}

// =====================================================
// UTILITY: Get rate limit stats (for admin monitoring)
// =====================================================

export function getRateLimitStats() {
  const now = Date.now();
  let activeEntries = 0;
  let totalEntries = store.size;

  for (const [, entry] of store) {
    if (now <= entry.resetAt) activeEntries++;
  }

  return { activeEntries, totalEntries, storeSize: store.size };
}
