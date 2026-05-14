import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { invalidateCache } from "@/lib/knowledge-cache";
import type { Project, KnowledgeFile } from "@/types/project";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  systemPrompt: z.string().trim().max(8000).optional(),
});


async function getOwnedProject(userId: string, id: string): Promise<Project | null> {
  const result = await db.projects("findOne", { filter: { id, userId } }) as { document: Project | null };
  return result.document ?? null;
}

// GET /api/projects/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const project = await getOwnedProject(userId, id);
  if (!project) return new Response("Not found", { status: 404 });

  const filesResult = await db.knowledgeFiles("find", {
    filter: { projectId: id, userId },
    sort: { createdAt: 1 },
  }) as { documents: KnowledgeFile[] };

  return Response.json({ document: { ...project, knowledgeFiles: filesResult.documents ?? [] } });
}

// PATCH /api/projects/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const project = await getOwnedProject(userId, id);
  if (!project) return new Response("Not found", { status: 404 });

  const body = await parseJson(req, updateProjectSchema);
  if (isResponse(body)) return body;
  const update: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.systemPrompt !== undefined) update.systemPrompt = body.systemPrompt;

  await db.projects("updateOne", { filter: { id, userId }, update: { $set: update } });
  invalidateCache(`project:${id}`);

  return Response.json({ ok: true });
}

// DELETE /api/projects/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const project = await getOwnedProject(userId, id);
  if (!project) return new Response("Not found", { status: 404 });

  // Cascade delete knowledge files then project
  const filesResult = await db.knowledgeFiles("find", { filter: { projectId: id, userId } }) as { documents: KnowledgeFile[] };
  for (const file of filesResult.documents ?? []) {
    await db.knowledgeFiles("deleteOne", { filter: { id: file.id, userId } });
    invalidateCache(`file:${file.id}`);
  }

  await db.projects("deleteOne", { filter: { id, userId } });
  invalidateCache(`project:${id}`);

  return Response.json({ ok: true });
}
