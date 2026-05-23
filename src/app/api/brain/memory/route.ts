import { auth } from "@/auth";
import { addMemory, deleteMemory, getBrainSummary, pauseMemory } from "@/lib/brain";
import { db } from "@/lib/insforge";
import { parseJson, parseSearchParams, isResponse } from "@/lib/validation";
import { z } from "zod";

const patchSchema = z.object({
  id: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(1000).optional(),
  paused: z.boolean().optional(),
});

const deleteSchema = z.object({
  id: z.string().trim().min(1).max(160),
});

const postSchema = z.object({
  type: z.enum(["fact", "preference", "goal", "mistake", "style"]).default("fact"),
  surface: z.enum(["chat", "code", "projects", "media", "global"]).default("global"),
  content: z.string().trim().min(1).max(1000),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const surface = (url.searchParams.get("surface") ?? "chat") as "chat";

  const result = (await db.memory("find", {
    filter: { userId: session.user.id },
    sort: { updatedAt: -1 },
    limit: 200,
  })) as { documents: unknown[] };
  const brainPreview = await getBrainSummary(session.user.id, surface);
  return Response.json({ memories: result.documents ?? [], brainPreview });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const body = await parseJson(req, postSchema);
  if (isResponse(body)) return body;
  const memory = await addMemory({ userId: session.user.id, ...body });
  return Response.json({ memory });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const body = await parseJson(req, patchSchema);
  if (isResponse(body)) return body;

  if (typeof body.paused === "boolean" && body.content === undefined) {
    return Response.json({ memory: await pauseMemory(session.user.id, body.id, body.paused) });
  }

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.content !== undefined) update.content = body.content.slice(0, 1000);
  if (body.paused !== undefined) update.paused = body.paused;
  const result = await db.memory("updateOne", {
    filter: { id: body.id, userId: session.user.id },
    update: { $set: update },
  });
  return Response.json({ memory: result.document });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const params = parseSearchParams(req, deleteSchema);
  if (isResponse(params)) return params;
  return Response.json(await deleteMemory(session.user.id, params.id));
}
