
import { auth } from "@/auth";
import { MODEL_MAP } from "@/lib/ai/client";
import { extractBrain, getBrainSummary } from "@/lib/brain";
import { uploadBase64ToBucket, uploadUrlToBucket } from "@/lib/media/storage";
import { createAsset } from "@/lib/media/assets";
import { aiLimiter } from "@/lib/rate-limit";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

export const maxDuration = 300;

interface ImageOut {
  type?: string;
  imageUrl?: string;
  url?: string;
  b64Json?: string;
  b64_json?: string;
}

const imageSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
});

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

  const body = await parseJson(req, imageSchema);
  if (isResponse(body)) return body;
  const { prompt } = body;

  const userId = session.user.id;
  try {
    const model =
      process.env.IMAGE_GEN_MODEL ?? MODEL_MAP.gemini ?? "google/gemini-3-pro-image-preview";
    const brain = await getBrainSummary(userId, "media").catch(() => "");
    const effectivePrompt = brain ? `${brain}\n\nImage prompt:\n${prompt}` : prompt;

    const baseUrl = process.env.INSFORGE_BASE_URL!;
    const apiKey = process.env.INSFORGE_API_KEY!;
    const upstream = await fetch(`${baseUrl}/api/ai/image/generation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, prompt: effectivePrompt }),
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
    void extractBrain({
      userId,
      surface: "media",
      userMessage: prompt,
      assistantMessage: "Generated image asset",
    }).catch((err) => console.warn("[media/image] brain extract failed:", err));

    return Response.json({ asset });
  } catch (err) {
    console.error("[media/image] failed:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
