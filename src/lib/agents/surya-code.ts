import { aiClient, MODEL_MAP } from "@/lib/ai/client";

export type AgentRole =
  | "pm"
  | "ui"
  | "db"
  | "frontend"
  | "backend"
  | "security"
  | "tester"
  | "reviewer"
  | "devops";

export interface SuryaCodeContext {
  prompt: string;
  currentFiles?: Record<string, string>;
  clarifyAnswers?: Record<string, string>;
  chatHistory?: Array<{ role: string; content: string }>;
  brainSummary?: string;
  webContext?: string;
}

export interface SuryaCodeAgent {
  role: AgentRole;
  name: string;
  model: string;
  systemPrompt: string;
}

const CODING_MODEL = MODEL_MAP.opus;

export const SURYA_CODE_AGENTS: SuryaCodeAgent[] = [
  {
    role: "pm",
    name: "PM Agent",
    model: CODING_MODEL,
    systemPrompt: "You are Surya Code PM. Convert idea into concise PRD, scope, screens, acceptance criteria.",
  },
  {
    role: "ui",
    name: "UI/UX Agent",
    model: CODING_MODEL,
    systemPrompt: "You are UI/UX Agent. Define layout, interaction model, visual system, responsive behavior.",
  },
  {
    role: "db",
    name: "DB Agent",
    model: CODING_MODEL,
    systemPrompt: "You are DB Agent. Define data model, persistence strategy, seed data, validation.",
  },
  {
    role: "frontend",
    name: "Frontend Agent",
    model: CODING_MODEL,
    systemPrompt: "You are Frontend Agent. Plan React/vanilla UI components and client state.",
  },
  {
    role: "backend",
    name: "Backend Agent",
    model: CODING_MODEL,
    systemPrompt: "You are Backend Agent. Plan APIs, auth assumptions, business logic, error handling.",
  },
  {
    role: "security",
    name: "Security Agent",
    model: CODING_MODEL,
    systemPrompt: "You are Security Agent. Threat-model app, add safe defaults, input validation, privacy notes.",
  },
  {
    role: "tester",
    name: "Tester Agent",
    model: CODING_MODEL,
    systemPrompt: "You are Tester Agent. Write test plan, edge cases, likely runtime failures.",
  },
  {
    role: "reviewer",
    name: "Reviewer Agent",
    model: CODING_MODEL,
    systemPrompt: "You are Reviewer Agent. Find gaps, reconcile agents, decide final build plan.",
  },
  {
    role: "devops",
    name: "DevOps Agent",
    model: CODING_MODEL,
    systemPrompt: "You are DevOps Agent. Ensure project boots, scripts work, deploy notes are realistic.",
  },
];

export async function runAgent(agent: SuryaCodeAgent, ctx: SuryaCodeContext) {
  const answers = Object.entries(ctx.clarifyAnswers ?? {})
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
  const files = Object.keys(ctx.currentFiles ?? {}).slice(0, 30).join(", ") || "none";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completion = await (aiClient.chat.completions.create as any)({
    model: agent.model,
    messages: [
      {
        role: "system",
        content: `${agent.systemPrompt}${ctx.brainSummary ?? ""}\n\nReturn concise markdown. No code fences. Max 250 words.`,
      },
      {
        role: "user",
        content: `Build request:\n${ctx.prompt}\n\nClarify answers:\n${answers || "none"}\n\nExisting files: ${files}${ctx.webContext ?? ""}`,
      },
    ],
    stream: false,
    maxTokens: 900,
  });

  return String(completion?.choices?.[0]?.message?.content ?? "").trim();
}

export const SURYA_CODE_BUILD_PROMPT = `You are Surya Code final builder.

OUTPUT FORMAT — exact, no JSON, no markdown fences, no explanation:

===PLAN===
<one short paragraph describing final app>
===END_PLAN===

===FILE: package.json===
<file content>

===FILE: index.html===
<file content>

===FILE: src/main.jsx===
<file content>

===FILE: src/App.jsx===
<file content>

===FILE: src/index.css===
<file content>

===END===

Rules:
- Build a working React 18 + Vite app unless existing files are vanilla and edit is surgical.
- Include "dev": "vite" and "build": "vite build" scripts.
- All buttons, inputs, and flows must work.
- Use localStorage only inside try/catch.
- No dead placeholder UI.
- Mobile responsive.
- Use refined dark operational UI unless user requests another style.
- File content raw, no escaping.`;

export async function streamFinalBuild(args: {
  ctx: SuryaCodeContext;
  transcript: string;
  emitText: (delta: string) => void;
}) {
  const currentFiles = Object.entries(args.ctx.currentFiles ?? {})
    .map(([path, content]) => `===FILE: ${path}===\n${content.slice(0, 80_000)}`)
    .join("\n\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await (aiClient.chat.completions.create as any)({
    model: CODING_MODEL,
    messages: [
      { role: "system", content: `${SURYA_CODE_BUILD_PROMPT}${args.ctx.brainSummary ?? ""}` },
      {
        role: "user",
        content: `User request:\n${args.ctx.prompt}\n\nAgent transcript:\n${args.transcript}\n\nExisting files for edit/bug fix:\n${currentFiles || "none"}`,
      },
    ],
    stream: true,
    maxTokens: 16384,
  })) as AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>;
}
