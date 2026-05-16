"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Code2,
  FileText,
  Play,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Pencil,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import { CitationCard } from "./CitationCard";
import { StreamingText } from "./StreamingText";
import type { Message, ArtifactType } from "@/types/chat";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

const ARTIFACT_ICONS = {
  code: Code2,
  document: FileText,
  interactive: Play,
  image: FileText,
  video: Play,
} as const;

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/6 hover:bg-white/12 text-gray-400 hover:text-white text-[11px] transition-colors"
    >
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const ArtifactChip = memo(function ArtifactChip({ artifact }: { artifact: ArtifactType }) {
  const { setArtifactPanel } = useUIStore();
  const Icon = ARTIFACT_ICONS[artifact.type];
  return (
    <button
      onClick={() => setArtifactPanel(true, artifact)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surya-500/40 bg-surya-500/10 hover:bg-surya-500/20 hover:border-surya-500/70 text-surya-500 text-xs font-medium transition-colors"
    >
      <Icon size={12} />
      <span className="truncate max-w-[180px]">{artifact.title}</span>
      {artifact.language && (
        <span className="text-gray-500 font-mono">{artifact.language}</span>
      )}
    </button>
  );
});

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  streamingContent?: string;
  onRegenerate?: () => void;
  canRegenerate?: boolean;
  onEdit?: (content: string) => void;
}

/**
 * Memoized — only re-renders when its own message prop or streaming state changes.
 * Prevents re-render of ALL prior messages on every streaming token.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming = false,
  streamingContent = "",
  onRegenerate,
  canRegenerate = false,
  onEdit,
}: MessageBubbleProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [docStatus, setDocStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [docError, setDocError] = useState<string | null>(null);
  const isUser = message.role === "user";
  const displayContent = isStreaming ? streamingContent : message.content;

  function copyMessage() {
    navigator.clipboard.writeText(displayContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function speakMessage() {
    if (!("speechSynthesis" in window)) {
      setDocError("Speech is not supported in this browser.");
      return;
    }
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(toPlainText(displayContent));
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  async function sendToGoogleDocs() {
    if (!displayContent.trim()) return;
    setDocStatus("saving");
    setDocError(null);
    try {
      const res = await fetch("/api/connectors/google-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: makeDocTitle(displayContent),
          content: displayContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Google Docs export failed");
      setDocStatus("saved");
      if (data.url) window.open(data.url, "_blank", "noopener,noreferrer");
      setTimeout(() => setDocStatus("idle"), 2500);
    } catch (err) {
      setDocStatus("error");
      setDocError(err instanceof Error ? err.message : "Google Docs export failed");
    }
  }

  return (
    <div className={cn("group flex w-full mb-7 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div
          className="shrink-0 mr-3 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-surya-500"
        >
          <Sparkles size={14} className="text-white" />
        </div>
      )}
      <div
        className={cn(
          isUser
            ? "max-w-[84%] rounded-[18px] rounded-br-md px-4 py-2.5 bg-[#303342] text-foreground shadow-sm"
            : "max-w-3xl flex-1 text-foreground leading-relaxed"
        )}
      >
        {/* Thinking block */}
        {message.thinking && (
          <div className="mb-3 border border-purple-800/40 rounded-lg overflow-hidden">
            <button
              onClick={() => setThinkingOpen((o) => !o)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-purple-400 hover:bg-purple-900/20 transition-colors"
            >
              <Brain size={12} />
              <span>Extended thinking</span>
              {thinkingOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {thinkingOpen && (
              <div className="px-3 pb-3 text-xs text-purple-300/70 italic whitespace-pre-wrap font-mono leading-relaxed border-t border-purple-800/30 pt-2">
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        {isUser ? (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{displayContent}</p>
        ) : (
          <div className="prose prose-invert max-w-none prose-p:my-2 prose-headings:mt-4 prose-headings:mb-2 prose-pre:bg-transparent prose-pre:p-0">
            {isStreaming ? (
              <StreamingText content={displayContent} isStreaming={isStreaming} />
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code({ className, children, ...props }) {
                    const isBlock = className?.includes("language-");
                    const lang = className?.replace("language-", "") ?? "";
                    const codeStr = String(children).replace(/\n$/, "");
                    return isBlock ? (
                      <div className="rounded-[10px] overflow-hidden border border-white/8 my-2.5 bg-surface-2 not-prose">
                        <div className="flex items-center justify-between px-3.5 py-1.5 bg-surface-3 border-b border-white/8">
                          <span className="font-mono text-[11px] text-gray-500">{lang || "code"}</span>
                          <CopyCodeButton code={codeStr} />
                        </div>
                        <pre className="overflow-x-auto">
                          <code
                            className={cn("block font-mono text-[12.5px] leading-relaxed p-3.5", className)}
                            {...props}
                          >
                            {children}
                          </code>
                        </pre>
                      </div>
                    ) : (
                      <code
                        className="bg-surface-2 rounded px-1 py-0.5 text-xs text-surya-accent font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  pre({ children }) {
                    return <>{children}</>;
                  },
                }}
              >
                {displayContent}
              </ReactMarkdown>
            )}
          </div>
        )}

        {/* Inline media artifacts (image/video) */}
        {!isUser && message.artifacts && message.artifacts.some((a) => a.type === "image" || a.type === "video") && (
          <div className="mt-3 space-y-3">
            {message.artifacts
              .filter((a) => a.type === "image" || a.type === "video")
              .map((a) =>
                a.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={a.id}
                    src={a.url ?? a.content}
                    alt={a.title}
                    className="rounded-xl border border-white/10 max-w-full max-h-[512px] object-contain bg-surface-2"
                  />
                ) : (
                  <video
                    key={a.id}
                    src={a.url ?? a.content}
                    controls
                    className="rounded-xl border border-white/10 max-w-full max-h-[512px] bg-surface-2"
                  />
                )
              )}
          </div>
        )}

        {/* Artifact chips (code/document/interactive only) */}
        {!isUser && message.artifacts && message.artifacts.some((a) => a.type === "code" || a.type === "document" || a.type === "interactive") && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.artifacts
              .filter((a) => a.type === "code" || a.type === "document" || a.type === "interactive")
              .map((artifact) => (
                <ArtifactChip key={artifact.id} artifact={artifact} />
              ))}
          </div>
        )}

        {/* Powered by Gemini badge — shown for research document artifacts */}
        {!isUser && message.artifacts?.some(a => a.type === "document" && a.title.startsWith("Research:")) && (
          <div className="flex items-center gap-1.5 mt-2">
            <Sparkles size={10} className="text-surya-accent" />
            <span className="text-[10px] text-surya-accent font-medium tracking-wide">Powered by Gemini</span>
          </div>
        )}

        {/* Citation cards strip — shown for web search results */}
        {!isUser && message.searchResults && message.searchResults.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-medium">Sources</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {message.searchResults.map((result) => (
                <CitationCard key={result.index} result={result} compact />
              ))}
            </div>
          </div>
        )}

        {!isStreaming && displayContent && (
          <div
            className={cn(
              "mt-2 inline-flex flex-wrap items-center gap-1 rounded-lg border border-white/8 bg-surface-2/80 px-1 py-0.5 opacity-90 shadow-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100",
              isUser ? "justify-end" : "justify-start"
            )}
          >
            <button
              type="button"
              onClick={copyMessage}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-white/8 hover:text-gray-200"
              aria-label="Copy message"
              title="Copy message"
            >
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </button>
            {isUser && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(displayContent)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-white/8 hover:text-gray-200"
                aria-label="Edit message"
                title="Edit message"
              >
                <Pencil size={13} />
              </button>
            )}
            {!isUser && (
              <button
                type="button"
                onClick={speakMessage}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-white/8 hover:text-gray-200"
                aria-label={speaking ? "Stop speaking" : "Speak message"}
                title={speaking ? "Stop speaking" : "Speak message"}
              >
                {speaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            )}
            {!isUser && (
              <button
                type="button"
                onClick={sendToGoogleDocs}
                disabled={docStatus === "saving"}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-white/8 hover:text-gray-200 disabled:cursor-wait disabled:opacity-60"
                aria-label="Put in Google Docs"
                title="Put in Google Docs"
              >
                {docStatus === "saving" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : docStatus === "saved" ? (
                  <Check size={13} className="text-green-400" />
                ) : (
                  <FileText size={13} />
                )}
              </button>
            )}
            {!isUser && canRegenerate && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-white/8 hover:text-gray-200"
                aria-label="Regenerate"
                title="Regenerate"
              >
                <RotateCcw size={13} />
              </button>
            )}
            {docError && <span className="ml-1 text-[11px] text-red-400">{docError}</span>}
          </div>
        )}
      </div>
    </div>
  );
});

function toPlainText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " code block omitted ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function makeDocTitle(value: string) {
  const firstLine =
    value
      .split("\n")
      .map((line) => line.replace(/^#+\s*/, "").trim())
      .find(Boolean) ?? "Surya AI Report";
  return firstLine.slice(0, 90);
}
