"use client";

import { useState } from "react";
import { Plus, Save, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
interface AgentSpec {
  id: string;
  role: string;
  goal: string;
  backstory: string;
  model?: string;
  tools: string[];
}

interface TaskSpec {
  id: string;
  description: string;
  expectedOutput: string;
  agentId: string;
}

const toolOptions = ["web_search", "gmail_search", "drive_read", "calendar_list_events", "docs_create", "github_issues", "image_generate", "recall_memory"];

function id() {
  return crypto.randomUUID();
}

export default function CrewBuilderPage() {
  const [name, setName] = useState("Research + Writer Crew");
  const [description, setDescription] = useState("Two-agent custom crew for research and final answers.");
  const [process, setProcess] = useState<"sequential" | "hierarchical">("sequential");
  const [status, setStatus] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentSpec[]>([
    {
      id: id(),
      role: "Researcher",
      goal: "Find accurate source-backed information.",
      backstory: "Careful researcher who checks claims before using them.",
      tools: ["web_search"],
    },
    {
      id: id(),
      role: "Writer",
      goal: "Turn research into a clear final answer.",
      backstory: "Concise writer for Surya AI chat responses.",
      tools: ["docs_create"],
    },
  ]);
  const [tasks, setTasks] = useState<TaskSpec[]>([
    {
      id: id(),
      description: "Research the user's request and collect useful findings.",
      expectedOutput: "Research notes with useful links.",
      agentId: agents[0].id,
    },
    {
      id: id(),
      description: "Write final answer based on research notes.",
      expectedOutput: "Clear final answer.",
      agentId: agents[1].id,
    },
  ]);

  function updateAgent(agentId: string, patch: Partial<AgentSpec>) {
    setAgents((items) => items.map((agent) => (agent.id === agentId ? { ...agent, ...patch } : agent)));
  }

  function updateTask(taskId: string, patch: Partial<TaskSpec>) {
    setTasks((items) => items.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  }

  async function saveTemplate() {
    setStatus("Saving...");
    const res = await fetch("/api/crew/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        template: { process, agents, tasks },
      }),
    });
    if (!res.ok) {
      setStatus(`Save failed: ${await res.text()}`);
      return;
    }
    setStatus("Saved. Select Custom in Crew Mode to run this template.");
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(26,115,232,0.055),transparent_34%),#0f1117] px-5 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-surya-500/15 text-surya-500">
              <Users size={19} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Crew Builder</h1>
            <p className="mt-1 text-sm text-gray-500">Design saved CrewAI templates for Surya chat.</p>
          </div>
          <Button onClick={saveTemplate} className="gap-2">
            <Save size={15} />
            Save template
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <section className="rounded-2xl border border-white/10 bg-[#171a23]/90 p-4">
            <div className="space-y-3">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Template name" />
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
              <div className="grid grid-cols-2 gap-2">
                {(["sequential", "hierarchical"] as const).map((value) => (
                  <button
                    key={value}
                    onClick={() => setProcess(value)}
                    className={`h-9 rounded-lg text-xs capitalize transition-colors ${process === value ? "bg-white text-black" : "bg-white/[0.04] text-gray-400 hover:text-white"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              {status && <p className="text-xs text-gray-400">{status}</p>}
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-[#171a23]/90 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-white">Agents</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAgents((items) => [...items, { id: id(), role: "Agent", goal: "", backstory: "", tools: [] }])}
                  className="gap-2"
                >
                  <Plus size={13} /> Agent
                </Button>
              </div>
              <div className="space-y-3">
                {agents.map((agent) => (
                  <div key={agent.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="grid gap-2 md:grid-cols-3">
                      <Input value={agent.role} onChange={(event) => updateAgent(agent.id, { role: event.target.value })} placeholder="Role" />
                      <Input value={agent.goal} onChange={(event) => updateAgent(agent.id, { goal: event.target.value })} placeholder="Goal" />
                      <Input value={agent.model ?? ""} onChange={(event) => updateAgent(agent.id, { model: event.target.value })} placeholder="Model optional" />
                    </div>
                    <Textarea className="mt-2" value={agent.backstory} onChange={(event) => updateAgent(agent.id, { backstory: event.target.value })} placeholder="Backstory" />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {toolOptions.map((tool) => {
                        const active = agent.tools.includes(tool);
                        return (
                          <button
                            key={tool}
                            onClick={() => updateAgent(agent.id, { tools: active ? agent.tools.filter((item) => item !== tool) : [...agent.tools, tool] })}
                            className={`rounded-lg px-2 py-1 text-[11px] ${active ? "bg-surya-500 text-white" : "bg-white/[0.04] text-gray-500 hover:text-white"}`}
                          >
                            {tool}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#171a23]/90 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-white">Tasks</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTasks((items) => [...items, { id: id(), description: "", expectedOutput: "", agentId: agents[0]?.id ?? "" }])}
                  className="gap-2"
                >
                  <Plus size={13} /> Task
                </Button>
              </div>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <select
                      value={task.agentId}
                      onChange={(event) => updateTask(task.id, { agentId: event.target.value })}
                      className="mb-2 h-9 rounded-lg border border-white/10 bg-surface-2 px-2 text-xs text-white outline-none"
                    >
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.role}</option>
                      ))}
                    </select>
                    <Textarea value={task.description} onChange={(event) => updateTask(task.id, { description: event.target.value })} placeholder="Task description" />
                    <Input className="mt-2" value={task.expectedOutput} onChange={(event) => updateTask(task.id, { expectedOutput: event.target.value })} placeholder="Expected output" />
                    <button
                      onClick={() => setTasks((items) => items.filter((item) => item.id !== task.id))}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
