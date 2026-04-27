import { auth } from "@/auth";
import { db } from "@/lib/insforge";

export const runtime = "nodejs";

async function requireOwned(id: string, userId: string) {
  const { document } = (await db.conversations("findOne", {
    filter: { id, userId },
  })) as { document: { userId?: string } | null };
  if (!document) return { status: 404 as const };
  return { status: 200 as const };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const { document } = (await db.conversations("findOne", {
    filter: { id, userId: session.user.id },
  })) as { document: unknown };

  if (!document) return new Response("Not found", { status: 404 });
  return Response.json({ document });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const check = await requireOwned(id, session.user.id);
  if (check.status !== 200) return new Response(null, { status: check.status });

  const body = (await req.json()) as { title?: string };
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (typeof body.title === "string") update.title = body.title.slice(0, 200);

  await db.conversations("updateOne", {
    filter: { id, userId: session.user.id },
    update: { $set: update },
  });

  return Response.json({ success: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const check = await requireOwned(id, session.user.id);
  if (check.status !== 200) return new Response(null, { status: check.status });

  await db.conversations("deleteOne", { filter: { id, userId: session.user.id } });
  // Best-effort: purge messages for this conversation
  try {
    await db.messages("deleteOne", { filter: { conversationId: id } });
  } catch {
    /* ignore */
  }

  return Response.json({ success: true });
}
