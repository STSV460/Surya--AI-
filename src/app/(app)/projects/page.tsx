"use client";

export const runtime = "edge";

import { useEffect, useState } from "react";
import { Plus, Loader2, FolderOpen } from "lucide-react";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { useProject } from "@/hooks/useProject";
import type { Project } from "@/types/project";

function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (p: Project) => void }) {
  const { createProject } = useProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const project = await createProject(name, description, systemPrompt);
    setLoading(false);
    if (project) onCreate(project);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-1 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-white/6">
          <h2 className="text-base font-semibold text-white">New Project</h2>
          <p className="text-xs text-gray-500 mt-1">Group conversations around a shared context and knowledge base.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Project Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Legal Research, Marketing Plan"
              className="w-full bg-surface-2 text-sm text-white placeholder:text-gray-600 rounded-xl px-4 py-2.5 outline-none border border-white/6 focus:border-surya-500/40 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this project"
              className="w-full bg-surface-2 text-sm text-white placeholder:text-gray-600 rounded-xl px-4 py-2.5 outline-none border border-white/6 focus:border-surya-500/40 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1.5">AI Instructions</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Tell the AI how to behave in this project…"
              rows={3}
              className="w-full bg-surface-2 text-sm text-white placeholder:text-gray-600 rounded-xl px-4 py-2.5 outline-none resize-none border border-white/6 focus:border-surya-500/40 transition-colors"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white border border-white/8 hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-surya-500 hover:bg-surya-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, loading, fetchProjects, deleteProject } = useProject();
  const [showNew, setShowNew] = useState(false);
  const [projectList, setProjectList] = useState(projects);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { setProjectList(projects); }, [projects]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this project and all its files?")) return;
    await deleteProject(id);
    setProjectList((prev) => prev.filter((p) => p.id !== id));
  }

  function handleCreate(project: Project) {
    setProjectList((prev) => [project, ...prev]);
    setShowNew(false);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">Organize your chats with custom instructions and knowledge files.</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-surya-500 hover:bg-surya-700 text-white transition-colors"
          >
            <Plus size={15} />
            New Project
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={20} className="text-surya-500 animate-spin" />
          </div>
        ) : projectList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-1 border border-white/8 flex items-center justify-center mb-4">
              <FolderOpen size={24} className="text-gray-600" />
            </div>
            <p className="text-sm text-gray-400">No projects yet</p>
            <p className="text-xs text-gray-600 mt-1">Create a project to organize conversations with custom AI instructions.</p>
            <button
              onClick={() => setShowNew(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-surya-500 border border-surya-500/20 hover:bg-surya-500/10 transition-colors"
            >
              <Plus size={14} />
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectList.map((project) => (
              <ProjectCard key={project.id} project={project} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NewProjectDialog onClose={() => setShowNew(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}