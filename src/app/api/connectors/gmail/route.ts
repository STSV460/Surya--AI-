export const runtime = "edge";

import { auth } from "@/auth";
import { getGoogleClient, isConnectorError } from "@/lib/google-apis";
import { google } from "googleapis";
import { connectorLimiter } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limiting — 20 connector requests per minute per user
  const { success } = await connectorLimiter.check(session.user.id);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const userId = session.user.id;
  const body = await req.json();
  const { action } = body;

  try {
    const oauth2Client = await getGoogleClient(userId);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    if (action === "search") {
      const { query, maxResults = 10 } = body;
      const listRes = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: Math.min(maxResults, 20),
      });

      const messages = listRes.data.messages ?? [];
      if (messages.length === 0) {
        return Response.json({ emails: [] });
      }

      // Fetch snippet + headers for each message
      const emails = await Promise.all(
        messages.slice(0, 10).map(async (m) => {
          const msg = await gmail.users.messages.get({
            userId: "me",
            id: m.id!,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "To", "Date"],
          });
          const headers = msg.data.payload?.headers ?? [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
          return {
            id: m.id,
            subject: getHeader("Subject"),
            from: getHeader("From"),
            to: getHeader("To"),
            date: getHeader("Date"),
            snippet: msg.data.snippet ?? "",
          };
        })
      );

      return Response.json({ emails });
    }

    if (action === "read") {
      const { messageId } = body;
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const headers = msg.data.payload?.headers ?? [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      // Extract plain text body
      let bodyText = "";
      const parts = msg.data.payload?.parts ?? [];
      const textPart = parts.find((p) => p.mimeType === "text/plain");
      if (textPart?.body?.data) {
        bodyText = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      } else if (msg.data.payload?.body?.data) {
        bodyText = Buffer.from(msg.data.payload.body.data, "base64").toString("utf-8");
      }

      return Response.json({
        id: messageId,
        subject: getHeader("Subject"),
        from: getHeader("From"),
        to: getHeader("To"),
        date: getHeader("Date"),
        body: bodyText.slice(0, 8000), // cap for context window
      });
    }

    if (action === "send") {
      const { to, subject, body: emailBody } = body;
      const raw = Buffer.from(
        `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${emailBody}`
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });

      return Response.json({ success: true, message: `Email sent to ${to}` });
    }

    return new Response(`Unknown action: ${action}`, { status: 400 });
  } catch (err) {
    if (isConnectorError(err)) {
      return Response.json({ error: err.message, code: err.code }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}