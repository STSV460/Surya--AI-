import { auth } from "@/auth";
import { uploadBlobToBucket } from "@/lib/media/storage";

const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_MEDIA_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // Audio
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const kind = (form.get("kind") as string) || "upload";
  if (!(file instanceof Blob)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }

  // Size validation
  if (file.size > MAX_MEDIA_BYTES) {
    return Response.json(
      { error: `File too large. Maximum ${MAX_MEDIA_BYTES / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  // MIME type validation
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MEDIA_TYPES.has(mime)) {
    return Response.json(
      {
        error: `Unsupported file type: ${mime}. Allowed: images (jpeg, png, webp, gif), video (mp4, webm), audio (mp3, wav, ogg).`,
      },
      { status: 415 }
    );
  }

  const url = await uploadBlobToBucket(session.user.id, kind, file);
  return Response.json({ url });
}

