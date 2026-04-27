import { insforge } from "@/lib/insforge";

const BUCKET = process.env.MEDIA_BUCKET ?? "media-assets";

function extFor(mime: string): string {
  if (mime.startsWith("video/")) return mime.includes("webm") ? "webm" : "mp4";
  if (mime.startsWith("audio/")) {
    if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
    if (mime.includes("wav")) return "wav";
    return "ogg";
  }
  if (mime.startsWith("image/")) {
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    if (mime.includes("gif")) return "gif";
    return "jpg";
  }
  return "bin";
}

function mimeForKind(kind: string, fallback: string): string {
  if (fallback && fallback !== "application/octet-stream" && fallback !== "binary/octet-stream") return fallback;
  if (kind === "video" || kind === "avatar" || kind === "film") return "video/mp4";
  if (kind === "audio") return "audio/mpeg";
  if (kind === "image" || kind === "ref") return "image/jpeg";
  return "application/octet-stream";
}

export async function uploadBlobToBucket(
  userId: string,
  kind: string,
  blob: Blob
): Promise<string> {
  const mime = mimeForKind(kind, blob.type);
  const ext = extFor(mime);
  const path = `${userId}/${kind}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const file = new File([await blob.arrayBuffer()], path.split("/").pop()!, { type: mime });
  const bucket = insforge.storage.from(BUCKET);
  const { error } = await bucket.upload(path, file);
  if (error) throw new Error(error.message || "Storage upload failed");
  return bucket.getPublicUrl(path);
}

export async function uploadUrlToBucket(
  userId: string,
  kind: string,
  url: string
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch source failed: ${res.status}`);
  const ct = res.headers.get("content-type") ?? "";
  const buf = Buffer.from(await res.arrayBuffer());
  const blob = new Blob([buf], { type: ct });
  return uploadBlobToBucket(userId, kind, blob);
}

export async function uploadBase64ToBucket(
  userId: string,
  kind: string,
  base64: string,
  mime: string
): Promise<string> {
  const buf = Buffer.from(base64, "base64");
  const blob = new Blob([buf], { type: mime });
  return uploadBlobToBucket(userId, kind, blob);
}
