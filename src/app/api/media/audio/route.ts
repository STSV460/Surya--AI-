export const runtime = "edge";

import { auth } from "@/auth";
import { synthesizeElevenLabs } from "@/lib/media/elevenlabs";
import { synthesizeSarvam } from "@/lib/media/sarvam";
import { routeAudioProvider, pickVoice } from "@/lib/media/router";
import { uploadBlobToBucket } from "@/lib/media/storage";
import { createAsset } from "@/lib/media/assets";
import type { AudioGenInput } from "@/types/media";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  let body: AudioGenInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.text || !body.language) {
    return Response.json({ error: "text and language required" }, { status: 400 });
  }

  const userId = session.user.id;
  const provider = routeAudioProvider(body.language);
  const voiceId = pickVoice(provider, body.voiceId);

  try {
    const { blob } =
      provider === "sarvam"
        ? await synthesizeSarvam(body.text, body.language, voiceId)
        : await synthesizeElevenLabs(body.text, voiceId);

    const storageUrl = await uploadBlobToBucket(userId, "audio", blob);
    const asset = await createAsset({
      userId,
      assetType: "audio",
      prompt: body.text,
      provider,
      language: body.language,
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