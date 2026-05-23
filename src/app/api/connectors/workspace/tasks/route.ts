import { auth } from "@/auth";
import { getValidWorkspaceToken } from "@/lib/google-workspace";
import { connectorLimiter } from "@/lib/rate-limit";

async function tokenOr401(userId: string) {
  const token = await getValidWorkspaceToken(userId);
  if (!token) return null;
  return token;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { success } = await connectorLimiter.check(session.user.id);
  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const token = await tokenOr401(session.user.id);
  if (!token) return Response.json({ error: "Google Workspace not connected" }, { status: 400 });
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  if (body.action === "create" || body.action === "insert") {
    const res = await fetch("https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({ title: body.title ?? "Untitled task", notes: body.notes }),
    });
    return Response.json(await res.json(), { status: res.status });
  }

  const res = await fetch("https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=20", { headers });
  return Response.json(await res.json(), { status: res.status });
}
