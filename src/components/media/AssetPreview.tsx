"use client";

import { useMediaStore } from "@/stores/mediaStore";
import { Loader2 } from "lucide-react";

export function AssetPreview() {
  const asset = useMediaStore((s) => s.selectedAsset);

  if (!asset) {
    return (
      <div className="flex items-center justify-center h-full text-white/30 text-sm">
        Select or generate an asset to preview
      </div>
    );
  }

  if (asset.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/50 text-sm">
        <Loader2 className="w-6 h-6 animate-spin text-surya-500" />
        Generating {asset.assetType}…
      </div>
    );
  }

  if (asset.status === "failed") {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        Generation failed
      </div>
    );
  }

  const src = `/api/media/file?id=${asset.id}`;
  if (asset.assetType === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={asset.prompt} className="max-w-full max-h-full object-contain rounded-lg" />;
  }
  if (asset.assetType === "video" || asset.assetType === "avatar" || asset.assetType === "film") {
    return (
      <video src={src} controls className="max-w-full max-h-full rounded-lg" />
    );
  }
  if (asset.assetType === "audio") {
    return (
      <div className="w-full max-w-md">
        <p className="text-xs text-white/60 mb-2">{asset.prompt}</p>
        <audio src={src} controls className="w-full" />
      </div>
    );
  }
  return null;
}
