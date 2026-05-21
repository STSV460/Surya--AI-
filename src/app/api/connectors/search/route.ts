
import { auth } from "@/auth";
import * as cheerio from "cheerio";
import { aiClient, MODEL_MAP } from "@/lib/ai/client";
import { safeFetch, normalizeSearchResults } from "@/lib/web-utils";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

export const maxDuration = 60;

const searchBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    query: z.string().trim().min(1).max(500),
    limit: z.coerce.number().int().min(1).max(10).optional().default(8),
  }),
  z.object({
    action: z.literal("scrape"),
    url: z.string().trim().url().max(2048),
    query: z.string().trim().min(1).max(2000).optional(),
  }),
]);

type RawSearchResult = { title: string; url: string; snippet: string };

interface SearchProviderResult {
  provider: string;
  results: RawSearchResult[];
}

async function fetchWithHardTimeout(url: URL | string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      fetch(url, { ...init, signal: controller.signal }),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function decodeDuckDuckGoUrl(href: string) {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    return url.searchParams.get("uddg") ?? url.href;
  } catch {
    return href;
  }
}

async function searchWithDuckDuckGo(query: string, cap: number): Promise<SearchProviderResult> {
  const body = new URLSearchParams({
    q: query,
    kl: "us-en",
  });

  const res = await fetchWithHardTimeout("https://html.duckduckgo.com/html/", {
    method: "POST",
    headers: {
      Accept: "text/html",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; SuryaAI/1.0; +https://www.suryaai.in)",
    },
    body,
  }, 5000);
  if (!res.ok) throw new Error(`DuckDuckGo ${res.status}: ${await res.text()}`);

  const $ = cheerio.load(await res.text());
  const results: RawSearchResult[] = [];
  $(".result").each((_, element) => {
    if (results.length >= cap) return false;
    const link = $(element).find(".result__a").first();
    const href = link.attr("href");
    if (!href) return;
    const url = decodeDuckDuckGoUrl(href);
    if (!url.startsWith("http")) return;
    results.push({
      title: link.text().replace(/\s+/g, " ").trim(),
      url,
      snippet: $(element).find(".result__snippet").text().replace(/\s+/g, " ").trim(),
    });
  });

  return {
    provider: "duckduckgo",
    results,
  };
}

async function searchWithFirecrawl(query: string, cap: number): Promise<SearchProviderResult> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { provider: "firecrawl", results: [] };

  const res = await fetchWithHardTimeout("https://api.firecrawl.dev/v2/search", {
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
  }, 6000);
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

function getYouTubeVideoId(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (url.hostname.endsWith("youtube.com")) {
      return url.searchParams.get("v") ?? url.pathname.match(/\/shorts\/([^/?#]+)/)?.[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function hasUsablePageText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length < 250) return false;
  return !/(page not found|looking for something|robot check|captcha|access denied|unusual traffic|enable javascript)/i.test(normalized);
}

async function summarizeYouTubeWithGateway(rawUrl: string, userQuery?: string) {
  if (!getYouTubeVideoId(rawUrl)) return null;

  const transcript = await scrapeYouTubeTranscript(rawUrl).catch(() => null);
  if (!transcript?.text?.trim()) return null;

  return summarizeWithInsForgeGateway({
    rawUrl,
    title: transcript.title || "YouTube video",
    text: transcript.text,
    kind: "YouTube video",
    userQuery,
    provider: "insforge-gateway-youtube",
  });
}

async function summarizeWithInsForgeGateway({
  rawUrl,
  title,
  text,
  kind,
  userQuery,
  provider,
}: {
  rawUrl: string;
  title: string;
  text: string;
  kind: string;
  userQuery?: string;
  provider: string;
}) {
  const sourceText = text.replace(/\s+/g, " ").trim();
  if (!hasUsablePageText(sourceText) && kind !== "YouTube video") return null;
  if (!sourceText) return null;

  const prompt = `Analyze this ${kind} for a Surya AI user.

URL: ${rawUrl}
Title: ${title || "not shown"}
User request: ${userQuery ?? "Explain this link and give useful details."}

Use only the source text below. Do not invent missing fields. If this is a product page, include product name, brand, price, rating/reviews, offers, delivery/return details, key specs, pros/cons, and buying advice when shown. If this is a video, include short overview, key points, useful takeaways, and timestamps when present. Say "not shown" for unavailable fields.

SOURCE TEXT:
${sourceText.slice(0, 16000)}`;

  const models = Array.from(new Set([
    MODEL_MAP.kimi,
    MODEL_MAP.gemini,
    "google/gemini-3.1-pro-preview",
  ]));
  const createCompletion = aiClient.chat.completions.create as (args: {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
    stream: false;
    maxTokens: number;
  }) => Promise<{ choices?: Array<{ message?: { content?: string | null } }> }>;

  for (const model of models) {
    try {
      const response = await createCompletion({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are Surya AI. Analyze fetched web/video text accurately and concisely. Never claim details that are not in the provided source text.",
          },
          { role: "user", content: prompt },
        ],
        stream: false,
        maxTokens: 4000,
      });
      const answer = String(response?.choices?.[0]?.message?.content ?? "").trim();
      if (answer) {
        return {
          title: title || "URL analysis",
          text: answer.slice(0, 16000),
          provider,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function scrapeYouTubeTranscript(rawUrl: string) {
  const videoId = getYouTubeVideoId(rawUrl);
  if (!videoId) return null;

  const watch = await fetchWithHardTimeout(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SuryaAI/1.0; +https://www.suryaai.in)" },
  }, 8000);
  if (!watch.ok) throw new Error(`YouTube ${watch.status}: ${await watch.text()}`);
  const html = await watch.text();
  const title = decodeHtmlEntities(
    html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+-\s+YouTube\s*$/i, "").trim() ?? ""
  );
  const playerJson = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});/)?.[1];
  if (!playerJson) return { title, text: "", provider: "youtube" };

  const player = JSON.parse(playerJson) as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: Array<{ baseUrl?: string; languageCode?: string; name?: { simpleText?: string } }>;
      };
    };
  };
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track = tracks.find((item) => item.languageCode?.startsWith("en")) ?? tracks[0];
  if (!track?.baseUrl) return { title, text: "", provider: "youtube" };

  const transcriptUrl = new URL(track.baseUrl);
  transcriptUrl.searchParams.set("fmt", "json3");
  const transcript = await fetchWithHardTimeout(transcriptUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SuryaAI/1.0; +https://www.suryaai.in)" },
  }, 8000);
  if (!transcript.ok) throw new Error(`YouTube transcript ${transcript.status}: ${await transcript.text()}`);
  const data = (await transcript.json()) as {
    events?: Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }>;
  };
  const text = (data.events ?? [])
    .map((event) => {
      const content = (event.segs ?? []).map((seg) => seg.utf8 ?? "").join("").trim();
      if (!content) return "";
      const seconds = Math.floor((event.tStartMs ?? 0) / 1000);
      const stamp = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      return `[${stamp}] ${content}`;
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);

  return { title, text, provider: "youtube" };
}

async function scrapeWithJina(rawUrl: string) {
  const readerUrl = `https://r.jina.ai/http://${rawUrl.replace(/^https?:\/\//, "")}`;
  const res = await fetchWithHardTimeout(readerUrl, {
    headers: {
      Accept: "text/plain, text/markdown",
      "User-Agent": "SuryaAI-Research/1.0",
    },
  }, 10000);
  if (!res.ok) throw new Error(`Jina Reader ${res.status}: ${await res.text()}`);
  const text = (await res.text()).replace(/\n{3,}/g, "\n\n").trim();
  if (!hasUsablePageText(text)) return null;
  const title = text.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? "";
  return {
    url: rawUrl,
    title,
    text: text.slice(0, 16000),
    provider: "jina-reader",
  };
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
      const gatewayYoutube = await summarizeYouTubeWithGateway(body.url, body.query);
      if (gatewayYoutube) {
        return Response.json({
          url: body.url,
          title: gatewayYoutube.title,
          text: gatewayYoutube.text,
          provider: gatewayYoutube.provider,
        });
      }

      const youtube = await scrapeYouTubeTranscript(body.url);
      if (youtube) {
        return Response.json({
          url: body.url,
          title: youtube.title,
          text: youtube.text,
          provider: youtube.provider,
        });
      }

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
          const text = (data.data?.markdown ?? data.markdown ?? "").trim();
          if (hasUsablePageText(text)) {
            const gateway = await summarizeWithInsForgeGateway({
              rawUrl: data.data?.metadata?.sourceURL ?? body.url,
              title: data.data?.metadata?.title ?? "",
              text,
              kind: "web page or product page",
              userQuery: body.query,
              provider: "insforge-gateway-url",
            });
            if (gateway) {
              return Response.json({
                url: data.data?.metadata?.sourceURL ?? body.url,
                title: gateway.title,
                text: gateway.text,
                provider: gateway.provider,
              });
            }
            return Response.json({
              url: data.data?.metadata?.sourceURL ?? body.url,
              title: data.data?.metadata?.title ?? "",
              text: text.slice(0, 16000),
              provider: "firecrawl",
            });
          }
        }
      }

      const jina = await scrapeWithJina(body.url).catch(() => null);
      if (jina) {
        const gateway = await summarizeWithInsForgeGateway({
          rawUrl: jina.url,
          title: jina.title,
          text: jina.text,
          kind: "web page or product page",
          userQuery: body.query,
          provider: "insforge-gateway-url",
        });
        return Response.json(gateway ? { ...jina, title: gateway.title, text: gateway.text, provider: gateway.provider } : jina);
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

      if (hasUsablePageText(text)) {
        const title = $("title").first().text().replace(/\s+/g, " ").trim();
        const gateway = await summarizeWithInsForgeGateway({
          rawUrl: body.url,
          title,
          text,
          kind: "web page or product page",
          userQuery: body.query,
          provider: "insforge-gateway-url",
        });
        if (gateway) return Response.json({ url: body.url, title: gateway.title, text: gateway.text, provider: gateway.provider });
      }

      return Response.json({ url: body.url, text: hasUsablePageText(text) ? text : "" });
    }

    return new Response(`Unknown action: ${action}`, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
