
import { auth } from "@/auth";
import { aiClient } from "@/lib/ai/client";
import { createClient } from "@insforge/sdk";
import { aiLimiter } from "@/lib/rate-limit";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

// Gemini 3 Pro Image can take 30-60s. Default 10s would always timeout.
// Vercel Hobby plan caps at 60s for non-streaming routes.
export const maxDuration = 60;

// Lazy-initialize image gen client (may use a separate InsForge instance)
let _imageGenClient: ReturnType<typeof createClient>["ai"] | null = null;

const imageGenSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
});

function getImageGenClient() {
  if (_imageGenClient) return _imageGenClient;

  const baseUrl = process.env.IMAGE_GEN_API_URL;
  const apiKey = process.env.IMAGE_GEN_API_KEY;
  const anonKey = process.env.IMAGE_GEN_ANON_KEY ?? process.env.INSFORGE_ANON_KEY!;

  if (baseUrl && apiKey) {
    const client = createClient({
      baseUrl,
      anonKey,
      headers: { Authorization: `Bearer ${apiKey}` },
      isServerMode: true,
    });
    _imageGenClient = client.ai;
  } else {
    // Fall back to main InsForge AI client
    _imageGenClient = aiClient;
  }

  return _imageGenClient;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limiting
  const { success } = await aiLimiter.check(session.user.id);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please wait before generating another image." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await parseJson(req, imageGenSchema);
  if (isResponse(body)) return body;
  const { prompt } = body;

  try {
    const imageClient = getImageGenClient();
    const model = process.env.IMAGE_GEN_MODEL ?? "google/gemini-3-pro-image-preview";

    // Use native InsForge images.generate — replaces the broken
    // chat.completions + response_modalities approach (SDK silently dropped
    // that field, leaving the model to answer text-only).
    //
    // Per InsForge SDK source: response shape is
    //   { created, data: [{ b64_json, content? }, ...] }
    // where `b64_json` is the raw base64 (data URI prefix already stripped).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await (imageClient as any).images.generate({
      model,
      prompt,
    });

    const first = response?.data?.[0];
    if (first?.b64_json) {
      return Response.json({ imageUrl: `data:image/png;base64,${first.b64_json}` });
    }
    // Some providers may also return a hosted URL directly
    if (first?.url) {
      return Response.json({ imageUrl: first.url });
    }
    // Text-only fallback (model declined or returned just commentary)
    if (first?.content) {
      return Response.json({ text: first.content });
    }

    console.warn(
      "[image-gen] empty image response, shape:",
      JSON.stringify(response).slice(0, 500)
    );
    return Response.json({
      text: "Image generation completed but no image data returned.",
    });
  } catch (err) {
    console.error("[image-gen] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      {
        error: msg,
        text: "Unable to generate image. The configured model may not support image generation.",
      },
      { status: 200 }
    );
  }
}
