"use client";

import { useState } from "react";
import { Wand2, Upload, Loader2 } from "lucide-react";
import { useMediaStore } from "@/stores/mediaStore";
import { uploadFile } from "../lib/uploadFile";
import type { MediaAsset, VideoGenInput } from "@/types/media";

const ASPECTS: VideoGenInput["aspectRatio"][] = ["16:9", "9:16", "1:1"];

export function VideoTab() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [aspect, setAspect] = useState<VideoGenInput["aspectRatio"]>("16:9");
  const [refImage, setRefImage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const addAsset = useMediaStore((s) => s.addAsset);
  const trackJob = useMediaStore((s) => s.trackJob);
  const setSelected = useMediaStore((s) => s.setSelectedAsset);

  async function handleUpload(file: File) {
    setBusy(true);
    try {
      const url = await uploadFile(file, "ref");
      setRefImage(url);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/media/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          durationSec: duration,
          aspectRatio: aspect,
          imageUrl: refImage || undefined,
          mode: refImage ? "i2v" : "t2v",
        } satisfies VideoGenInput),
      });
      if (!res.ok) throw new Error(await res.text());
      const { assetId } = (await res.json()) as { assetId: string };
      const lookup = await fetch(`/api/media/assets?id=${assetId}`).then((r) => r.json());
      const asset = lookup.asset as MediaAsset;
      addAsset(asset);
      trackJob(assetId);
      setSelected(asset);
    } catch (err) {
      alert(`Video gen failed: ${err}`);
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
          placeholder="A cinematic shot of a tiger walking through a misty forest at dawn"
          rows={4}
          className="w-full px-3 py-2 bg-surface-2 border border-white/8 rounded-lg text-sm text-white placeholder:text-white/30 outline-none focus:border-surya-500/50"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-white/60 mb-1 block">Duration (sec)</label>
          <input
            type="number"
            min={2}
            max={10}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-3 py-2 bg-surface-2 border border-white/8 rounded-lg text-sm text-white outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-white/60 mb-1 block">Aspect</label>
          <select
            value={aspect}
            onChange={(e) => setAspect(e.target.value as VideoGenInput["aspectRatio"])}
            className="w-full px-3 py-2 bg-surface-2 border border-white/8 rounded-lg text-sm text-white outline-none"
          >
            {ASPECTS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-white/60 mb-1 block">Reference image (optional, image-to-video)</label>
        <label className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-dashed border-white/15 rounded-lg text-sm text-white/60 cursor-pointer hover:border-surya-500/40">
          <Upload size={14} />
          {refImage ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
        </label>
        {refImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={refImage} alt="" className="mt-2 max-h-32 rounded-lg border border-white/8" />
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={busy || !prompt.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surya-500 hover:bg-surya-500/90 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 size={15} />}
        Generate Video
      </button>
    </div>
  );
}
