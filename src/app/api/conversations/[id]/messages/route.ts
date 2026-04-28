import { auth } from "@/auth";
import { db } from "@/lib/insforge";

export const runtime = "edge";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  // Verify ownership
  const convResult = await db.conversations("findOne", { filter: { id, userId } }) as any;
  if (!convResult?.document) {
    return new Response("Not found", { status: 404 });
  }

  const messages = await db.messages("find", {
    filter: { conversationId: id },
    sort: { timestamp: 1 },
  });

  return Response.json(messages);
}
