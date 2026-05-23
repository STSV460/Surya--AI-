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
  const headers = { Authorization: `Bearer ${token}` };
  const endpoint = body.action === "groups"
    ? "https://admin.googleapis.com/admin/directory/v1/groups?customer=my_customer&maxResults=20"
    : "https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=20&orderBy=email";
  const res = await fetch(endpoint, { headers });
  return Response.json(await res.json(), { status: res.status });
}
