import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";
// randomUUID via globalThis.crypto (Web Crypto API)

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().default(""),
  systemPrompt: z.string().trim().max(8000).optional().default(""),
});

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

  const body = await parseJson(req, createProjectSchema);
  if (isResponse(body)) return body;

  const now = new Date().toISOString();
  const project = {
    id: crypto.randomUUID(),
    userId,
    name: body.name,
    description: body.description,
    systemPrompt: body.systemPrompt,
    createdAt: now,
    updatedAt: now,
  };

  await db.projects("insertOne", { document: project });
  return Response.json({ document: { ...project, knowledgeFiles: [] } }, { status: 201 });
}
