/**
 * Sarvam AI TTS — Indian languages (Hindi, Tamil, Telugu, Kannada, Malayalam,
 * Marathi, Bengali, Gujarati, Punjabi, Odia, Assamese).
 */
const KEY = process.env.SARVAM_API_KEY;
const BASE = "https://api.sarvam.ai";
const MODEL = process.env.SARVAM_MODEL ?? "bulbul:v2";

const LANG_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN",
  mr: "mr-IN", bn: "bn-IN", gu: "gu-IN", pa: "pa-IN", or: "od-IN", as: "as-IN",
};

export async function synthesizeSarvam(
  text: string,
  language: string,
  voiceId: string
): Promise<{ blob: Blob }> {
  if (!KEY) throw new Error("SARVAM_API_KEY not set");
  const code = language.toLowerCase().slice(0, 2);
  const targetLang = LANG_MAP[code] ?? "en-IN";

  const res = await fetch(`${BASE}/text-to-speech`, {
    method: "POST",
    headers: {
      "api-subscription-key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: targetLang,
      speaker: voiceId,
      model: MODEL,
    }),
  });
  if (!res.ok) throw new Error(`sarvam failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { audios?: string[] };
  const b64 = data.audios?.[0];
  if (!b64) throw new Error("sarvam returned no audio");
  const buf = Buffer.from(b64, "base64");
  return { blob: new Blob([buf], { type: "audio/wav" }) };
}
