import { auth } from "@/auth";
import { db } from "@/lib/insforge";


export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  const result = await db.conversations("find", {
    filter: { userId },
    sort: { updatedAt: -1 },
    limit: 50,
  });

  return Response.json(result);
}
