import { auth } from "@/auth";
import { getValidWorkspaceToken } from "@/lib/google-workspace";
import { connectorLimiter } from "@/lib/rate-limit";
import { isResponse, parseJson } from "@/lib/validation";
import { z } from "zod";

const docsBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    documentId: z.string().trim().min(1).max(200),
  }),
]);

interface DocsElement {
  textRun?: { content?: string };
}

interface DocsStructuralElement {
  paragraph?: { elements?: DocsElement[] };
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{
        content?: DocsStructuralElement[];
      }>;
    }>;
  };
}

interface DocsDocument {
  title?: string;
  body?: { content?: DocsStructuralElement[] };
}

function googleWorkspaceMissing() {
  return Response.json(
    { error: "Google Workspace not connected. Connect it in Settings > Connected Accounts.", code: "NOT_CONNECTED" },
    { status: 400 }
  );
}

function extractText(elements: DocsStructuralElement[] = []): string {
  return elements
    .map((element) => {
      if (element.paragraph?.elements) {
        return element.paragraph.elements.map((item) => item.textRun?.content ?? "").join("");
      }
      if (element.table?.tableRows) {
        return element.table.tableRows
          .map((row) =>
            (row.tableCells ?? [])
              .map((cell) => extractText(cell.content ?? []).trim())
              .filter(Boolean)
              .join("\t")
          )
          .join("\n");
      }
      return "";
    })
    .join("");
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

  const body = await parseJson(req, docsBodySchema);
  if (isResponse(body)) return body;

  const accessToken = await getValidWorkspaceToken(session.user.id);
  if (!accessToken) return googleWorkspaceMissing();

  try {
    const res = await fetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(body.documentId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      return Response.json({ error: await res.text() }, { status: res.status });
    }

    const doc = (await res.json()) as DocsDocument;
    const text = extractText(doc.body?.content ?? []).trim();
    return Response.json({
      document: {
        id: body.documentId,
        title: doc.title ?? "Untitled document",
        text: text.slice(0, 30000),
        truncated: text.length > 30000,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
