/**
 * Google Generative Language API — Veo 3 video generation.
 * Long-running operation: submit → poll → fetch video.
 */
import type { VideoGenInput, AvatarGenInput } from "@/types/media";

const KEY = process.env.GOOGLE_AI_API_KEY;
const MODEL = process.env.VEO_MODEL ?? "veo-3.0-generate-001";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

function requireKey(): string {
  if (!KEY) throw new Error("GOOGLE_AI_API_KEY not set");
  return KEY;
}

interface OpResp {
  name: string;
  done?: boolean;
  error?: { message: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{ video?: { uri?: string } }>;
    };
  };
}

async function fetchImageAsInline(url: string): Promise<{ bytesBase64Encoded: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image failed: ${res.status}`);
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { bytesBase64Encoded: buf.toString("base64"), mimeType };
}

async function submit(payload: Record<string, unknown>): Promise<string> {
  const key = requireKey();
  const url = `${BASE}/models/${MODEL}:predictLongRunning?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`veo submit failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { name?: string };
  if (!data.name) throw new Error("veo submit returned no operation name");
  return data.name;
}

async function pollOp(opName: string, timeoutMs = 8 * 60 * 1000): Promise<string> {
  const key = requireKey();
  const url = `${BASE}/${opName}?key=${key}`;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`veo poll failed: ${res.status}`);
    const op = (await res.json()) as OpResp;
    if (op.done) {
      if (op.error) throw new Error(`veo error: ${op.error.message}`);
      const uri = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new Error("veo response missing video URI");
      return uri;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("veo timed out");
}

/**
 * Veo 3 returns a `download` URI that requires the API key appended for actual fetch.
 */
export function withKey(uri: string): string {
  const key = requireKey();
  const sep = uri.includes("?") ? "&" : "?";
  return `${uri}${sep}key=${key}`;
}

export async function generateVeoVideo(input: VideoGenInput): Promise<string> {
  const instance: Record<string, unknown> = { prompt: input.prompt };
  if (input.imageUrl) {
    instance.image = await fetchImageAsInline(input.imageUrl);
  }
  const payload = {
    instances: [instance],
    parameters: { aspectRatio: input.aspectRatio ?? "16:9" },
  };
  const opName = await submit(payload);
  const uri = await pollOp(opName);
  return withKey(uri);
}

export async function generateVeoAvatar(input: AvatarGenInput): Promise<string> {
  const image = await fetchImageAsInline(input.imageUrl);
  const payload = {
    instances: [
      {
        prompt:
          "A realistic talking-head video of the person in the image speaking naturally with matching lip-sync",
        image,
      },
    ],
    parameters: { aspectRatio: "9:16" },
  };
  const opName = await submit(payload);
  const uri = await pollOp(opName);
  return withKey(uri);
}
