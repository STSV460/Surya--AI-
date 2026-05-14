import type { SearchResult } from "@/types/chat";
import ipaddr from "ipaddr.js";
import dns from "node:dns/promises";

// CIDR ranges considered private/internal — both IPv4 and IPv6.
// Blocks: loopback, RFC-1918, link-local (cloud metadata 169.254/16),
// CGNAT (100.64/10), benchmark (198.18/15), multicast/reserved, IPv4-mapped IPv6.
const PRIVATE_V4: [string, number][] = [
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["169.254.0.0", 16], // link-local + cloud metadata (169.254.169.254)
  ["127.0.0.0", 8],    // loopback
  ["100.64.0.0", 10],  // CGNAT
  ["198.18.0.0", 15],  // benchmarking
  ["224.0.0.0", 4],    // multicast
  ["240.0.0.0", 4],    // reserved/future
  ["0.0.0.0", 8],      // current network
];

const PRIVATE_V6: [string, number][] = [
  ["::1", 128],        // loopback
  ["fc00::", 7],       // ULA
  ["fe80::", 10],      // link-local
  ["::ffff:0:0", 96],  // IPv4-mapped (catches ::ffff:127.0.0.1, ::ffff:169.254.169.254)
  ["::", 128],         // unspecified
];

function isPrivateAddr(addr: string): boolean {
  try {
    const parsed = ipaddr.parse(addr);
    const ranges = parsed.kind() === "ipv4" ? PRIVATE_V4 : PRIVATE_V6;
    for (const [base, prefix] of ranges) {
      const cidr: [ipaddr.IPv4 | ipaddr.IPv6, number] = [
        ipaddr.parse(base) as ipaddr.IPv4 | ipaddr.IPv6,
        prefix,
      ];
      if (parsed.match(cidr)) return true;
    }
    return false;
  } catch {
    // Unparseable — treat as private/unsafe
    return true;
  }
}

/**
 * SSRF protection — returns false for any URL that resolves to a private/loopback
 * address (after DNS resolution). Blocks decimal/octal/hex IPs, IPv6 ULA + link-local,
 * IPv4-mapped IPv6, cloud metadata, RFC-1918, CGNAT, multicast, etc.
 *
 * Async because hostname resolution is required to defeat DNS-based bypasses.
 *
 * Apply before every user-supplied URL fetch (scrape, research, avatar, etc.).
 */
export async function isSafeUrl(raw: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;

  // Strip IPv6 brackets if present
  const host = parsed.hostname.replace(/^\[|\]$/g, "");

  // Empty host
  if (!host) return false;

  // If the hostname IS a literal IP (in any base — decimal/octal/hex), ipaddr.js
  // canonicalizes it and we check against private ranges.
  if (ipaddr.isValid(host)) {
    return !isPrivateAddr(host);
  }

  // Hostname — resolve all A/AAAA records and check every returned IP.
  // Any single private match = unsafe.
  try {
    const addrs = await dns.lookup(host, { all: true });
    if (!addrs.length) return false;
    return addrs.every((a) => !isPrivateAddr(a.address));
  } catch {
    return false;
  }
}

/**
 * SSRF-safe fetch — disables auto-redirect, re-validates each Location header
 * through `isSafeUrl`. Caps at 3 hops. Throws on unsafe URLs at any hop.
 *
 * Use this anywhere we fetch a user-supplied URL (scrape, research, avatar download).
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  hops = 0
): Promise<Response> {
  if (hops > 3) {
    throw new Error("Too many redirects");
  }
  if (!(await isSafeUrl(url))) {
    throw new Error("Unsafe or invalid URL");
  }
  const res = await fetch(url, { ...init, redirect: "manual" });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get("location");
    if (!loc) return res;
    const next = new URL(loc, url).toString();
    return safeFetch(next, init, hops + 1);
  }
  return res;
}

/**
 * Normalize raw search API results to the SearchResult schema.
 * Handles varying field names from different search providers.
 */
export function normalizeSearchResults(
  raw: unknown[],
  limit: number
): SearchResult[] {
  return (raw as Record<string, unknown>[])
    .slice(0, limit)
    .map((r, i) => {
      const url = String(r.url ?? r.link ?? "");
      let domain = "";
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        domain = url;
      }
      return {
        index: i + 1,
        title: String(r.title ?? ""),
        url,
        domain,
        snippet: String(r.description ?? r.snippet ?? r.body ?? ""),
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
      };
    })
    .filter((r) => r.url.startsWith("http"));
}
