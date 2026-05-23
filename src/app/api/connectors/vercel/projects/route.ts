import { auth } from "@/auth";
import { decryptOrPlain } from "@/lib/crypto";
import { db } from "@/lib/insforge";

async function getToken(userId: string) {
  const row = (await db.connectorTokens("findOne", {
    filter: { userId, provider: "vercel" },
  })) as { document: { accessToken?: string } | null };
  return row.document?.accessToken ? decryptOrPlain(row.document.accessToken) : null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const token = await getToken(session.user.id);
  if (!token) return Response.json({ error: "Vercel not connected" }, { status: 400 });
  const res = await fetch("https://api.vercel.com/v9/projects", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Response.json(await res.json(), { status: res.status });
}
