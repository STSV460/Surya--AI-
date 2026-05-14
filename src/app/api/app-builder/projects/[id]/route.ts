import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";


type ProjectDoc = {
  id: string;
  userId: string;
  name: string;
  files?: Record<string, string>;
  messages?: unknown[];
  previewMode?: string;
  createdAt?: string;
  updatedAt?: string;
};

const updateAppProjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  files: z.record(z.string().max(240), z.string().max(250_000)).optional(),
  messages: z.array(z.unknown()).max(200).optional(),
  previewMode: z.enum(["none", "srcdoc", "webcontainer"]).optional(),
});

async function loadOwned(id: string, userId: string) {
  const { document } = (await db.appBuilderProjects("findOne", {
    filter: { id },
  })) as { document: ProjectDoc | null };
  if (!document) return { status: 404 as const, document: null };
  if (document.userId !== userId) return { status: 403 as const, document: null };
  return { status: 200 as const, document };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const { status, document } = await loadOwned(id, session.user.id);
  if (status !== 200) return new Response(null, { status });
  return Response.json({ document });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const check = await loadOwned(id, session.user.id);
  if (check.status !== 200) return new Response(null, { status: check.status });

  const body = await parseJson(req, updateAppProjectSchema);
  if (isResponse(body)) return body;

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof body.name === "string") update.name = body.name;
  if (body.files && typeof body.files === "object") update.files = body.files;
  if (Array.isArray(body.messages)) update.messages = body.messages;
  if (typeof body.previewMode === "string") update.previewMode = body.previewMode;

  await db.appBuilderProjects("updateOne", {
    filter: { id, userId: session.user.id },
    update: { $set: update },
  });

  return Response.json({ success: true, updatedAt: update.updatedAt });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const check = await loadOwned(id, session.user.id);
  if (check.status !== 200) return new Response(null, { status: check.status });

  await db.appBuilderProjects("deleteOne", {
    filter: { id, userId: session.user.id },
  });
  return Response.json({ success: true });
}
