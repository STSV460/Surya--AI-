
import { auth } from "@/auth";
import * as cheerio from "cheerio";
import { safeFetch, normalizeSearchResults } from "@/lib/web-utils";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const searchBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    query: z.string().trim().min(1).max(500),
    limit: z.coerce.number().int().min(1).max(10).optional().default(8),
  }),
  z.object({
    action: z.literal("scrape"),
    url: z.string().trim().url().max(2048),
  }),
]);

type RawSearchResult = { title: string; url: string; snippet: string };

interface SearchProviderResult {
  provider: string;
  results: RawSearchResult[];
}

async function searchWithFirecrawl(query: string, cap: number): Promise<SearchProviderResult> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { provider: "firecrawl", results: [] };

  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: cap,
      sources: ["web"],
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    success?: boolean;
    data?:
      | {
          web?: Array<{
            title?: string;
            description?: string;
            url?: string;
            markdown?: string;
          }>;
        }
      | Array<{
          title?: string;
          description?: string;
          url?: string;
          markdown?: string;
        }>;
  };
  const items = Array.isArray(data.data) ? data.data : data.data?.web ?? [];
  return {
    provider: "firecrawl",
    results: items
      .filter((item) => item.url)
      .map((item) => ({
        title: item.title ?? item.url ?? "",
        url: item.url ?? "",
        snippet: item.description ?? item.markdown?.slice(0, 280) ?? "",
      }))
      .slice(0, cap),
  };
}

async function searchWithDuckDuckGo(query: string, cap: number): Promise<SearchProviderResult> {
  const params = new URLSearchParams({ q: query });
  const endpoints = [
    `https://duckduckgo.com/html/?${params}`,
    `https://lite.duckduckgo.com/lite/?${params}`,
  ];

  const results: RawSearchResult[] = [];
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const res = await safeFetch(endpoint, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`);

      const html = await res.text();
      const $ = cheerio.load(html);

      $(".result").each((_, element) => {
        if (results.length >= cap) return false;
        const link = $(element).find("a.result__a").first();
        const title = link.text().replace(/\s+/g, " ").trim();
        const url = extractDuckDuckGoUrl(link.attr("href") ?? "");
        const snippet = $(element).find(".result__snippet").text().replace(/\s+/g, " ").trim();
        if (title && url && !results.some((item) => item.url === url)) {
          results.push({ title, url, snippet });
        }
      });

      $("a.result-link, a[href*='uddg=']").each((_, element) => {
        if (results.length >= cap) return false;
        const title = $(element).text().replace(/\s+/g, " ").trim();
        const url = extractDuckDuckGoUrl($(element).attr("href") ?? "");
        if (!title || !url || results.some((item) => item.url === url)) return;
        const row = $(element).closest("tr");
        const snippet =
          row.nextAll("tr").find(".result-snippet").first().text().replace(/\s+/g, " ").trim() ||
          row.next("tr").text().replace(/\s+/g, " ").trim();
        results.push({ title, url, snippet });
      });

      if (results.length > 0) break;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "DuckDuckGo failed");
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  return { provider: "duckduckgo", results };
}

function extractDuckDuckGoUrl(href: string) {
  try {
    const url = new URL(href, "https://lite.duckduckgo.com");
    const encoded = url.searchParams.get("uddg");
    if (encoded) return decodeURIComponent(encoded);
    if (url.hostname !== "lite.duckduckgo.com") return url.toString();
  } catch {
    return "";
  }
  return "";
}

async function runSearch(query: string, cap: number) {
  const errors: string[] = [];
  const providers = [
    () => searchWithDuckDuckGo(query, cap),
    () => searchWithFirecrawl(query, cap),
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result.results.length > 0) return result;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Unknown provider error");
    }
  }

  return { provider: "none", results: [], errors };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await parseJson(req, searchBodySchema);
  if (isResponse(body)) return body;
  const { action } = body;

  try {
    if (action === "search") {
      const cap = body.limit;
      const result = await runSearch(body.query, cap);
      if (result.results.length > 0) {
        return Response.json({
          provider: result.provider,
          results: normalizeSearchResults(result.results, cap),
        });
      }
      return Response.json({
        provider: "none",
        results: [],
        details: "errors" in result ? result.errors : [],
      });
    }

    if (action === "scrape") {
      const firecrawlKey = process.env.FIRECRAWL_API_KEY;
      if (firecrawlKey) {
        const firecrawl = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: body.url,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });
        if (firecrawl.ok) {
          const data = (await firecrawl.json()) as {
            data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
            markdown?: string;
          };
          return Response.json({
            url: data.data?.metadata?.sourceURL ?? body.url,
            title: data.data?.metadata?.title ?? "",
            text: (data.data?.markdown ?? data.markdown ?? "").slice(0, 12000),
            provider: "firecrawl",
          });
        }
      }

      let res: Response;
      try {
        // safeFetch validates URL, blocks DNS-rebinding/redirect SSRF, re-checks every hop
        res = await safeFetch(body.url, {
          headers: { "User-Agent": "SuryaAI-Research/1.0" },
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "fetch failed";
        return Response.json({ error: msg }, { status: 400 });
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text")) {
        return Response.json({ url: body.url, text: "" });
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      $("script, style, nav, footer, header, aside").remove();
      const text = ($("body").text() ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 6000);

      return Response.json({ url: body.url, text });
    }

    return new Response(`Unknown action: ${action}`, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
