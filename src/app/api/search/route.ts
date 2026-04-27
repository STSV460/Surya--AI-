export const runtime = "edge";

import { auth } from "@/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 5;

  if (!q) {
    return Response.json({ error: "q is required" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cookie = req.headers.get("cookie") ?? "";

  const res = await fetch(`${appUrl}/api/connectors/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ action: "search", query: q, limit }),
  });

  const data = await res.json();
  return Response.json(data, { status: res.status });
}