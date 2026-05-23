"use client";

import { useState } from "react";
import { Rocket, X } from "lucide-react";

export function DeployToVercel({ files }: { files: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("surya-app");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");

  async function connectAndDeploy() {
    setStatus("Preparing deploy...");
    if (token.trim()) {
      const connected = await fetch("/api/connectors/vercel/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!connected.ok) {
        const data = await connected.json();
        setStatus(data.error ?? "Vercel token failed");
        return;
      }
    }
    const res = await fetch("/api/connectors/vercel/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, files, target: "preview" }),
    });
    const data = await res.json();
    setStatus(res.ok ? `Ready: ${data.url ?? data.inspectorUrl ?? data.id}` : data.error ?? "Deploy failed");
    if (res.ok && data.url) window.open(data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/8 px-2 text-[11px] text-gray-400 hover:border-white/20 hover:text-white">
        <Rocket size={12} /> Vercel
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#141721] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Deploy to Vercel</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white"><X size={15} /></button>
            </div>
            <input value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} className="h-9 w-full rounded-lg border border-white/10 bg-surface-2 px-3 text-sm text-white outline-none" />
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Vercel token (first time only)" className="mt-2 h-9 w-full rounded-lg border border-white/10 bg-surface-2 px-3 text-sm text-white outline-none placeholder:text-gray-600" />
            <button onClick={connectAndDeploy} className="mt-4 h-9 w-full rounded-lg bg-surya-500 text-sm font-medium text-white hover:bg-surya-700">
              Deploy preview
            </button>
            {status && <p className="mt-3 break-words text-xs text-gray-400">{status}</p>}
          </div>
        </div>
      )}
    </>
  );
}
