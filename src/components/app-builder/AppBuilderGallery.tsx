"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Zap, Trash2, Loader2, Clock } from "lucide-react";
import type { UseAppBuilderReturn } from "@/hooks/useAppBuilder";

interface Props {
  hook: UseAppBuilderReturn;
  onStartNew: () => void;
  onOpen: (id: string) => void;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diffSec = Math.floor((Date.now() - t) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AppBuilderGallery({ hook, onStartNew, onOpen }: Props) {
  const { projects, projectsLoaded, loadProjects, deleteProject } = hook;
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!projectsLoaded) loadProjects();
  }, [projectsLoaded, loadProjects]);

  const handleDelete = async (id: string) => {
    setBusyId(id);
    await deleteProject(id);
    setBusyId(null);
    setConfirmId(null);
  };

  const handleNew = () => {
    hook.newProject();
    onStartNew();
  };

  return (
    <div className="flex flex-col h-full bg-surface-DEFAULT overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-surface-1 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-surya-500" />
          <h1 className="text-base font-semibold text-white">App Builder</h1>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surya-500/20 text-surya-500 border border-surya-500/30">
            Beta
          </span>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surya-500 hover:bg-surya-500/90 text-white text-xs font-medium transition-all"
        >
          <Plus size={13} />
          New Project
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-sm font-semibold text-gray-200">Your Projects</h2>
            <span className="text-xs text-gray-500">
              {projectsLoaded ? `${projects.length} total` : "loading…"}
            </span>
          </div>

          {!projectsLoaded ? (
            <div className="flex items-center justify-center py-20 text-xs text-gray-500">
              <Loader2 size={14} className="animate-spin mr-2" />
              Loading projects…
            </div>
          ) : projects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center gap-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-surya-500/10 border border-surya-500/20 flex items-center justify-center">
                <Zap size={24} className="text-surya-500" />
              </div>
              <p className="text-sm font-medium text-white">No projects yet</p>
              <p className="text-xs text-gray-500 max-w-xs">
                Click <span className="text-surya-500">New Project</span> to describe and build your first app.
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="group relative bg-surface-1 border border-white/5 hover:border-surya-500/30 rounded-xl p-4 cursor-pointer transition-all"
                  onClick={() => onOpen(p.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-surya-500/10 border border-surya-500/20 flex items-center justify-center flex-shrink-0">
                      <Zap size={15} className="text-surya-500" />
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wide">
                      {p.previewMode === "webcontainer" ? "react" : p.previewMode === "srcdoc" ? "html" : "empty"}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-white truncate mb-1">{p.name}</h3>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Clock size={10} />
                    <span>{formatRelative(p.updatedAt)}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmId(p.id);
                    }}
                    title="Delete project"
                    className="absolute top-3 right-3 p-1.5 rounded-md text-gray-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>

                  {confirmId === p.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute inset-0 rounded-xl bg-black/80 flex flex-col items-center justify-center gap-2 px-4"
                    >
                      <p className="text-xs text-gray-200 text-center">Delete this project?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={busyId === p.id}
                          className="px-3 py-1 rounded-md bg-red-500 hover:bg-red-500/90 text-white text-[11px] font-medium disabled:opacity-50"
                        >
                          {busyId === p.id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="px-3 py-1 rounded-md bg-surface-2 hover:bg-surface-2/80 text-gray-300 text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
