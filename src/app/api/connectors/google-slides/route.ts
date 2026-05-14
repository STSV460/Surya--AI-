/**
 * Google Slides connector — Kimi K2.5 generates structured slide JSON,
 * we push it to Google Slides API using the user's workspace OAuth token.
 *
 * POST body: { topic: string, slides?: number, action?: "create" }
 * Response: { url, id, title }
 */

import { auth } from "@/auth";
import { aiClient, MODEL_MAP } from "@/lib/ai/client";
import { connectorLimiter } from "@/lib/rate-limit";
import { getValidWorkspaceToken } from "@/lib/google-workspace";

export const maxDuration = 60;

interface SlideSpec {
  title: string;
  bullets: string[];
  notes?: string;
}

interface DeckSpec {
  title: string;
  slides: SlideSpec[];
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const { success } = await connectorLimiter.check(userId);
  if (!success) {
    return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  let body: { topic?: string; slides?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = (body.topic ?? "").trim();
  if (!topic) return Response.json({ error: "topic is required" }, { status: 400 });
  const slideCount = Math.max(3, Math.min(20, body.slides ?? 10));

  const accessToken = await getValidWorkspaceToken(userId);
  if (!accessToken) {
    return Response.json(
      { error: "Google Workspace not connected. Connect it in Settings → Connected Accounts." },
      { status: 400 }
    );
  }

  // 1. Generate slide structure with Kimi K2.5
  let deck: DeckSpec;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completion = await (aiClient.chat.completions.create as any)({
      model: MODEL_MAP.kimi,
      messages: [
        {
          role: "system",
          content: `You generate Google Slides presentation structure as JSON. Return ONLY valid JSON (no markdown fences, no prose) matching this schema:
{
  "title": "Presentation title",
  "slides": [
    { "title": "Slide title", "bullets": ["short bullet 1", "short bullet 2"], "notes": "optional speaker notes" }
  ]
}
Rules: ${slideCount} slides, professional tone, max 8 bullets per slide, max 12 words per bullet, first slide is the cover (no bullets, just title).`,
        },
        { role: "user", content: `Topic: ${topic}` },
      ],
      stream: false,
      maxTokens: 4096,
    });
    const text: string = completion?.choices?.[0]?.message?.content ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    deck = JSON.parse(jsonMatch[0]) as DeckSpec;
    if (!deck.title || !Array.isArray(deck.slides) || deck.slides.length === 0) {
      throw new Error("Invalid deck shape");
    }
  } catch (err) {
    console.error("[slides] gen failed:", err);
    return Response.json({ error: "Failed to generate slide content" }, { status: 500 });
  }

  // 2. Create empty presentation
  let presentationId: string;
  try {
    const createRes = await fetch("https://slides.googleapis.com/v1/presentations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: deck.title }),
    });
    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error("[slides] create failed:", createRes.status, errBody);
      return Response.json({ error: "Google Slides create failed" }, { status: 500 });
    }
    const createJson = await createRes.json();
    presentationId = createJson.presentationId;
  } catch (err) {
    console.error("[slides] create error:", err);
    return Response.json({ error: "Network error creating presentation" }, { status: 500 });
  }

  // 3. Build batchUpdate requests — one slide per spec, replace title placeholder + body
  // Google's API: createSlide requires slideLayoutReference; we add slides then
  // insertText into placeholders by their id. Simplest reliable approach: create
  // a slide with TITLE_AND_BODY layout, then look up its placeholder IDs via a
  // get+presentation call. To keep this self-contained, we use a single
  // createSlide per slide and trust Google's deterministic placeholder ordering.
  const requests: Array<Record<string, unknown>> = [];

  // Set the cover (first slide, auto-created with default layout)
  // Replace its single title placeholder. We use {{TITLE_0}} object IDs we create.
  // Google generates random ids; safer to insert via createSlide with explicit
  // objectId, then insertText with placeholderIdMappings.

  for (let i = 0; i < deck.slides.length; i++) {
    const slide = deck.slides[i];
    const slideId = `s${i}`;
    const titleId = `t${i}`;
    const bodyId = `b${i}`;
    const isFirst = i === 0;
    requests.push({
      createSlide: {
        objectId: slideId,
        insertionIndex: i,
        slideLayoutReference: { predefinedLayout: isFirst ? "TITLE" : "TITLE_AND_BODY" },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: "TITLE", index: 0 }, objectId: titleId },
          ...(isFirst
            ? []
            : [{ layoutPlaceholder: { type: "BODY", index: 0 }, objectId: bodyId }]),
        ],
      },
    });
    requests.push({ insertText: { objectId: titleId, text: slide.title || `Slide ${i + 1}` } });
    if (!isFirst && slide.bullets?.length) {
      requests.push({
        insertText: { objectId: bodyId, text: slide.bullets.join("\n") },
      });
      requests.push({
        createParagraphBullets: {
          objectId: bodyId,
          textRange: { type: "ALL" },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
        },
      });
    }
  }

  // Delete the auto-created blank first slide that comes with new presentations
  // (Google adds one by default; our `createSlide` calls insert at index 0 and
  // beyond, pushing the blank one to the end. We delete it via objectId from
  // a get call.)
  let blankSlideId: string | null = null;
  try {
    const getRes = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (getRes.ok) {
      const data = await getRes.json();
      // The blank slide was at index 0 before our inserts; after our inserts,
      // Google places our slides at the start, so it's now at index = deck.slides.length
      blankSlideId = data.slides?.[0]?.objectId ?? null;
    }
  } catch {
    /* skip */
  }

  // Apply batchUpdate
  try {
    const buRes = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      }
    );
    if (!buRes.ok) {
      const errBody = await buRes.text();
      console.error("[slides] batchUpdate failed:", buRes.status, errBody);
      // Still return — we have the empty presentation, user can edit it
    }
  } catch (err) {
    console.error("[slides] batchUpdate error:", err);
  }

  // Best-effort cleanup of the original blank slide
  if (blankSlideId) {
    try {
      await fetch(
        `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{ deleteObject: { objectId: blankSlideId } }],
          }),
        }
      );
    } catch {
      /* ignore */
    }
  }

  return Response.json({
    id: presentationId,
    title: deck.title,
    url: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    slideCount: deck.slides.length,
  });
}
