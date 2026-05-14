
import { after } from "next/server";
import { auth } from "@/auth";
import { generateFilm } from "@/lib/media/film";
import { createAsset, updateAsset } from "@/lib/media/assets";
import type { Storyboard } from "@/types/media";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  let body: Storyboard;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.shots?.length) {
    return Response.json({ error: "shots required" }, { status: 400 });
  }

  const userId = session.user.id;
  const asset = await createAsset({
    userId,
    assetType: "film",
    prompt: body.title || `Film: ${body.shots.length} shots`,
    provider: "fal/ltx-2",
    metadata: { storyboard: body },
  });

  after(async () => {
    try {
      const { shotUrls } = await generateFilm(body);
      await updateAsset(asset.id, userId, {
        status: "done",
        storageUrl: shotUrls[0],
        metadata: {
          ...(asset.metadata ?? {}),
          shotUrls,
        },
      });
    } catch (err) {
      console.error("[media/film] failed:", err);
      await updateAsset(asset.id, userId, { status: "failed" });
    }
  });

  return Response.json({ jobId: asset.id, assetId: asset.id, status: "pending" });
}