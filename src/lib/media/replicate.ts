/**
 * Replicate client for LivePortrait avatar gen + LTX-Video text-to-video.
 */
import type { AvatarGenInput, VideoGenInput } from "@/types/media";

const TOKEN = process.env.REPLICATE_API_TOKEN;
const BASE = "https://api.replicate.com/v1";
const MODEL_VERSION =
  process.env.REPLICATE_LIVEPORTRAIT_VERSION ??
  "fofr/live-portrait:067dd98cc3e5cb396c4a9efb4bba3eec6c4a9d8a3a4f6ff34c6a9d8c1d9e0f1a";
const LTX_VERSION =
  process.env.REPLICATE_LTX_VERSION ??
  "8c47da666861d081eeb4d1261853087de23923a268a69b63febdf5dc1dee08e4";

function headers() {
  if (!TOKEN) throw new Error("REPLICATE_API_TOKEN not set");
  return {
    Authorization: `Token ${TOKEN}`,
    "Content-Type": "application/json",
  };
}

interface RepPredict {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
  urls: { get: string };
}

export async function generateAvatarBlocking(
  input: AvatarGenInput,
  timeoutMs = 5 * 60 * 1000
): Promise<string> {
  const create = await fetch(`${BASE}/predictions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      version: MODEL_VERSION.split(":")[1] ?? MODEL_VERSION,
      input: {
        face_image: input.imageUrl,
        driving_audio: input.audioUrl,
      },
    }),
  });
  if (!create.ok) {
    throw new Error(`replicate create failed: ${create.status} ${await create.text()}`);
  }
  let pred = (await create.json()) as RepPredict;

  const start = Date.now();
  while (
    pred.status !== "succeeded" &&
    pred.status !== "failed" &&
    pred.status !== "canceled"
  ) {
    if (Date.now() - start > timeoutMs) throw new Error("replicate timed out");
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(pred.urls.get, { headers: headers() });
    pred = (await poll.json()) as RepPredict;
  }

  if (pred.status !== "succeeded") {
    throw new Error(`replicate ${pred.status}: ${pred.error ?? ""}`);
  }
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!out) throw new Error("replicate empty output");
  return out;
}

const ASPECT_DIMS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 768, height: 432 },
  "9:16": { width: 432, height: 768 },
  "1:1": { width: 512, height: 512 },
};

export async function generateLtxVideo(
  input: VideoGenInput,
  timeoutMs = 8 * 60 * 1000,
): Promise<string> {
  const dims = ASPECT_DIMS[input.aspectRatio ?? "16:9"];
  const fps = 24;
  const seconds = Math.min(Math.max(input.durationSec ?? 5, 2), 8);
  const body: Record<string, unknown> = {
    version: LTX_VERSION,
    input: {
      prompt: input.prompt,
      num_frames: seconds * fps,
      frame_rate: fps,
      width: dims.width,
      height: dims.height,
    },
  };
  if (input.imageUrl) (body.input as Record<string, unknown>).image = input.imageUrl;

  const create = await fetch(`${BASE}/predictions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!create.ok) {
    throw new Error(`replicate ltx create failed: ${create.status} ${await create.text()}`);
  }
  let pred = (await create.json()) as RepPredict;

  const start = Date.now();
  while (
    pred.status !== "succeeded" &&
    pred.status !== "failed" &&
    pred.status !== "canceled"
  ) {
    if (Date.now() - start > timeoutMs) throw new Error("replicate ltx timed out");
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(pred.urls.get, { headers: headers() });
    pred = (await poll.json()) as RepPredict;
  }
  if (pred.status !== "succeeded") {
    throw new Error(`replicate ltx ${pred.status}: ${pred.error ?? ""}`);
  }
  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!out) throw new Error("replicate ltx empty output");
  return out;
}
