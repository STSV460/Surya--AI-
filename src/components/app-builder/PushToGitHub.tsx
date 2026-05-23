"use client";

import { useState } from "react";
import { FolderGit2, X } from "lucide-react";

export function PushToGitHub({ files }: { files: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [repoName, setRepoName] = useState("surya-test");
  const [privateRepo, setPrivateRepo] = useState(true);
  const [status, setStatus] = useState("");

  async function push() {
    setStatus("Pushing...");
    const res = await fetch("/api/connectors/github/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoName, private: privateRepo, files, commitMessage: "Add Surya Code build" }),
    });
    const data = await res.json();
    setStatus(res.ok ? `Pushed: ${data.htmlUrl}` : data.error ?? "Push failed");
    if (res.ok && data.htmlUrl) window.open(data.htmlUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/8 px-2 text-[11px] text-gray-400 hover:border-white/20 hover:text-white">
        <FolderGit2 size={12} /> GitHub
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#141721] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Push to GitHub</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X size={15} /></button>
            </div>
            <input value={repoName} onChange={(e) => setRepoName(e.target.value)} className="h-9 w-full rounded-lg border border-white/10 bg-surface-2 px-3 text-sm text-white outline-none" />
            <label className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={privateRepo} onChange={(e) => setPrivateRepo(e.target.checked)} />
              Private repo
            </label>
            <button onClick={push} className="mt-4 h-9 w-full rounded-lg bg-surya-500 text-sm font-medium text-white hover:bg-surya-700">
              Push files
            </button>
            {status && <p className="mt-3 break-words text-xs text-gray-400">{status}</p>}
          </div>
        </div>
      )}
    </>
  );
}
