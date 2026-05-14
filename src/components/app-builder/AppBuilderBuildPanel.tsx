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

interface Props extends UseAppBuilderReturn {}

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
  buildTab,
  setBuildTab,
  previewMode,
  srcdocHtml,
  viewport,
  setViewport,
  wcStatus,
  wcPreviewUrl,
  wcTerminalOutput,
  setSelectedElement,
  buildError,
}: Props) {
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
    if (buildTab === "code" && !activeFile && fileList.length > 0) {
      setActiveFile(fileList[0]);
    }
  }, [buildTab, activeFile, fileList, setActiveFile]);

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
    <div className="flex flex-col h-full bg-[#0a0c10] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 border-b border-white/5 bg-surface-1 flex-shrink-0 h-10">
        <div className="flex items-center gap-1">
          {(["preview", "code"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setBuildTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-medium transition-all ${
                buildTab === tab
                  ? "bg-surface-2 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {tab === "preview" ? <Eye size={12} /> : <Code2 size={12} />}
              {tab === "preview" ? "Preview" : "Code"}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {buildTab === "preview" && previewMode !== "none" && (
            <div className="flex items-center gap-0.5 mr-1 p-0.5 rounded-md bg-surface-2 border border-white/5">
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
                      ? "bg-surya-500/20 text-surya-500"
                      : "text-gray-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon size={12} />
                </button>
              ))}
            </div>
          )}
          {buildTab === "preview" && previewMode === "srcdoc" && srcdocHtml && (
            <>
              <button
                onClick={() => setIsSelectMode((v) => !v)}
                title={isSelectMode ? "Cancel element pick" : "Pick element to fix"}
                className={`p-1.5 rounded transition-colors ${
                  isSelectMode
                    ? "text-surya-500 bg-surya-500/20 hover:bg-surya-500/30"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <Crosshair size={13} />
              </button>
              <button
                onClick={handleReloadSrcdoc}
                title="Reload preview"
                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded transition-colors"
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
                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded transition-colors"
              >
                <ExternalLink size={13} />
              </button>
            </>
          )}
          {buildTab === "preview" && previewMode === "webcontainer" && wcPreviewUrl && (
            <button
              onClick={() => window.open(wcPreviewUrl, "_blank")}
              title="Open in new tab"
              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded transition-colors"
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
          {buildTab === "preview" ? (
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
                <div className="w-full h-full flex items-center justify-center bg-[#05070a] p-2">
                  <div
                    className="h-full bg-white transition-all duration-200 overflow-hidden rounded-lg shadow-2xl"
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
          ) : (
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
                  <div className="flex overflow-x-auto scrollbar-none border-b border-white/5 bg-[#0d0f14] flex-shrink-0 h-9">
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
                              ? "text-white bg-surface-2 border-b-2 border-b-surya-500"
                              : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
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
                      <div className="flex items-center justify-center h-full text-xs text-gray-600">
                        Select a file to edit
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-white/5 flex items-center justify-center">
        <Zap size={24} className="text-surya-500/50" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-400">Preview will appear here</p>
        <p className="text-xs text-gray-600 mt-1">Describe your app in the chat</p>
      </div>
    </div>
  );
}

function EmptyCode() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Loader2 size={13} className="animate-spin" />
        Waiting for code generation...
      </div>
    </div>
  );
}
