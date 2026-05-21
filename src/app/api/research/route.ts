import { NextRequest } from "next/server";
import { auth } from "@/auth";
import * as cheerio from "cheerio";
// randomUUID via globalThis.crypto (Web Crypto API)
import { safeFetch } from "@/lib/web-utils";
import { insforge, db, insforgeDb } from "@/lib/insforge";
import {
  DEFAULT_RESEARCH_COUNCIL_MODELS,
  MODEL_MAP,
  RESEARCH_COUNCIL_MODEL_OPTIONS,
  type ResearchCouncilModelId,
} from "@/lib/ai/models";
import { aiLimiter } from "@/lib/rate-limit";
import { getAppUrl } from "@/lib/app-url";
import { requireOwnedConversation, requireOwnedProject } from "@/lib/auth-guard";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";
import type { StreamEvent, SearchResult } from "@/types/chat";

export const maxDuration = 300;

const researchRequestSchema = z.object({
  question: z.string().trim().min(1).max(20_000),
  conversationId: z.string().trim().min(1).max(160).optional(),
  projectId: z.string().trim().min(1).max(160).optional(),
  councilModels: z.array(
    z.enum(RESEARCH_COUNCIL_MODEL_OPTIONS.map((model) => model.id) as [
      ResearchCouncilModelId,
      ...ResearchCouncilModelId[],
    ])
  ).min(1).max(7).optional(),
});

function send(controller: ReadableStreamDefaultController, event: StreamEvent) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
}

async function resolveUserId(sessionUser: { id?: string | null; email?: string | null }) {
  if (sessionUser.id) return sessionUser.id;
  if (!sessionUser.email) return "";

  const { data } = await insforgeDb
    .from("profiles")
    .select("id")
    .eq("email", sessionUser.email)
    .maybeSingle();

  return typeof data?.id === "string" ? data.id : "";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const userId = await resolveUserId(session.user as { id?: string | null; email?: string | null });
  if (!userId) {
    return Response.json(
      { error: "Your session is missing a user profile. Please sign in again." },
      { status: 401 }
    );
  }

  // Rate limiting — research is the most expensive route
  const { success } = await aiLimiter.check(userId);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please wait before starting another research." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await parseJson(req, researchRequestSchema);
  if (isResponse(body)) return body;
  const { question, conversationId, projectId } = body;
  const requestedCouncilModels = body.councilModels ?? [...DEFAULT_RESEARCH_COUNCIL_MODELS];

  try {
    if (conversationId) await requireOwnedConversation(conversationId, userId);
    if (projectId) await requireOwnedProject(projectId, userId);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

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
          model: MODEL_MAP.kimi,
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
        const baseUrl = getAppUrl(req);
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
              try {
                // safeFetch validates URL + re-checks every redirect hop
                const res = await safeFetch(url, {
                  headers: { "User-Agent": "SuryaAI-Research/1.0" },
                  signal: AbortSignal.timeout(8000),
                });
                if (!res.ok) return;
                const ct = res.headers.get("content-type") ?? "";
                if (!ct.includes("text")) return;
                const html = await res.text();
                const $ = cheerio.load(html);
                $("script, style, nav, footer, header, aside, .ad, #ad").remove();
                const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 2500);
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
            if (!seenScrapeUrls.has(s.url) && uniqueScraped.length < 8) {
              seenScrapeUrls.add(s.url);
              uniqueScraped.push(s);
            }
          }
        }

        send(controller, {
          type: "research_progress",
          researchProgress: { stage: "scraping", detail: `Analyzing ${uniqueScraped.length} sources...` },
        });

        const sourceItems =
          uniqueScraped.length > 0
            ? uniqueScraped.map((s, i) => {
                const meta = allResults.find((r) => r.url === s.url);
                return {
                  index: i + 1,
                  title: meta?.title ?? s.url,
                  url: s.url,
                  text: s.text,
                };
              })
            : allResults.slice(0, 8).map((r, i) => ({
                index: i + 1,
                title: r.title,
                url: r.url,
                text: r.snippet,
              }));

        const sourcesBlock = sourceItems
          .map((s) => `[${s.index}] ${s.title}\n${s.url}\n${s.text}`)
          .join("\n\n---\n\n");

        const citationMap = sourceItems
          .map((s) => `[${s.index}] ${s.title} — ${s.url}`)
          .join("\n");

        // ── Stage 3: Model Council debates using InsForge Gateway models ─────
        send(controller, {
          type: "research_progress",
          researchProgress: { stage: "debating", detail: "Opening model council..." },
        });

        const selectedModelSet = new Set(requestedCouncilModels);
        const councilMembers = RESEARCH_COUNCIL_MODEL_OPTIONS
          .filter((option) => selectedModelSet.has(option.id))
          .map((option) => ({
            id: option.id,
            name: `${option.label} Council Member`,
            provider: option.provider,
            model: MODEL_MAP[option.id],
            lens: option.lens,
          }));

        const finalChair =
          councilMembers.find((member) => member.id === "opus") ??
          councilMembers.find((member) => member.id === "gpt54") ??
          councilMembers.find((member) => member.id === "gemini") ??
          councilMembers[0];

        if (!finalChair) {
          throw new Error("Select at least one research model.");
        }

        send(controller, {
          type: "research_progress",
          researchProgress: {
            stage: "debating",
            detail: `Selected: ${councilMembers.map((member) => member.name.replace(" Council Member", "")).join(", ")}`,
          },
        });

        function sendCouncilUpdate(
          member: {
            id: ResearchCouncilModelId;
            name: string;
            provider: string;
          },
          phase: "reading" | "memo" | "debate" | "chair",
          status: "thinking" | "done" | "error",
          content?: string
        ) {
          send(controller, {
            type: "research_progress",
            researchProgress: {
              stage: phase === "chair" ? "synthesizing" : "debating",
              detail:
                status === "thinking"
                  ? `${member.name.replace(" Council Member", "")} ${phase === "memo" ? "answering" : phase === "debate" ? "discussing" : phase === "chair" ? "writing final conclusion" : "reading sources"}...`
                  : `${member.name.replace(" Council Member", "")} ${phase === "memo" ? "answered" : phase === "debate" ? "finished discussion" : phase === "chair" ? "finished final conclusion" : "finished reading"}`,
              council: {
                id: member.id,
                label: member.name.replace(" Council Member", ""),
                provider: member.provider,
                phase,
                status,
                content,
              },
            },
          });
        }

        async function councilCompletion({
          model,
          system,
          user,
          maxTokens,
        }: {
          model: string;
          system: string;
          user: string;
          maxTokens: number;
        }) {
          const models =
            model === MODEL_MAP.gemini
              ? Array.from(new Set([model, "google/gemini-3.1-pro-preview"]))
              : [model];

          let lastError: unknown;
          for (const candidateModel of models) {
            try {
              const response = await aiClient.chat.completions.create({
                model: candidateModel,
                messages: [
                  { role: "system", content: system },
                  { role: "user", content: user },
                ],
                stream: false,
                maxTokens,
              });

              const content = response.choices[0]?.message?.content?.trim() ?? "";
              if (content) return content;
              lastError = new Error(`${candidateModel} returned no content`);
            } catch (err) {
              lastError = err;
            }
          }

          if (lastError instanceof Error) throw lastError;
          throw new Error("Gateway returned no response");
        }

        const sourcePayload = `Research question: ${question}

## Web Search Sources
${sourcesBlock || "No readable source text was found. Use the search result list and be transparent about limits."}

## Citation Reference
${citationMap || "No sources found."}`;

        const firstRound: Array<(typeof councilMembers)[number] & { content: string }> = [];
        for (const member of councilMembers) {
            sendCouncilUpdate(member, "reading", "thinking");
            sendCouncilUpdate(member, "memo", "thinking");

            try {
              const content = await councilCompletion({
                model: member.model,
                maxTokens: 1200,
                system: `You are ${member.name}, one member of Surya AI's Deep Research Model Council. Your lens: ${member.lens}.

Use only the provided web sources. Cite source numbers like [1], [2]. Do not invent facts. Identify uncertainty and missing evidence.`,
                user: `${sourcePayload}

              Write your independent council memo:
- direct answer
- strongest evidence
- weak or missing evidence
- risks / caveats
- preliminary conclusion`,
              });

              if (!content.trim()) {
                const fallback = `${member.name.replace(" Council Member", "")} returned no answer from the gateway. It will be excluded from the final council synthesis.`;
                sendCouncilUpdate(member, "memo", "error", fallback);
                continue;
              }

              sendCouncilUpdate(member, "memo", "done", content);
              firstRound.push({ ...member, content });
            } catch (err) {
              const rawMessage = err instanceof Error ? err.message : "";
              const cleanMessage = rawMessage.includes("Unexpected token '<'")
                ? "Gemini gateway returned an HTML error page instead of JSON. Check that the selected Gemini text model is enabled in InsForge."
                : rawMessage;
              const message =
                cleanMessage
                  ? `${member.name.replace(" Council Member", "")} failed: ${cleanMessage}`
                  : `${member.name.replace(" Council Member", "")} failed.`;
              sendCouncilUpdate(member, "memo", "error", message);
            }
        }

        const firstRoundBlock = firstRound
          .map((note) => `## ${note.name}\n${note.content}`)
          .join("\n\n---\n\n");

        send(controller, {
          type: "research_progress",
          researchProgress: { stage: "debating", detail: "Council members challenging each other..." },
        });

        const secondRound: Array<{ name: string; content: string }> = [];
        let debateTranscript = "";

        for (const member of firstRound) {
          sendCouncilUpdate(member, "debate", "thinking");
          try {
            const content = await councilCompletion({
              model: member.model,
              maxTokens: 900,
              system: `You are ${member.name} in Surya AI's live Model Council debate.

Rules:
- Speak directly to other named models, like "Claude Opus 4.6, I disagree because..." or "Gemini 3.1 Pro is right about..."
- Challenge at least one peer claim.
- Defend or revise your own first memo.
- Mention what evidence changes your mind.
- Use citations for factual claims.
- Keep it as debate dialogue, not another standalone essay.`,
              user: `Research question: ${question}

## Source Reference
${citationMap || "No sources found."}

## Round 1 Council Memos
${firstRoundBlock}

## Debate So Far
${debateTranscript || "No one has spoken yet. Open the debate and call out another model by name."}

Write your next council turn now. Address specific peers by model name.`,
            });

            sendCouncilUpdate(member, "debate", "done", content);
            secondRound.push({ name: member.name, content });
            debateTranscript += `\n\n### ${member.name}\n${content}`;
          } catch (err) {
            const rawMessage = err instanceof Error ? err.message : "";
            const message = rawMessage
              ? `${member.name.replace(" Council Member", "")} debate failed: ${rawMessage}`
              : `${member.name.replace(" Council Member", "")} debate failed.`;
            sendCouncilUpdate(member, "debate", "error", message);
          }
        }

        const debateBlock = secondRound
          .map((note) => `## ${note.name} Round 2\n${note.content}`)
          .join("\n\n---\n\n");
        const visibleDiscussion =
          secondRound.length > 0
            ? `## Model Council Discussion\n\n${secondRound
                .map((note) => `### ${note.name.replace(" Council Member", "")}\n${note.content}`)
                .join("\n\n")}\n\n## Final Council Answer\n\n`
            : "## Model Council Discussion\n\nNo council debate turns completed. Final answer below uses the available web sources and successful model memos.\n\n## Final Council Answer\n\n";
        const finalWriter =
          firstRound.find((member) => member.id === finalChair.id) ??
          firstRound.find((member) => member.id === "gpt54") ??
          firstRound.find((member) => member.id === "gemini") ??
          firstRound.find((member) => member.id === "sonnet") ??
          firstRound[0] ??
          finalChair;

        // ── Stage 4: Council Chair writes final report ───────────────────────
        send(controller, {
          type: "research_progress",
          researchProgress: { stage: "synthesizing", detail: "Writing council conclusion..." },
        });
        if (finalWriter.id !== finalChair.id) {
          sendCouncilUpdate(
            finalChair,
            "chair",
            "error",
            `${finalChair.name.replace(" Council Member", "")} did not finish a council memo, so ${finalWriter.name.replace(" Council Member", "")} is writing the final answer.`
          );
        }
        sendCouncilUpdate(finalWriter, "chair", "thinking");

        const artifactId = crypto.randomUUID();
        const artifactTitle = `Research: ${question.slice(0, 60)}${question.length > 60 ? "..." : ""}`;

        send(controller, {
          type: "artifact_start",
          artifact: { id: artifactId, type: "document", title: artifactTitle },
        });

        let fullContent = visibleDiscussion;
        send(controller, { type: "text", content: visibleDiscussion });

        const finalStream = await aiClient.chat.completions.create({
          model: finalWriter.model,
          messages: [
            {
              role: "system",
              content:
                "You are the chair of Surya AI's Deep Research Model Council. The app already displayed the council discussion above your answer. Now write only the final council answer. Use inline citations like [1], [2] for factual claims. Resolve disagreements. Name which positions won and why. Do not invent missing facts. Structure with clear ### headings under the existing 'Final Council Answer' section. Include a concise final conclusion and a ### Sources section.",
            },
            {
              role: "user",
              content: `${sourcePayload}

## Round 1 Council Memos
${firstRoundBlock || "No council memo succeeded. Write from sources only."}

## Round 2 Debate
${debateBlock || "No second-round debate succeeded. Note this limitation only if relevant."}

Write final council answer now. Do not repeat the full debate transcript; synthesize it.`,
            },
          ],
          stream: true,
          maxTokens: 5000,
        });

        for await (const chunk of finalStream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullContent += delta;
            send(controller, { type: "text", content: delta });
          }
        }
        sendCouncilUpdate(finalWriter, "chair", "done", fullContent);

        send(controller, {
          type: "artifact_end",
          artifact: { id: artifactId, type: "document", title: artifactTitle, content: fullContent },
        });

        // ── Stage 5: Coordinator persists to InsForge ─────────────────────────
        let convId = conversationId;
        if (!convId) {
          const conv = await db.conversations("insertOne", {
            document: {
              id: crypto.randomUUID(),
              userId,
              title: `Research: ${question.slice(0, 50)}`,
              model: finalWriter.model,
              projectId: projectId ?? null,
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
          });
          convId = conv?.document?.id ?? conv?.id ?? crypto.randomUUID();
        }

        const now = new Date().toISOString();
        const userMsgId = crypto.randomUUID();
        await db.messages("insertOne", {
          document: {
            id: userMsgId,
            conversationId: convId,
            role: "user",
            content: question,
            timestamp: now,
          },
        });

        const msgId = crypto.randomUUID();
        await db.messages("insertOne", {
          document: {
            id: msgId,
            conversationId: convId,
            role: "assistant",
            content: fullContent,
            timestamp: now,
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
