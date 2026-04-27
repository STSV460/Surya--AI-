"use client";

import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { useMediaStore } from "@/stores/mediaStore";
import type { MediaAsset } from "@/types/media";

export function ImageTab() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const addAsset = useMediaStore((s) => s.addAsset);
  const setSelected = useMediaStore((s) => s.setSelectedAsset);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/media/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Image gen failed");
      const asset = data.asset as MediaAsset;
      addAsset(asset);
      setSelected(asset);
    } catch (err) {
      alert(`Image gen failed: ${err}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-white/60 mb-1 block">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A photorealistic portrait of an astronaut on Mars, golden hour"
          rows={5}
          className="w-full px-3 py-2 bg-surface-2 border border-white/8 rounded-lg text-sm text-white placeholder:text-white/30 outline-none focus:border-surya-500/50"
        />
      </div>
      <p className="text-[11px] text-white/40">Powered by Gemini 3.1 Pro Preview via InsForge.</p>
      <button
        onClick={handleGenerate}
        disabled={busy || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surya-500 hover:bg-surya-500/90 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 size={15} />}
        Generate Image
      </button>
    </div>
  );
}
