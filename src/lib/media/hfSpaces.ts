/**
 * HuggingFace Spaces video gen via Gradio Client.
 *
 * Pipeline: prompt → Gemini image → Wan 2.1 fast (image-to-video).
 * Wan 2.1 fast Space requires an input image, so we auto-generate one
 * from the prompt unless caller supplied imageUrl.
 *
 * Default space: multimodalart/wan2-1-fast.
 * Override: HF_VIDEO_SPACE.
 */
import { Client, handle_file } from "@gradio/client";
import type { VideoGenInput } from "@/types/media";

const SPACE_ID = process.env.HF_VIDEO_SPACE ?? "multimodalart/wan2-1-fast";
const HF_TOKEN = process.env.HF_TOKEN as `hf_${string}` | undefined;

export async function isHfSpacesAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`https://huggingface.co/spaces/${SPACE_ID}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return r.status < 500;
  } catch {
    return false;
  }
}

interface GeminiImageOut {
  type?: string;
  imageUrl?: string;
  url?: string;
  b64Json?: string;
  b64_json?: string;
}

/**
 * Generate a starting image via InsForge Gemini for image-to-video pipeline.
 * Returns Blob (not uploaded — caller passes directly to Gradio).
 */
async function generateStartingImage(prompt: string): Promise<Blob> {
  const baseUrl = process.env.INSFORGE_BASE_URL!;
  const apiKey = process.env.INSFORGE_API_KEY!;
  const model =
    process.env.IMAGE_GEN_MODEL ?? "google/gemini-3-pro-image-preview";

  console.log(`[hfSpaces] generating starting image via ${model}`);
  const res = await fetch(`${baseUrl}/api/ai/image/generation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, prompt }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!res.ok) {
    throw new Error(
      `image gen ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as { images?: GeminiImageOut[] };
  for (const img of json.images ?? []) {
    const url = img.imageUrl ?? img.url;
    if (url?.startsWith("data:")) {
      const m = url.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        return new Blob([Buffer.from(m[2], "base64")], { type: m[1] });
      }
    } else if (url?.startsWith("http")) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`download starting image ${r.status}`);
      const buf = await r.arrayBuffer();
      return new Blob([buf], { type: "image/png" });
    } else if (img.b64Json || img.b64_json) {
      return new Blob([Buffer.from((img.b64Json ?? img.b64_json)!, "base64")], {
        type: "image/png",
      });
    }
  }
  throw new Error("Gemini returned no image for starting frame");
}

export async function generateHfSpacesVideo(
  input: VideoGenInput,
): Promise<{ blob: Blob }> {
  // Step 1: get a starting image (user-supplied or auto-gen)
  let imageBlob: Blob;
  if (input.imageUrl) {
    console.log(`[hfSpaces] using user image: ${input.imageUrl}`);
    const r = await fetch(input.imageUrl);
    if (!r.ok) throw new Error(`download user image ${r.status}`);
    imageBlob = new Blob([await r.arrayBuffer()], { type: "image/png" });
  } else {
    imageBlob = await generateStartingImage(input.prompt);
  }

  console.log(`[hfSpaces] connecting to ${SPACE_ID}`);
  const client = await Client.connect(
    SPACE_ID,
    HF_TOKEN ? { token: HF_TOKEN } : undefined,
  );

  const dims =
    input.aspectRatio === "9:16"
      ? { width: 480, height: 832 }
      : input.aspectRatio === "1:1"
        ? { width: 640, height: 640 }
        : { width: 832, height: 480 };

  const duration = Math.max(2, Math.min(input.durationSec ?? 4, 5));

  console.log(
    `[hfSpaces] submitting i2v: "${input.prompt.slice(0, 80)}" ${dims.width}x${dims.height} ${duration}s`,
  );

  const result = (await client.predict("/generate_video", [
    handle_file(imageBlob),                  // 0 image
    input.prompt,                             // 1 prompt
    dims.height,                              // 2 height
    dims.width,                               // 3 width
    "worst quality, blurry, distorted",       // 4 negative
    duration,                                 // 5 duration
    1.0,                                      // 6 guidance
    4,                                        // 7 steps (fast)
    0,                                        // 8 seed
    true,                                     // 9 randomize
  ])) as { data: unknown[] };

  const out = result.data?.[0] as
    | { video?: { url?: string; path?: string }; url?: string; path?: string }
    | string
    | null;

  const videoObj =
    typeof out === "object" && out !== null ? (out.video ?? out) : null;
  const url =
    typeof out === "string"
      ? out
      : videoObj?.url ??
        (videoObj?.path
          ? `https://${SPACE_ID.replace("/", "-").toLowerCase()}.hf.space/file=${videoObj.path}`
          : null);

  if (!url) {
    throw new Error(
      `hfSpaces: no video URL: ${JSON.stringify(result.data).slice(0, 300)}`,
    );
  }

  console.log(`[hfSpaces] downloading mp4: ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`hfSpaces download ${res.status}`);
  const arr = await res.arrayBuffer();
  console.log(`[hfSpaces] downloaded ${arr.byteLength} bytes`);
  return { blob: new Blob([arr], { type: "video/mp4" }) };
}
