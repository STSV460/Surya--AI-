import { auth } from "@/auth";
import { db } from "@/lib/insforge";
// randomUUID via globalThis.crypto (Web Crypto API)

export const runtime = "edge";

// GET /api/projects — list user's projects
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;

  const result = await db.projects("find", {
    filter: { userId },
    sort: { updatedAt: -1 },
    limit: 100,
  }) as { documents: unknown[] };

  return Response.json({ documents: result.documents ?? [] });
}

// POST /api/projects — create a project
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { name, description, systemPrompt } = await req.json();
  if (!name?.trim()) return new Response("Name required", { status: 400 });

  const now = new Date().toISOString();
  const project = {
    id: randomUUID(),
    userId,
    name: name.trim(),
    description: description?.trim() ?? "",
    systemPrompt: systemPrompt?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
  };

  await db.projects("insertOne", { document: project });
  return Response.json({ document: { ...project, knowledgeFiles: [] } }, { status: 201 });
}
