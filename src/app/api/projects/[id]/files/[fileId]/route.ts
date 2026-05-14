import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { invalidateCache } from "@/lib/knowledge-cache";
import type { KnowledgeFile } from "@/types/project";


export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id: projectId, fileId } = await params;

  const result = await db.knowledgeFiles("findOne", {
    filter: { id: fileId, projectId, userId },
  }) as { document: KnowledgeFile | null };

  if (!result.document) return new Response("Not found", { status: 404 });

  await db.knowledgeFiles("deleteOne", { filter: { id: fileId, projectId, userId } });
  invalidateCache(`file:${fileId}`);
  invalidateCache(`project:${projectId}`);

  return Response.json({ ok: true });
}
