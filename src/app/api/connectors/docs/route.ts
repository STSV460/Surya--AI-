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

  // Rate limiting
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

    if (action === "read") {
      const { documentId } = body;
      const docs = google.docs({ version: "v1", auth: oauth2Client });

      const doc = await docs.documents.get({ documentId });

      // Extract plain text from document content
      let text = "";
      const content = doc.data.body?.content ?? [];
      for (const element of content) {
        if (element.paragraph) {
          for (const elem of element.paragraph.elements ?? []) {
            text += elem.textRun?.content ?? "";
          }
        }
        if (element.table) {
          for (const row of element.table.tableRows ?? []) {
            for (const cell of row.tableCells ?? []) {
              for (const cellEl of cell.content ?? []) {
                if (cellEl.paragraph) {
                  for (const elem of cellEl.paragraph.elements ?? []) {
                    text += elem.textRun?.content ?? "";
                  }
                  text += "\t";
                }
              }
            }
            text += "\n";
          }
        }
      }

      return Response.json({
        title: doc.data.title,
        content: text.slice(0, 12000),
      });
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