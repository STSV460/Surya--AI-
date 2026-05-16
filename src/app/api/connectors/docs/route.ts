export const runtime = "edge";

import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { decryptOrPlain } from "@/lib/crypto";
import type { ConnectorToken } from "@/types/connector";

async function getGoogleAccessToken(userId: string): Promise<string> {
  const result = (await db.connectorTokens("findOne", {
    filter: { userId, provider: "google" },
  })) as { document: ConnectorToken | null };

  if (!result.document?.accessToken) {
    throw new Error("NOT_CONNECTED");
  }

  const token = result.document;

  // Refresh if expired
  if (token.expiresAt && new Date(token.expiresAt) < new Date() && token.refreshToken) {
    const plainRefresh = await decryptOrPlain(token.refreshToken);
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        refresh_token: plainRefresh,
        grant_type: "refresh_token",
      }),
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      return data.access_token as string;
    }
  }

  return await decryptOrPlain(token.accessToken);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action, title = "Surya AI Export", content = "" } = body;

  if (action !== "create") {
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(session.user.id);
  } catch {
    return Response.json(
      { error: "Google account not connected. Enable Connectors and connect Google first." },
      { status: 401 }
    );
  }

  // Create document
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    return Response.json(
      { error: (err as { error?: { message?: string } }).error?.message ?? "Failed to create document" },
      { status: 502 }
    );
  }

  const doc = await createRes.json() as { documentId: string };
  const documentId = doc.documentId;

  // Insert content
  if (content) {
    await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{ insertText: { location: { index: 1 }, text: content } }],
      }),
    });
  }

  return Response.json({
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    documentId,
    title,
  });
}
