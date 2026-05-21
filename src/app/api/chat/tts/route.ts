import { auth } from "@/auth";
import { synthesizeElevenLabs } from "@/lib/media/elevenlabs";
import { synthesizeSarvam } from "@/lib/media/sarvam";
import { DEFAULT_VOICES, pickVoice, routeAudioProvider } from "@/lib/media/router";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  language: z.string().trim().min(2).max(40).default("en"),
  voiceId: z.string().trim().max(120).optional(),
});

function isQuotaError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("quota_exceeded") ||
    m.includes("quota exceeded") ||
    m.includes("credits remaining") ||
    m.includes("rate_limit") ||
    m.includes("too_many_requests")
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const body = await parseJson(req, ttsSchema);
  if (isResponse(body)) return body;

  const provider = routeAudioProvider(body.language);
  const voiceId = pickVoice(provider, body.voiceId);

  try {
    let blob: Blob;
    let contentType: string;

    if (provider === "sarvam") {
      ({ blob } = await synthesizeSarvam(body.text, body.language, voiceId));
      contentType = blob.type || "audio/wav";
    } else {
      try {
        ({ blob } = await synthesizeElevenLabs(body.text, voiceId));
        contentType = blob.type || "audio/mpeg";
      } catch (err) {
        // Auto-fallback to Sarvam on ElevenLabs quota/rate-limit errors.
        if (isQuotaError(err) && process.env.SARVAM_API_KEY) {
          console.warn("[tts] ElevenLabs quota exhausted, falling back to Sarvam");
          ({ blob } = await synthesizeSarvam(
            body.text,
            body.language,
            DEFAULT_VOICES.sarvam
          ));
          contentType = blob.type || "audio/wav";
        } else {
          throw err;
        }
      }
    }

    return new Response(blob, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "TTS failed";
    const status = isQuotaError(err) ? 429 : 500;
    return Response.json({ error: message, code: isQuotaError(err) ? "quota_exceeded" : "tts_failed" }, { status });
  }
}
