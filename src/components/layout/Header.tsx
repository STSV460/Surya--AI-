"use client";

import { PanelLeft, Sun, Bug } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { usePathname } from "next/navigation";

const BUG_REPORT_EMAIL = "pvshariharan324@gmail.com";

function ReportBugButton() {
  function handleClick() {
    const subject = encodeURIComponent("Bug Report — Surya AI");
    const body = encodeURIComponent(
      `Hi PVS Hariharan,\n\nI found a bug on Surya AI:\n\n[Describe the bug here]\n\nSteps to reproduce:\n1. \n2. \n3. \n\nExpected behavior:\n\nActual behavior:\n\nBrowser / device:\n\nThanks!`
    );
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${BUG_REPORT_EMAIL}&su=${subject}&body=${body}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white bg-white/[0.04] hover:bg-surface-2 border border-white/8 transition-all duration-150"
      title="Report a bug — opens Gmail"
    >
      <Bug size={12} className="text-red-400" />
      Report Bug
    </button>
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

      {isChatRoute && <ReportBugButton />}
    </header>
  );
}
