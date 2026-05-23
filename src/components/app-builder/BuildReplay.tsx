"use client";

import { ListChecks } from "lucide-react";
import type { BuildReplayData } from "@/stores/appBuilderStore";

function ReplayGroup({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <ul className="space-y-1 text-[11px] leading-relaxed text-gray-300">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

export function BuildReplay({ replay }: { replay?: BuildReplayData }) {
  if (!replay) return null;
  return (
    <details className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-emerald-200">
        <ListChecks size={13} />
        Build Replay
      </summary>
      <div className="mt-3 grid gap-3">
        <ReplayGroup title="Built" items={replay.built} />
        <ReplayGroup title="Files" items={replay.files} />
        <ReplayGroup title="Security" items={replay.security} />
        <ReplayGroup title="Bugs Fixed" items={replay.bugsFixed} />
        <ReplayGroup title="Next" items={replay.next} />
      </div>
    </details>
  );
}
