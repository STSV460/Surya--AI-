"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Code2, MessageSquare, Pause, Play, Search, Trash2 } from "lucide-react";

type ScheduleStatus = "active" | "paused";
type ScheduleFrequency = "once" | "hourly" | "daily" | "weekly";
type ScheduleTarget = "chat" | "code" | "research";

interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  frequency: ScheduleFrequency;
  target: ScheduleTarget;
  status: ScheduleStatus;
  nextRunAt?: string;
  createdAt?: string;
}

const targets: Record<ScheduleTarget, { label: string; icon: typeof MessageSquare }> = {
  chat: { label: "Chat", icon: MessageSquare },
  code: { label: "Code", icon: Code2 },
  research: { label: "Research", icon: Search },
};

function formatRun(value?: string) {
  if (!value) return "Next run pending";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const activeCount = useMemo(() => tasks.filter((task) => task.status === "active").length, [tasks]);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];

  async function loadTasks() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/scheduled-tasks", { cache: "no-store" });
      const data = await res.json();
      const nextTasks = Array.isArray(data.tasks) ? data.tasks : [];
      setTasks(nextTasks);
      setSelectedTaskId((current) => current ?? nextTasks[0]?.id ?? null);
      if (!res.ok) setStatus(data.error ?? "Could not load tasks.");
    } catch {
      setStatus("Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  async function updateTask(task: ScheduledTask, patch: Partial<ScheduledTask>) {
    const previous = tasks;
    setTasks((items) => items.map((item) => (item.id === task.id ? { ...item, ...patch } : item)));
    try {
      const res = await fetch("/api/scheduled-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, ...patch }),
      });
      if (!res.ok) setTasks(previous);
    } catch {
      setTasks(previous);
    }
  }

  async function deleteTask(taskId: string) {
    const previous = tasks;
    setTasks((items) => items.filter((item) => item.id !== taskId));
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    try {
      const res = await fetch(`/api/scheduled-tasks?id=${encodeURIComponent(taskId)}`, { method: "DELETE" });
      if (!res.ok) setTasks(previous);
    } catch {
      setTasks(previous);
    }
  }

  return (
    <div className="flex h-full min-h-0 bg-[#151515] text-[#f4f0e8]">
      <aside className="hidden w-[292px] shrink-0 border-r border-white/10 bg-[#20201f] p-3 md:flex md:flex-col">
        <div className="mb-4 flex items-center gap-2 px-2 py-2 text-sm font-medium text-white">
          <CalendarClock size={16} className="text-[#a6e85f]" />
          Scheduled
        </div>
        <div className="mb-3 flex items-center justify-between px-2 text-[11px] uppercase tracking-[0.08em] text-neutral-500">
          <span>Tasks</span>
          <span>{tasks.length}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-sm text-neutral-500">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-neutral-500">
              No scheduled tasks yet. Create one in chat with <span className="text-neutral-300">/schedule</span>.
            </div>
          ) : (
            <div className="space-y-1.5">
              {tasks.map((task) => {
                const Icon = targets[task.target]?.icon ?? MessageSquare;
                const selected = selectedTask?.id === task.id;
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`w-full rounded-xl px-3 py-3 text-left transition ${
                      selected ? "bg-[#111111] text-white" : "text-neutral-300 hover:bg-white/8"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={14} className={selected ? "mt-0.5 text-[#a6e85f]" : "mt-0.5 text-neutral-500"} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{task.title}</p>
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          {task.frequency} - {formatRun(task.nextRunAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="mt-3 border-t border-white/10 pt-3 text-xs text-neutral-500">
          {activeCount} active task{activeCount === 1 ? "" : "s"}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-8 md:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-[#f4f0e8]">Scheduled tasks</h1>
              <p className="mt-2 max-w-2xl text-sm text-neutral-500">
                Tasks created from chat. Type <span className="text-neutral-300">/schedule</span> in chat to add one.
              </p>
            </div>
            <button
              onClick={loadTasks}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/12 px-4 text-sm font-medium text-neutral-300 transition hover:bg-white/8 hover:text-white"
            >
              Refresh
            </button>
          </div>

          <div className="mb-6 rounded-2xl border border-white/15 bg-[#1d1d1c] px-4 py-4 text-sm text-neutral-300">
            Scheduled list only. Creation happens in chat.
          </div>

          {status && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">{status}</div>}

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#1f1f1e] p-5 text-sm text-neutral-500">Loading scheduled tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/16 bg-[#1f1f1e] p-10 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#a6e85f]/10 text-[#a6e85f]">
                <CalendarClock size={24} />
              </div>
              <h2 className="text-base font-medium text-white">No scheduled tasks yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
                Go to chat and type <span className="text-neutral-300">/schedule daily AI news brief</span>.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tasks.map((task) => {
                const Icon = targets[task.target]?.icon ?? MessageSquare;
                return (
                  <article key={task.id} className="rounded-2xl border border-white/10 bg-[#1f1f1e] p-4 hover:border-white/20">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/8 text-[#a6e85f]">
                        <Icon size={17} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void updateTask(task, { status: task.status === "active" ? "paused" : "active" })}
                          className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition hover:bg-white/8 hover:text-white"
                          aria-label={task.status === "active" ? "Pause task" : "Resume task"}
                        >
                          {task.status === "active" ? <Pause size={15} /> : <Play size={15} />}
                        </button>
                        <button
                          onClick={() => void deleteTask(task.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition hover:bg-red-500/10 hover:text-red-300"
                          aria-label="Delete task"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-medium text-white">{task.title}</h3>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-neutral-500">{task.prompt}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-md border border-[#a6e85f]/30 bg-[#a6e85f]/10 px-2 py-1 text-[11px] text-[#b8f47a]">
                        {task.frequency}
                      </span>
                      <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-neutral-400">
                        {formatRun(task.nextRunAt)}
                      </span>
                      <span className={`rounded-md px-2 py-1 text-[11px] ${task.status === "active" ? "bg-emerald-500/10 text-emerald-300" : "bg-white/8 text-neutral-500"}`}>
                        {task.status}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
