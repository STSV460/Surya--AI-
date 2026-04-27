"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Zap, Send, Loader2, RotateCcw, Square, RefreshCw, AlertCircle, Plus, FileText, X, Crosshair, Sparkles, ArrowRight, Upload } from "lucide-react";
import type { UseAppBuilderReturn } from "@/hooks/useAppBuilder";
import type { WCStatus } from "@/hooks/useWebContainer";
import { ClarifyQuestions } from "@/components/app-builder/ClarifyQuestions";

interface AttachedFile {
  kind: "text" | "image";
  name: string;
  size: number;
  content?: string;     // text content for kind=text
  dataUrl?: string;     // base64 data URL for kind=image
  mime?: string;
  truncated?: boolean;
}

const EXAMPLE_PROMPTS = [
  "Build a calculator with dark theme",
  "Create a Pomodoro timer app",
  "Make a responsive landing page",
  "Build a quiz game about space",
  "Create a todo app with React",
  "Make a weather dashboard UI",
];

const STATUS_PILL: Partial<Record<WCStatus, { label: string; color: string }>> = {
  booting:    { label: "Booting container...", color: "text-yellow-400" },
  installing: { label: "Installing dependencies...", color: "text-yellow-400" },
  starting:   { label: "Starting dev server...", color: "text-blue-400" },
  ready:      { label: "● Live", color: "text-green-400" },
  error:      { label: "Error", color: "text-red-400" },
};

interface Props extends UseAppBuilderReturn {}

function AssistantDots() {
  return (
    <div className="flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-surya-500"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

export function AppBuilderChatPanel({
  messages,
  isStreaming,
  elapsedSeconds,
  previewMode,
  wcStatus,
  sendMessage,
  submitClarifyAnswers,
  skipClarify,
  stopGeneration,
  retry,
  reset,
  selectedElement,
  setSelectedElement,
}: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;

  const uploadFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File > 5MB");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/chat/files", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
        return;
      }
      const att: AttachedFile = data.kind === "image"
        ? { kind: "image", name: data.name, size: data.size, mime: data.mime, dataUrl: data.dataUrl }
        : { kind: "text", name: data.name, size: data.size, mime: data.mime, content: data.content, truncated: data.truncated };
      setAttachments((a) => [...a, att]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          // Synthesize friendlier name when clipboard provides "image.png"
          const named = file.name && file.name !== "image.png"
            ? file
            : new File([file], `pasted-${Date.now()}.${(file.type.split("/")[1] || "png")}`, { type: file.type });
          await uploadFile(named);
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    for (const f of files) {
      await uploadFile(f);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if ((!text && attachments.length === 0 && !selectedElement) || isStreaming) return;
    setInput("");

    let finalPrompt = text;

    if (selectedElement) {
      finalPrompt = `${selectedElement}\n\nUser request: ${text || "(fix this element)"}`;
      setSelectedElement(null);
    }

    const textFiles = attachments.filter((a) => a.kind === "text");
    const imageFiles = attachments.filter((a) => a.kind === "image");

    if (textFiles.length > 0) {
      const ctx = textFiles
        .map((f) => `<file name="${f.name}"${f.truncated ? ' truncated="true"' : ""}>\n${f.content ?? ""}\n</file>`)
        .join("\n\n");
      finalPrompt = ctx + "\n\n" + finalPrompt;
    }

    const images = imageFiles
      .map((f) => f.dataUrl)
      .filter((u): u is string => typeof u === "string");

    setAttachments([]);
    sendMessage(finalPrompt || "(see attached image)", images.length > 0 ? images : undefined);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      await uploadFile(f);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pill = previewMode === "webcontainer" ? STATUS_PILL[wcStatus] : null;

  return (
    <div
      className="relative flex flex-col h-full bg-surface-DEFAULT overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-surya-500/10 border-2 border-dashed border-surya-500/60 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-surya-500">
            <Upload size={28} />
            <p className="text-sm font-medium">Drop image to attach</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0 bg-surface-1">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-surya-500" />
          <span className="text-sm font-semibold text-white">App Builder</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surya-500/20 text-surya-500 border border-surya-500/30">
            Beta
          </span>
        </div>
        {hasMessages && (
          <button
            onClick={reset}
            title="Start over"
            className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-white/5 rounded transition-colors"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <AnimatePresence initial={false}>
          {!hasMessages ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full gap-6 pb-8"
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-2xl bg-surya-500/10 border border-surya-500/20 flex items-center justify-center">
                  <Zap size={22} className="text-surya-500" />
                </div>
                <p className="text-sm font-medium text-white">Describe your app</p>
                <p className="text-xs text-gray-500 max-w-[200px]">
                  Build any web app with AI. Iterate with follow-up messages.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-left text-xs text-gray-400 hover:text-white bg-surface-2 hover:bg-surface-2/80 border border-white/5 hover:border-white/10 rounded-lg px-3 py-2 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;
              return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-surface-2 border border-white/5 px-3 py-2 text-sm text-white">
                    {msg.content}
                  </div>
                ) : msg.kind === "clarify" && msg.questions ? (
                  <div className="max-w-[92%] w-full">
                    <ClarifyQuestions
                      messageId={msg.id}
                      questions={msg.questions}
                      answered={!!msg.answered}
                      initialAnswers={msg.answers ?? {}}
                      onSubmit={submitClarifyAnswers}
                      onSkip={skipClarify}
                      disabled={isStreaming}
                    />
                  </div>
                ) : (
                  <div className="max-w-[92%] text-sm text-gray-300 space-y-2">
                    {msg.error && (
                      <div className="flex items-center gap-1.5 text-red-400 text-xs">
                        <AlertCircle size={12} />
                        <span>Generation failed</span>
                      </div>
                    )}
                    {(msg.plan || (msg.isStreaming && typeof msg.thoughtSeconds === "number")) && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                          <Sparkles size={10} className="text-surya-500" />
                          <span>
                            Thought for {msg.thoughtSeconds ?? elapsedSeconds}s
                          </span>
                        </div>
                        {msg.plan && (
                          <p className="text-[13px] text-gray-200 leading-relaxed">
                            {msg.plan}
                          </p>
                        )}
                      </div>
                    )}
                    {msg.isStreaming && !msg.content && !msg.plan ? (
                      <AssistantDots />
                    ) : (
                      msg.content && (
                        <div className={`text-[12px] text-gray-400 ${msg.error ? "text-red-300" : ""}`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )
                    )}
                    {msg.isStreaming && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <Loader2 size={10} className="animate-spin" />
                        <span>Generating… {elapsedSeconds}s</span>
                      </div>
                    )}
                    {msg.error && isLast && !isStreaming && (
                      <button
                        onClick={retry}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surya-500/10 hover:bg-surya-500/20 border border-surya-500/30 text-surya-500 text-xs transition-colors"
                      >
                        <RefreshCw size={11} />
                        Retry
                      </button>
                    )}
                    {msg.followUps && msg.followUps.length > 0 && !msg.isStreaming && (
                      <div className="pt-2 space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-gray-600">
                          Try next
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.followUps.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => sendMessage(s)}
                              disabled={isStreaming}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-2 hover:bg-surya-500/10 border border-white/10 hover:border-surya-500/40 text-[11px] text-gray-300 hover:text-surya-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {s}
                              <ArrowRight size={10} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
              );
            })
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-white/5 bg-surface-1 space-y-2">
        {pill && (
          <div className={`text-[11px] font-medium text-center ${pill.color}`}>
            {pill.label}
          </div>
        )}

        {/* Element selection banner */}
        {selectedElement && (
          <div className="flex items-start gap-2 px-2.5 py-2 bg-surya-500/10 border border-surya-500/20 rounded-lg">
            <Crosshair size={12} className="text-surya-500 mt-0.5 shrink-0" />
            <span className="text-[11px] text-gray-300 flex-1 line-clamp-2 leading-relaxed">{selectedElement}</span>
            <button
              onClick={() => setSelectedElement(null)}
              className="p-0.5 text-gray-500 hover:text-gray-200 rounded"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Attachment chips */}
        {(attachments.length > 0 || uploading || uploadError) && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((f, i) => (
              f.kind === "image" && f.dataUrl ? (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.dataUrl}
                    alt={f.name}
                    className="h-14 w-14 rounded-lg object-cover border border-white/10"
                  />
                  <button
                    onClick={() => setAttachments((a) => a.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 p-0.5 rounded-full bg-black/80 border border-white/10 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div key={i} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-surface-2 border border-white/10 text-xs">
                  <FileText size={11} className="text-surya-accent" />
                  <span className="max-w-[120px] truncate text-[11px]">{f.name}</span>
                  {f.truncated && <span className="text-amber-400 text-[10px]">trunc</span>}
                  <button
                    onClick={() => setAttachments((a) => a.filter((_, idx) => idx !== i))}
                    className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300"
                  >
                    <X size={10} />
                  </button>
                </div>
              )
            ))}
            {uploading && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-2 text-[11px] text-gray-400">
                <Loader2 size={10} className="animate-spin" /> Uploading…
              </div>
            )}
            {uploadError && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-[11px] text-red-400 border border-red-500/30">
                {uploadError}
                <button onClick={() => setUploadError(null)} className="p-0.5"><X size={10} /></button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 bg-surface-2 border border-white/10 rounded-xl px-3 py-2 focus-within:border-surya-500/40 transition-colors">
          {/* File attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file"
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            <Plus size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.csv,.txt,.ts,.tsx,.js,.jsx,.py,.md,.png,.jpg,.jpeg,.gif,.webp,image/*"
            onChange={handleFileSelect}
          />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onPaste={handlePaste}
            placeholder={
              selectedElement
                ? "What should I fix about this element?"
                : hasMessages
                ? "What should I change?"
                : "Describe the app you want to build..."
            }
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 resize-none outline-none max-h-32 overflow-y-auto"
            style={{ minHeight: "24px" }}
          />
          {isStreaming ? (
            <button
              onClick={stopGeneration}
              title="Stop generation"
              className="flex-shrink-0 w-7 h-7 rounded-lg bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-all"
            >
              <Square size={11} className="text-white fill-white" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && attachments.length === 0 && !selectedElement}
              className="flex-shrink-0 w-7 h-7 rounded-lg bg-surya-500 hover:bg-surya-500/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              <Send size={13} className="text-white" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-600 text-center">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
