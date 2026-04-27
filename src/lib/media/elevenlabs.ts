/**
 * ElevenLabs TTS — international languages.
 */
const KEY = process.env.ELEVENLABS_API_KEY;
const BASE = "https://api.elevenlabs.io/v1";
const MODEL = process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";

export async function synthesizeElevenLabs(
  text: string,
  voiceId: string
): Promise<{ blob: Blob }> {
  if (!KEY) throw new Error("ELEVENLABS_API_KEY not set");
  const res = await fetch(`${BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    throw new Error(`elevenlabs failed: ${res.status} ${await res.text()}`);
  }
  const arr = await res.arrayBuffer();
  return { blob: new Blob([arr], { type: "audio/mpeg" }) };
}
