/**
 * User memory store — ChatGPT/Gemini-style cross-conversation memory.
 *
 * GET    /api/memory         List user's memories (newest first)
 * POST   /api/memory         { content: string }  Add a memory
 * DELETE /api/memory?id=...  Remove a single memory
 *
 * Memories are injected into the chat system prompt so the AI persistently
 * "remembers" facts about the user across conversations.
 */

import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { displayMemoryContent, rememberUserMemory } from "@/lib/memory";
import { parseJson, parseSearchParams, isResponse } from "@/lib/validation";
import { z } from "zod";

const memoryCreateSchema = z.object({
  content: z.string().trim().min(1).max(1000),
  scope: z.enum(["chat", "project", "code"]).optional().default("chat"),
  projectId: z.string().trim().min(1).max(160).optional(),
  appProjectId: z.string().trim().min(1).max(160).optional(),
});

const memoryDeleteSchema = z.object({
  id: z.string().trim().min(1).max(160),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const result = (await db.memory("find", {
      filter: { userId: session.user.id },
      sort: { createdAt: -1 },
      limit: 100,
    })) as { documents: Array<{ id: string; content: string; createdAt: string }> };
    return Response.json({
      memories: (result.documents ?? []).map((memory) => ({
        ...memory,
        content: displayMemoryContent(memory.content),
      })),
    });
  } catch (err) {
    console.error("[memory] GET failed:", err);
    return Response.json({ memories: [], error: "Failed to load memories" });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const body = await parseJson(req, memoryCreateSchema);
  if (isResponse(body)) return body;

  try {
    const memory = await rememberUserMemory(session.user.id, body.content, {
      surface: body.scope,
      projectId: body.projectId,
      appProjectId: body.appProjectId,
      source: "manual",
    });
    return Response.json({ memory });
  } catch (err) {
    console.error("[memory] POST failed:", err);
    const msg = err instanceof Error ? err.message : "save failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const params = parseSearchParams(req, memoryDeleteSchema);
  if (isResponse(params)) return params;

  try {
    await db.memory("deleteOne", { filter: { id: params.id, userId: session.user.id } });
    return Response.json({ success: true });
  } catch (err) {
    console.error("[memory] DELETE failed:", err);
    return Response.json({ error: "delete failed" }, { status: 500 });
  }
}
