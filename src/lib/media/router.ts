import type { VoiceProvider } from "@/types/media";

const INDIC_LANGS = new Set([
  "hi", "ta", "te", "kn", "ml", "mr", "bn", "gu", "pa", "or", "as",
]);

export function routeAudioProvider(language: string): VoiceProvider {
  const code = (language || "en").toLowerCase().slice(0, 2);
  return INDIC_LANGS.has(code) ? "sarvam" : "elevenlabs";
}

export const DEFAULT_VOICES: Record<VoiceProvider, string> = {
  elevenlabs: "JBFqnCBsd6RMkjVDRZzb",
  sarvam: "anushka",
};

export function pickVoice(provider: VoiceProvider, requested?: string): string {
  return requested || DEFAULT_VOICES[provider];
}
