"use client";

import { CheckCircle2, Loader2, Users, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrewProgressEvent } from "@/types/chat";

interface CrewProgressProps {
  events: CrewProgressEvent[];
  isRunning: boolean;
  embedded?: boolean;
}

export function CrewProgress({ events, isRunning, embedded = false }: CrewProgressProps) {
  if (events.length === 0) return null;

  const start = events.find((event) => event.type === "crew_start");
  const latest = events[events.length - 1];
  const agents = start?.agents ?? [];
  const done = latest.type === "crew_complete";
  const failed = latest.type === "error";

  return (
    <div className={embedded ? "w-full" : "mx-auto mb-3 w-full max-w-3xl px-4"}>
      <div className="rounded-2xl border border-white/10 bg-[#171a23]/95 px-4 py-3 shadow-[0_12px_34px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surya-500/15 text-surya-500">
              {failed ? <XCircle size={16} /> : done ? <CheckCircle2 size={16} /> : <Users size={16} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">
                {start?.crewName ? `${start.crewName} crew` : "Crew"} {done ? "complete" : failed ? "failed" : "running"}
              </p>
              <p className="truncate text-xs text-gray-500">
                {latest.error ?? latest.output ?? latest.thought ?? "Preparing agents"}
              </p>
            </div>
          </div>
          {isRunning && !done && !failed && <Loader2 size={16} className="shrink-0 animate-spin text-surya-500" />}
        </div>

        {agents.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agents.map((agent) => (
              <span
                key={agent.role}
                className="rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1 text-[11px] text-gray-300"
              >
                {agent.role}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 space-y-1.5">
          {events.slice(-4).map((event, index) => (
            <div key={`${event.type}-${index}`} className="flex items-start gap-2 text-xs">
              <span
                className={cn(
                  "mt-1 h-1.5 w-1.5 rounded-full",
                  event.type === "error" ? "bg-red-400" : event.type === "crew_complete" ? "bg-green-400" : "bg-surya-500"
                )}
              />
              <p className="min-w-0 flex-1 truncate text-gray-400">
                {event.agent ? `${event.agent}: ` : ""}
                {event.output ?? event.thought ?? event.finalOutput ?? event.error ?? event.type}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
