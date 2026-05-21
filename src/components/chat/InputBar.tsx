"use client";

import { useRef, useState, useEffect } from "react";
import { ArrowUp, Square, Plus, Plug, FlaskConical, X, FileText, Loader2, Wrench, ChevronUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_RESEARCH_COUNCIL_MODELS, RESEARCH_COUNCIL_MODEL_OPTIONS } from "@/lib/ai/models";
import type { ResearchCouncilModelId } from "@/types/chat";

interface AttachedFile {
  name: string;
  size: number;
  content: string;
  truncated?: boolean;
}

interface InputBarProps {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  enableConnectors?: boolean;
  onToggleConnectors?: () => void;
  enableImageGen?: boolean;
  onToggleImageGen?: () => void;
  enableVideoGen?: boolean;
  onToggleVideoGen?: () => void;
  onDeepResearch?: (question: string, councilModels: ResearchCouncilModelId[]) => void;
  draftMessage?: { id: number; content: string } | null;
  onDraftConsumed?: () => void;
}

export function InputBar({
  onSend,
  onStop,
  isStreaming,
  disabled,
  enableConnectors,
  onToggleConnectors,
  onDeepResearch,
  draftMessage,
  onDraftConsumed,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  const [selectedCouncilModels, setSelectedCouncilModels] = useState<ResearchCouncilModelId[]>([
    ...DEFAULT_RESEARCH_COUNCIL_MODELS,
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  const charCount = value.length;
  const canSend = (!!value.trim() || attachments.length > 0) && !disabled;

  // Count active tools for badge
  const activeToolCount = [enableConnectors, deepResearchEnabled].filter(Boolean).length;

  // Close tools popup on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  useEffect(() => {
    if (!draftMessage) return;
    setValue(draftMessage.content);
    textareaRef.current?.focus();
    onDraftConsumed?.();
  }, [draftMessage, onDraftConsumed]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming || disabled) return;
    if (deepResearchEnabled && onDeepResearch && trimmed) {
      handleDeepResearch();
      return;
    }
    let composed = trimmed;
    if (attachments.length > 0) {
      const ctx = attachments
        .map((f) => `<file name="${f.name}"${f.truncated ? ' truncated="true"' : ""}>\n${f.content}\n</file>`)
        .join("\n\n");
      composed = ctx + (trimmed ? `\n\n${trimmed}` : "");
    }
    onSend(composed);
    setValue("");
    setAttachments([]);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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
      setAttachments((a) => [...a, { name: data.name, size: data.size, content: data.content, truncated: data.truncated }]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((a) => a.filter((_, i) => i !== idx));
  }

  function handleDeepResearch() {
    const q = value.trim();
    if (!deepResearchEnabled || !q || isStreaming || disabled || !onDeepResearch) return;
    onDeepResearch(q, selectedCouncilModels);
    setValue("");
    setToolsOpen(false);
  }

  function toggleCouncilModel(modelId: ResearchCouncilModelId) {
    setSelectedCouncilModels((current) => {
      if (current.includes(modelId)) {
        return current.length <= 1 ? current : current.filter((id) => id !== modelId);
      }
      return [...current, modelId];
    });
  }

  return (
    <div
      className={cn(
        "bg-[#1b1e28]/95 border border-white/10 rounded-[22px] shadow-[0_14px_46px_rgba(0,0,0,0.28)] transition-all duration-150",
        "focus-within:border-surya-500/50 focus-within:ring-[3px] focus-within:ring-surya-500/12"
      )}
    >
      {/* Attachment chips */}
      {(attachments.length > 0 || uploading || uploadError) && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {attachments.map((f, i) => (
            <div key={i} className="inline-flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg bg-surface-2 border border-white/10 text-xs">
              <FileText size={12} className="text-surya-accent" />
              <span className="max-w-[160px] truncate">{f.name}</span>
              {f.truncated && <span className="text-amber-400 text-[10px]">trunc</span>}
              <button
                type="button"
                onClick={() => removeAttachment(i)}
                className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {uploading && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-2 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" /> Uploading…
            </div>
          )}
          {uploadError && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 text-xs text-red-400 border border-red-500/30">
              {uploadError}
              <button onClick={() => setUploadError(null)} className="p-0.5"><X size={11} /></button>
            </div>
          )}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Message Surya AI"
        rows={1}
        style={{ minHeight: "52px", maxHeight: "240px", resize: "none" }}
        className="w-full bg-transparent px-5 pt-4 pb-1 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground outline-none overflow-y-auto"
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 pb-2 pt-1">
        {/* Left: attach + tools */}
        <div className="flex items-center gap-1">

          {/* File attach */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-300 hover:bg-surface-2 transition-colors"
            title="Attach file"
          >
            <Plus size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.csv,.txt,.ts,.tsx,.js,.jsx,.py,.md"
            onChange={handleFileSelect}
          />

          {/* Tools dropdown */}
          <div ref={toolsRef} className="relative">
            <button
              type="button"
              onClick={() => setToolsOpen((v) => !v)}
              className={cn(
                "h-7 flex items-center gap-1.5 px-2 rounded-md text-xs font-medium transition-colors",
                toolsOpen || activeToolCount > 0
                  ? "text-surya-500 bg-surya-500/10 hover:bg-surya-500/15"
                  : "text-gray-500 hover:text-gray-300 hover:bg-surface-2"
              )}
              title="Tools"
            >
              <Wrench size={13} />
              <span>Tools</span>
              {activeToolCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-surya-500 text-white text-[9px] font-bold leading-none">
                  {activeToolCount}
                </span>
              )}
              <ChevronUp
                size={11}
                className={cn("opacity-50 transition-transform duration-150", !toolsOpen && "rotate-180")}
              />
            </button>

            {/* Popup */}
            {toolsOpen && (
              <div className="absolute bottom-full left-0 mb-2 z-50 bg-surface-2 border border-white/10 rounded-2xl p-2 w-56 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider px-2 pt-1 pb-2 font-medium">Tools</p>

                {/* Connectors */}
                {onToggleConnectors && (
                  <button
                    type="button"
                    onClick={() => { onToggleConnectors(); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors text-sm",
                      enableConnectors
                        ? "text-surya-500 bg-surya-500/10"
                        : "text-gray-400 hover:text-white hover:bg-white/6"
                    )}
                  >
                    <Plug size={14} className="shrink-0" />
                    <div className="flex-1 text-left">
                      <p className="text-[13px] font-medium leading-none mb-0.5">Connectors</p>
                      <p className="text-[11px] text-gray-500 leading-none">Google, GitHub workspace</p>
                    </div>
                    <div className={cn(
                      "w-7 h-4 rounded-full transition-colors relative shrink-0",
                      enableConnectors ? "bg-surya-500" : "bg-white/15"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                        enableConnectors ? "left-3.5" : "left-0.5"
                      )} />
                    </div>
                  </button>
                )}

                {/* Image/Video gen moved to /media — removed from chat */}

                {/* Divider */}
                {onDeepResearch && onToggleConnectors && (
                  <div className="h-px bg-white/6 mx-2 my-1.5" />
                )}

                {/* Deep Research */}
                {onDeepResearch && (
                  <div className="rounded-xl bg-black/10 border border-white/6 p-2">
                    <button
                      type="button"
                      onClick={() => setDeepResearchEnabled((enabled) => !enabled)}
                      className={cn(
                        "w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-sm",
                        deepResearchEnabled
                          ? "text-surya-accent bg-surya-accent/10"
                          : "text-gray-400 hover:text-white hover:bg-white/6"
                      )}
                    >
                      <FlaskConical size={14} className="shrink-0" />
                      <div className="flex-1 text-left">
                        <p className="text-[13px] font-medium leading-none mb-0.5">Deep Research</p>
                        <p className="text-[11px] text-gray-500 leading-none">
                          {deepResearchEnabled
                            ? `${selectedCouncilModels.length} model council + web search`
                            : "Enable model council"}
                        </p>
                      </div>
                      <div className={cn(
                        "w-7 h-4 rounded-full transition-colors relative shrink-0",
                        deepResearchEnabled ? "bg-surya-500" : "bg-white/15"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                          deepResearchEnabled ? "left-3.5" : "left-0.5"
                        )} />
                      </div>
                    </button>

                    {deepResearchEnabled && (
                    <div className="mt-2 pt-2 border-t border-white/6">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider px-2 pb-1.5 font-medium">
                        Which models for Deep Research?
                      </p>
                      <p className="px-2 pb-2 text-[10px] leading-snug text-amber-300/80">
                        Uses more tokens because selected models search, discuss, and write a final conclusion.
                      </p>
                      <div className="max-h-48 overflow-y-auto pr-1">
                        {RESEARCH_COUNCIL_MODEL_OPTIONS.map((model) => {
                          const checked = selectedCouncilModels.includes(model.id);
                          return (
                            <label
                              key={model.id}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                                checked ? "bg-surya-500/10 text-white" : "text-gray-400 hover:bg-white/6 hover:text-white"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCouncilModel(model.id)}
                                className="sr-only"
                              />
                              <span
                                className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                  checked
                                    ? "bg-surya-500 border-surya-500 text-white"
                                    : "border-white/20 bg-white/5"
                                )}
                              >
                                {checked && <Check size={11} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[12px] leading-tight truncate">{model.label}</span>
                                <span className="block text-[10px] leading-tight text-gray-500 truncate">
                                  {model.provider}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={handleDeepResearch}
                        disabled={!value.trim() || isStreaming || disabled}
                        className={cn(
                          "mt-2 w-full flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-[12px] font-medium transition-colors",
                          value.trim() && !isStreaming && !disabled
                            ? "bg-surya-500 text-white hover:bg-surya-700"
                            : "bg-white/6 text-gray-600 cursor-not-allowed"
                        )}
                      >
                        <FlaskConical size={13} />
                        Start Deep Research
                      </button>
                    </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: char count + send/stop */}
        <div className="flex items-center gap-2">
          {charCount > 1000 && (
            <span
              className={cn(
                "text-[10px]",
                charCount > 6000
                  ? "text-red-400"
                  : charCount > 3000
                    ? "text-amber-400"
                    : "text-gray-500"
              )}
            >
              {charCount.toLocaleString()}
            </span>
          )}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="h-8 w-8 flex items-center justify-center rounded-xl bg-surface-2 hover:bg-surface-2/80 text-white transition-colors"
              title="Stop"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                "h-8 w-8 flex items-center justify-center rounded-xl transition-colors",
                canSend
                  ? "bg-surya-500 hover:bg-surya-700 text-white"
                  : "bg-surface-2 text-gray-600 cursor-not-allowed"
              )}
              title="Send"
            >
              <ArrowUp size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
