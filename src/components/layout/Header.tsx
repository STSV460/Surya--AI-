"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { PanelLeft, ChevronDown, Sun } from "lucide-react";
import { useUIStore, type ModelId } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { usePathname } from "next/navigation";

const MODELS: { id: ModelId; label: string; badge: string; color: string }[] = [
  { id: "sonnet", label: "Sonnet 4.6", badge: "Fast",  color: "#4FC3F7" },
  { id: "opus",   label: "Opus 4.7",   badge: "Smart", color: "#A855F7" },
];

function ModelSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { selectedModel, setSelectedModel } = useUIStore();
  const setThinkingEnabled = useChatStore((s) => s.setThinkingEnabled);

  const model = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(id: ModelId) {
    setSelectedModel(id);
    setThinkingEnabled(id === "opus");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white bg-white/[0.04] hover:bg-surface-2 border border-white/8 transition-all duration-150"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: model.color }}
        />
        {model.label}
        <ChevronDown size={11} className="opacity-60 ml-0.5" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-50 bg-surface-2 border border-white/12 rounded-xl p-1.5 min-w-[180px] shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelect(m.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all duration-100 ${
                selectedModel === m.id
                  ? "bg-surya-500/12 text-white"
                  : "text-gray-400 hover:bg-white/6 hover:text-white"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: m.color }}
              />
              <span className="flex-1 text-left font-medium">{m.label}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: `${m.color}22`, color: m.color }}
              >
                {m.badge}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { conversations, activeConversationId } = useChatStore();
  const pathname = usePathname();

  const activeTitle = conversations.find((c) => c.id === activeConversationId)?.title;
  const isChatRoute = pathname.startsWith("/chat");

  return (
    <header className="h-12 flex items-center px-4 border-b border-white/6 bg-surface-1/80 backdrop-blur-sm shrink-0 gap-3 z-10">
      <button
        onClick={toggleSidebar}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/6 transition-colors"
        title="Toggle sidebar"
      >
        <PanelLeft size={16} />
      </button>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        {!activeTitle && (
          <Sun size={18} className="text-surya-500 shrink-0" />
        )}
        <span className="text-[13.5px] font-medium text-gray-300 truncate">
          {activeTitle ?? "Surya AI"}
        </span>
      </div>

      {isChatRoute && <ModelSelector />}
    </header>
  );
}
