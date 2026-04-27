export const runtime = "edge";

import { auth } from "@/auth";
import { aiClient, MODEL_MAP } from "@/lib/ai/client";
import { createClient } from "@insforge/sdk";
import { aiLimiter } from "@/lib/rate-limit";

// Lazy-initialize image gen client (may use a separate InsForge instance)
let _imageGenClient: ReturnType<typeof createClient>["ai"] | null = null;

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

  let body: { prompt?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = body.prompt;
  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const imageClient = getImageGenClient();
    const model = process.env.IMAGE_GEN_MODEL ?? MODEL_MAP.gemini;

    // Gemini image generation via InsForge gateway
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (imageClient.chat.completions.create as any)({
      model,
      messages: [
        {
          role: "user",
          content: `Generate an image of: ${prompt}`,
        },
      ],
      response_modalities: ["IMAGE", "TEXT"],
    });

    const content = response.choices?.[0]?.message?.content;

    // Gemini returns content as an array of parts
    if (Array.isArray(content)) {
      for (const part of content) {
        // Inline base64 image
        if (part?.inline_data?.data && part?.inline_data?.mime_type) {
          const dataUrl = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
          return Response.json({ imageUrl: dataUrl });
        }
        // Image URL part
        if (part?.image_url?.url) {
          return Response.json({ imageUrl: part.image_url.url });
        }
      }
      // Array but no image — extract text
      const textPart = content.find(
        (p: { type?: string; text?: string }) => p?.text
      );
      return Response.json({
        text: textPart?.text ?? "Image generation completed without an image.",
      });
    }

    // String response — return as text
    if (typeof content === "string") {
      return Response.json({ text: content });
    }

    return Response.json({
      text: "Image generation is not supported by the current model configuration.",
    });
  } catch (err) {
    console.error("[image-gen] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    // Return 200 with error text so the AI can explain it gracefully in the chat
    return Response.json(
      {
        error: msg,
        text: "Unable to generate image. The configured model may not support image generation.",
      },
      { status: 200 }
    );
  }
}