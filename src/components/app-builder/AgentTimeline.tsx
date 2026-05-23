"use client";

import { CheckCircle2, CircleDot } from "lucide-react";
import type { AgentTimelineEvent } from "@/stores/appBuilderStore";

export function AgentTimeline({ events }: { events?: AgentTimelineEvent[] }) {
  if (!events?.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-white/8 bg-surface-1/80 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Agent Timeline</p>
      <div className="space-y-2">
        {events.map((event) => (
          <details key={event.role} className="group rounded-lg border border-white/8 bg-surface-2/60 px-3 py-2" open={event.status === "running"}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-white">
              {event.status === "done" ? (
                <CheckCircle2 size={13} className="text-emerald-400" />
              ) : (
                <CircleDot size={13} className="animate-pulse text-surya-500" />
              )}
              <span className="font-medium">{event.label}</span>
              <span className="ml-auto text-[10px] text-gray-500">{event.status}</span>
            </summary>
            {event.summary && <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-400">{event.summary}</p>}
          </details>
        ))}
      </div>
    </div>
  );
}
