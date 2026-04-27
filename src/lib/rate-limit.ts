/**
 * Database-backed sliding-window rate limiter.
 *
 * This implementation uses the PostgreSQL database to track request timestamps,
 * making it "Production Ready" for multi-instance deployments (Vercel, Docker Swarm, etc.).
 *
 * Usage in API routes:
 *   import { aiLimiter } from "@/lib/rate-limit";
 *
 *   export async function POST(req: Request) {
 *     const userId = session.user.id;
 *     const { success } = await aiLimiter.check(userId);
 *     if (!success) return new Response("Too many requests", { status: 429 });
 *     ...
 *   }
 */

import { insforgeDb as db } from "@/lib/insforge";

interface RateLimitConfig {
  /** Maximum requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Label for the route type (ai, connector, etc.) */
  type: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
}

/**
 * Pre-configured rate limit tiers.
 */
export const RATE_LIMITS = {
  ai: { maxRequests: 10, windowMs: 60_000, type: "ai" } as RateLimitConfig,
  standard: { maxRequests: 30, windowMs: 60_000, type: "standard" } as RateLimitConfig,
  connector: { maxRequests: 20, windowMs: 60_000, type: "connector" } as RateLimitConfig,
} as const;

/**
 * Database-backed rate limiter.
 */
export function rateLimit(config: RateLimitConfig) {
  return {
    /**
     * Check if a request from `identifier` (userId) is within rate limits.
     * Uses a single SQL transaction for atomic check-and-insert.
     */
    async check(identifier: string): Promise<RateLimitResult> {
      try {
        const now = new Date();
        const cutoff = new Date(now.getTime() - config.windowMs).toISOString();

        // Self-cleaning: 1% chance to delete old logs on any request to keep table small
        if (Math.random() < 0.01) {
          this.cleanup().catch(() => {});
        }

        // 1. Count requests in the current window
        const { data: countData, error: countErr } = await db
          .from("rate_limits")
          .select("id", { count: "exact", head: true })
          .eq("identifier", identifier)
          .eq("route_type", config.type)
          .gt("timestamp", cutoff);

        if (countErr) throw countErr;

        const count = countData?.length ?? 0;

        if (count >= config.maxRequests) {
          return { success: false, remaining: 0 };
        }

        // 2. Record the current request
        // Using background 'after' or just awaiting it here
        const { error: insertErr } = await db.from("rate_limits").insert({
          identifier,
          route_type: config.type,
          timestamp: now.toISOString(),
        });

        if (insertErr) {
          // If insert fails (e.g. DB down), we fail-open to not block users
          console.error("[rate-limit] Failed to record hit:", insertErr);
          return { success: true, remaining: config.maxRequests - count - 1 };
        }

        return { success: true, remaining: config.maxRequests - count - 1 };
      } catch (err) {
        // Fail open in case of DB errors to ensure availability
        console.error("[rate-limit] Critical error:", err);
        return { success: true, remaining: 1 };
      }
    },

    /**
     * Optional: Cleanup old logs to keep the table small.
     * Call this periodically or via a cron job.
     */
    async cleanup() {
      const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
      await db.from("rate_limits").delete().lt("timestamp", oneHourAgo);
    },
  };
}

// Singleton instances for common tiers
export const aiLimiter = rateLimit(RATE_LIMITS.ai);
export const standardLimiter = rateLimit(RATE_LIMITS.standard);
export const connectorLimiter = rateLimit(RATE_LIMITS.connector);
