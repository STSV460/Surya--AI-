import { auth } from "@/auth";
import { db, insforgeDb } from "@/lib/insforge";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const renameSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

async function resolveUserId(sessionUser: { id?: string | null; email?: string | null }) {
  if (sessionUser.id) return sessionUser.id;
  if (!sessionUser.email) return "";
  const { data } = await insforgeDb
    .from("profiles")
    .select("id")
    .eq("email", sessionUser.email)
    .maybeSingle();
  return typeof data?.id === "string" ? data.id : "";
}

async function requireOwned(id: string, userId: string) {
  const { document } = (await db.conversations("findOne", {
    filter: { id, userId },
  })) as { document: { userId?: string } | null };
  if (!document) return { status: 404 as const };
  return { status: 200 as const };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const userId = await resolveUserId(session.user as { id?: string | null; email?: string | null });
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { document } = (await db.conversations("findOne", {
    filter: { id, userId },
  })) as { document: unknown };

  if (!document) return new Response("Not found", { status: 404 });
  return Response.json({ document });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const userId = await resolveUserId(session.user as { id?: string | null; email?: string | null });
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const check = await requireOwned(id, userId);
  if (check.status !== 200) return new Response(null, { status: check.status });

  const body = await parseJson(req, renameSchema);
  if (isResponse(body)) return body;
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof body.title === "string") update.title = body.title;

  await db.conversations("updateOne", {
    filter: { id, userId },
    update: { $set: update },
  });

  return Response.json({ success: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const userId = await resolveUserId(session.user as { id?: string | null; email?: string | null });
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const check = await requireOwned(id, userId);
  if (check.status !== 200) return new Response(null, { status: check.status });

  await db.conversations("deleteOne", { filter: { id, userId } });
  // Cascade-delete linked rows so user data is fully purged (GDPR / right-to-erasure).
  // Note: db.deleteOne wraps PostgREST .delete() which removes ALL matching rows.
  try {
    await db.messages("deleteOne", { filter: { conversationId: id } });
  } catch {
    /* messages cleanup best-effort */
  }
  try {
    await db.artifacts("deleteOne", { filter: { conversationId: id } });
  } catch {
    /* artifacts cleanup best-effort */
  }

  return Response.json({ success: true });
}
