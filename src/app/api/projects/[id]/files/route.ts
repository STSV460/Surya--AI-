import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { invalidateCache } from "@/lib/knowledge-cache";
import { apiError } from "@/lib/api-error";
import { randomUUID } from "crypto";
import type { Project } from "@/types/project";

export const runtime = "edge";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_PROJECT_BYTES = 50 * 1024 * 1024; // 50MB

// Hard MIME allowlist — no wildcard text/*. text/html and text/svg+xml are stored-XSS vectors.
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "text/plain",
  "text/x-python",
  "text/x-typescript",
  "text/x-javascript",
  "application/javascript",
  "text/markdown",
  "application/json",
]);

const ALLOWED_EXTS = new Set([".pdf", ".csv", ".txt", ".ts", ".tsx", ".js", ".jsx", ".py", ".md", ".json"]);

// Magic-byte sniff — reject files whose content starts with HTML/SVG/script regardless of declared MIME.
function looksLikeActiveContent(buf: Buffer): boolean {
  const head = buf.slice(0, 512).toString("utf-8").toLowerCase().trimStart();
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return true;
  if (head.startsWith("<?xml") && head.includes("<svg")) return true;
  if (head.startsWith("<svg")) return true;
  if (head.startsWith("<script")) return true;
  return false;
}

function csvToMarkdown(csv: string): string {
  const lines = csv.trim().split("\n");
  if (lines.length === 0) return csv;
  const rows = lines.map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  const header = `| ${rows[0].join(" | ")} |`;
  const sep = `| ${rows[0].map(() => "---").join(" | ")} |`;
  const body = rows.slice(1).map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [header, sep, body].join("\n");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  const userId = (session.user as { id: string }).id;
  const { id: projectId } = await params;

  // Verify project ownership
  try {
    const projResult = await db.projects("findOne", { filter: { id: projectId, userId } }) as { document: Project | null };
    if (!projResult.document) return apiError("Project not found", 404);
  } catch (e) {
    return apiError("Failed to verify project", 500, e, "files POST projects.findOne");
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return apiError("No file provided", 400);

  // Validate size
  if (file.size > MAX_FILE_BYTES) {
    return apiError("File exceeds 10MB limit", 413);
  }

  // Validate extension
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return apiError("File type not supported", 415);
  }

  // Strict MIME allowlist (no wildcard text/*).
  // For .ts/.tsx/.js/.jsx browsers often send empty type or octet-stream — accept those for code files.
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    const codeExt = ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx" || ext === ".py" || ext === ".md" || ext === ".txt";
    const benignFallback = file.type === "application/octet-stream" || file.type === "";
    if (!(codeExt && benignFallback)) {
      return apiError("File type not supported", 415);
    }
  }

  // Check total project size
  let totalSize = 0;
  try {
    const existingFiles = await db.knowledgeFiles("find", { filter: { projectId, userId } }) as { documents: { size: number }[] };
    totalSize = (existingFiles.documents ?? []).reduce((sum, f) => sum + (f.size ?? 0), 0);
  } catch (e) {
    console.error("[files POST] list existing failed:", e);
  }
  if (totalSize + file.size > MAX_PROJECT_BYTES) {
    return apiError("Project knowledge base exceeds 50MB limit", 413);
  }

  // Extract text content
  let rawContent = "";
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Magic-byte sniff: reject HTML/SVG/script regardless of declared MIME (stored-XSS guard).
  if (ext !== ".pdf" && looksLikeActiveContent(buffer)) {
    return apiError("File content not allowed", 415);
  }

  try {
    if (ext === ".pdf") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfModule = await import("pdf-parse") as any;
      const pdfParse = pdfModule.default ?? pdfModule;
      const parsed = await pdfParse(buffer);
      rawContent = (parsed.text ?? "").trim();
      if (!rawContent) {
        return apiError("PDF text extraction returned empty content", 422);
      }
    } else if (ext === ".csv") {
      rawContent = csvToMarkdown(buffer.toString("utf-8"));
    } else {
      rawContent = buffer.toString("utf-8");
    }
  } catch (e) {
    return apiError("Failed to extract file content", 422, e, "files POST extract");
  }

  const now = new Date().toISOString();
  const mimeType = file.type || "text/plain";
  // Insert without mimeType — schema doesn't have that column on hosted InsForge
  const insertDoc = {
    id: randomUUID(),
    projectId,
    userId,
    name: file.name,
    rawContent,
    size: file.size,
    createdAt: now,
  };
  const knowledgeFile = { ...insertDoc, mimeType };

  try {
    await db.knowledgeFiles("insertOne", { document: insertDoc });
  } catch (e) {
    return apiError("Failed to save file", 500, e, "files POST insert");
  }
  invalidateCache(`project:${projectId}`);

  return Response.json({ document: knowledgeFile }, { status: 201 });
}
