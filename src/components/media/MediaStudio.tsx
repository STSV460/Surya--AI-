"use client";

import { Film, ImageIcon, Music, Library, type LucideIcon } from "lucide-react";
import { useMediaStore } from "@/stores/mediaStore";
import type { MediaTab } from "@/types/media";
import { cn } from "@/lib/utils";
import { VideoTab } from "./tabs/VideoTab";
import { ImageTab } from "./tabs/ImageTab";
import { AudioTab } from "./tabs/AudioTab";
import { AssetLibrary } from "./AssetLibrary";
import { AssetPreview } from "./AssetPreview";
import { JobStatus } from "./JobStatus";

const TABS: { id: MediaTab; label: string; icon: LucideIcon }[] = [
  { id: "video", label: "Video", icon: Film },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "audio", label: "Audio", icon: Music },
  { id: "library", label: "Library", icon: Library },
];

export function MediaStudio() {
  const activeTab = useMediaStore((s) => s.activeTab);
  const setActiveTab = useMediaStore((s) => s.setActiveTab);

  return (
    <div className="flex h-full bg-background">
      {/* Tab rail */}
      <nav className="w-16 shrink-0 border-r border-white/6 bg-surface-1 flex flex-col items-center py-3 gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors",
                active
                  ? "bg-surya-500/15 text-surya-500"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
              aria-label={t.label}
            >
              <Icon size={16} />
              <span className="text-[9px] font-medium tracking-wide">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Control panel */}
      <div className="w-[340px] shrink-0 border-r border-white/6 bg-surface-1/40 flex flex-col">
        <div className="px-4 py-3 border-b border-white/6">
          <h2 className="text-sm font-semibold text-white capitalize">{activeTab}</h2>
          <p className="text-[11px] text-white/40 mt-0.5">Surya Media Studio</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "video" && <VideoTab />}
          {activeTab === "image" && <ImageTab />}
          {activeTab === "audio" && <AudioTab />}
          {activeTab === "library" && <AssetLibrary />}
        </div>
      </div>

      {/* Preview pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
          <AssetPreview />
        </div>
        {activeTab !== "library" && (
          <div className="border-t border-white/6 max-h-[40%] overflow-hidden flex flex-col">
            <p className="text-[10px] uppercase tracking-wider text-white/40 px-3 pt-2">Recent</p>
            <AssetLibrary />
          </div>
        )}
      </div>

      <JobStatus />
    </div>
  );
}
