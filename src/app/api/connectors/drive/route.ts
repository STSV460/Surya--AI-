import { auth } from "@/auth";
import { getValidWorkspaceToken } from "@/lib/google-workspace";
import { connectorLimiter } from "@/lib/rate-limit";
import { isResponse, parseJson } from "@/lib/validation";
import { z } from "zod";

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

const driveBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    query: z.string().trim().max(500).optional().default(""),
    maxResults: z.coerce.number().int().min(1).max(30).optional().default(10),
  }),
  z.object({
    action: z.literal("read"),
    fileId: z.string().trim().min(1).max(200),
  }),
]);

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

function googleWorkspaceMissing() {
  return Response.json(
    { error: "Google Workspace not connected. Connect it in Settings > Connected Accounts.", code: "NOT_CONNECTED" },
    { status: 400 }
  );
}

function exportMimeType(mimeType: string) {
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "text/csv";
  if (
    mimeType === "application/vnd.google-apps.document" ||
    mimeType === "application/vnd.google-apps.presentation"
  ) {
    return "text/plain";
  }
  return null;
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

  const body = await parseJson(req, driveBodySchema);
  if (isResponse(body)) return body;

  const accessToken = await getValidWorkspaceToken(session.user.id);
  if (!accessToken) return googleWorkspaceMissing();

  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    if (body.action === "list") {
      const q = body.query ? `(${body.query}) and trashed = false` : "trashed = false";
      const params = new URLSearchParams({
        q,
        pageSize: String(body.maxResults),
        orderBy: "modifiedTime desc",
        fields: "files(id,name,mimeType,webViewLink,modifiedTime,size)",
      });
      const res = await fetch(`${DRIVE_API}?${params}`, { headers });
      if (!res.ok) {
        return Response.json({ error: await res.text() }, { status: res.status });
      }
      const data = (await res.json()) as { files?: DriveFile[] };
      return Response.json({ files: data.files ?? [] });
    }

    const metaParams = new URLSearchParams({
      fields: "id,name,mimeType,webViewLink,modifiedTime,size",
    });
    const metaRes = await fetch(`${DRIVE_API}/${encodeURIComponent(body.fileId)}?${metaParams}`, {
      headers,
    });
    if (!metaRes.ok) {
      return Response.json({ error: await metaRes.text() }, { status: metaRes.status });
    }
    const file = (await metaRes.json()) as DriveFile;
    const googleExport = exportMimeType(file.mimeType);
    const contentUrl = googleExport
      ? `${DRIVE_API}/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(googleExport)}`
      : `${DRIVE_API}/${encodeURIComponent(file.id)}?alt=media`;

    const contentRes = await fetch(contentUrl, { headers });
    if (!contentRes.ok) {
      return Response.json({ error: await contentRes.text(), file }, { status: contentRes.status });
    }

    const contentType = contentRes.headers.get("content-type") ?? file.mimeType;
    const text = contentType.includes("text") || contentType.includes("json") || googleExport
      ? await contentRes.text()
      : "";

    return Response.json({
      file: {
        ...file,
        text: text.slice(0, 30000),
        truncated: text.length > 30000,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
