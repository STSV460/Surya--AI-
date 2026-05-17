import { auth } from "@/auth";
import { db, insforgeDb } from "@/lib/insforge";

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const userId = await resolveUserId(session.user as { id?: string | null; email?: string | null });
  if (!userId) return new Response("Unauthorized", { status: 401 });

  // Verify ownership
  const convResult = (await db.conversations("findOne", {
    filter: { id, userId },
  })) as { document: { id: string } | null };
  if (!convResult?.document) {
    return new Response("Not found", { status: 404 });
  }

  const messages = await db.messages("find", {
    filter: { conversationId: id },
    sort: { timestamp: 1 },
  });

  return Response.json(messages);
}
