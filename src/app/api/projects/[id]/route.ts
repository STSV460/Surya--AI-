import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { invalidateCache } from "@/lib/knowledge-cache";
import type { Project, KnowledgeFile } from "@/types/project";

export const runtime = "nodejs";

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

  const { name, description, systemPrompt } = await req.json();
  const update: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (name !== undefined) update.name = name.trim();
  if (description !== undefined) update.description = description.trim();
  if (systemPrompt !== undefined) update.systemPrompt = systemPrompt.trim();

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
