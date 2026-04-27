import { auth } from "@/auth";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const TEXT_ALLOWED = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "text/x-typescript",
  "application/typescript",
  "text/javascript",
  "application/javascript",
  "text/x-python",
  "text/x-script.python",
]);
const IMAGE_ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File > 5MB" }, { status: 413 });
  }

  const mime = file.type || "text/plain";

  // Image branch — return base64 data URL for vision models
  if (mime.startsWith("image/") || IMAGE_ALLOWED.has(mime)) {
    if (!IMAGE_ALLOWED.has(mime)) {
      return Response.json({ error: `Unsupported image type: ${mime}` }, { status: 415 });
    }
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      return Response.json({
        kind: "image",
        name: file.name,
        size: file.size,
        mime,
        dataUrl,
      });
    } catch (err) {
      console.error("[chat/files] image read failed:", err);
      return Response.json({ error: "Image read failed" }, { status: 500 });
    }
  }

  const isText = mime.startsWith("text/") || TEXT_ALLOWED.has(mime) || /\.(md|txt|csv|json|ts|tsx|js|jsx|py)$/i.test(file.name);

  let content = "";

  try {
    if (mime === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const buf = Buffer.from(await file.arrayBuffer());
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      const result = await parser.getText();
      content = result.text ?? "";
    } else if (isText) {
      content = await file.text();
    } else {
      return Response.json({ error: `Unsupported type: ${mime}` }, { status: 415 });
    }
  } catch (err) {
    console.error("[chat/files] parse failed:", err);
    return Response.json({ error: "Parse failed" }, { status: 500 });
  }

  const capped = content.slice(0, 40_000);

  return Response.json({
    kind: "text",
    name: file.name,
    size: file.size,
    mime,
    content: capped,
    truncated: content.length > capped.length,
  });
}
