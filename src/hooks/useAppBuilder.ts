"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useAppBuilderStore,
  type AppBuilderMessage,
  type WorkspaceState,
  type SuryaCodeView,
} from "@/stores/appBuilderStore";
import { useWebContainer } from "@/hooks/useWebContainer";

const GENERATION_CLIENT_TIMEOUT_MS = 180_000;

function buildSrcdoc(files: Record<string, string>): string {
  const html = files["index.html"] ?? "";
  if (!html) return "";

  const css =
    files["style.css"] ??
    files["src/style.css"] ??
    files["styles.css"] ??
    "";
  const js =
    files["script.js"] ??
    files["src/script.js"] ??
    files["src/main.js"] ??
    files["main.js"] ??
    "";

  let result = html
    .replace(/<link[^>]+href=["'](?:\.\/)?(?:style|styles|src\/style)\.css["'][^>]*>/gi, "")
    .replace(/<script[^>]+src=["'](?:\.\/)?(?:script|main|src\/script|src\/main)\.js["'][^>]*><\/script>/gi, "");

  if (css) {
    if (result.includes("</head>")) {
      result = result.replace("</head>", `<style>\n${css}\n</style>\n</head>`);
    } else {
      result = `<style>\n${css}\n</style>\n` + result;
    }
  }

  if (js) {
    if (result.includes("</body>")) {
      result = result.replace("</body>", `<script>\n${js}\n</script>\n</body>`);
    } else {
      result = result + `\n<script>\n${js}\n</script>`;
    }
  }

  const storageShim = `<script id="__surya-storage-shim__">(function(){try{window.localStorage.setItem('__t','1');window.localStorage.removeItem('__t');}catch(e){var m={};var s={getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null;},setItem:function(k,v){m[k]=String(v);},removeItem:function(k){delete m[k];},clear:function(){m={};},key:function(i){return Object.keys(m)[i]||null;},get length(){return Object.keys(m).length;}};try{Object.defineProperty(window,'localStorage',{value:s,configurable:true});Object.defineProperty(window,'sessionStorage',{value:s,configurable:true});}catch(_){}}})();</script>`;
  if (result.includes("<head>")) {
    result = result.replace("<head>", `<head>\n${storageShim}`);
  } else if (result.includes("</head>")) {
    result = result.replace("</head>", `${storageShim}\n</head>`);
  } else {
    result = storageShim + "\n" + result;
  }

  const pickerScript = `<script id="__surya-picker__">(function(){var active=false,hovered=null;window.addEventListener('message',function(e){if(!e.data)return;if(e.data.type==='activate-picker'){active=true;document.body.style.cursor='crosshair';}else if(e.data.type==='deactivate-picker'){active=false;document.body.style.cursor='';if(hovered){hovered.style.outline='';hovered=null;}}});document.addEventListener('mouseover',function(e){if(!active)return;if(hovered&&hovered!==e.target)hovered.style.outline='';hovered=e.target;hovered.style.outline='2px solid #1A73E8';},true);document.addEventListener('click',function(e){if(!active)return;e.preventDefault();e.stopPropagation();active=false;document.body.style.cursor='';if(hovered)hovered.style.outline='';var el=e.target;window.parent.postMessage({type:'element-picked',tagName:el.tagName.toLowerCase(),id:el.id||null,className:(typeof el.className==='string'?el.className:null),textContent:(el.textContent||'').trim().slice(0,100),outerHTML:el.outerHTML.slice(0,300)},'*');},true);})();</script>`;

  if (result.includes("</body>")) {
    result = result.replace("</body>", `${pickerScript}\n</body>`);
  } else {
    result = result + `\n${pickerScript}`;
  }

  return result;
}

async function persistProjectSnapshot(args: {
  projectId: string;
  files: Record<string, string>;
  messages: AppBuilderMessage[];
  previewMode: string;
  workspaceState?: WorkspaceState;
  name?: string;
}) {
  try {
    await fetch(`/api/app-builder/projects/${args.projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: args.files,
        // Store everything except transient streaming flags
        messages: args.messages.map((m) => ({
          ...m,
          isStreaming: false,
        })),
        previewMode: args.previewMode,
        workspaceState: args.workspaceState,
        ...(args.name ? { name: args.name } : {}),
      }),
    });
  } catch {
    // Best-effort; UI keeps working in-memory
  }
}

function filesEmittedSuccess(newFiles: Record<string, string>): boolean {
  return Object.keys(newFiles).length > 0;
}

function visiblePrompt(prompt: string): string {
  return prompt
    .replace(/<app-builder-skill[\s\S]*?<\/app-builder-skill>\s*/g, "")
    .replace(/<app-builder-mcps>[\s\S]*?<\/app-builder-mcps>\s*/g, "")
    .trim();
}

function deriveProjectName(prompt: string): string {
  const cleaned = visiblePrompt(prompt).trim().split("\n")[0].slice(0, 60);
  return cleaned || "Untitled App";
}

export function useAppBuilder() {
  const store = useAppBuilderStore();
  const wc = useWebContainer();
  const abortRef = useRef<AbortController | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const srcdocHtml = useMemo(
    () => (store.previewMode === "srcdoc" ? buildSrcdoc(store.files) : ""),
    [store.files, store.previewMode]
  );

  useEffect(() => {
    if (store.isStreaming) {
      const startedAt = Date.now();
      store.setElapsedSeconds(0);
      tickerRef.current = setInterval(() => {
        store.setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000));
      }, 500);
    } else if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isStreaming]);

  // Ensure a project row exists. Creates one lazily if not already present.
  const ensureProject = useCallback(
    async (suggestedName: string): Promise<{ id: string; name: string } | null> => {
      if (store.projectId) return { id: store.projectId, name: store.projectName };
      try {
        const res = await fetch("/api/app-builder/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: suggestedName }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { document?: { id: string; name: string } };
        if (!data.document) return null;
        store.setProject({ id: data.document.id, name: data.document.name });
        store.upsertProjectMeta({
          id: data.document.id,
          name: data.document.name,
          previewMode: "none",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return { id: data.document.id, name: data.document.name };
      } catch {
        return null;
      }
    },
    [store]
  );

  const runGenerate = useCallback(
    async (
      prompt: string,
      clarifyAnswers: Record<string, string> | null,
      images?: string[],
      projectIdOverride?: string
    ) => {
      const isFirstBuild = Object.keys(store.files).length === 0;
      const mode = isFirstBuild ? "surya_code" : "edit";
      const requestProjectId = projectIdOverride ?? store.projectId ?? undefined;

      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: AppBuilderMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        kind: "text",
      };
      store.addMessage(assistantMsg);
      store.setIsStreaming(true);
      store.setBuildError(null);

      const body =
        mode === "surya_code"
          ? { mode, prompt, projectId: requestProjectId, clarifyAnswers: clarifyAnswers ?? undefined, images }
          : {
              mode,
              prompt,
              projectId: requestProjectId,
              currentFiles: store.files,
              chatHistory: store.messages
                .filter((m) => !m.isStreaming && m.kind !== "clarify")
                .slice(-16)
                .map((m) => ({ role: m.role, content: m.content })),
              images,
            };

      abortRef.current = new AbortController();
      const timeoutId = setTimeout(() => abortRef.current?.abort(), GENERATION_CLIENT_TIMEOUT_MS);

      let finalPreviewMode: "srcdoc" | "webcontainer" | "none" = store.previewMode;
      const newFiles: Record<string, string> = {};

      try {
        const res = await fetch("/api/app-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          const err = await res.text();
          store.updateLastAssistantMessage(`Error: ${err}`, false, { error: true });
          store.setIsStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let statusLine = mode === "edit" ? "Updating app…" : "Generating code…";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;

            let event: {
              type: string;
              content?: string;
              path?: string;
              previewMode?: string;
              error?: string;
              message?: string;
              role?: string;
              label?: string;
              delta?: string;
              summary?: string;
              text?: string;
              data?: {
                built: string[];
                files: string[];
                security: string[];
                bugsFixed: string[];
                next: string[];
              };
              elapsed?: number;
              size?: number;
              task?: Record<string, unknown> & { id?: string; title?: string; owner?: string; status?: "queued" | "running" | "done" | "blocked" | "error" };
              entry?: Record<string, unknown>;
              patch?: Record<string, unknown>;
            };
            try {
              event = JSON.parse(json);
            } catch {
              continue;
            }

            if (event.type === "plan" && event.content) {
              store.patchMessage(assistantMsgId, {
                plan: event.content,
                thoughtSeconds: event.elapsed ?? 0,
              });
            } else if (event.type === "text" && event.content) {
              statusLine = event.content.trim();
              store.updateLastAssistantMessage(statusLine, true);
            } else if (event.type === "progress") {
              const elapsed = event.elapsed ?? 0;
              const size = event.size ?? 0;
              store.updateLastAssistantMessage(
                `${statusLine}\n\nGenerating… ${elapsed}s · ${size} KB received`,
                true,
                { elapsed }
              );
            } else if (event.type === "ping") {
              if (typeof event.elapsed === "number") {
                store.updateLastAssistantMessage(statusLine, true, { elapsed: event.elapsed });
              }
            } else if (event.type === "agent_start" && event.role && event.label) {
              const current = useAppBuilderStore.getState().messages.find((m) => m.id === assistantMsgId);
              const next = [...(current?.agentEvents ?? []).filter((a) => a.role !== event.role), {
                role: event.role,
                label: event.label,
                status: "running" as const,
                summary: "",
              }];
              store.patchMessage(assistantMsgId, { agentEvents: next, content: "Surya Code agents are building..." });
            } else if (event.type === "agent_chunk" && event.role && event.delta !== undefined) {
              const current = useAppBuilderStore.getState().messages.find((m) => m.id === assistantMsgId);
              const next = (current?.agentEvents ?? []).map((a) =>
                a.role === event.role ? { ...a, summary: `${a.summary}${event.delta}` } : a
              );
              store.patchMessage(assistantMsgId, { agentEvents: next });
            } else if (event.type === "agent_done" && event.role) {
              const current = useAppBuilderStore.getState().messages.find((m) => m.id === assistantMsgId);
              const next = (current?.agentEvents ?? []).map((a) =>
                a.role === event.role ? { ...a, status: "done" as const, summary: event.summary ?? a.summary } : a
              );
              store.patchMessage(assistantMsgId, { agentEvents: next });
            } else if (event.type === "war_room" && event.role && event.text) {
              const current = useAppBuilderStore.getState().messages.find((m) => m.id === assistantMsgId);
              store.patchMessage(assistantMsgId, {
                warRoomEvents: [...(current?.warRoomEvents ?? []), { role: event.role, text: event.text }],
                content: "Bug War Room is diagnosing...",
              });
            } else if (event.type === "replay" && event.data) {
              store.patchMessage(assistantMsgId, { replay: event.data });
            } else if (event.type === "terminal_log") {
              store.appendTerminalLog(event.entry ?? { message: event.content ?? event.message ?? "" });
            } else if (event.type === "background_task" && event.task) {
              store.addBackgroundTask({
                id: event.task.id,
                title: String(event.task.title ?? "Background task"),
                owner: String(event.task.owner ?? event.role ?? "agent"),
                status: event.task.status ?? "running",
              });
            } else if (event.type === "checkpoint") {
              store.createCheckpoint(event.message ?? event.content ?? "SSE checkpoint");
            } else if (event.type === "permission_request") {
              store.setPermissions({ pending: event });
              store.addSecurityReplay({ action: "permission_request", agent: event.role, command: event.message ?? event.content, checkpointAvailable: true });
            } else if (event.type === "repo_import" && event.patch) {
              store.setRepo(event.patch);
              store.updateRepoBrain({ lastImport: event.patch });
            } else if (event.type === "pr_event" && event.patch) {
              store.upsertPullRequest(event.patch);
            } else if (event.type === "review_comment" && event.patch) {
              store.upsertReviewComment(event.patch);
            } else if (event.type === "hook_run" && event.patch) {
              store.addBackgroundTask({ title: String(event.patch.title ?? "Hook run"), owner: "hook", status: "done", result: String(event.patch.result ?? "") });
            } else if (event.type === "cost_update" && event.patch) {
              store.updateCostMeter(event.patch);
            } else if (event.type === "quality_score" && event.patch) {
              store.updateQualityScore(event.patch);
            } else if (event.type === "qa_event" && event.patch) {
              store.addBackgroundTask({ title: String(event.patch.title ?? "QA event"), owner: "qa", status: "done", result: String(event.patch.result ?? "") });
            } else if (event.type === "security_scan" && event.patch) {
              store.addBackgroundTask({ title: String(event.patch.title ?? "Security scan"), owner: "security", status: "done", risk: "medium", result: String(event.patch.result ?? "") });
            } else if (event.type === "deploy_observation" && event.patch) {
              store.addDeployObservation(event.patch);
            } else if (event.type === "vision_event" && event.patch) {
              store.addBackgroundTask({ title: String(event.patch.title ?? "Vision Build"), owner: "ui", status: "done", result: String(event.patch.result ?? "") });
            } else if (event.type === "security_replay" && event.patch) {
              store.addSecurityReplay({ action: String(event.patch.action ?? "security event"), command: String(event.patch.command ?? ""), agent: String(event.patch.agent ?? "") });
            } else if (event.type === "file" && event.path && event.content !== undefined) {
              newFiles[event.path] = event.content;
              store.patchFiles({ [event.path]: event.content });
              store.setActiveFile(event.path);
            } else if (event.type === "done") {
              const pm = event.previewMode as "srcdoc" | "webcontainer";
              finalPreviewMode = pm;
              store.setPreviewMode(pm);
              store.updateLastAssistantMessage(
                mode === "edit" ? "App updated." : "App ready. Preview on the right.",
                false
              );

              if (pm === "webcontainer") {
                const mergedFiles =
                  mode === "edit" ? { ...store.files, ...newFiles } : newFiles;
                wc.mountApp(mergedFiles);
              }

              const firstFile =
                Object.keys(newFiles)[0] ?? Object.keys(store.files)[0] ?? null;
              if (firstFile) store.setActiveFile(firstFile);
            } else if (event.type === "error") {
              store.updateLastAssistantMessage(`Error: ${event.error ?? event.message ?? "Unknown error"}`, false, {
                error: true,
              });
              store.setBuildError(event.error ?? event.message ?? "Unknown error");
            }
          }
        }
      } catch (err) {
        const isAbort = (err as Error).name === "AbortError";
        const msg = isAbort
          ? "Generation took too long. Try a simpler prompt or retry."
          : err instanceof Error
          ? err.message
          : "Unknown error";
        store.updateLastAssistantMessage(`Error: ${msg}`, false, { error: true });
        store.setBuildError(msg);
      } finally {
        clearTimeout(timeoutId);
        store.setIsStreaming(false);
      }

      // After successful build, fetch follow-up suggestions
      if (filesEmittedSuccess(newFiles) && finalPreviewMode !== "none") {
        try {
          const mergedFiles = { ...store.files, ...newFiles };
          const fres = await fetch("/api/app-builder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              mode: "followups",
              prompt,
              projectId: store.projectId ?? undefined,
              currentFiles: mergedFiles,
            }),
          });
          if (fres.ok) {
            const fdata = (await fres.json()) as { items?: string[] };
            if (Array.isArray(fdata.items) && fdata.items.length > 0) {
              store.patchMessage(assistantMsgId, { followUps: fdata.items });
            }
          }
        } catch {
          // ignore
        }
      }

      // Persist snapshot
      const pid = requestProjectId ?? store.projectId;
      if (pid) {
        const mergedFiles = { ...store.files, ...newFiles };
        const now = new Date().toISOString();
        await persistProjectSnapshot({
          projectId: pid,
          files: mergedFiles,
          messages: useAppBuilderStore.getState().messages,
          previewMode: finalPreviewMode,
          workspaceState: useAppBuilderStore.getState().workspaceState,
          name: isFirstBuild ? deriveProjectName(prompt) : undefined,
        });
        store.upsertProjectMeta({
          id: pid,
          name: isFirstBuild ? deriveProjectName(prompt) : store.projectName || "Untitled App",
          previewMode: finalPreviewMode,
          createdAt: now,
          updatedAt: now,
        });
      }
    },
    [store, wc]
  );

  const handleSlashCommand = useCallback((raw: string) => {
    const command = raw.trim().toLowerCase();
    const viewMap: Record<string, SuryaCodeView> = {
      "/preview": "preview",
      "/diff": "diff",
      "/terminal": "terminal",
      "/files": "files",
      "/tasks": "tasks",
      "/plan": "plan",
    };
    if (viewMap[command]) {
      store.setWorkspaceView(viewMap[command]);
      return true;
    }
    if (command === "/checkpoint") {
      const checkpoint = store.createCheckpoint("Manual checkpoint");
      store.addMessage({ id: crypto.randomUUID(), role: "assistant", content: `Checkpoint created: ${checkpoint.label}`, kind: "text" });
      return true;
    }
    const taskCommands: Record<string, { title: string; owner: string; view?: SuryaCodeView; risk?: "low" | "medium" | "high" }> = {
      "/restore": { title: "Open checkpoint restore picker", owner: "checkpoint", view: "diff", risk: "low" },
      "/repo": { title: "Open GitHub repo import panel", owner: "repo", view: "files", risk: "medium" },
      "/pr": { title: "Open pull request workflow", owner: "reviewer", view: "diff", risk: "medium" },
      "/review": { title: "Review current diff", owner: "reviewer", view: "diff", risk: "low" },
      "/fix": { title: "Start Bug War Room", owner: "tester", view: "tasks", risk: "medium" },
      "/qa": { title: "Run Surya QA Agent", owner: "qa", view: "tasks", risk: "low" },
      "/tests": { title: "Generate and run tests", owner: "tester", view: "tasks", risk: "low" },
      "/scan": { title: "Run dependency and security scan", owner: "security", view: "tasks", risk: "low" },
      "/quality": { title: "Calculate engineering quality score", owner: "reviewer", view: "plan", risk: "low" },
      "/env": { title: "Open environment variable manager", owner: "devops", view: "plan", risk: "medium" },
      "/observe": { title: "Check deploy/runtime observations", owner: "devops", view: "tasks", risk: "low" },
      "/mcp": { title: "Open MCP panel", owner: "platform", view: "plan", risk: "low" },
      "/skills": { title: "Open project skills panel", owner: "platform", view: "plan", risk: "low" },
      "/agents": { title: "Open custom agents panel", owner: "platform", view: "tasks", risk: "low" },
      "/hooks": { title: "Open hooks panel", owner: "platform", view: "tasks", risk: "low" },
      "/routines": { title: "Open routines panel", owner: "platform", view: "plan", risk: "low" },
      "/vision": { title: "Open Surya Vision Build input", owner: "ui", view: "plan", risk: "low" },
      "/push": { title: "Prepare GitHub push", owner: "devops", view: "tasks", risk: "high" },
      "/deploy": { title: "Prepare Vercel deploy", owner: "devops", view: "tasks", risk: "high" },
    };
    const task = taskCommands[command];
    if (!task) return false;
    store.addBackgroundTask({ title: task.title, owner: task.owner, status: "queued", risk: task.risk });
    if (task.view) store.setWorkspaceView(task.view);
    return true;
  }, [store]);

  const sendMessage = useCallback(
    async (prompt: string, images?: string[], displayPrompt = prompt) => {
      if (store.isStreaming) return;

      const handledSlash = handleSlashCommand(prompt);
      if (handledSlash) return;

      const userMsg: AppBuilderMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: displayPrompt,
        kind: "text",
      };
      store.addMessage(userMsg);
      store.setLastUserPrompt(prompt);

      const isFirstBuild = Object.keys(store.files).length === 0;

      if (isFirstBuild) {
        const proj = await ensureProject(deriveProjectName(displayPrompt));
        try {
          const res = await fetch("/api/app-builder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "clarify", prompt, projectId: proj?.id, images }),
          });
          const data = (await res.json()) as {
            skip?: boolean;
            questions?: Array<{ id: string; q: string; suggestions: string[] }>;
          };
          if (!data.skip && data.questions?.length) {
            store.addMessage({
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Client Mode",
              kind: "clarify",
              questions: data.questions,
            });
            return;
          }
        } catch {
          // Fall through to build.
        }
        await runGenerate(prompt, null, images, proj?.id);
        return;
      }

      const proj = await ensureProject(deriveProjectName(displayPrompt));
      await runGenerate(prompt, null, images, proj?.id);
    },
    [store, ensureProject, runGenerate, handleSlashCommand]
  );

  const submitClarifyAnswers = useCallback(
    async (messageId: string, answers: Record<string, string>) => {
      if (store.isStreaming) return;
      const msg = store.messages.find((m) => m.id === messageId);
      if (!msg || msg.kind !== "clarify") return;

      store.patchMessage(messageId, { answers, answered: true });

      const originalPrompt = store.lastUserPrompt ?? "";
      if (!originalPrompt) return;
      await runGenerate(originalPrompt, answers);
    },
    [store, runGenerate]
  );

  const skipClarify = useCallback(
    async (messageId: string) => {
      if (store.isStreaming) return;
      store.patchMessage(messageId, { answered: true });
      const originalPrompt = store.lastUserPrompt ?? "";
      if (!originalPrompt) return;
      await runGenerate(originalPrompt, null);
    },
    [store, runGenerate]
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    store.setIsStreaming(false);
    store.updateLastAssistantMessage("Generation cancelled.", false, { error: true });
  }, [store]);

  const retry = useCallback(() => {
    const last = store.lastUserPrompt;
    if (!last || store.isStreaming) return;
    runGenerate(last, null);
  }, [store, runGenerate]);

  const fixBug = useCallback(async (bugPrompt?: string) => {
    if (store.isStreaming) return;
    const prompt = bugPrompt?.trim() || store.buildError || "Preview/runtime bug reported by user.";
    const assistantMsgId = crypto.randomUUID();
    store.addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: `Fix bug: ${prompt}`,
      kind: "text",
    });
    store.addMessage({
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
      kind: "text",
    });
    store.setIsStreaming(true);

    const newFiles: Record<string, string> = {};
    try {
      const res = await fetch("/api/app-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bug_war_room",
          prompt,
          projectId: store.projectId ?? undefined,
          currentFiles: store.files,
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const event = JSON.parse(line.slice(5).trim()) as {
            type: string;
            role?: string;
            text?: string;
            label?: string;
            delta?: string;
            summary?: string;
            path?: string;
            content?: string;
            data?: AppBuilderMessage["replay"];
            previewMode?: string;
            error?: string;
          };
          if (event.type === "war_room" && event.role && event.text) {
            const current = useAppBuilderStore.getState().messages.find((m) => m.id === assistantMsgId);
            store.patchMessage(assistantMsgId, {
              warRoomEvents: [...(current?.warRoomEvents ?? []), { role: event.role, text: event.text }],
              content: "Bug War Room is diagnosing...",
            });
          } else if (event.type === "agent_start" && event.role && event.label) {
            const current = useAppBuilderStore.getState().messages.find((m) => m.id === assistantMsgId);
            store.patchMessage(assistantMsgId, {
              agentEvents: [...(current?.agentEvents ?? []), { role: event.role, label: event.label, status: "running", summary: "" }],
            });
          } else if (event.type === "agent_done" && event.role) {
            const current = useAppBuilderStore.getState().messages.find((m) => m.id === assistantMsgId);
            store.patchMessage(assistantMsgId, {
              agentEvents: (current?.agentEvents ?? []).map((a) => a.role === event.role ? { ...a, status: "done", summary: event.summary ?? a.summary } : a),
            });
          } else if (event.type === "file" && event.path && event.content !== undefined) {
            newFiles[event.path] = event.content;
            store.patchFiles({ [event.path]: event.content });
            store.setActiveFile(event.path);
          } else if (event.type === "replay" && event.data) {
            store.patchMessage(assistantMsgId, { replay: event.data });
          } else if (event.type === "done") {
            store.setPreviewMode((event.previewMode as "srcdoc" | "webcontainer") ?? store.previewMode);
            store.patchMessage(assistantMsgId, { content: "Bug fix applied.", isStreaming: false });
            if (store.previewMode === "webcontainer") await wc.mountApp({ ...store.files, ...newFiles });
          } else if (event.type === "error") {
            throw new Error(event.error ?? "Bug War Room failed");
          }
        }
      }
    } catch (err) {
      store.patchMessage(assistantMsgId, {
        content: `Error: ${err instanceof Error ? err.message : "Bug War Room failed"}`,
        isStreaming: false,
        error: true,
      });
    } finally {
      store.setIsStreaming(false);
    }
  }, [store, wc]);

  const editFile = useCallback(
    async (path: string, content: string) => {
      store.patchFiles({ [path]: content });
      if (store.previewMode === "webcontainer") {
        await wc.editFile(path, content);
      }
      // Persist edit
      const pid = store.projectId;
      if (pid) {
        const mergedFiles = { ...store.files, [path]: content };
        await persistProjectSnapshot({
          projectId: pid,
          files: mergedFiles,
          messages: useAppBuilderStore.getState().messages,
          previewMode: store.previewMode,
          workspaceState: useAppBuilderStore.getState().workspaceState,
        });
      }
    },
    [store, wc]
  );

  // Project list ops
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/app-builder/projects");
      if (!res.ok) return;
      const data = (await res.json()) as {
        documents?: Array<{
          id: string;
          name: string;
          previewMode?: string;
          createdAt: string;
          updatedAt: string;
        }>;
      };
      const list = (data.documents ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        previewMode: (p.previewMode ?? "none") as "srcdoc" | "webcontainer" | "none",
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
      store.setProjects(list);
    } catch {
      store.setProjects([]);
    }
  }, [store]);

  const openProject = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/app-builder/projects/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          document?: {
            id: string;
            name: string;
            files?: Record<string, string>;
            messages?: AppBuilderMessage[];
            previewMode?: string;
            workspaceState?: Partial<WorkspaceState>;
          };
        };
        const d = data.document;
        if (!d) return;
        store.loadProject({
          id: d.id,
          name: d.name,
          files: d.files ?? {},
          messages: Array.isArray(d.messages) ? d.messages : [],
          previewMode: ((d.previewMode ?? "none") as "srcdoc" | "webcontainer" | "none"),
          workspaceState: d.workspaceState,
        });
        if (d.previewMode === "webcontainer" && d.files && Object.keys(d.files).length > 0) {
          wc.mountApp(d.files);
        }
      } catch {
        // ignore
      }
    },
    [store, wc]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/app-builder/projects/${id}`, { method: "DELETE" });
      } catch {
        // ignore
      }
      store.removeProjectMeta(id);
      if (store.projectId === id) store.clearProject();
    },
    [store]
  );

  const newProject = useCallback(() => {
    store.clearProject();
  }, [store]);

  return {
    // Project
    projectId: store.projectId,
    projectName: store.projectName,
    projects: store.projects,
    projectsLoaded: store.projectsLoaded,
    loadProjects,
    openProject,
    deleteProject,
    newProject,

    // Chat
    messages: store.messages,
    isStreaming: store.isStreaming,
    elapsedSeconds: store.elapsedSeconds,
    sendMessage,
    submitClarifyAnswers,
    skipClarify,
    stopGeneration,
    retry,

    // Files
    files: store.files,
    activeFile: store.activeFile,
    setActiveFile: store.setActiveFile,
    editFile,

    // Build panel
    buildTab: store.buildTab,
    setBuildTab: store.setBuildTab,
    workspaceState: store.workspaceState,
    setWorkspaceView: store.setWorkspaceView,
    addBackgroundTask: store.addBackgroundTask,
    updateBackgroundTask: store.updateBackgroundTask,
    createCheckpoint: store.createCheckpoint,
    restoreCheckpoint: store.restoreCheckpoint,
    setPermissions: store.setPermissions,
    appendTerminalLog: store.appendTerminalLog,
    setRepo: store.setRepo,
    updateRepoBrain: store.updateRepoBrain,
    upsertPullRequest: store.upsertPullRequest,
    upsertReviewComment: store.upsertReviewComment,
    addHook: store.addHook,
    addCustomAgent: store.addCustomAgent,
    updateCostMeter: store.updateCostMeter,
    updateQualityScore: store.updateQualityScore,
    updateEnvState: store.updateEnvState,
    addDeployObservation: store.addDeployObservation,
    addSecurityReplay: store.addSecurityReplay,
    previewMode: store.previewMode,
    srcdocHtml,
    viewport: store.viewport,
    setViewport: store.setViewport,
    buildError: store.buildError,

    // WebContainer
    wcStatus: wc.status,
    wcPreviewUrl: wc.previewUrl,
    wcTerminalOutput: wc.terminalOutput,

    // Element picker
    selectedElement: store.selectedElement,
    setSelectedElement: store.setSelectedElement,

    // Reset (clears session, keeps current project row if any)
    reset: store.reset,
    buildFromPlan: runGenerate,
    fixBug,
  };
}

export type UseAppBuilderReturn = ReturnType<typeof useAppBuilder>;
