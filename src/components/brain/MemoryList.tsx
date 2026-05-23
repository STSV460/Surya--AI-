"use client";

import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Save, Search, Trash2 } from "lucide-react";
import { BrainCard } from "@/components/brain/BrainCard";
import { SkillBar, type SkillBarItem } from "@/components/brain/SkillBar";

interface MemoryEntry {
  id: string;
  type: "fact" | "preference" | "goal" | "mistake" | "style";
  surface: string;
  content: string;
  paused?: boolean;
  updatedAt?: string;
}

const TYPES = ["fact", "preference", "goal", "mistake", "style"] as const;

export function MemoryList() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [skills, setSkills] = useState<SkillBarItem[]>([]);
  const [preview, setPreview] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [memoryRes, skillRes] = await Promise.all([
        fetch("/api/brain/memory"),
        fetch("/api/brain/skills"),
      ]);
      const memoryData = memoryRes.ok ? await memoryRes.json() : {};
      const skillData = skillRes.ok ? await skillRes.json() : {};
      setMemories(Array.isArray(memoryData.memories) ? memoryData.memories : []);
      setSkills(Array.isArray(skillData.skills) ? skillData.skills : []);
      setPreview(memoryData.brainPreview ?? "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return memories;
    return memories.filter((m) => `${m.type} ${m.surface} ${m.content}`.toLowerCase().includes(q));
  }, [memories, query]);

  async function patchMemory(id: string, patch: Partial<MemoryEntry>) {
    setMemories((items) => items.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    await fetch("/api/brain/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    await load();
  }

  async function removeMemory(id: string) {
    setMemories((items) => items.filter((m) => m.id !== id));
    await fetch(`/api/brain/memory?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  async function pauseAll(paused: boolean) {
    await Promise.all(memories.map((m) => patchMemory(m.id, { paused })));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Memory</h1>
          <p className="mt-1 text-sm text-gray-500">View, edit, pause, or delete Surya Skill Brain signals.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => pauseAll(true)} className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-gray-300 hover:bg-white/5">
            <Pause size={13} /> Pause all
          </button>
          <button onClick={() => pauseAll(false)} className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-gray-300 hover:bg-white/5">
            <Play size={13} /> Resume all
          </button>
        </div>
      </div>

      <BrainCard preview={preview} />

      <section className="rounded-xl border border-white/8 bg-surface-1 p-5">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/8 bg-surface-2 px-3 py-2">
          <Search size={14} className="text-gray-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search memory"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
          />
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading memory...</p>
        ) : (
          <div className="space-y-5">
            {TYPES.map((type) => {
              const items = filtered.filter((m) => m.type === type);
              if (items.length === 0) return null;
              return (
                <div key={type}>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{type}</h2>
                  <div className="space-y-2">
                    {items.map((memory) => (
                      <div key={memory.id} className="flex items-start gap-2 rounded-lg border border-white/8 bg-surface-2/70 p-3">
                        <textarea
                          value={editing[memory.id] ?? memory.content}
                          onChange={(event) => setEditing((s) => ({ ...s, [memory.id]: event.target.value }))}
                          className="min-h-10 flex-1 resize-none bg-transparent text-sm text-gray-200 outline-none"
                        />
                        <button
                          onClick={() => patchMemory(memory.id, { content: editing[memory.id] ?? memory.content })}
                          title="Save"
                          className="rounded-md p-1.5 text-gray-500 hover:bg-white/8 hover:text-white"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => patchMemory(memory.id, { paused: !memory.paused })}
                          title={memory.paused ? "Resume" : "Pause"}
                          className="rounded-md p-1.5 text-gray-500 hover:bg-white/8 hover:text-white"
                        >
                          {memory.paused ? <Play size={14} /> : <Pause size={14} />}
                        </button>
                        <button
                          onClick={() => removeMemory(memory.id)}
                          title="Delete"
                          className="rounded-md p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/8 bg-surface-1 p-5">
        <h2 className="mb-3 text-sm font-medium text-white">Skills</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {skills.length === 0 ? (
            <p className="text-sm text-gray-500">No skill evidence yet.</p>
          ) : (
            skills.map((skill) => <SkillBar key={`${skill.domain}:${skill.topic}`} skill={skill} />)
          )}
        </div>
      </section>
    </div>
  );
}
