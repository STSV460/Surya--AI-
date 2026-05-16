
import { auth } from "@/auth";
import * as cheerio from "cheerio";
import { safeFetch, normalizeSearchResults } from "@/lib/web-utils";
import { connectorLimiter } from "@/lib/rate-limit";
import { aiClient } from "@/lib/ai/client";
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

async function searchWithInsForge(query: string, cap: number): Promise<SearchProviderResult> {
  const model = process.env.WEB_SEARCH_MODEL ?? "moonshotai/kimi-k2.5";
  const response = (await aiClient.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: `Find the newest authoritative web sources for: ${query}

Return up to ${cap} relevant results. For latest, current, today, or news queries, prioritize recent dated pages, official sources, and reputable reporting. Prefer sources that expose publication dates.`,
      },
    ],
    webSearch: { enabled: true, maxResults: cap },
  })) as {
    choices?: Array<{
      message?: {
        annotations?: Array<{
          urlCitation?: { url?: string; title?: string; content?: string };
          url_citation?: { url?: string; title?: string; content?: string };
        }>;
      };
    }>;
  };

  const annotations = response.choices?.[0]?.message?.annotations ?? [];
  const results: RawSearchResult[] = [];
  for (const annotation of annotations) {
    const citation = annotation.urlCitation ?? annotation.url_citation;
    if (!citation?.url) continue;
    results.push({
      title: citation.title ?? citation.url,
      url: citation.url,
      snippet: citation.content ?? "",
    });
    if (results.length >= cap) break;
  }

  return { provider: "insforge", results };
}

async function searchWithBrave(query: string, cap: number): Promise<SearchProviderResult> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return { provider: "brave", results: [] };

  const params = new URLSearchParams({
    q: query,
    count: String(cap),
    text_decorations: "false",
    search_lang: "en",
  });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": key,
    },
  });
  if (!res.ok) throw new Error(`Brave ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
      }>;
    };
  };
  return {
    provider: "brave",
    results: (data.web?.results ?? [])
      .filter((item) => item.url)
      .map((item) => ({
        title: item.title ?? item.url ?? "",
        url: item.url ?? "",
        snippet: item.description ?? "",
      }))
      .slice(0, cap),
  };
}

async function searchWithDuckDuckGo(query: string, cap: number): Promise<SearchProviderResult> {
  const params = new URLSearchParams({ q: query });
  const res = await safeFetch(`https://lite.duckduckgo.com/lite/?${params}`, {
    headers: { "User-Agent": "SuryaAI-Search/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const results: RawSearchResult[] = [];

  $("a.result-link, a[href*='uddg=']").each((_, element) => {
    if (results.length >= cap) return false;
    const title = $(element).text().replace(/\s+/g, " ").trim();
    const href = $(element).attr("href") ?? "";
    const url = extractDuckDuckGoUrl(href);
    if (!title || !url) return;
    const row = $(element).closest("tr");
    const snippet =
      row.nextAll("tr").find(".result-snippet").first().text().replace(/\s+/g, " ").trim() ||
      row.next("tr").text().replace(/\s+/g, " ").trim();
    results.push({ title, url, snippet });
  });

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
    () => searchWithInsForge(query, cap),
    () => searchWithBrave(query, cap),
    () => searchWithDuckDuckGo(query, cap),
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

  // Rate limiting
  const { success } = await connectorLimiter.check((session.user as { id: string }).id || session.user.email || "anon");
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
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
      return Response.json(
        {
          error: "Web search is unavailable right now. Please try again later.",
          code: "SEARCH_UNAVAILABLE",
          details: "errors" in result ? result.errors : [],
        },
        { status: 503 }
      );
    }

    if (action === "scrape") {
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
