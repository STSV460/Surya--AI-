export const runtime = "edge";

import { auth } from "@/auth";
import * as cheerio from "cheerio";
import { isSafeUrl, normalizeSearchResults } from "@/lib/web-utils";
import { connectorLimiter } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limiting
  const { success } = await connectorLimiter.check((session.user as { id: string }).id || session.user.email || "anon");
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await req.json();
  const { action, query, url, limit } = body as {
    action: "search" | "scrape";
    query?: string;
    url?: string;
    limit?: number;
  };

  try {
    if (action === "search") {
      if (!query) {
        return Response.json({ error: "query is required" }, { status: 400 });
      }

      const cap = limit ?? 5;

      // Primary: Brave Search API (if key is configured)
      if (process.env.BRAVE_SEARCH_API_KEY) {
        console.log(`[search] trying brave query="${query}" cap=${cap}`);
        const braveRes = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${cap}`,
          {
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY,
            },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (braveRes.ok) {
          const data = await braveRes.json();
          const results = normalizeSearchResults(data.web?.results ?? [], cap);
          console.log(`[search] backend=brave count=${results.length}`);
          return Response.json({ results });
        }
        console.log(`[search] brave failed status=${braveRes.status}`);
      } else {
        console.log("[search] brave skipped: BRAVE_SEARCH_API_KEY not set");
      }

      // Fallback: DuckDuckGo HTML scraping (free, no API key)
      console.log(`[search] trying duckduckgo query="${query}"`);
      const params = new URLSearchParams({ q: query });
      const ddgRes = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SuryaAI/1.0)",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!ddgRes.ok) {
        return Response.json({ results: [] });
      }

      const html = await ddgRes.text();
      const $d = cheerio.load(html);
      const rawDDG: Array<{ title: string; url: string; snippet: string }> = [];

      $d(".result").each((_i, el) => {
        if (rawDDG.length >= cap) return false;
        const title = $d(el).find(".result__title").text().trim();
        const snippet = $d(el).find(".result__snippet").text().trim();
        const href = $d(el).find(".result__title a").attr("href") ?? "";
        const urlText = $d(el).find(".result__url").text().trim();

        // DDG wraps destination URLs — extract the real URL
        let resultUrl = "";
        if (href.includes("uddg=")) {
          try {
            resultUrl = decodeURIComponent(href.split("uddg=")[1].split("&")[0]);
          } catch {
            resultUrl = urlText ? `https://${urlText}` : "";
          }
        } else if (urlText) {
          resultUrl = `https://${urlText}`;
        }

        if (title && resultUrl) rawDDG.push({ title, url: resultUrl, snippet });
      });

      const results = normalizeSearchResults(rawDDG, cap);
      console.log(`[search] backend=duckduckgo count=${results.length}`);
      return Response.json({ results });
    }

    if (action === "scrape") {
      if (!url) {
        return Response.json({ error: "url is required" }, { status: 400 });
      }

      if (!isSafeUrl(url)) {
        return Response.json({ error: "Unsafe or invalid URL" }, { status: 400 });
      }

      const res = await fetch(url, {
        headers: { "User-Agent": "SuryaAI-Research/1.0" },
        signal: AbortSignal.timeout(8000),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text")) {
        return Response.json({ url, text: "" });
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      $("script, style, nav, footer, header, aside").remove();
      const text = ($("body").text() ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 6000);

      return Response.json({ url, text });
    }

    return new Response(`Unknown action: ${action}`, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}