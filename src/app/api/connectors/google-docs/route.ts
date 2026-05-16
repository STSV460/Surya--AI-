/**
 * Google Docs connector — Kimi K2.5 generates document content as JSON,
 * we push to Google Docs API using user's workspace OAuth token.
 *
 * POST body: { topic: string, length?: "short"|"medium"|"long", tone?: string }
 *        or { title: string, content: string } to create a doc from exact chat output.
 * Response: { url, id, title }
 */

import { auth } from "@/auth";
import { aiClient, MODEL_MAP } from "@/lib/ai/client";
import { connectorLimiter } from "@/lib/rate-limit";
import { getValidWorkspaceToken } from "@/lib/google-workspace";

export const maxDuration = 60;

interface DocSection {
  heading: string;
  paragraphs: string[];
}

interface DocSpec {
  title: string;
  sections: DocSection[];
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const { success } = await connectorLimiter.check(userId);
  if (!success) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  let body: { topic?: string; length?: string; tone?: string; title?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = (body.topic ?? "").trim();
  const directContent = (body.content ?? "").trim();
  const directTitle = (body.title ?? "Surya AI Report").trim().slice(0, 120) || "Surya AI Report";
  if (!topic && !directContent) return Response.json({ error: "topic or content is required" }, { status: 400 });
  const length = body.length === "long" ? "long" : body.length === "short" ? "short" : "medium";
  const tone = (body.tone ?? "professional").slice(0, 40);

  const accessToken = await getValidWorkspaceToken(userId);
  if (!accessToken) {
    return Response.json(
      { error: "Google Workspace not connected. Connect it in Settings → Connected Accounts." },
      { status: 400 }
    );
  }

  // 1. Generate doc content with Kimi K2.5 when caller provides topic.
  const lengthGuide =
    length === "short"
      ? "3-4 sections, 1-2 paragraphs each"
      : length === "long"
      ? "8-10 sections, 3-5 paragraphs each"
      : "5-6 sections, 2-3 paragraphs each";

  let spec: DocSpec | null = null;
  if (!directContent) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completion = await (aiClient.chat.completions.create as any)({
        model: MODEL_MAP.kimi,
        messages: [
          {
            role: "system",
            content: `You generate Google Docs document content as JSON. Return ONLY valid JSON (no markdown fences, no prose):
{
  "title": "Doc title",
  "sections": [
    { "heading": "Section heading", "paragraphs": ["para 1", "para 2"] }
  ]
}
Rules: ${lengthGuide}. Tone: ${tone}. Well-structured, clear, factual.`,
          },
          { role: "user", content: `Topic: ${topic}` },
        ],
        stream: false,
        maxTokens: 12288,
      });
      const text: string = completion?.choices?.[0]?.message?.content ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      spec = JSON.parse(jsonMatch[0]) as DocSpec;
      if (!spec.title || !Array.isArray(spec.sections) || spec.sections.length === 0) {
        throw new Error("Invalid doc shape");
      }
    } catch (err) {
      console.error("[docs] gen failed:", err);
      return Response.json({ error: "Failed to generate doc content" }, { status: 500 });
    }
  }

  // 2. Create empty doc
  let documentId: string;
  try {
    const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title: directContent ? directTitle : spec!.title }),
    });
    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error("[docs] create failed:", createRes.status, errBody);
      return Response.json({ error: "Google Docs create failed" }, { status: 500 });
    }
    const j = await createRes.json();
    documentId = j.documentId;
  } catch (err) {
    console.error("[docs] create error:", err);
    return Response.json({ error: "Network error creating document" }, { status: 500 });
  }

  // 3. Build batchUpdate requests — insertText then style as headings.
  // Strategy: build one big text block with newlines, insert at index 1
  // (start of body), then apply HEADING_1 style to each section heading line.
  const lines: { text: string; isHeading: boolean }[] = [];
  if (directContent) {
    lines.push({ text: directContent + "\n", isHeading: false });
  } else {
    for (const section of spec!.sections) {
      lines.push({ text: section.heading + "\n", isHeading: true });
      for (const para of section.paragraphs) {
        lines.push({ text: para + "\n\n", isHeading: false });
      }
    }
  }
  const fullText = lines.map((l) => l.text).join("");

  const requests: Array<Record<string, unknown>> = [
    { insertText: { location: { index: 1 }, text: fullText } },
  ];

  // Apply heading styles by computed offsets
  let cursor = 1;
  for (const line of lines) {
    if (line.isHeading) {
      const start = cursor;
      const end = cursor + line.text.length - 1; // exclude trailing \n
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType: "HEADING_1" },
          fields: "namedStyleType",
        },
      });
    }
    cursor += line.text.length;
  }

  try {
    const buRes = await fetch(
      `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      }
    );
    if (!buRes.ok) {
      const errBody = await buRes.text();
      console.error("[docs] batchUpdate failed:", buRes.status, errBody);
    }
  } catch (err) {
    console.error("[docs] batchUpdate error:", err);
  }

  return Response.json({
    id: documentId,
    title: directContent ? directTitle : spec!.title,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
  });
}
