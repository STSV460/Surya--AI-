import { auth } from "@/auth";
import { db } from "@/lib/insforge";

/**
 * Resolves session.user.id or throws a 401 Response.
 * Use at the top of every user-scoped API route:
 *   const userId = await requireUser();
 */
export async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return session.user.id;
}

export async function getUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireOwnedConversation(conversationId: string, userId: string) {
  const result = (await db.conversations("findOne", {
    filter: { id: conversationId, userId },
  })) as { document: { id: string } | null };

  if (!result.document) {
    throw new Response("Not found", { status: 404 });
  }
  return result.document;
}

export async function requireOwnedProject(projectId: string, userId: string) {
  const result = (await db.projects("findOne", {
    filter: { id: projectId, userId },
  })) as { document: { id: string } | null };

  if (!result.document) {
    throw new Response("Not found", { status: 404 });
  }
  return result.document;
}

export function unauthorizedResponse(err: unknown) {
  if (err instanceof Response) return err;
  throw err;
}
