"use client";

import { ExternalLink } from "lucide-react";
import type { SearchResult } from "@/types/chat";
import { cn } from "@/lib/utils";

interface CitationCardProps {
  result: SearchResult;
  compact?: boolean;
}

export function CitationCard({ result, compact = false }: CitationCardProps) {
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-white/10 bg-surface-2",
        "hover:border-surya-500/40 hover:bg-surface-2/80 transition-colors group",
        compact ? "px-2.5 py-2 min-w-[160px] max-w-[220px]" : "px-3 py-2.5 w-full"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={result.favicon}
        alt=""
        width={14}
        height={14}
        className="rounded-sm mt-0.5 shrink-0 opacity-80"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-mono text-surya-500 bg-surya-500/10 rounded px-1 py-0.5 shrink-0">
            [{result.index}]
          </span>
          <span className="text-[11px] text-gray-400 truncate">{result.domain}</span>
          <ExternalLink size={10} className="text-gray-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-xs text-gray-200 font-medium line-clamp-2 leading-tight">{result.title}</p>
        {!compact && (
          <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-snug">{result.snippet}</p>
        )}
      </div>
    </a>
  );
}
