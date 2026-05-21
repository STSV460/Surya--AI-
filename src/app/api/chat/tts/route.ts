import { auth } from "@/auth";
import { synthesizeElevenLabs } from "@/lib/media/elevenlabs";
import { synthesizeSarvam } from "@/lib/media/sarvam";
import { pickVoice, routeAudioProvider } from "@/lib/media/router";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  language: z.string().trim().min(2).max(40).default("en"),
  voiceId: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const body = await parseJson(req, ttsSchema);
  if (isResponse(body)) return body;

  const provider = routeAudioProvider(body.language);
  const voiceId = pickVoice(provider, body.voiceId);

  try {
    const { blob } =
      provider === "sarvam"
        ? await synthesizeSarvam(body.text, body.language, voiceId)
        : await synthesizeElevenLabs(body.text, voiceId);

    return new Response(blob, {
      headers: {
        "Content-Type": blob.type || (provider === "sarvam" ? "audio/wav" : "audio/mpeg"),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
