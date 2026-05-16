"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock, Moon, Pause, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ScheduleStatus = "active" | "paused";
type ScheduleFrequency = "once" | "hourly" | "daily" | "weekly";

interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  frequency: ScheduleFrequency;
  target: "chat" | "code" | "research";
  model: string;
  status: ScheduleStatus;
  nextRunAt?: string;
  createdAt?: string;
}

const frequencies: Array<{ id: ScheduleFrequency; label: string; hint: string }> = [
  { id: "once", label: "Once", hint: "Run one time" },
  { id: "hourly", label: "Hourly", hint: "Keep checking" },
  { id: "daily", label: "Daily", hint: "Every day" },
  { id: "weekly", label: "Weekly", hint: "Every week" },
];

const targets = [
  { id: "chat", label: "Chat" },
  { id: "code", label: "Code" },
  { id: "research", label: "Research" },
] as const;

function scheduledDate(offsetHours = 1) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function scheduledTime(offsetHours = 1) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toRunAt(date: string, time: string) {
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : value.toISOString();
}

function formatRun(value?: string) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [title, setTitle] = useState("Nightly code cleanup");
  const [prompt, setPrompt] = useState("Review my latest Code project while I sleep. Find bugs, suggest improvements, and prepare the next build plan.");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [target, setTarget] = useState<"chat" | "code" | "research">("code");
  const [model, setModel] = useState("opus");
  const [runDate, setRunDate] = useState(scheduledDate(1));
  const [runTime, setRunTime] = useState(scheduledTime(1));

  const activeCount = useMemo(() => tasks.filter((task) => task.status === "active").length, [tasks]);

  async function loadTasks() {
    setLoading(true);
    try {
      const res = await fetch("/api/scheduled-tasks");
      const data = await res.json();
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch {
      setStatus("Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTasks();
  }, []);

  async function createTask() {
    if (!title.trim() || !prompt.trim()) return;
    setSaving(true);
    setStatus("Saving...");
    try {
      const res = await fetch("/api/scheduled-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          prompt,
          frequency,
          target,
          model,
          runAt: toRunAt(runDate, runTime),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error ?? "Save failed");
        return;
      }
      setTasks((items) => [data.task, ...items]);
      setStatus("Task scheduled.");
    } catch {
      setStatus("Save failed.");
    } finally {
      setSaving(false);
    }
  }

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
    try {
      const res = await fetch(`/api/scheduled-tasks?id=${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });
      if (!res.ok) setTasks(previous);
    } catch {
      setTasks(previous);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(26,115,232,0.055),transparent_34%),#0f1117] px-5 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-surya-500/15 text-surya-500">
              <CalendarClock size={19} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Scheduled Tasks</h1>
            <p className="mt-1 text-sm text-gray-500">Queue Surya to work later, overnight, or on repeat.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
            <Moon size={14} className="text-surya-500" />
            <span>{activeCount} active while you sleep</span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <section className="rounded-2xl border border-white/10 bg-[#171a23]/90 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
              <Plus size={15} className="text-surya-500" />
              New task
            </div>
            <div className="space-y-3">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task name" />
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="What should Surya do?"
                className="min-h-28"
              />
              <div className="grid grid-cols-2 gap-2">
                {frequencies.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFrequency(item.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      frequency === item.id
                        ? "border-surya-500/50 bg-surya-500/15 text-white"
                        : "border-white/8 bg-white/[0.03] text-gray-500 hover:text-white"
                    }`}
                  >
                    <span className="block text-xs font-medium">{item.label}</span>
                    <span className="text-[10px]">{item.hint}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {targets.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTarget(item.id)}
                    className={`h-9 rounded-lg text-xs transition-colors ${
                      target === item.id ? "bg-white text-black" : "bg-white/[0.04] text-gray-400 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2">
                <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Model" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={runDate} onChange={(event) => setRunDate(event.target.value)} placeholder="YYYY-MM-DD" />
                  <Input value={runTime} onChange={(event) => setRunTime(event.target.value)} placeholder="HH:mm" />
                </div>
              </div>
              <Button onClick={createTask} disabled={saving || !title.trim() || !prompt.trim()} className="w-full gap-2">
                <Clock size={15} />
                {saving ? "Scheduling..." : "Schedule task"}
              </Button>
              {status && <p className="text-xs text-gray-500">{status}</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#171a23]/90 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Task queue</h2>
              <button onClick={loadTasks} className="text-xs text-gray-500 hover:text-white">
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-gray-500">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6 text-center">
                <CalendarClock className="mx-auto mb-2 text-gray-600" size={24} />
                <p className="text-sm font-medium text-white">No scheduled tasks yet</p>
                <p className="mt-1 text-xs text-gray-500">Create one for research, code edits, reminders, or daily checks.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-medium text-white">{task.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${task.status === "active" ? "bg-green-500/12 text-green-400" : "bg-white/8 text-gray-500"}`}>
                            {task.status}
                          </span>
                          <span className="rounded-full bg-surya-500/10 px-2 py-0.5 text-[10px] text-surya-400">
                            {task.frequency}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">{task.prompt}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-500">
                          <span>Next: {formatRun(task.nextRunAt)}</span>
                          <span>Target: {task.target}</span>
                          <span>Model: {task.model}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => updateTask(task, { status: task.status === "active" ? "paused" : "active" })}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2 text-xs text-gray-400 hover:text-white"
                        >
                          {task.status === "active" ? <Pause size={12} /> : <Play size={12} />}
                          {task.status === "active" ? "Pause" : "Resume"}
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-500/20 px-2 text-xs text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
