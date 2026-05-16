import { auth } from "@/auth";
import { getValidWorkspaceToken } from "@/lib/google-workspace";
import { connectorLimiter } from "@/lib/rate-limit";
import { isResponse, parseJson } from "@/lib/validation";
import { z } from "zod";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

const gmailBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("search"),
    query: z.string().trim().min(1).max(500),
    maxResults: z.coerce.number().int().min(1).max(20).optional().default(10),
  }),
  z.object({
    action: z.literal("read"),
    messageId: z.string().trim().min(1).max(200),
  }),
]);

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  payload?: GmailPart & {
    headers?: Array<{ name: string; value: string }>;
  };
  internalDate?: string;
}

function headerValue(message: GmailMessage, name: string) {
  return (
    message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

function decodeBase64Url(data: string) {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function collectText(part: GmailPart | undefined, preferred: string): string {
  if (!part) return "";
  if (part.mimeType === preferred && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  return (part.parts ?? []).map((child) => collectText(child, preferred)).filter(Boolean).join("\n");
}

function plainTextFromMessage(message: GmailMessage) {
  const plain = collectText(message.payload, "text/plain");
  if (plain.trim()) return plain.trim();
  const html = collectText(message.payload, "text/html");
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function googleWorkspaceMissing() {
  return Response.json(
    { error: "Google Workspace not connected. Connect it in Settings > Connected Accounts.", code: "NOT_CONNECTED" },
    { status: 400 }
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { success } = await connectorLimiter.check(session.user.id);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await parseJson(req, gmailBodySchema);
  if (isResponse(body)) return body;

  const accessToken = await getValidWorkspaceToken(session.user.id);
  if (!accessToken) return googleWorkspaceMissing();

  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    if (body.action === "search") {
      const params = new URLSearchParams({
        q: body.query,
        maxResults: String(body.maxResults),
      });
      const res = await fetch(`${GMAIL_API}/messages?${params}`, { headers });
      if (!res.ok) {
        return Response.json({ error: await res.text() }, { status: res.status });
      }
      const list = (await res.json()) as { messages?: Array<{ id: string }> };
      const ids = list.messages ?? [];
      const messages = await Promise.all(
        ids.map(async ({ id }) => {
          const metaParams = new URLSearchParams({
            format: "metadata",
            metadataHeaders: "Subject",
          });
          metaParams.append("metadataHeaders", "From");
          metaParams.append("metadataHeaders", "Date");
          const metaRes = await fetch(`${GMAIL_API}/messages/${id}?${metaParams}`, { headers });
          if (!metaRes.ok) return null;
          const message = (await metaRes.json()) as GmailMessage;
          return {
            id: message.id,
            threadId: message.threadId,
            subject: headerValue(message, "Subject"),
            from: headerValue(message, "From"),
            date: headerValue(message, "Date"),
            snippet: message.snippet ?? "",
          };
        })
      );

      return Response.json({ messages: messages.filter(Boolean) });
    }

    const params = new URLSearchParams({ format: "full" });
    const res = await fetch(`${GMAIL_API}/messages/${encodeURIComponent(body.messageId)}?${params}`, {
      headers,
    });
    if (!res.ok) {
      return Response.json({ error: await res.text() }, { status: res.status });
    }
    const message = (await res.json()) as GmailMessage;
    return Response.json({
      message: {
        id: message.id,
        threadId: message.threadId,
        subject: headerValue(message, "Subject"),
        from: headerValue(message, "From"),
        to: headerValue(message, "To"),
        date: headerValue(message, "Date"),
        snippet: message.snippet ?? "",
        text: plainTextFromMessage(message).slice(0, 20000),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
