"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useAppBuilderStore,
  type AppBuilderMessage,
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
      const mode = isFirstBuild ? "generate" : "edit";
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
        mode === "generate"
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
              elapsed?: number;
              size?: number;
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
              store.updateLastAssistantMessage(`Error: ${event.error ?? "Unknown error"}`, false, {
                error: true,
              });
              store.setBuildError(event.error ?? "Unknown error");
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

  const planFirst = useCallback(
    async (prompt: string, images?: string[], displayPrompt = prompt) => {
      if (store.isStreaming) return;

      const userMsg: AppBuilderMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: displayPrompt,
        kind: "text",
      };
      const assistantMsgId = crypto.randomUUID();
      store.addMessage(userMsg);
      store.addMessage({
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        kind: "text",
      });
      store.setLastUserPrompt(prompt);
      store.setIsStreaming(true);
      store.setBuildError(null);

      const proj = await ensureProject(deriveProjectName(displayPrompt));
      try {
        const res = await fetch("/api/app-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "plan", prompt, projectId: proj?.id, images }),
        });
        const data = (await res.json()) as { plan?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        store.patchMessage(assistantMsgId, {
          content: data.plan ?? "Ready to build.",
          isStreaming: false,
          planPrompt: prompt,
          planImages: images,
          followUps: ["Build from this plan"],
        });
      } catch (err) {
        store.patchMessage(assistantMsgId, {
          content: `Error: ${err instanceof Error ? err.message : "Planning failed"}`,
          isStreaming: false,
          error: true,
        });
      } finally {
        store.setIsStreaming(false);
      }
    },
    [store, ensureProject]
  );

  const sendMessage = useCallback(
    async (prompt: string, images?: string[], displayPrompt = prompt) => {
      if (store.isStreaming) return;

      const userMsg: AppBuilderMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: displayPrompt,
        kind: "text",
      };
      store.addMessage(userMsg);
      store.setLastUserPrompt(prompt);

      const isFirstBuild = Object.keys(store.files).length === 0;

      // First build: plan first, then wait for user to confirm build.
      if (isFirstBuild) {
        return planFirst(prompt, images, displayPrompt);
      }

      const proj = await ensureProject(deriveProjectName(displayPrompt));
      await runGenerate(prompt, null, images, proj?.id);
    },
    [store, ensureProject, planFirst, runGenerate]
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
  };
}

export type UseAppBuilderReturn = ReturnType<typeof useAppBuilder>;
