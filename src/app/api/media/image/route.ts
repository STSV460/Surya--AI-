export const runtime = "edge";

import { auth } from "@/auth";
import { MODEL_MAP } from "@/lib/ai/client";
import { uploadBase64ToBucket, uploadUrlToBucket } from "@/lib/media/storage";
import { createAsset } from "@/lib/media/assets";
import { aiLimiter } from "@/lib/rate-limit";

export const maxDuration = 300;

interface ImageOut {
  type?: string;
  imageUrl?: string;
  url?: string;
  b64Json?: string;
  b64_json?: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  // Rate limiting
  const { success } = await aiLimiter.check(session.user.id);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please wait before generating another image." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const prompt = body.prompt;
  if (!prompt) return Response.json({ error: "prompt is required" }, { status: 400 });

  const userId = session.user.id;
  try {
    const model =
      process.env.IMAGE_GEN_MODEL ?? MODEL_MAP.gemini ?? "google/gemini-3-pro-image-preview";

    const baseUrl = process.env.INSFORGE_BASE_URL!;
    const apiKey = process.env.INSFORGE_API_KEY!;
    const upstream = await fetch(`${baseUrl}/api/ai/image/generation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, prompt }),
      signal: AbortSignal.timeout(240_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      throw new Error(`InsForge image gen ${upstream.status}: ${text.slice(0, 300)}`);
    }
    const response = (await upstream.json()) as { images?: ImageOut[] };

    let storageUrl: string | null = null;
    for (const img of response.images ?? []) {
      const url = img.imageUrl ?? img.url;
      if (url?.startsWith("data:")) {
        const m = url.match(/^data:([^;]+);base64,(.+)$/);
        if (m) {
          storageUrl = await uploadBase64ToBucket(userId, "image", m[2], m[1]);
          break;
        }
      } else if (url?.startsWith("http")) {
        storageUrl = await uploadUrlToBucket(userId, "image", url);
        break;
      } else if (img.b64Json || img.b64_json) {
        storageUrl = await uploadBase64ToBucket(
          userId,
          "image",
          (img.b64Json ?? img.b64_json)!,
          "image/png",
        );
        break;
      }
    }

    if (!storageUrl) {
      return Response.json(
        { error: "Image generation returned no image", raw: response },
        { status: 502 },
      );
    }

    const asset = await createAsset({
      userId,
      assetType: "image",
      prompt,
      provider: `insforge/${model}`,
      storageUrl,
      status: "done",
    });

    return Response.json({ asset });
  } catch (err) {
    console.error("[media/image] failed:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}