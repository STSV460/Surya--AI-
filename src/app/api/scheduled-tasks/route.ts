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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const result = (await db.scheduledTasks("find", {
      filter: { userId: session.user.id },
      sort: { createdAt: -1 },
      limit: 100,
    })) as { documents: unknown[] };
    return Response.json({ tasks: result.documents ?? [] });
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
    title: body.title,
    prompt: body.prompt,
    frequency: body.frequency,
    target: body.target,
    model: body.model,
    status: "active",
    nextRunAt: nextRunAt(body.frequency, body.runAt),
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.scheduledTasks("insertOne", { document: task });
    return Response.json({ task }, { status: 201 });
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

  const { id, ...patch } = body;
  const update = {
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  try {
    const result = (await db.scheduledTasks("updateOne", {
      filter: { id, userId: session.user.id },
      update: { $set: update },
    })) as { document: unknown };
    return Response.json({ task: result.document });
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
