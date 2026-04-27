"use client";

import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { useMediaStore } from "@/stores/mediaStore";
import { routeAudioProvider } from "@/lib/media/router";
import type { MediaAsset } from "@/types/media";
import { TransliterationInput } from "../TransliterationInput";

const LANGUAGES = [
  { code: "en", label: "English (ElevenLabs)" },
  { code: "es", label: "Spanish (ElevenLabs)" },
  { code: "fr", label: "French (ElevenLabs)" },
  { code: "de", label: "German (ElevenLabs)" },
  { code: "ja", label: "Japanese (ElevenLabs)" },
  { code: "zh", label: "Chinese (ElevenLabs)" },
  { code: "hi", label: "हिन्दी Hindi (Sarvam)" },
  { code: "ta", label: "தமிழ் Tamil (Sarvam)" },
  { code: "te", label: "తెలుగు Telugu (Sarvam)" },
  { code: "kn", label: "ಕನ್ನಡ Kannada (Sarvam)" },
  { code: "ml", label: "മലയാളം Malayalam (Sarvam)" },
  { code: "mr", label: "मराठी Marathi (Sarvam)" },
  { code: "bn", label: "বাংলা Bengali (Sarvam)" },
  { code: "gu", label: "ગુજરાતી Gujarati (Sarvam)" },
  { code: "pa", label: "ਪੰਜਾਬੀ Punjabi (Sarvam)" },
];

export function AudioTab() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const addAsset = useMediaStore((s) => s.addAsset);
  const setSelected = useMediaStore((s) => s.setSelectedAsset);

  const provider = routeAudioProvider(language);

  async function handleGenerate() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/media/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Audio gen failed");
      const asset = data.asset as MediaAsset;
      addAsset(asset);
      setSelected(asset);
    } catch (err) {
      alert(`Audio gen failed: ${err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-white/60 mb-1 block">Text</label>
        <TransliterationInput
          value={text}
          onChange={setText}
          language={language}
          placeholder="The text you want to convert to speech"
          rows={5}
        />
      </div>
      <div>
        <label className="text-xs text-white/60 mb-1 block">Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full px-3 py-2 bg-surface-2 border border-white/8 rounded-lg text-sm text-white outline-none"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
        <p className="text-[11px] text-white/40 mt-1">Routing → <span className="text-surya-500">{provider}</span></p>
      </div>
      <button
        onClick={handleGenerate}
        disabled={busy || !text.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surya-500 hover:bg-surya-500/90 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 size={15} />}
        Generate Audio
      </button>
    </div>
  );
}
