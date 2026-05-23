"use client";


import { useCallback, useEffect, useRef, useState } from "react";
import { useAppBuilder } from "@/hooks/useAppBuilder";
import { AppBuilderChatPanel } from "@/components/app-builder/AppBuilderChatPanel";
import { AppBuilderBuildPanel } from "@/components/app-builder/AppBuilderBuildPanel";
import { AppBuilderGallery } from "@/components/app-builder/AppBuilderGallery";
import { ArrowLeft, Bot, Brain, ChevronDown, GitBranch, History, Monitor, Plus, Server, Settings, SlidersHorizontal, Wrench, Zap } from "lucide-react";

export default function AppBuilderPage() {
  const hook = useAppBuilder();
  const [chatWidthPct, setChatWidthPct] = useState(31);
  const [forceGallery, setForceGallery] = useState(false);
  const [, setForceChat] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    hook.loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surya Code home is the default. Gallery remains reachable only as legacy project picker.
  const view: "gallery" | "chat" = forceGallery ? "gallery" : "chat";

  const startDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMove = (mv: PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((mv.clientX - rect.left) / rect.width) * 100;
      setChatWidthPct(Math.min(54, Math.max(24, pct)));
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
    <div className="flex flex-col h-full overflow-hidden select-none bg-[#0b1220] text-[#dbeafe]">
      {/* Project header */}
      <div className="flex items-center gap-2 px-3 h-10 border-b border-[#23314d] bg-[#111827] flex-shrink-0">
        <button
          onClick={handleBackToGallery}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#94a3b8] hover:text-[#e5edf8] hover:bg-[#1e3a5f] transition-colors"
        >
          <ArrowLeft size={11} />
          Projects
        </button>
        {hook.projectName && (
          <>
            <span className="text-[#64748b] text-xs">/</span>
            <span className="text-xs text-[#dbeafe] truncate">{hook.projectName}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[#94a3b8]">
          <span className="inline-flex items-center gap-1 rounded-md bg-[#172033] px-2 py-1 border border-[#23314d]">
            <Monitor size={11} /> Local
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-[#172033] px-2 py-1 border border-[#23314d]">
            <Server size={11} /> surya-ai
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-[#172033] px-2 py-1 border border-[#23314d]">
            <GitBranch size={11} /> worktree
          </span>
        </div>
      </div>

      <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden bg-[#0b1220]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[#23314d] bg-[#0a1020] p-3 text-[#dbeafe] lg:flex">
          <div className="mb-3 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1287ff]/15 text-[#7dd3fc] ring-1 ring-[#24436f]">
              <Zap size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold">Surya Code</p>
              <p className="text-[10px] text-[#64748b]">Online coding agent</p>
            </div>
          </div>
          <button
            onClick={() => {
              hook.newProject();
              setForceGallery(false);
              setForceChat(true);
            }}
            className="mb-2 flex h-9 items-center gap-2 rounded-lg bg-[#123b70] px-3 text-sm font-medium text-[#eaf4ff] hover:bg-[#1d4f8f]"
          >
            <Plus size={15} /> New session
          </button>
          {([
            { label: "Routines", icon: Wrench },
            { label: "Customize", icon: SlidersHorizontal },
            { label: "More", icon: ChevronDown },
            { label: "MCPs", icon: Bot },
            { label: "Skills", icon: Brain },
          ] as const).map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => hook.setWorkspaceView(label === "MCPs" || label === "Skills" || label === "Routines" ? "plan" : "tasks")}
              className="flex h-8 items-center gap-2 rounded-md px-3 text-sm text-[#8aa4c8] hover:bg-[#172033] hover:text-[#eaf4ff]"
            >
              <Icon size={14} /> {label}
            </button>
          ))}
          <div className="mt-4 flex items-center justify-between px-2 text-[11px] font-medium uppercase tracking-wide text-[#64748b]">
            <span>Recents</span>
            <History size={12} />
          </div>
          <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
            {hook.projects.slice(0, 18).map((project) => (
              <button
                key={project.id}
                onClick={() => hook.openProject(project.id)}
                className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-[#8aa4c8] hover:bg-[#172033] hover:text-[#eaf4ff]"
              >
                {project.name}
              </button>
            ))}
            {hook.projects.length === 0 && (
              <p className="px-2 py-3 text-xs text-[#475569]">No recent sessions yet.</p>
            )}
          </div>
          <button className="mt-2 flex h-8 items-center gap-2 rounded-md px-3 text-sm text-[#8aa4c8] hover:bg-[#172033] hover:text-[#eaf4ff]">
            <Settings size={14} /> Settings
          </button>
        </aside>
        <div style={{ width: `${chatWidthPct}%` }} className="flex-shrink-0 overflow-hidden border-r border-[#23314d]">
          <AppBuilderChatPanel {...hook} />
        </div>

        <div
          onPointerDown={startDrag}
          className="w-1 flex-shrink-0 bg-[#172033] hover:bg-[#3b82f6]/60 cursor-col-resize transition-colors"
        />

        <div className="flex-1 min-w-0 overflow-hidden">
          <AppBuilderBuildPanel {...hook} />
        </div>
      </div>
    </div>
  );
}
