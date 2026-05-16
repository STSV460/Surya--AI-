import { NextRequest } from "next/server";
import { auth } from "@/auth";
import * as cheerio from "cheerio";
// randomUUID via globalThis.crypto (Web Crypto API)
import { isSafeUrl } from "@/lib/web-utils";
import { insforge, db } from "@/lib/insforge";
import { MODEL_MAP, TASK_MODEL_MAP } from "@/lib/ai/models";
import { aiLimiter } from "@/lib/rate-limit";
import type { StreamEvent, SearchResult } from "@/types/chat";

export const runtime = "edge";
export const maxDuration = 300;

function send(controller: ReadableStreamDefaultController, event: StreamEvent) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const userId = (session.user as { id: string }).id;

  // Rate limiting — research is the most expensive route
  const { success } = await aiLimiter.check(userId);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please wait before starting another research." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { question, conversationId, projectId } = await req.json();
  if (!question?.trim()) return new Response("question required", { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── Stage 1: Coordinator (Sonnet) generates sub-queries ──────────────
        send(controller, {
          type: "research_progress",
          researchProgress: { stage: "generating_queries", detail: "Analyzing your question..." },
        });

        const aiClient = insforge.ai;
        const subQueryResponse = await aiClient.chat.completions.create({
          model: MODEL_MAP.sonnet,
          messages: [
            {
              role: "system",
              content:
                'You are a research coordinator. Given a question, generate 5-8 distinct search queries to comprehensively research it. Return ONLY a valid JSON array of strings, no other text. Example: ["query 1", "query 2", "query 3"]',
            },
            { role: "user", content: question },
          ],
          stream: false,
          maxTokens: 600,
        });

        let subQueries: string[] = [];
        try {
          const raw = subQueryResponse.choices[0]?.message?.content ?? "[]";
          const match = raw.match(/\[[\s\S]*\]/);
          subQueries = JSON.parse(match?.[0] ?? "[]");
        } catch {
          subQueries = [question];
        }
        subQueries = subQueries.slice(0, 8).filter((q): q is string => typeof q === "string");

        send(controller, {
          type: "research_progress",
          researchProgress: { stage: "searching", detail: `Running ${subQueries.length} search queries...` },
        });

        // ── Stage 2: Researcher agents (parallel Promise.all) ─────────────────
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const cookieHeader = req.headers.get("cookie") ?? "";

        interface AgentFindings {
          results: SearchResult[];
          scrapedContent: { url: string; text: string }[];
        }

        const researcherTasks = subQueries.map(async (subQuery): Promise<AgentFindings> => {
          send(controller, {
            type: "research_progress",
            researchProgress: { stage: "searching", detail: `Searching: "${subQuery}"` },
          });

          let results: SearchResult[] = [];
          try {
            const res = await fetch(`${baseUrl}/api/connectors/search`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: cookieHeader,
              },
              body: JSON.stringify({ action: "search", query: subQuery, limit: 5 }),
            });
            if (res.ok) {
              const data = await res.json();
              results = data.results ?? [];
            }
          } catch { /* continue with empty results */ }

          const urlsToScrape = results.slice(0, 3).map((r) => r.url);
          const scrapedContent: { url: string; text: string }[] = [];

          await Promise.all(
            urlsToScrape.map(async (url) => {
              if (!isSafeUrl(url)) return;
              try {
                const res = await fetch(url, {
                  headers: { "User-Agent": "SuryaAI-Research/1.0" },
                  signal: AbortSignal.timeout(8000),
                });
                if (!res.ok) return;
                const ct = res.headers.get("content-type") ?? "";
                if (!ct.includes("text")) return;
                const html = await res.text();
                const $ = cheerio.load(html);
                $("script, style, nav, footer, header, aside, .ad, #ad").remove();
                const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 6000);
                if (text.length > 100) scrapedContent.push({ url, text });
              } catch { /* skip failed scrapes */ }
            })
          );

          return { results, scrapedContent };
        });

        const allFindings = await Promise.all(researcherTasks);

        // Deduplicate results and scraped content
        const seenUrls = new Set<string>();
        const allResults: SearchResult[] = [];
        let sourceIndex = 1;
        for (const finding of allFindings) {
          for (const r of finding.results) {
            if (!seenUrls.has(r.url)) {
              seenUrls.add(r.url);
              allResults.push({ ...r, index: sourceIndex++ });
            }
          }
        }

        const seenScrapeUrls = new Set<string>();
        const uniqueScraped: { url: string; text: string }[] = [];
        for (const finding of allFindings) {
          for (const s of finding.scrapedContent) {
            if (!seenScrapeUrls.has(s.url) && uniqueScraped.length < 15) {
              seenScrapeUrls.add(s.url);
              uniqueScraped.push(s);
            }
          }
        }

        send(controller, {
          type: "research_progress",
          researchProgress: { stage: "scraping", detail: `Analyzing ${uniqueScraped.length} sources...` },
        });

        // ── Stage 3: Analyst (Opus) synthesizes ───────────────────────────────
        send(controller, {
          type: "research_progress",
          researchProgress: { stage: "synthesizing" },
        });

        const sourcesBlock = uniqueScraped
          .map((s, i) => `[${i + 1}] ${s.url}\n${s.text}`)
          .join("\n\n---\n\n");

        const citationMap = allResults
          .map((r) => `[${r.index}] ${r.title} — ${r.url}`)
          .join("\n");

        const artifactId = crypto.randomUUID();
        const artifactTitle = `Research: ${question.slice(0, 60)}${question.length > 60 ? "..." : ""}`;

        send(controller, {
          type: "artifact_start",
          artifact: { id: artifactId, type: "document", title: artifactTitle },
        });

        const opusStream = await aiClient.chat.completions.create({
          model: MODEL_MAP[TASK_MODEL_MAP.deepResearch],
          messages: [
            {
              role: "system",
              content:
                "You are a world-class research analyst. Synthesize the provided sources into a comprehensive, well-structured research report. Use inline citations like [1], [2] referencing the source numbers. Structure the report with clear ## headings. Be thorough, factual, and insightful. End with a ## Sources section listing all cited sources.",
            },
            {
              role: "user",
              content: `Research question: ${question}\n\n## Available Sources\n\n${sourcesBlock}\n\n## Citation Reference\n${citationMap}\n\nWrite the comprehensive research report now:`,
            },
          ],
          stream: true,
          maxTokens: 16000,
        });

        let fullContent = "";
        for await (const chunk of opusStream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullContent += delta;
            send(controller, { type: "text", content: delta });
          }
        }

        send(controller, {
          type: "artifact_end",
          artifact: { id: artifactId, type: "document", title: artifactTitle, content: fullContent },
        });

        // ── Stage 4: Coordinator persists to InsForge ─────────────────────────
        const userId =
          (session.user as { id?: string }).id ?? session.user.email ?? "";

        let convId = conversationId;
        if (!convId) {
          const conv = await db.conversations("insertOne", {
            document: {
              id: crypto.randomUUID(),
              userId,
              title: `Research: ${question.slice(0, 50)}`,
              model: MODEL_MAP[TASK_MODEL_MAP.deepResearch],
              projectId: projectId ?? null,
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
          });
          convId = conv?.document?.id ?? conv?.id ?? crypto.randomUUID();
        }

        const msgId = crypto.randomUUID();
        await db.messages("insertOne", {
          document: {
            id: msgId,
            conversationId: convId,
            role: "assistant",
            content: fullContent,
            tokens: Math.ceil(fullContent.length / 4),
            createdAt: new Date().toISOString(),
          },
        });

        await db.artifacts("insertOne", {
          document: {
            id: artifactId,
            messageId: msgId,
            type: "document",
            title: artifactTitle,
            content: fullContent,
            createdAt: new Date().toISOString(),
          },
        });

        send(controller, { type: "done", content: convId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Research failed";
        send(controller, { type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
