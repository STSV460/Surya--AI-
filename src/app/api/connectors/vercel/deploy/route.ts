import { auth } from "@/auth";
import { decryptOrPlain } from "@/lib/crypto";
import { db } from "@/lib/insforge";
import { connectorLimiter } from "@/lib/rate-limit";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const schema = z.object({
  name: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/),
  files: z.record(z.string().max(240), z.string().max(500_000)),
  target: z.enum(["production", "preview"]).optional().default("preview"),
});

async function getToken(userId: string) {
  const row = (await db.connectorTokens("findOne", {
    filter: { userId, provider: "vercel" },
  })) as { document: { accessToken?: string } | null };
  return row.document?.accessToken ? decryptOrPlain(row.document.accessToken) : null;
}

function b64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { success } = await connectorLimiter.check(session.user.id);
  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 });
  const body = await parseJson(req, schema);
  if (isResponse(body)) return body;
  const token = await getToken(session.user.id);
  if (!token) return Response.json({ error: "Vercel not connected" }, { status: 400 });
  if (body.target === "production" && req.headers.get("x-surya-confirm-production") !== "true") {
    return Response.json({ error: "Production deploy requires confirmation", code: "CONFIRMATION_REQUIRED" }, { status: 403 });
  }

  const files = Object.entries(body.files).map(([file, data]) => ({
    file,
    data: b64(data),
    encoding: "base64",
  }));
  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: body.name,
      target: body.target === "production" ? "production" : undefined,
      files,
      projectSettings: { framework: "vite" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  return Response.json(
    {
      url: data.url ? `https://${data.url}` : undefined,
      inspectorUrl: data.inspectorUrl,
      id: data.id,
      readyState: data.readyState,
      raw: data,
    },
    { status: res.status }
  );
}
