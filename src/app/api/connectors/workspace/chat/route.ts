import { auth } from "@/auth";
import { getValidWorkspaceToken } from "@/lib/google-workspace";
import { connectorLimiter } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { success } = await connectorLimiter.check(session.user.id);
  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const token = await getValidWorkspaceToken(session.user.id);
  if (!token) return Response.json({ error: "Google Workspace not connected" }, { status: 400 });
  if (!body.space) return Response.json({ error: "space is required" }, { status: 400 });

  const res = await fetch(`https://chat.googleapis.com/v1/${body.space}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: body.text ?? body.message ?? "" }),
  });
  return Response.json(await res.json(), { status: res.status });
}
