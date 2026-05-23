import { auth } from "@/auth";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/insforge";
import { connectorLimiter } from "@/lib/rate-limit";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const schema = z.object({ token: z.string().trim().min(20).max(400) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { success } = await connectorLimiter.check(session.user.id);
  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 });
  const body = await parseJson(req, schema);
  if (isResponse(body)) return body;

  const res = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${body.token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ error: data.error?.message ?? "Invalid Vercel token" }, { status: 400 });

  await db.connectorTokens("deleteOne", { filter: { userId: session.user.id, provider: "vercel" } });
  await db.connectorTokens("insertOne", {
    document: {
      id: crypto.randomUUID(),
      userId: session.user.id,
      provider: "vercel",
      email: data.user?.email ?? null,
      accessToken: await encrypt(body.token),
      refreshToken: null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  return Response.json({ connected: true, user: data.user });
}
