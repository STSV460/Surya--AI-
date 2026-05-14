import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const createAppProjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;
  const result = await db.appBuilderProjects("find", {
    filter: { userId },
    sort: { updatedAt: -1 },
    limit: 50,
  });
  return Response.json(result);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;
  const body = req.headers.get("content-length") === "0"
    ? { name: undefined }
    : await parseJson(req, createAppProjectSchema);
  if (isResponse(body)) return body;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const doc = {
    id,
    userId,
    name: body.name || "Untitled App",
    files: {},
    messages: [],
    previewMode: "none",
    createdAt: now,
    updatedAt: now,
  };

  await db.appBuilderProjects("insertOne", { document: doc });
  return Response.json({ document: doc });
}
