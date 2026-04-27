/**
 * fal.ai client for Wan 2.2 video generation.
 * REST-only, no SDK — keeps deps minimal.
 */
import type { VideoGenInput } from "@/types/media";

const FAL_KEY = process.env.FAL_KEY;
const FAL_BASE = "https://queue.fal.run";

const MODEL_T2V = process.env.FAL_MODEL_T2V ?? "fal-ai/ltx-2";
const MODEL_I2V = process.env.FAL_MODEL_I2V ?? "fal-ai/ltx-2-19b/image-to-video";
const MODEL_V2V = process.env.FAL_MODEL_V2V ?? "fal-ai/ltx-2";

function authHeaders() {
  if (!FAL_KEY) throw new Error("FAL_KEY env var is not set");
  return { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" };
}

interface FalSubmitResp {
  request_id: string;
  status_url: string;
  response_url: string;
}

export async function submitVideoJob(input: VideoGenInput): Promise<FalSubmitResp> {
  const mode = input.mode ?? (input.imageUrl ? "i2v" : "t2v");
  const model = mode === "v2v" ? MODEL_V2V : mode === "i2v" ? MODEL_I2V : MODEL_T2V;

  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio ?? "16:9",
    duration: Math.min(Math.max(input.durationSec ?? 5, 2), 10),
    resolution: "720p",
  };
  if (input.imageUrl) payload.image_url = input.imageUrl;
  if (input.sourceVideoUrl) payload.video_url = input.sourceVideoUrl;

  const res = await fetch(`${FAL_BASE}/${model}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`fal submit failed: ${res.status} ${await res.text()}`);
  return res.json();
}

interface FalStatusResp {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
}

export async function pollVideoJob(
  statusUrl: string,
  responseUrl: string,
  timeoutMs = 5 * 60 * 1000
): Promise<{ videoUrl: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(statusUrl, { headers: authHeaders() });
    if (!r.ok) throw new Error(`fal status failed: ${r.status}`);
    const status = (await r.json()) as FalStatusResp;
    if (status.status === "COMPLETED") {
      const final = await fetch(responseUrl, { headers: authHeaders() });
      const data = await final.json();
      const videoUrl = data?.video?.url ?? data?.url ?? data?.output?.video?.url;
      if (!videoUrl) throw new Error("fal response missing video URL");
      return { videoUrl };
    }
    if (status.status === "FAILED") throw new Error("fal job failed");
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error("fal job timed out");
}

export async function generateVideoBlocking(input: VideoGenInput): Promise<string> {
  const submit = await submitVideoJob(input);
  const { videoUrl } = await pollVideoJob(submit.status_url, submit.response_url);
  return videoUrl;
}
