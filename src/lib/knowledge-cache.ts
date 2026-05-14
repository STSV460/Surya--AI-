// 30 seconds — short TTL because cache is per-Vercel-instance.
// `invalidateCache` only clears the current instance, so stale entries on
// other warm instances would otherwise persist for the old (5 min) TTL.
// 30s gives ~free perf for repeated requests in same conversation while
// guaranteeing edits propagate fast across the fleet.
const TTL_MS = 30 * 1000;

interface CacheEntry {
  content: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCached(id: string): string | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(id);
    return null;
  }
  return entry.content;
}

export function setCache(id: string, content: string): void {
  cache.set(id, { content, expiresAt: Date.now() + TTL_MS });
}

export function invalidateCache(id: string): void {
  cache.delete(id);
}
