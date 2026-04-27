import { auth } from "@/auth";
import { aiClient, MODEL_MAP } from "@/lib/ai/client";
import { aiLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

function isSimpleApp(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const complexKeywords = ["react", "vue", "angular", "npm", "node", "express", "next", "vite", "webpack"];
  const simpleKeywords = ["html", "page", "landing", "form", "calculator", "game", "quiz", "timer", "clock", "todo", "counter"];
  if (complexKeywords.some((k) => lower.includes(k))) return false;
  if (simpleKeywords.some((k) => lower.includes(k))) return true;
  if (prompt.trim().length < 80) return true;
  return false;
}

const SIMPLE_SYSTEM_PROMPT = `You are an expert web developer. The user wants a web app or page.

OUTPUT FORMAT — exact, no JSON, no markdown fences, no explanation:

===PLAN===
<one short paragraph (2-3 sentences) in plain English describing what you'll build and key design choices. Friendly, confident tone. No bullet lists.>
===END_PLAN===

===FILE: index.html===
<file content here, raw, no escaping>

===FILE: style.css===
<file content here>

===FILE: script.js===
<file content here>

===END===

Rules for the format:
- Each file starts with a line: ===FILE: <path>===
- File content is raw, no escaping, no quotes
- Finish with a line: ===END===
- Do NOT wrap in JSON. Do NOT use markdown code fences. Do NOT add commentary.

CRITICAL functionality rules — the app MUST actually work:
- Every button, input, form MUST have a working event handler — no dead UI
- Wire ALL event listeners inside a DOMContentLoaded handler OR place the <script> at end of <body>
- Use event delegation or addEventListener — never inline onclick in HTML unless trivial
- Read input values with element.value; update DOM with textContent/innerHTML after state change
- Persist state to localStorage when useful — but ALWAYS wrap localStorage.getItem/setItem in try/catch and fall back to in-memory defaults. The preview runs in a sandboxed iframe where localStorage may throw SecurityError; an unhandled throw inside DOMContentLoaded will kill ALL event listeners and break the app.
- Handle Enter key in inputs (keydown with e.key === 'Enter')
- Test every interaction path in your head before outputting code
- If you add a "+" button to add items, make sure clicking it ACTUALLY appends to the list AND clears the input

Tech rules:
- Vanilla HTML/CSS/JS only — no React, no npm, no build step
- Load libraries (Chart.js, Tailwind CDN, etc.) from CDN inside index.html
- index.html must be complete standalone page
- style.css and script.js optional — include only if needed
- Script tag at end of <body> OR wrap init in DOMContentLoaded

Design rules:
- Beautiful modern dark UI by default, polished
- Responsive, mobile-first
- Use Inter font via Google Fonts
- Smooth hover transitions, focus states, subtle shadows
- Empty-state messages when list is empty`;

const WEBCONTAINER_SYSTEM_PROMPT = `You are an expert app builder AI. The user will describe a web app.

OUTPUT FORMAT — exact, no JSON, no markdown fences, no explanation:

===PLAN===
<one short paragraph (2-3 sentences) in plain English describing what you'll build and key design choices. Friendly, confident tone. No bullet lists.>
===END_PLAN===

===FILE: package.json===
<file content>

===FILE: vite.config.js===
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

Format rules:
- Each file starts with: ===FILE: <path>===
- Content is raw — no escaping, no quotes, no JSON wrapping
- End with: ===END===
- No markdown fences, no commentary

Requirements:
- Use React 18 with Vite. TypeScript is allowed: when used, include a tsconfig.json with strict:false and use .tsx/.ts extensions; vite handles compilation. Default to plain JSX (.jsx) unless the user requested TypeScript.
- package.json must have "dev": "vite" and "build": "vite build" scripts. If TS is used, include @vitejs/plugin-react and "typescript" in devDependencies.
- All buttons and features fully working — no placeholders
- Prefer Tailwind CDN via <script> in index.html (no PostCSS setup)
- Beautiful modern dark UI by default, responsive, polished
- Code must run without errors on first boot
- Do not use packages requiring native bindings or Node.js APIs
- Use lucide-react for icons if needed`;

const CLARIFY_SYSTEM_PROMPT = `You help scope a web app build. Given a build request, ask 3 to 5 SHORT clarifying questions covering:
- stack/framework preference (vanilla vs React; TypeScript yes/no)
- key features or scope cuts
- design/style direction
- data persistence (localStorage, none, etc.)
- target user / device

Return ONLY a single JSON object, no prose, no markdown:
{"questions":[{"id":"q1","q":"...","suggestions":["...","...","..."]}, ...]}

Rules:
- Each question text under 80 chars.
- 2-4 suggestion chips per question, each under 24 chars.
- Skip a topic if the user already specified it in the prompt.
- 3 questions if request is detailed; 5 if vague.
- Keep questions casual and human, not interrogative.`;

function shouldSkipClarify(prompt: string): boolean {
  // Lovable-style: only ask clarify when the prompt is genuinely vague.
  // Skip clarify (= go straight to thought + code) when ANY of:
  //   - prompt has feature/style specifics
  //   - prompt is reasonably long
  //   - prompt names a known app type with at least one detail
  const trimmed = prompt.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= 8) return true;
  if (trimmed.length >= 60) return true;
  const lower = trimmed.toLowerCase();
  const detailKeywords = [
    "dark", "light", "theme", "responsive", "mobile", "minimal", "modern",
    "gradient", "animated", "react", "typescript", "tailwind", "with ", " and ",
  ];
  if (detailKeywords.some((k) => lower.includes(k))) return true;
  return false;
}

function buildEditPrompt(
  prompt: string,
  currentFiles: Record<string, string>,
  chatHistory: { role: string; content: string }[]
): string {
  const historyText = chatHistory
    .slice(-8)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const filesText = Object.entries(currentFiles)
    .map(([path, content]) => `===FILE: ${path}===\n${content}`)
    .join("\n\n");

  return `You are editing an existing web app.

Previous conversation:
${historyText}

User's new request: "${prompt}"

Current files (same marker format):
${filesText}

===END===

Return ONLY the files that need to change, in the same marker format:
===FILE: <path>===
<new content>
===FILE: <path>===
<new content>
===END===

Do NOT include unchanged files. Make surgical edits only.
No JSON, no markdown fences, no commentary.`;
}

function emit(controller: ReadableStreamDefaultController, event: object) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const userId = (session.user as { id: string }).id;

  // Rate limiting — 10 AI requests per minute per user
  const { success } = await aiLimiter.check(userId);
  if (!success) {
    return Response.json(
      { error: "Too many requests. Please wait before generating another app." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: {
    mode?: string;
    prompt?: string;
    currentFiles?: Record<string, string>;
    chatHistory?: { role: string; content: string }[];
    clarifyAnswers?: Record<string, string>;
    images?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode =
    body.mode === "edit"
      ? "edit"
      : body.mode === "clarify"
      ? "clarify"
      : body.mode === "followups"
      ? "followups"
      : "generate";
  const prompt = body.prompt?.trim();
  if (!prompt) return Response.json({ error: "prompt is required" }, { status: 400 });

  // Followups branch — short JSON list of next-step suggestions
  if (mode === "followups") {
    try {
      const fileList = Object.keys(body.currentFiles ?? {}).slice(0, 12).join(", ");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completion = await (aiClient.chat.completions.create as any)({
        model: MODEL_MAP.sonnet,
        messages: [
          {
            role: "system",
            content: `You suggest 4 short next-step ideas for a web app the user just built. Each suggestion is a 2-4 word imperative phrase the user can click to extend the app. Examples: "Add dark mode", "Save to localStorage", "Add sound effects", "Mobile breakpoints". Return ONLY JSON: {"items":["...","...","...","..."]}. No prose.`,
          },
          {
            role: "user",
            content: `App built from prompt: "${prompt}"\nFiles: ${fileList}\nGive 4 distinct, useful, specific suggestions.`,
          },
        ],
        stream: false,
        maxTokens: 256,
      });
      const content: string = completion?.choices?.[0]?.message?.content ?? "";
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) return Response.json({ items: [] });
      const parsed = JSON.parse(m[0]);
      const items = Array.isArray(parsed?.items)
        ? parsed.items.slice(0, 4).map((s: unknown) => String(s).slice(0, 32))
        : [];
      return Response.json({ items });
    } catch {
      return Response.json({ items: [] });
    }
  }

  // Clarify branch — non-streaming JSON response
  if (mode === "clarify") {
    if (shouldSkipClarify(prompt)) {
      return Response.json({ skip: true, questions: [] });
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const completion = await (aiClient.chat.completions.create as any)({
        model: MODEL_MAP.sonnet,
        messages: [
          { role: "system", content: CLARIFY_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        stream: false,
        maxTokens: 1024,
      });
      const content: string =
        completion?.choices?.[0]?.message?.content ?? "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return Response.json({ skip: true, questions: [] });
      const parsed = JSON.parse(jsonMatch[0]);
      const questions = Array.isArray(parsed?.questions)
        ? parsed.questions.slice(0, 5).map((q: { id?: string; q?: string; suggestions?: unknown[] }, i: number) => ({
            id: typeof q?.id === "string" ? q.id : `q${i + 1}`,
            q: String(q?.q ?? "").slice(0, 200),
            suggestions: Array.isArray(q?.suggestions)
              ? q.suggestions.slice(0, 4).map((s) => String(s).slice(0, 40))
              : [],
          }))
        : [];
      return Response.json({ skip: questions.length === 0, questions });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Clarify failed";
      return Response.json({ skip: true, questions: [], error: msg });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      // Heartbeat every 8s so the fetch stays alive through proxies/browser idle timers
      const heartbeat = setInterval(() => {
        try {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          emit(controller, { type: "ping", elapsed });
        } catch {
          /* ignore */
        }
      }, 8000);

      try {
        let systemPrompt: string;
        let userContent: string;
        let previewMode: "srcdoc" | "webcontainer";

        if (mode === "edit") {
          const currentFiles = body.currentFiles ?? {};
          const chatHistory = body.chatHistory ?? [];
          const hasPackageJson = "package.json" in currentFiles;
          previewMode = hasPackageJson ? "webcontainer" : "srcdoc";
          systemPrompt = hasPackageJson ? WEBCONTAINER_SYSTEM_PROMPT : SIMPLE_SYSTEM_PROMPT;
          userContent = buildEditPrompt(prompt, currentFiles, chatHistory);
        } else {
          const simple = isSimpleApp(prompt);
          previewMode = simple ? "srcdoc" : "webcontainer";
          systemPrompt = simple ? SIMPLE_SYSTEM_PROMPT : WEBCONTAINER_SYSTEM_PROMPT;
          const ans = body.clarifyAnswers ?? {};
          const ansLines = Object.entries(ans)
            .filter(([, v]) => typeof v === "string" && v.trim())
            .map(([k, v]) => `- ${k}: ${v}`)
            .join("\n");
          userContent = ansLines
            ? `Build this: ${prompt}\n\nUser preferences from clarifying questions:\n${ansLines}`
            : `Build this: ${prompt}`;
        }

        emit(controller, {
          type: "text",
          content: mode === "edit"
            ? `Updating app: "${prompt}"...\n`
            : `Building ${previewMode === "srcdoc" ? "a lightweight" : "a React"} app: "${prompt}"...\n`,
        });

        // Build user message — vision format if images attached
        const images = (body.images ?? []).filter(
          (u) => typeof u === "string" && u.startsWith("data:image/")
        );
        const userMessage: { role: "user"; content: unknown } = images.length > 0
          ? {
              role: "user",
              content: [
                { type: "text", text: userContent },
                ...images.map((url) => ({ type: "image_url", image_url: { url } })),
              ],
            }
          : { role: "user", content: userContent };

        // Stream the AI response
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completion = await (aiClient.chat.completions.create as any)({
          model: MODEL_MAP.sonnet,
          messages: [
            { role: "system", content: systemPrompt },
            userMessage,
          ],
          stream: true,
          maxTokens: 16384,
        }) as AsyncIterable<{
          choices: Array<{ delta: { content?: string }; finish_reason?: string }>;
        }>;

        // Streaming marker parser:
        //   ===FILE: <path>===
        //   <raw content>
        //   ===FILE: <next>===
        //   ...
        //   ===END===
        let rawBuffer = "";
        let lineBuffer = "";
        let curPath: string | null = null;
        let curLines: string[] = [];
        let filesEmitted = 0;
        let lastProgressAt = Date.now();

        const FILE_RE = /^===FILE:\s*(.+?)\s*===\s*$/;
        const END_RE = /^===END===\s*$/;
        const PLAN_START_RE = /^===PLAN===\s*$/;
        const PLAN_END_RE = /^===END_PLAN===\s*$/;
        let inPlan = false;
        let planLines: string[] = [];
        let planEmitted = false;
        const planStartedAt = Date.now();

        function flushFile() {
          if (curPath !== null) {
            const content = curLines.join("\n").replace(/^\s*\n/, "").replace(/\n\s*$/, "");
            emit(controller, { type: "file", path: curPath, content });
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
            const text = planLines.join(" ").trim().replace(/\s+/g, " ");
            if (text && !planEmitted) {
              const elapsed = Math.round((Date.now() - planStartedAt) / 1000);
              emit(controller, { type: "plan", content: text, elapsed });
              planEmitted = true;
            }
            return;
          }
          if (inPlan) {
            planLines.push(line);
            return;
          }
          const m = line.match(FILE_RE);
          if (m) {
            flushFile();
            curPath = m[1].trim();
            curLines = [];
            return;
          }
          if (END_RE.test(line)) {
            flushFile();
            return;
          }
          if (curPath !== null) curLines.push(line);
        }

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (!delta) continue;
          rawBuffer += delta;
          lineBuffer += delta;

          // Process complete lines, keep partial
          let nl;
          while ((nl = lineBuffer.indexOf("\n")) !== -1) {
            const line = lineBuffer.slice(0, nl);
            lineBuffer = lineBuffer.slice(nl + 1);
            processLine(line);
          }

          const now = Date.now();
          if (now - lastProgressAt > 2500) {
            emit(controller, {
              type: "progress",
              elapsed: Math.round((now - startTime) / 1000),
              size: Math.round(rawBuffer.length / 1024),
            });
            lastProgressAt = now;
          }
        }

        // Process trailing partial line, then flush any open file (handles truncation gracefully)
        if (lineBuffer.length > 0) processLine(lineBuffer);
        flushFile();

        if (filesEmitted === 0) {
          emit(controller, {
            type: "error",
            error: "No files in AI output. Try a more specific prompt.",
          });
          clearInterval(heartbeat);
          controller.close();
          return;
        }

        emit(controller, { type: "done", previewMode });
        clearInterval(heartbeat);
        controller.close();
      } catch (err) {
        clearInterval(heartbeat);
        const msg = err instanceof Error ? err.message : "Unknown error";
        emit(controller, { type: "error", error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
