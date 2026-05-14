"use client";


import { useCallback, useRef, useState } from "react";
import { useAppBuilder } from "@/hooks/useAppBuilder";
import { AppBuilderChatPanel } from "@/components/app-builder/AppBuilderChatPanel";
import { AppBuilderBuildPanel } from "@/components/app-builder/AppBuilderBuildPanel";
import { AppBuilderGallery } from "@/components/app-builder/AppBuilderGallery";
import { ArrowLeft } from "lucide-react";

export default function AppBuilderPage() {
  const hook = useAppBuilder();
  const [chatWidthPct, setChatWidthPct] = useState(37);
  const [forceGallery, setForceGallery] = useState(false);
  const [forceChat, setForceChat] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Derived view: chat if project active OR user clicked New; gallery otherwise.
  const view: "gallery" | "chat" = forceGallery
    ? "gallery"
    : forceChat || hook.projectId || hook.messages.length > 0
    ? "chat"
    : "gallery";

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMove = (mv: PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((mv.clientX - rect.left) / rect.width) * 100;
      setChatWidthPct(Math.min(65, Math.max(25, pct)));
    };

    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const handleBackToGallery = () => {
    hook.newProject();
    setForceChat(false);
    setForceGallery(true);
  };

  if (view === "gallery") {
    return (
      <AppBuilderGallery
        hook={hook}
        onStartNew={() => {
          setForceGallery(false);
          setForceChat(true);
        }}
        onOpen={(id) => {
          hook.openProject(id);
          setForceGallery(false);
          setForceChat(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      {/* Project header */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-white/5 bg-surface-1 flex-shrink-0">
        <button
          onClick={handleBackToGallery}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={11} />
          Projects
        </button>
        {hook.projectName && (
          <>
            <span className="text-gray-600 text-xs">/</span>
            <span className="text-xs text-gray-200 truncate">{hook.projectName}</span>
          </>
        )}
      </div>

      <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
        <div style={{ width: `${chatWidthPct}%` }} className="flex-shrink-0 overflow-hidden">
          <AppBuilderChatPanel {...hook} />
        </div>

        <div
          onPointerDown={startDrag}
          className="w-1 flex-shrink-0 bg-surface-2 hover:bg-surya-500/40 cursor-col-resize transition-colors"
        />

        <div className="flex-1 min-w-0 overflow-hidden">
          <AppBuilderBuildPanel {...hook} />
        </div>
      </div>
    </div>
  );
}