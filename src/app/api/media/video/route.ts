export const runtime = "edge";

import { after } from "next/server";
import { auth } from "@/auth";
import { generateHfSpacesVideo } from "@/lib/media/hfSpaces";
import { uploadBlobToBucket } from "@/lib/media/storage";
import { createAsset, updateAsset } from "@/lib/media/assets";
import { aiLimiter } from "@/lib/rate-limit";
import type { VideoGenInput } from "@/types/media";

export const maxDuration = 900;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  // Rate limiting
  const { success } = await aiLimiter.check(session.user.id);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please wait before generating another video." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: VideoGenInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const userId = session.user.id;
  const provider = `hf-spaces/${process.env.HF_VIDEO_SPACE ?? "wan2-1-fast"}`;

  const asset = await createAsset({
    userId,
    assetType: "video",
    prompt: body.prompt,
    provider,
    durationSec: body.durationSec ?? 5,
    metadata: {
      mode: body.mode ?? (body.imageUrl ? "i2v" : "t2v"),
      aspectRatio: body.aspectRatio ?? "16:9",
    },
  });

  after(async () => {
    try {
      const { blob } = await generateHfSpacesVideo(body);
      const stored = await uploadBlobToBucket(userId, "video", blob);
      await updateAsset(asset.id, userId, { storageUrl: stored, status: "done" });
    } catch (err) {
      console.error("[media/video] failed:", err);
      await updateAsset(asset.id, userId, {
        status: "failed",
        metadata: { ...(asset.metadata ?? {}), error: String(err) },
      });
    }
  });

  return Response.json({ jobId: asset.id, assetId: asset.id, status: "pending", provider });
}