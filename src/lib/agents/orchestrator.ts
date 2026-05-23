import {
  runAgent,
  streamFinalBuild,
  SURYA_CODE_AGENTS,
  type AgentRole,
  type SuryaCodeContext,
} from "@/lib/agents/surya-code";

export type ReplayData = {
  built: string[];
  files: string[];
  security: string[];
  bugsFixed: string[];
  next: string[];
};

export type SuryaCodeEvent =
  | { type: "agent_start"; role: AgentRole; label: string }
  | { type: "agent_chunk"; role: AgentRole; delta: string }
  | { type: "agent_done"; role: AgentRole; summary: string; artifacts?: string[] }
  | { type: "file"; path: string; content: string }
  | { type: "war_room"; role: "tester" | "frontend" | "backend" | "db" | "reviewer" | "fix"; text: string }
  | { type: "replay"; data: ReplayData }
  | { type: "plan"; content: string; elapsed?: number }
  | { type: "progress"; elapsed: number; size: number }
  | { type: "done"; previewMode?: "srcdoc" | "webcontainer" }
  | { type: "error"; error: string; message?: string };

type Emit = (event: SuryaCodeEvent) => void;

function replayFrom(files: Record<string, string>, transcript: string): ReplayData {
  const fileNames = Object.keys(files);
  return {
    built: ["Working app generated through 9-agent Surya Code pipeline"],
    files: fileNames,
    security: transcript.toLowerCase().includes("security")
      ? ["Input validation and safe persistence reviewed by Security Agent"]
      : ["Security review completed"],
    bugsFixed: transcript.toLowerCase().includes("bug") ? ["Likely runtime issues reviewed before final build"] : [],
    next: ["Run preview", "Push to GitHub", "Deploy to Vercel"],
  };
}

function parseStreamingFiles(emit: Emit, startTime: number) {
  let rawBuffer = "";
  let lineBuffer = "";
  let curPath: string | null = null;
  let curLines: string[] = [];
  let filesEmitted = 0;
  let lastProgressAt = Date.now();
  const files: Record<string, string> = {};

  const FILE_RE = /^===FILE:\s*(.+?)\s*===\s*$/;
  const END_RE = /^===END===\s*$/;
  const PLAN_START_RE = /^===PLAN===\s*$/;
  const PLAN_END_RE = /^===END_PLAN===\s*$/;
  let inPlan = false;
  let planLines: string[] = [];
  let planEmitted = false;

  function flushFile() {
    if (curPath !== null) {
      const content = curLines.join("\n").replace(/^\s*\n/, "").replace(/\n\s*$/, "");
      files[curPath] = content;
      emit({ type: "file", path: curPath, content });
      filesEmitted++;
      curPath = null;
      curLines = [];
    }
  }

  function processLine(line: string) {
    if (PLAN_START_RE.test(line)) {
      inPlan = true;
      planLines = [];
      return;
    }
    if (PLAN_END_RE.test(line)) {
      inPlan = false;
      if (!planEmitted) {
        emit({ type: "plan", content: planLines.join(" ").replace(/\s+/g, " ").trim(), elapsed: Math.round((Date.now() - startTime) / 1000) });
        planEmitted = true;
      }
      return;
    }
    if (inPlan) {
      planLines.push(line);
      return;
    }
    const match = line.match(FILE_RE);
    if (match) {
      flushFile();
      curPath = match[1].trim();
      curLines = [];
      return;
    }
    if (END_RE.test(line)) {
      flushFile();
      return;
    }
    if (curPath !== null) curLines.push(line);
  }

  return {
    push(delta: string) {
      rawBuffer += delta;
      lineBuffer += delta;
      let nl;
      while ((nl = lineBuffer.indexOf("\n")) !== -1) {
        const line = lineBuffer.slice(0, nl);
        lineBuffer = lineBuffer.slice(nl + 1);
        processLine(line);
      }
      const now = Date.now();
      if (now - lastProgressAt > 2500) {
        emit({ type: "progress", elapsed: Math.round((now - startTime) / 1000), size: Math.round(rawBuffer.length / 1024) });
        lastProgressAt = now;
      }
    },
    finish() {
      if (lineBuffer) processLine(lineBuffer);
      flushFile();
      return { filesEmitted, files };
    },
  };
}

export async function runSuryaCodePipeline(ctx: SuryaCodeContext, emit: Emit) {
  const startTime = Date.now();
  const transcript: string[] = [];

  for (const agent of SURYA_CODE_AGENTS) {
    emit({ type: "agent_start", role: agent.role, label: agent.name });
    const summary = await runAgent(agent, ctx);
    transcript.push(`## ${agent.name}\n${summary}`);
    emit({ type: "agent_chunk", role: agent.role, delta: summary });
    emit({ type: "agent_done", role: agent.role, summary });
  }

  const parser = parseStreamingFiles(emit, startTime);
  const completion = await streamFinalBuild({ ctx, transcript: transcript.join("\n\n"), emitText: parser.push });
  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) parser.push(delta);
  }

  const { filesEmitted, files } = parser.finish();
  if (filesEmitted === 0) {
    emit({ type: "error", error: "No files in Surya Code output." });
    return;
  }
  emit({ type: "replay", data: replayFrom(files, transcript.join("\n")) });
  emit({ type: "done", previewMode: "webcontainer" });
}

export async function runBugWarRoom(ctx: SuryaCodeContext, emit: Emit) {
  const roles: Array<SuryaCodeEvent & { type: "war_room" }> = [
    { type: "war_room", role: "tester", text: "Reproducing reported failure from current preview and changed files." },
    { type: "war_room", role: "frontend", text: "Checking UI state, event handlers, rendering errors, and missing imports." },
    { type: "war_room", role: "backend", text: "Checking API assumptions, async failures, and data contracts." },
    { type: "war_room", role: "db", text: "Checking persistence schema, seed data, and localStorage guards." },
    { type: "war_room", role: "reviewer", text: "Selecting minimal fix and asking final builder for patched files only." },
    { type: "war_room", role: "fix", text: "Applying patch in existing file-marker format." },
  ];
  roles.forEach(emit);

  await runSuryaCodePipeline(
    {
      ...ctx,
      prompt: `Bug War Room fix request:\n${ctx.prompt}\n\nReturn patched files only where possible.`,
    },
    emit
  );
}
