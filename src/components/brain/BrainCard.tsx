"use client";

import { Brain } from "lucide-react";

export function BrainCard({ preview }: { preview: string }) {
  return (
    <section className="rounded-xl border border-white/8 bg-surface-1 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
        <Brain size={15} className="text-surya-500" />
        Brain Preview
      </div>
      <pre className="max-h-72 whitespace-pre-wrap rounded-lg border border-white/8 bg-black/20 p-3 text-xs leading-relaxed text-gray-300">
        {preview.trim() || "No active brain summary yet."}
      </pre>
    </section>
  );
}
