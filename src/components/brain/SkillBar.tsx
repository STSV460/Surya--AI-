"use client";

import { cn } from "@/lib/utils";

export interface SkillBarItem {
  id?: string;
  domain: string;
  topic: string;
  level: "strong" | "medium" | "weak" | "very_weak";
  evidenceCount?: number;
}

const LEVEL_WIDTH = {
  strong: "w-full bg-emerald-400",
  medium: "w-2/3 bg-sky-400",
  weak: "w-1/3 bg-amber-400",
  very_weak: "w-1/5 bg-red-400",
};

export function SkillBar({ skill }: { skill: SkillBarItem }) {
  return (
    <div className="rounded-lg border border-white/8 bg-surface-2/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-white">{skill.topic}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{skill.domain}</p>
        </div>
        <span className="rounded-md bg-black/20 px-2 py-0.5 text-[10px] text-gray-400">
          {skill.level.replace("_", " ")}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className={cn("h-full rounded-full", LEVEL_WIDTH[skill.level])} />
      </div>
    </div>
  );
}
