
import { auth } from "@/auth";
import { synthesizeElevenLabs } from "@/lib/media/elevenlabs";
import { synthesizeSarvam } from "@/lib/media/sarvam";
import { routeAudioProvider, pickVoice } from "@/lib/media/router";
import { uploadBlobToBucket } from "@/lib/media/storage";
import { createAsset } from "@/lib/media/assets";
import { parseJson, isResponse } from "@/lib/validation";
import { z } from "zod";
import type { AudioGenInput } from "@/types/media";

const audioSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  language: z.string().trim().min(2).max(40),
  voiceId: z.string().trim().max(120).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const body = await parseJson(req, audioSchema);
  if (isResponse(body)) return body;
  const input: AudioGenInput = body;

  const userId = session.user.id;
  const provider = routeAudioProvider(input.language);
  const voiceId = pickVoice(provider, input.voiceId);

  try {
    const { blob } =
      provider === "sarvam"
        ? await synthesizeSarvam(input.text, input.language, voiceId)
        : await synthesizeElevenLabs(input.text, voiceId);

    const storageUrl = await uploadBlobToBucket(userId, "audio", blob);
    const asset = await createAsset({
      userId,
      assetType: "audio",
      prompt: input.text,
      provider,
      language: input.language,
      storageUrl,
      status: "done",
      metadata: { voiceId },
    });
    return Response.json({ asset });
  } catch (err) {
    console.error("[media/audio] failed:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
