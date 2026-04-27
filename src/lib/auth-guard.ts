import { auth } from "@/auth";

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
