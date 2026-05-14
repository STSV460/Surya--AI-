
import { after } from "next/server";
import { auth } from "@/auth";
import { generateHfSpacesVideo } from "@/lib/media/hfSpaces";
import { uploadBlobToBucket } from "@/lib/media/storage";
import { createAsset, updateAsset } from "@/lib/media/assets";
import { aiLimiter } from "@/lib/rate-limit";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";
import type { VideoGenInput } from "@/types/media";

export const maxDuration = 300;

const videoSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  durationSec: z.coerce.number().int().min(1).max(12).optional(),
  mode: z.enum(["t2v", "i2v", "v2v"]).optional(),
  imageUrl: z.string().trim().url().max(2048).optional(),
  sourceVideoUrl: z.string().trim().url().max(2048).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional(),
});

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

  const body = await parseJson(req, videoSchema);
  if (isResponse(body)) return body;
  const input = body as VideoGenInput;

  const userId = session.user.id;
  const provider = `hf-spaces/${process.env.HF_VIDEO_SPACE ?? "wan2-1-fast"}`;

  const asset = await createAsset({
    userId,
    assetType: "video",
    prompt: input.prompt,
    provider,
    durationSec: input.durationSec ?? 5,
    metadata: {
      mode: input.mode ?? (input.imageUrl ? "i2v" : "t2v"),
      aspectRatio: input.aspectRatio ?? "16:9",
    },
  });

  after(async () => {
    try {
      const { blob } = await generateHfSpacesVideo(input);
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
