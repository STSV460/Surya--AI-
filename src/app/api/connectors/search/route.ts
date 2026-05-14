
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
    limit: z.coerce.number().int().min(1).max(10).optional().default(5),
  }),
  z.object({
    action: z.literal("scrape"),
    url: z.string().trim().url().max(2048),
  }),
]);

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
      // Kimi K2.5 via InsForge gateway — long context, fast, supports
      // InsForge's webSearch annotations with grounded citations.
      const model = process.env.WEB_SEARCH_MODEL ?? "moonshotai/kimi-k2.5";

      // Native InsForge web search — grounds the model with live web results
      // and returns citations in `message.annotations`. Replaces the previous
      // Brave/Tavily/DDG/Wikipedia provider chain.
      try {
        const response = (await aiClient.chat.completions.create({
          model,
          messages: [
            {
              role: "user",
              content: `Search the web and return up to ${cap} relevant results for: ${body.query}`,
            },
          ],
          webSearch: { enabled: true, maxResults: cap },
        })) as {
          choices?: Array<{
            message?: {
              annotations?: Array<{
                type?: string;
                // InsForge returns camelCase `urlCitation` (not snake_case).
                urlCitation?: { url?: string; title?: string; content?: string };
                url_citation?: { url?: string; title?: string; content?: string };
              }>;
            };
          }>;
        };

        const annotations = response.choices?.[0]?.message?.annotations ?? [];
        const raw: Array<{ title: string; url: string; snippet: string }> = [];
        for (const a of annotations) {
          const c = a.urlCitation ?? a.url_citation;
          if (!c?.url) continue;
          raw.push({
            title: c.title ?? c.url,
            url: c.url,
            snippet: c.content ?? "",
          });
          if (raw.length >= cap) break;
        }

        return Response.json({ results: normalizeSearchResults(raw, cap) });
      } catch (err) {
        console.error("[search] InsForge web search failed:", err);
        return Response.json({ results: [] });
      }
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
