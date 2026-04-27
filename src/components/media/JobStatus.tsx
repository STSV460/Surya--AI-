"use client";

import { useEffect, useRef } from "react";
import { useMediaStore } from "@/stores/mediaStore";
import type { MediaAsset } from "@/types/media";

const POLL_MS = 3000;

export function JobStatus() {
  const pendingJobIds = useMediaStore((s) => s.pendingJobIds);
  const updateAsset = useMediaStore((s) => s.updateAsset);
  const untrackJob = useMediaStore((s) => s.untrackJob);
  const setSelectedAsset = useMediaStore((s) => s.setSelectedAsset);
  const timersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    for (const id of pendingJobIds) {
      if (timersRef.current[id]) continue;
      timersRef.current[id] = setInterval(async () => {
        try {
          const res = await fetch(`/api/media/assets?id=${id}`);
          if (!res.ok) return;
          const { asset } = (await res.json()) as { asset: MediaAsset };
          if (!asset) return;
          updateAsset(id, asset);
          if (asset.status === "done" || asset.status === "failed") {
            clearInterval(timersRef.current[id]);
            delete timersRef.current[id];
            untrackJob(id);
            if (asset.status === "done") setSelectedAsset(asset);
          }
        } catch {
          /* ignore */
        }
      }, POLL_MS);
    }
    const timers = timersRef.current;
    return () => {
      for (const id of Object.keys(timers)) {
        if (!pendingJobIds.includes(id)) {
          clearInterval(timers[id]);
          delete timers[id];
        }
      }
    };
  }, [pendingJobIds, updateAsset, untrackJob, setSelectedAsset]);

  if (pendingJobIds.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-white/10 text-xs text-white/80 shadow-xl">
      <span className="inline-block w-2 h-2 rounded-full bg-surya-500 animate-pulse" />
      Generating {pendingJobIds.length} job{pendingJobIds.length > 1 ? "s" : ""}…
    </div>
  );
}
