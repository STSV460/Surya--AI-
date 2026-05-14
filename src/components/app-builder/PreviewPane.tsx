"use client";

import { useRef } from "react";
import {
  RefreshCw,
  ExternalLink,
  Terminal,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";
import type { WCStatus } from "@/hooks/useWebContainer";

const STATUS_LABELS: Record<WCStatus, string> = {
  idle: "Idle",
  booting: "Booting container...",
  installing: "Installing dependencies...",
  starting: "Starting dev server...",
  ready: "Live",
  error: "Error",
};

interface PreviewPaneProps {
  url: string | null;
  status: WCStatus;
  terminalOutput: string;
}

export function PreviewPane({ url, status, terminalOutput }: PreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleReload = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.location.reload();
    }
  };

  const showPreview = status === "ready" && !!url;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          {status === "ready" ? (
            <Wifi className="w-3.5 h-3.5 text-green-400" />
          ) : status === "error" ? (
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-surya-500 animate-spin" />
          )}
          <span
            className={`text-xs font-medium ${
              status === "ready"
                ? "text-green-400"
                : status === "error"
                ? "text-red-400"
                : "text-gray-400"
            }`}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>
        {showPreview && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleReload}
              title="Reload preview"
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Content */}
      {showPreview ? (
        <iframe
          ref={iframeRef}
          src={url}
          className="flex-1 border-0 w-full"
          sandbox="allow-scripts allow-forms allow-modals"
          title="App Preview"
        />
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1 border-b border-white/5 bg-black/40">
            <Terminal className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-gray-400">Terminal</span>
          </div>
          <pre
            className="flex-1 p-3 text-xs text-green-400 font-mono overflow-y-auto whitespace-pre-wrap break-words bg-black"
            ref={(el) => {
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            {terminalOutput || (status === "idle" ? "Waiting for app generation...\n" : "")}
          </pre>
        </div>
      )}
    </div>
  );
}
