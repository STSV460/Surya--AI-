export const runtime = "edge";

import { after } from "next/server";
import { auth } from "@/auth";
import { generateAvatarBlocking } from "@/lib/media/replicate";
import { uploadUrlToBucket } from "@/lib/media/storage";
import { createAsset, updateAsset } from "@/lib/media/assets";
import type { AvatarGenInput } from "@/types/media";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  let body: AvatarGenInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.imageUrl || !body.audioUrl) {
    return Response.json({ error: "imageUrl and audioUrl required" }, { status: 400 });
  }

  const userId = session.user.id;
  const asset = await createAsset({
    userId,
    assetType: "avatar",
    prompt: "Avatar talking head",
    provider: "replicate/liveportrait",
    metadata: { imageUrl: body.imageUrl, audioUrl: body.audioUrl },
  });

  after(async () => {
    try {
      const videoUrl = await generateAvatarBlocking(body);
      const stored = await uploadUrlToBucket(userId, "avatar", videoUrl);
      await updateAsset(asset.id, userId, { storageUrl: stored, status: "done" });
    } catch (err) {
      console.error("[media/avatar] failed:", err);
      await updateAsset(asset.id, userId, { status: "failed" });
    }
  });

  return Response.json({ jobId: asset.id, assetId: asset.id, status: "pending" });
}