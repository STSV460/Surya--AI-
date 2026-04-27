export type MediaAssetType = "video" | "image" | "audio" | "avatar" | "film";

export type MediaStatus = "pending" | "done" | "failed";

export type VoiceProvider = "elevenlabs" | "sarvam";

export type MediaTab = "video" | "image" | "audio" | "avatar" | "film" | "library";

export interface MediaAsset {
  id: string;
  userId: string;
  assetType: MediaAssetType;
  prompt: string;
  provider: string;
  language?: string | null;
  storageUrl: string;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
  status: MediaStatus;
  jobId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface VideoGenInput {
  prompt: string;
  imageUrl?: string;
  durationSec?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  mode?: "t2v" | "i2v" | "v2v";
  sourceVideoUrl?: string;
}

export interface AudioGenInput {
  text: string;
  language: string;
  voiceId?: string;
}

export interface AvatarGenInput {
  imageUrl: string;
  audioUrl: string;
}

export interface StoryboardShot {
  id: string;
  prompt: string;
  durationSec: number;
  imageUrl?: string;
}

export interface Storyboard {
  title: string;
  shots: StoryboardShot[];
}

export interface MediaJob {
  jobId: string;
  status: MediaStatus;
  assetId?: string;
}
