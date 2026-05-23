"use client";

import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Eye,
  Code2,
  RefreshCw,
  ExternalLink,
  Zap,
  Loader2,
  FileCode2,
  FileText,
  FileJson,
  FileImage,
  File,
  Smartphone,
  Tablet,
  Monitor,
  Crosshair,
  AlertTriangle,
  GitCompare,
  Terminal,
  ListChecks,
  ClipboardList,
} from "lucide-react";
import { PreviewPane } from "@/components/app-builder/PreviewPane";
import type { UseAppBuilderReturn } from "@/hooks/useAppBuilder";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const cls = "w-3.5 h-3.5 flex-shrink-0";
  if (["js", "jsx"].includes(ext)) return <FileCode2 className={`${cls} text-yellow-400`} />;
  if (["ts", "tsx"].includes(ext)) return <FileCode2 className={`${cls} text-blue-400`} />;
  if (ext === "html") return <FileCode2 className={`${cls} text-orange-400`} />;
  if (ext === "css") return <FileCode2 className={`${cls} text-purple-400`} />;
  if (ext === "json") return <FileJson className={`${cls} text-gray-400`} />;
  if (["png", "jpg", "jpeg", "svg", "gif", "ico"].includes(ext))
    return <FileImage className={`${cls} text-green-400`} />;
  if (["md", "txt"].includes(ext)) return <FileText className={`${cls} text-gray-300`} />;
  return <File className={`${cls} text-gray-400`} />;
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript",
    ts: "typescript", tsx: "typescript",
    html: "html", css: "css", json: "json",
    md: "markdown", py: "python",
  };
  return map[ext] ?? "plaintext";
}

type Props = UseAppBuilderReturn;

const VIEWPORT_WIDTH: Record<"mobile" | "tablet" | "desktop", string> = {
  mobile: "375px",
  tablet: "768px",
  desktop: "100%",
};

export function AppBuilderBuildPanel({
  files,
  activeFile,
  setActiveFile,
  editFile,
  previewMode,
  srcdocHtml,
  viewport,
  setViewport,
  wcStatus,
  wcPreviewUrl,
  wcTerminalOutput,
  setSelectedElement,
  buildError,
  workspaceState,
  setWorkspaceView,
}: Props) {
  const activeView = workspaceState.activeView;
  const fileList = Object.keys(files).sort((a, b) => {
    // Root files first, then by path. Prioritize index.html / package.json / src/App.* at top.
    const priorityOf = (p: string) => {
      if (p === "index.html") return 0;
      if (p === "package.json") return 1;
      if (/^src\/App\.(jsx|tsx|js|ts)$/.test(p)) return 2;
      if (/^src\/main\.(jsx|tsx|js|ts)$/.test(p)) return 3;
      return 10;
    };
    const pa = priorityOf(a);
    const pb = priorityOf(b);
    if (pa !== pb) return pa - pb;
    const aDepth = a.split("/").length;
    const bDepth = b.split("/").length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.localeCompare(b);
  });

  // Auto-select first file when entering code tab with nothing selected
  useEffect(() => {
    if (activeView === "files" && !activeFile && fileList.length > 0) {
      setActiveFile(fileList[0]);
    }
  }, [activeView, activeFile, fileList, setActiveFile]);

  const activeContent = activeFile ? (files[activeFile] ?? "") : "";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);

  const handleReloadSrcdoc = () => {
    if (iframeRef.current && srcdocHtml) {
      iframeRef.current.srcdoc = srcdocHtml;
    }
  };

  // Send activate/deactivate to iframe when select mode changes
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: isSelectMode ? "activate-picker" : "deactivate-picker" },
      "*"
    );
  }, [isSelectMode]);

  // Listen for element-picked messages from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type !== "element-picked") return;
      const d = e.data;
      const parts = [
        "[Element selected in preview]",
        `Tag: ${d.tagName}`,
        d.id ? `ID: ${d.id}` : null,
        d.className ? `Classes: ${d.className}` : null,
        d.textContent ? `Text: "${d.textContent}"` : null,
        `HTML: ${d.outerHTML}`,
      ].filter(Boolean).join("\n");
      setSelectedElement(parts);
      setIsSelectMode(false);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setSelectedElement]);

  return (
    <div className="flex flex-col h-full bg-[#0b1220] overflow-hidden text-[#dbeafe]">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 border-b border-[#23314d] bg-[#111827] flex-shrink-0 h-10">
        <div className="flex items-center gap-1">
          {([
            { key: "preview", label: "Preview", icon: Eye },
            { key: "diff", label: "Diff", icon: GitCompare },
            { key: "terminal", label: "Terminal", icon: Terminal },
            { key: "files", label: "Files", icon: Code2 },
            { key: "tasks", label: "Background tasks", icon: ListChecks },
            { key: "plan", label: "Plan", icon: ClipboardList },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setWorkspaceView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                activeView === key
                  ? "bg-[#1e3a5f] text-[#e5edf8]"
                  : "text-[#64748b] hover:text-[#dbeafe] hover:bg-[#172033]"
              }`}
            >
              <Icon size={12} />
              <span className="hidden xl:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {activeView === "preview" && previewMode !== "none" && (
            <div className="flex items-center gap-0.5 mr-1 p-0.5 rounded-md bg-[#172033] border border-[#23314d]">
              {([
                { key: "mobile", icon: Smartphone, label: "Mobile (375px)" },
                { key: "tablet", icon: Tablet, label: "Tablet (768px)" },
                { key: "desktop", icon: Monitor, label: "Desktop" },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setViewport(key)}
                  title={label}
                  className={`p-1 rounded transition-colors ${
                    viewport === key
                      ? "bg-[#1d4f8f] text-[#7dd3fc]"
                      : "text-[#64748b] hover:text-[#e5edf8] hover:bg-[#1e3a5f]"
                  }`}
                >
                  <Icon size={12} />
                </button>
              ))}
            </div>
          )}
          {activeView === "preview" && previewMode === "srcdoc" && srcdocHtml && (
            <>
              <button
                onClick={() => setIsSelectMode((v) => !v)}
                title={isSelectMode ? "Cancel element pick" : "Pick element to fix"}
                className={`p-1.5 rounded transition-colors ${
                  isSelectMode
                    ? "text-[#7dd3fc] bg-[#1d4f8f] hover:bg-[#1e40af]"
                    : "text-[#64748b] hover:text-[#e5edf8] hover:bg-[#1e3a5f]"
                }`}
              >
                <Crosshair size={13} />
              </button>
              <button
                onClick={handleReloadSrcdoc}
                title="Reload preview"
                className="p-1.5 text-[#64748b] hover:text-[#e5edf8] hover:bg-[#1e3a5f] rounded transition-colors"
              >
                <RefreshCw size={13} />
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([srcdocHtml], { type: "text/html" });
                  const url = URL.createObjectURL(blob);
                  window.open(url, "_blank");
                }}
                title="Open in new tab"
                className="p-1.5 text-[#64748b] hover:text-[#e5edf8] hover:bg-[#1e3a5f] rounded transition-colors"
              >
                <ExternalLink size={13} />
              </button>
            </>
          )}
          {activeView === "preview" && previewMode === "webcontainer" && wcPreviewUrl && (
            <button
              onClick={() => window.open(wcPreviewUrl, "_blank")}
              title="Open in new tab"
              className="p-1.5 text-[#64748b] hover:text-[#e5edf8] hover:bg-[#1e3a5f] rounded transition-colors"
            >
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {(buildError || wcStatus === "error") && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border-b border-red-500/30 text-[11px] text-red-300">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span className="flex-1 line-clamp-2 leading-relaxed">
            {buildError || "WebContainer error — see terminal output below."}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {activeView === "preview" ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="absolute inset-0"
            >
              {previewMode === "none" ? (
                <EmptyPreview />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#070d18] p-3">
                  <div
                    className="h-full bg-white transition-all duration-200 overflow-hidden rounded-md shadow-[0_20px_80px_rgba(0,0,0,0.45)] ring-1 ring-[#23314d]"
                    style={{
                      width: VIEWPORT_WIDTH[viewport],
                      maxWidth: "100%",
                    }}
                  >
                    {previewMode === "srcdoc" ? (
                      <iframe
                        ref={iframeRef}
                        srcDoc={srcdocHtml}
                        sandbox="allow-scripts allow-forms allow-modals"
                        className="w-full h-full border-0"
                        title="App Preview"
                      />
                    ) : (
                      <PreviewPane
                        url={wcPreviewUrl}
                        status={wcStatus}
                        terminalOutput={wcTerminalOutput}
                      />
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : activeView === "files" ? (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="absolute inset-0 flex flex-col"
            >
              {fileList.length === 0 ? (
                <EmptyCode />
              ) : (
                <>
                  {/* File tabs */}
                  <div className="flex overflow-x-auto scrollbar-none border-b border-[#23314d] bg-[#111827] flex-shrink-0 h-9">
                    {fileList.map((path) => {
                      const name = path.split("/").pop() ?? path;
                      const isActive = activeFile === path;
                      return (
                        <button
                          key={path}
                          onClick={() => setActiveFile(path)}
                          title={path}
                          className={`flex items-center gap-1.5 px-3 text-xs whitespace-nowrap border-r border-white/5 transition-all flex-shrink-0 h-full ${
                            isActive
                              ? "text-[#e5edf8] bg-[#1e3a5f] border-b-2 border-b-[#3b82f6]"
                              : "text-[#64748b] hover:text-[#dbeafe] hover:bg-[#172033]"
                          }`}
                        >
                          {getFileIcon(name)}
                          <span>{name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Monaco */}
                  <div className="flex-1 min-h-0">
                    {activeFile ? (
                      <MonacoEditor
                        key={activeFile}
                        height="100%"
                        language={getLanguage(activeFile)}
                        value={activeContent}
                        theme="vs-dark"
                        onChange={(val) => {
                          if (activeFile && val !== undefined) {
                            editFile(activeFile, val);
                          }
                        }}
                        options={{
                          minimap: { enabled: false },
                          wordWrap: "on",
                          fontSize: 13,
                          lineHeight: 20,
                          scrollBeyondLastLine: false,
                          padding: { top: 12, bottom: 12 },
                          renderLineHighlight: "gutter",
                          smoothScrolling: true,
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-[#64748b]">
                        Select a file to edit
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          ) : activeView === "diff" ? (
            <DiffView files={files} baseFiles={workspaceState.diffBaseFiles} checkpoints={workspaceState.checkpoints} />
          ) : activeView === "terminal" ? (
            <TerminalView terminalOutput={wcTerminalOutput} history={workspaceState.terminalHistory} />
          ) : activeView === "tasks" ? (
            <BackgroundTasksView tasks={workspaceState.backgroundTasks} securityReplay={workspaceState.securityReplay} />
          ) : (
            <PlanView workspaceState={workspaceState} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function changedPaths(files: Record<string, string>, baseFiles: Record<string, string>) {
  return Array.from(new Set([...Object.keys(files), ...Object.keys(baseFiles)])).filter(
    (path) => files[path] !== baseFiles[path]
  ).sort();
}

function DiffView({
  files,
  baseFiles,
  checkpoints,
}: {
  files: Record<string, string>;
  baseFiles: Record<string, string>;
  checkpoints: Array<{ id: string; label: string; files: Record<string, string>; createdAt: string }>;
}) {
  const base = Object.keys(baseFiles).length > 0 ? baseFiles : checkpoints[0]?.files ?? {};
  const paths = changedPaths(files, base);
  return (
    <motion.div key="diff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto bg-[#070d18] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#e5edf8]">Diff</p>
          <p className="text-xs text-[#64748b]">Current files compared with diff base or latest checkpoint.</p>
        </div>
        <span className="rounded-md border border-[#24436f] bg-[#111f38] px-2 py-1 text-xs text-[#7dd3fc]">{paths.length} changed</span>
      </div>
      {paths.length === 0 ? (
        <EmptyPanel title="No diff yet" detail="Create a checkpoint or edit files to see changes." />
      ) : (
        <div className="space-y-3">
          {paths.map((path) => {
            const before = base[path] ?? "";
            const after = files[path] ?? "";
            return (
              <div key={path} className="overflow-hidden rounded-lg border border-[#23314d] bg-[#0f1b31]">
                <div className="border-b border-[#23314d] px-3 py-2 text-xs font-medium text-[#dbeafe]">{path}</div>
                <div className="grid gap-px bg-[#23314d] md:grid-cols-2">
                  <pre className="max-h-72 overflow-auto bg-[#0b1220] p-3 text-[11px] leading-relaxed text-[#94a3b8]">{before || "(new file)"}</pre>
                  <pre className="max-h-72 overflow-auto bg-[#07182d] p-3 text-[11px] leading-relaxed text-[#bfdbfe]">{after || "(deleted)"}</pre>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function TerminalView({ terminalOutput, history }: { terminalOutput: string; history: Array<Record<string, unknown>> }) {
  return (
    <motion.div key="terminal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col bg-[#050b15]">
      <div className="border-b border-[#23314d] bg-[#111827] px-4 py-3">
        <p className="text-sm font-semibold text-[#e5edf8]">Controlled terminal</p>
        <p className="text-xs text-[#64748b]">WebContainer logs only. Host shell disabled in V1.</p>
      </div>
      <pre className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-[#93c5fd]">
        {[
          ...history.map((entry) => `[${String(entry.createdAt ?? "now")}] ${String(entry.message ?? entry.command ?? JSON.stringify(entry))}`),
          terminalOutput,
        ].filter(Boolean).join("\n") || "No terminal logs yet. Run build, preview, or controlled commands."}
      </pre>
    </motion.div>
  );
}

function BackgroundTasksView({
  tasks,
  securityReplay,
}: {
  tasks: Array<{ id: string; title: string; owner: string; status: string; risk?: string; result?: string; filesTouched?: string[] }>;
  securityReplay: Array<{ id: string; action: string; command?: string; permissionChoice?: string; createdAt: string }>;
}) {
  return (
    <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto bg-[#070d18] p-4">
      <p className="text-sm font-semibold text-[#e5edf8]">Background tasks</p>
      <p className="mb-4 text-xs text-[#64748b]">Agent board, Bug War Room, QA, scans, deploy jobs, and security replay.</p>
      <div className="grid gap-3 xl:grid-cols-2">
        {(tasks.length ? tasks : [{ id: "empty", title: "No active tasks", owner: "surya", status: "queued", risk: "low", result: "Use slash commands like /qa, /scan, /review, /repo." }]).map((task) => (
          <div key={task.id} className="rounded-lg border border-[#23314d] bg-[#0f1b31] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[#e5edf8]">{task.title}</p>
              <span className="rounded bg-[#1e3a5f] px-2 py-0.5 text-[10px] uppercase text-[#7dd3fc]">{task.status}</span>
            </div>
            <p className="mt-1 text-xs text-[#8aa4c8]">Owner: {task.owner} · Risk: {task.risk ?? "low"}</p>
            {task.result && <p className="mt-2 text-xs text-[#cbd5e1]">{task.result}</p>}
          </div>
        ))}
      </div>
      {securityReplay.length > 0 && (
        <div className="mt-5 rounded-lg border border-[#24436f] bg-[#0f1b31] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7dd3fc]">Security replay</p>
          <div className="space-y-2">
            {securityReplay.map((event) => (
              <div key={event.id} className="text-xs text-[#94a3b8]">{event.action} {event.command ? `· ${event.command}` : ""} {event.permissionChoice ? `· ${event.permissionChoice}` : ""}</div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function PlanView({ workspaceState }: { workspaceState: Props["workspaceState"] }) {
  const q = workspaceState.qualityScore;
  const score = Number(q.overall ?? 0);
  return (
    <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 overflow-y-auto bg-[#070d18] p-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-lg border border-[#23314d] bg-[#0f1b31] p-4">
          <p className="text-sm font-semibold text-[#e5edf8]">Plan</p>
          <p className="mt-2 text-xs leading-relaxed text-[#94a3b8]">PM/reviewer plan, next steps, Build Replay, repo rules, and future local handoff live here.</p>
        </div>
        <div className="rounded-lg border border-[#23314d] bg-[#0f1b31] p-4">
          <p className="text-sm font-semibold text-[#e5edf8]">Quality score</p>
          <p className="mt-3 text-3xl font-semibold text-[#7dd3fc]">{score || "--"}</p>
          <p className="mt-1 text-xs text-[#64748b]">Build · Security · Testing · Performance · Accessibility</p>
        </div>
        <div className="rounded-lg border border-[#23314d] bg-[#0f1b31] p-4">
          <p className="text-sm font-semibold text-[#e5edf8]">Cost meter</p>
          <p className="mt-2 text-xs text-[#94a3b8]">Model: {String(workspaceState.costMeter.model ?? "Opus 4.6")}</p>
          <p className="mt-1 text-xs text-[#94a3b8]">Tokens: {String(workspaceState.costMeter.tokens ?? 0)}</p>
          <p className="mt-1 text-xs text-[#94a3b8]">Files changed: {String(workspaceState.costMeter.filesChanged ?? 0)}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ListPanel title="Routines" items={workspaceState.routines} />
        <ListPanel title="Skills" items={workspaceState.skills} />
        <ListPanel title="MCPs" items={workspaceState.mcps} empty="No MCPs connected." />
        <ListPanel title="Custom agents" items={workspaceState.customAgents} />
        <ListPanel title="Hooks" items={workspaceState.hooks} />
        <ListPanel title="Future roadmap" items={[
          { label: "Desktop Bridge" },
          { label: "Local CLI" },
          { label: "IDE extension" },
          { label: "Cloud-to-local handoff" },
          { label: "iPad/mobile remote" },
          { label: "Surya Swarm Mode" },
          { label: "Marketplace" },
        ]} />
      </div>
    </motion.div>
  );
}

function ListPanel({ title, items, empty = "No items yet." }: { title: string; items: Array<Record<string, unknown>>; empty?: string }) {
  return (
    <div className="rounded-lg border border-[#23314d] bg-[#0f1b31] p-4">
      <p className="mb-3 text-sm font-semibold text-[#e5edf8]">{title}</p>
      <div className="space-y-2">
        {(items.length ? items : [{ label: empty }]).map((item, index) => (
          <div key={String(item.id ?? item.label ?? index)} className="rounded-md border border-[#23314d] bg-[#0b1220] px-3 py-2 text-xs text-[#94a3b8]">
            {String(item.label ?? item.title ?? item.name ?? empty)}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
      <p className="text-sm font-medium text-[#cbd5e1]">{title}</p>
      <p className="mt-1 text-xs text-[#64748b]">{detail}</p>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center bg-[#070d18]">
      <div className="w-14 h-14 rounded-md bg-[#172033] border border-[#23314d] flex items-center justify-center">
        <Zap size={24} className="text-[#3b82f6]/70" />
      </div>
      <div>
        <p className="text-sm font-medium text-[#cbd5e1]">Preview will appear here</p>
        <p className="text-xs text-[#64748b] mt-1">Describe task in Surya Code</p>
      </div>
    </div>
  );
}

function EmptyCode() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-2 text-xs text-[#64748b]">
        <Loader2 size={13} className="animate-spin" />
        Waiting for code generation...
      </div>
    </div>
  );
}
