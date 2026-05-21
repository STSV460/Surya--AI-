"use client";

import { PanelLeft, Bug } from "lucide-react";
import Image from "next/image";
import { useUIStore } from "@/stores/uiStore";
import { useChatStore } from "@/stores/chatStore";
import { usePathname } from "next/navigation";

function ReportBugButton() {
  const href = `mailto:pvshariharan324@gmail.com?subject=${encodeURIComponent(
    "Surya AI bug report"
  )}&body=${encodeURIComponent(
    "Hi PVS,\n\nI found an issue in Surya AI.\n\nWhere it happened:\n\nWhat went wrong:\n\nSteps to reproduce:\n1. \n2. \n3. \n\nScreenshot or extra details:\n"
  )}`;

  return (
    <a
      href={href}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white bg-white/[0.04] hover:bg-surface-2 border border-white/8 transition-all duration-150"
      title="Report a bug"
    >
      <Bug size={13} className="text-surya-400" />
      Report Bug
    </a>
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
          <Image src="/logo.png" alt="Surya AI" width={20} height={20} className="rounded-[5px] shrink-0" />
        )}
        <span className="text-[13.5px] font-medium text-gray-300 truncate">
          {activeTitle ?? "Surya AI"}
        </span>
      </div>

      {isChatRoute && <ReportBugButton />}
    </header>
  );
}
