import { auth } from "@/auth";
import { db } from "@/lib/insforge";
import { parseJson, parseSearchParams, isResponse } from "@/lib/validation";
import { z } from "zod";

const frequencySchema = z.enum(["once", "hourly", "daily", "weekly"]);
const statusSchema = z.enum(["active", "paused"]);
const targetSchema = z.enum(["chat", "code", "research"]);

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(4000),
  frequency: frequencySchema.default("once"),
  target: targetSchema.default("chat"),
  model: z.string().trim().min(1).max(80).default("opus"),
  runAt: z.string().datetime().optional(),
});

const updateTaskSchema = z.object({
  id: z.string().trim().min(1).max(160),
  status: statusSchema.optional(),
  title: z.string().trim().min(1).max(120).optional(),
  prompt: z.string().trim().min(1).max(4000).optional(),
  frequency: frequencySchema.optional(),
  target: targetSchema.optional(),
  model: z.string().trim().min(1).max(80).optional(),
  nextRunAt: z.string().datetime().optional(),
});

const deleteTaskSchema = z.object({
  id: z.string().trim().min(1).max(160),
});

interface ScheduledTaskRow {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  cronExpression?: string;
  isActive?: boolean;
  nextRun?: string | null;
  lastRun?: string | null;
  createdAt?: string;
}

function nextRunAt(frequency: z.infer<typeof frequencySchema>, runAt?: string) {
  const base = runAt ? new Date(runAt) : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(base.getTime())) return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  if (base.getTime() > Date.now()) return base.toISOString();

  const next = new Date(base);
  while (next.getTime() <= Date.now()) {
    if (frequency === "hourly") next.setHours(next.getHours() + 1);
    else if (frequency === "daily") next.setDate(next.getDate() + 1);
    else if (frequency === "weekly") next.setDate(next.getDate() + 7);
    else next.setHours(next.getHours() + 1);
  }
  return next.toISOString();
}

function frequencyToCron(frequency: z.infer<typeof frequencySchema>, runAt?: string) {
  const date = new Date(nextRunAt(frequency, runAt));
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  if (frequency === "hourly") return `${minute} * * * *`;
  if (frequency === "daily") return `${minute} ${hour} * * *`;
  if (frequency === "weekly") return `${minute} ${hour} * * ${dayOfWeek}`;
  return `${minute} ${hour} ${dayOfMonth} ${month} *`;
}

function cronToFrequency(cron?: string): z.infer<typeof frequencySchema> {
  if (!cron) return "daily";
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "daily";
  if (parts[1] === "*" && parts[2] === "*" && parts[3] === "*" && parts[4] === "*") return "hourly";
  if (parts[2] === "*" && parts[3] === "*" && parts[4] === "*") return "daily";
  if (parts[2] === "*" && parts[3] === "*" && parts[4] !== "*") return "weekly";
  return "once";
}

function inferTarget(prompt: string): z.infer<typeof targetSchema> {
  const value = prompt.toLowerCase();
  if (value.includes("code") || value.includes("bug") || value.includes("build") || value.includes("project")) return "code";
  if (value.includes("research") || value.includes("news") || value.includes("search") || value.includes("brief")) return "research";
  return "chat";
}

function normalizeTask(row: unknown) {
  const task = row as Partial<ScheduledTaskRow>;
  const prompt = task.prompt ?? "";
  return {
    id: task.id,
    title: task.name ?? "Scheduled task",
    prompt,
    frequency: cronToFrequency(task.cronExpression),
    target: inferTarget(prompt),
    model: "opus",
    status: task.isActive === false ? "paused" : "active",
    nextRunAt: task.nextRun ?? undefined,
    lastRunAt: task.lastRun ?? undefined,
    createdAt: task.createdAt,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const result = (await db.scheduledTasks("find", {
      filter: { userId: session.user.id },
      sort: { createdAt: -1 },
      limit: 100,
    })) as { documents: unknown[] };
    return Response.json({ tasks: (result.documents ?? []).map(normalizeTask) });
  } catch (err) {
    console.error("[scheduled-tasks] GET failed:", err);
    return Response.json({ tasks: [], error: "Failed to load scheduled tasks" });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const body = await parseJson(req, createTaskSchema);
  if (isResponse(body)) return body;

  const now = new Date().toISOString();
  const task = {
    id: crypto.randomUUID(),
    userId: session.user.id,
    name: body.title,
    prompt: body.prompt,
    cronExpression: frequencyToCron(body.frequency, body.runAt),
    nextRun: nextRunAt(body.frequency, body.runAt),
    createdAt: now,
  };

  try {
    const result = (await db.scheduledTasks("insertOne", { document: task })) as { document: unknown };
    return Response.json({ task: normalizeTask(result.document) }, { status: 201 });
  } catch (err) {
    console.error("[scheduled-tasks] POST failed:", err);
    const msg = err instanceof Error ? err.message : "save failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const body = await parseJson(req, updateTaskSchema);
  if (isResponse(body)) return body;

  const update: Record<string, unknown> = {};
  if (body.status) update.isActive = body.status === "active";
  if (body.title) update.name = body.title;
  if (body.prompt) update.prompt = body.prompt;
  if (body.frequency) update.cronExpression = frequencyToCron(body.frequency, body.nextRunAt);
  if (body.nextRunAt) update.nextRun = nextRunAt(body.frequency ?? "daily", body.nextRunAt);

  try {
    const result = (await db.scheduledTasks("updateOne", {
      filter: { id: body.id, userId: session.user.id },
      update: { $set: update },
    })) as { document: unknown };
    return Response.json({ task: normalizeTask(result.document) });
  } catch (err) {
    console.error("[scheduled-tasks] PATCH failed:", err);
    return Response.json({ error: "update failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const params = parseSearchParams(req, deleteTaskSchema);
  if (isResponse(params)) return params;

  try {
    await db.scheduledTasks("deleteOne", { filter: { id: params.id, userId: session.user.id } });
    return Response.json({ success: true });
  } catch (err) {
    console.error("[scheduled-tasks] DELETE failed:", err);
    return Response.json({ error: "delete failed" }, { status: 500 });
  }
}
