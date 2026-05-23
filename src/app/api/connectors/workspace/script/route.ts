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

  if (body.action === "run" && body.scriptId && body.functionName) {
    const res = await fetch(`https://script.googleapis.com/v1/scripts/${encodeURIComponent(body.scriptId)}:run`, {
      method: "POST",
      headers,
      body: JSON.stringify({ function: body.functionName, parameters: body.parameters ?? [] }),
    });
    return Response.json(await res.json(), { status: res.status });
  }

  return Response.json({ error: "Apps Script list is not exposed by Google Script API. Provide scriptId and functionName to run." }, { status: 400 });
}
