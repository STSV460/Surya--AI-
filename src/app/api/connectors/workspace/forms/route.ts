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
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  if (body.action === "responses" && body.formId) {
    const res = await fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(body.formId)}/responses`, { headers });
    return Response.json(await res.json(), { status: res.status });
  }

  const res = await fetch("https://forms.googleapis.com/v1/forms", {
    method: "POST",
    headers,
    body: JSON.stringify({ info: { title: body.title ?? "Untitled form" } }),
  });
  return Response.json(await res.json(), { status: res.status });
}
