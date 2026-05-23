import { auth } from "@/auth";
import { db } from "@/lib/insforge";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const result = (await db.skills("find", {
    filter: { userId: session.user.id },
    sort: { lastSeenAt: -1 },
    limit: 200,
  })) as { documents: unknown[] };

  return Response.json({ skills: result.documents ?? [] });
}
