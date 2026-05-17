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

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = await resolveUserId(session.user as { id?: string | null; email?: string | null });
  if (!userId) return Response.json({ documents: [] });

  const result = await db.conversations("find", {
    filter: { userId },
    sort: { updatedAt: -1 },
    limit: 50,
  });

  return Response.json(result);
}
