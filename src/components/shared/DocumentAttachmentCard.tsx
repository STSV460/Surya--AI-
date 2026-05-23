"use client";

import { useState } from "react";
import { Check, Copy, Download, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/paste-as-file";

interface DocumentAttachmentCardProps {
  name: string;
  subtitle?: string;
  sizeBytes?: number;
  lineCount?: number;
  content?: string;
  mode?: "composer" | "message";
  onRemove?: () => void;
  className?: string;
}

function buildSubtitle(subtitle?: string, lineCount?: number, sizeBytes?: number) {
  const parts = [subtitle ?? "Document"];
  if (lineCount) parts.push(`${lineCount} lines`);
  const size = formatBytes(sizeBytes);
  if (size) parts.push(size);
  return parts.join(" · ");
}

export function DocumentAttachmentCard({
  name,
  subtitle,
  sizeBytes,
  lineCount,
  content,
  mode = "message",
  onRemove,
  className,
}: DocumentAttachmentCardProps) {
  const [copied, setCopied] = useState(false);
  const cardSubtitle = buildSubtitle(subtitle, lineCount, sizeBytes);

  const copy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const download = () => {
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        "group flex w-full max-w-[520px] items-center gap-3 rounded-2xl border border-[#24436f] bg-[#0f1b31] p-3 text-left shadow-[0_16px_48px_rgba(15,35,72,0.22)]",
        className
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1287ff] text-white shadow-[0_10px_30px_rgba(18,135,255,0.35)]">
        <FileText size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#eaf4ff]">{name}</p>
        <p className="mt-0.5 truncate text-xs text-[#8aa4c8]">{cardSubtitle}</p>
      </div>
      {mode === "composer" ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8aa4c8] hover:bg-[#1e3a5f] hover:text-white"
        >
          <X size={15} />
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <button
            type="button"
            onClick={copy}
            disabled={!content}
            aria-label={`Copy ${name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8aa4c8] hover:bg-[#1e3a5f] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? <Check size={15} className="text-[#7dd3fc]" /> : <Copy size={15} />}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={!content}
            aria-label={`Download ${name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8aa4c8] hover:bg-[#1e3a5f] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
