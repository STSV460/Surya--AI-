/**
 * Kling AI video generation (text2video / image2video).
 *
 * Auth: JWT (HS256) signed with KLING_SECRET_KEY, iss=KLING_ACCESS_KEY.
 * Docs: https://kling.ai/document-api/quickStart/productIntroduction/overview
 *
 * Env:
 *   KLING_ACCESS_KEY   (required)
 *   KLING_SECRET_KEY   (required)
 *   KLING_BASE_URL     default https://api-singapore.klingai.com
 *   KLING_MODEL        default kling-v2-master (override for 3.0 if needed)
 *   KLING_MODE         std | pro (default std)
 */
import type { VideoGenInput } from "@/types/media";

const BASE_URL = process.env.KLING_BASE_URL ?? "https://api-singapore.klingai.com";
const MODEL = process.env.KLING_MODEL ?? "kling-v2-master";
const MODE = (process.env.KLING_MODE ?? "std") as "std" | "pro";

export function isKlingAvailable(): boolean {
  return !!(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY);
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signJwt(): Promise<string> {
  const ak = process.env.KLING_ACCESS_KEY!;
  const sk = process.env.KLING_SECRET_KEY!;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { iss: ak, exp: now + 1800, nbf: now - 5 };
  const enc = new TextEncoder();
  const h = b64url(enc.encode(JSON.stringify(header)));
  const p = b64url(enc.encode(JSON.stringify(payload)));
  const data = `${h}.${p}`;
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(sk),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

interface KlingTaskResp {
  code: number;
  message?: string;
  data?: {
    task_id: string;
    task_status: "submitted" | "processing" | "succeed" | "failed";
    task_status_msg?: string;
    task_result?: {
      videos?: { id: string; url: string; duration: string }[];
    };
  };
}

async function klingFetch(path: string, init?: RequestInit): Promise<KlingTaskResp> {
  const token = await signJwt();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const txt = await res.text();
  let json: KlingTaskResp;
  try {
    json = JSON.parse(txt) as KlingTaskResp;
  } catch {
    throw new Error(`Kling ${path} ${res.status}: ${txt.slice(0, 300)}`);
  }
  if (!res.ok || json.code !== 0) {
    throw new Error(`Kling ${path} ${res.status} code=${json.code}: ${json.message ?? txt.slice(0, 200)}`);
  }
  return json;
}

async function imageToBase64(url: string): Promise<string> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:[^;]+;base64,(.+)$/);
    if (m) return m[1];
  }
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`fetch ref image ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

export async function generateKlingVideo(input: VideoGenInput): Promise<{ blob: Blob }> {
  const duration = (input.durationSec ?? 5) >= 8 ? "10" : "5";
  const aspect = input.aspectRatio ?? "16:9";
  const isI2V = !!input.imageUrl;

  const path = isI2V ? "/v1/videos/image2video" : "/v1/videos/text2video";
  const body: Record<string, unknown> = {
    model_name: MODEL,
    prompt: input.prompt,
    duration,
    mode: MODE,
    cfg_scale: 0.5,
  };
  if (isI2V) {
    body.image = await imageToBase64(input.imageUrl!);
  } else {
    body.aspect_ratio = aspect;
  }

  console.log(`[kling] submit ${path} model=${MODEL} mode=${MODE} dur=${duration}s i2v=${isI2V}`);
  const submitted = await klingFetch(path, { method: "POST", body: JSON.stringify(body) });
  const taskId = submitted.data?.task_id;
  if (!taskId) throw new Error(`Kling: missing task_id: ${JSON.stringify(submitted).slice(0, 200)}`);

  const deadline = Date.now() + 12 * 60_000;
  let videoUrl: string | undefined;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 6000));
    const poll = await klingFetch(`${path}/${taskId}`, { method: "GET" });
    const status = poll.data?.task_status;
    if (status === "succeed") {
      videoUrl = poll.data?.task_result?.videos?.[0]?.url;
      break;
    }
    if (status === "failed") {
      throw new Error(`Kling task failed: ${poll.data?.task_status_msg ?? "unknown"}`);
    }
    console.log(`[kling] task ${taskId} status=${status}`);
  }
  if (!videoUrl) throw new Error("Kling: timeout waiting for video");

  console.log(`[kling] downloading ${videoUrl}`);
  const dl = await fetch(videoUrl, { signal: AbortSignal.timeout(180_000) });
  if (!dl.ok) throw new Error(`Kling download ${dl.status}`);
  const arr = await dl.arrayBuffer();
  return { blob: new Blob([arr], { type: "video/mp4" }) };
}
