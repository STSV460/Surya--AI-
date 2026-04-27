import { db } from "@/lib/insforge";
import type { MediaAsset, MediaAssetType, MediaStatus } from "@/types/media";

export interface CreateAssetArgs {
  userId: string;
  assetType: MediaAssetType;
  prompt: string;
  provider: string;
  language?: string | null;
  storageUrl?: string;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  status?: MediaStatus;
  jobId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function createAsset(args: CreateAssetArgs): Promise<MediaAsset> {
  const { document } = await db.mediaAssets("insertOne", {
    document: {
      userId: args.userId,
      assetType: args.assetType,
      prompt: args.prompt,
      provider: args.provider,
      language: args.language ?? null,
      storageUrl: args.storageUrl ?? "",
      thumbnailUrl: args.thumbnailUrl ?? null,
      durationSec: args.durationSec ?? null,
      status: args.status ?? "pending",
      jobId: args.jobId ?? null,
      metadata: args.metadata ?? {},
      createdAt: new Date().toISOString(),
    },
  });
  return document as MediaAsset;
}

export async function updateAsset(
  id: string,
  userId: string,
  patch: Partial<MediaAsset>
): Promise<void> {
  await db.mediaAssets("updateOne", { filter: { id, userId }, update: { $set: patch } });
}

export async function listAssets(userId: string): Promise<MediaAsset[]> {
  const { documents } = await db.mediaAssets("find", {
    filter: { userId },
    sort: { createdAt: -1 },
    limit: 200,
  });
  return documents as MediaAsset[];
}

export async function getAsset(id: string, userId: string): Promise<MediaAsset | null> {
  const { document } = await db.mediaAssets("findOne", { filter: { id, userId } });
  return document as MediaAsset | null;
}

export async function deleteAsset(id: string, userId: string): Promise<void> {
  await db.mediaAssets("deleteOne", { filter: { id, userId } });
}
