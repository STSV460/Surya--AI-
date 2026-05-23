"use client";

import { ShieldAlert } from "lucide-react";
import type { WarRoomEvent } from "@/stores/appBuilderStore";

export function BugWarRoom({ events }: { events?: WarRoomEvent[] }) {
  if (!events?.length) return null;
  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-200">
        <ShieldAlert size={13} />
        Bug War Room
      </div>
      <div className="space-y-1.5">
        {events.map((event, index) => (
          <div key={`${event.role}-${index}`} className="rounded-lg bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-amber-300/70">{event.role}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-300">{event.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
