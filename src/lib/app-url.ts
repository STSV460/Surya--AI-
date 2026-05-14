/**
 * Resolve the public app URL at runtime.
 *
 * Resolution order (most specific → most generic):
 *   1. NEXTAUTH_URL                       — explicit override
 *   2. NEXT_PUBLIC_APP_URL                — public alternative
 *   3. VERCEL_PROJECT_PRODUCTION_URL      — Vercel-injected canonical prod URL
 *   4. VERCEL_URL                         — Vercel-injected deployment URL
 *   5. Request host header                — fallback when called from a route handler
 *   6. http://localhost:3000              — dev fallback
 *
 * Pass the incoming `Request` (when available) so we can fall back to the
 * actual hostname the request came in on. This makes the helper resilient
 * to misconfigured / empty env vars on the deployment platform.
 */
export function getAppUrl(req?: Request): string {
  const explicit = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, ""); // strip trailing slash

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (req) {
    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  }

  return "http://localhost:3001";
}
