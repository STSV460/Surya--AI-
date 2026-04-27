"use client";

import { useEffect, useState } from "react";
import { Film, ImageIcon, Music, User, Clapperboard, Loader2, Trash2, LayoutGrid, type LucideIcon } from "lucide-react";
import { useMediaStore } from "@/stores/mediaStore";
import type { MediaAsset, MediaAssetType } from "@/types/media";
import { cn } from "@/lib/utils";

const ICONS: Record<MediaAssetType, LucideIcon> = {
  video: Film,
  image: ImageIcon,
  audio: Music,
  avatar: User,
  film: Clapperboard,
};

type Folder = "all" | MediaAssetType;

const FOLDERS: { id: Folder; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "video", label: "Videos", icon: Film },
  { id: "image", label: "Images", icon: ImageIcon },
  { id: "audio", label: "Audio", icon: Music },
];

export function AssetLibrary() {
  const assets = useMediaStore((s) => s.assets);
  const selected = useMediaStore((s) => s.selectedAsset);
  const setAssets = useMediaStore((s) => s.setAssets);
  const setSelected = useMediaStore((s) => s.setSelectedAsset);
  const removeAsset = useMediaStore((s) => s.removeAsset);
  const [folder, setFolder] = useState<Folder>("all");

  useEffect(() => {
    fetch("/api/media/assets")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.assets && setAssets(data.assets))
      .catch(() => {});
  }, [setAssets]);

  async function handleDelete(asset: MediaAsset, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this asset?")) return;
    const res = await fetch(`/api/media/assets?id=${asset.id}`, { method: "DELETE" });
    if (res.ok) removeAsset(asset.id);
  }

  const filtered = folder === "all" ? assets : assets.filter((a) => a.assetType === folder);
  const counts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.assetType] = (acc[a.assetType] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-wrap gap-1 px-2 pt-2 pb-1 border-b border-white/6">
        {FOLDERS.map((f) => {
          const Icon = f.icon;
          const active = folder === f.id;
          const count = f.id === "all" ? assets.length : (counts[f.id] ?? 0);
          return (
            <button
              key={f.id}
              onClick={() => setFolder(f.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
                active
                  ? "bg-surya-500/15 text-surya-500"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={11} />
              {f.label}
              <span className="text-[9px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-white/30 px-3 py-4">
          No {folder === "all" ? "assets" : folder + "s"} yet.
        </p>
      ) : (
    <div className="grid grid-cols-2 gap-2 p-2 overflow-y-auto">
      {filtered.map((a) => {
        const Icon = ICONS[a.assetType];
        const isSelected = selected?.id === a.id;
        return (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(a)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(a)}
            className={cn(
              "group relative aspect-square rounded-lg overflow-hidden border text-left transition-colors cursor-pointer",
              isSelected
                ? "border-surya-500"
                : "border-white/8 hover:border-white/20",
              "bg-surface-2"
            )}
          >
            {a.status === "done" && a.assetType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/media/file?id=${a.id}`} alt="" className="w-full h-full object-cover" />
            ) : a.status === "done" && (a.assetType === "video" || a.assetType === "film" || a.assetType === "avatar") ? (
              <video src={`/api/media/file?id=${a.id}`} className="w-full h-full object-cover" muted />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                {a.status === "pending" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-6 h-6" />
                )}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-[10px] text-white/80 truncate">{a.prompt || a.assetType}</p>
            </div>
            <button
              onClick={(e) => handleDelete(a, e)}
              className="absolute top-1 right-1 p-1 rounded bg-black/60 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
              aria-label="Delete"
            >
              <Trash2 size={11} className="text-white" />
            </button>
          </div>
        );
      })}
    </div>
      )}
    </div>
  );
}
