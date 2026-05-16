"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  ChevronDown, ChevronRight, Brain, Code2, FileText, Play, Sparkles,
  Copy, Check, Volume2, VolumeX, Edit3, FileOutput, Loader2,
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
  onEdit?: (messageId: string, newContent: string) => void;
}

/**
 * Memoized — only re-renders when its own message prop or streaming state changes.
 * Prevents re-render of ALL prior messages on every streaming token.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming = false,
  streamingContent = "",
  onEdit,
}: MessageBubbleProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isUser = message.role === "user";
  const displayContent = isStreaming ? streamingContent : message.content;

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [isEditing]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  const handleSpeak = useCallback(() => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(message.content.replace(/[#*`_~[\]()]/g, ""));
    utt.rate = 1.0;
    utt.pitch = 1.0;
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utt);
  }, [isSpeaking, message.content]);

  const handleGoogleDocs = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const res = await fetch("/api/connectors/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: "Surya AI Response", content: message.content }),
      });
      if (res.status === 401 || res.status === 403) {
        setDocsError("Connect Google first");
        setTimeout(() => setDocsError(null), 3000);
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else if (data.error) {
        setDocsError(data.error.slice(0, 40));
        setTimeout(() => setDocsError(null), 3000);
      }
    } catch {
      setDocsError("Failed to create doc");
      setTimeout(() => setDocsError(null), 3000);
    } finally {
      setDocsLoading(false);
    }
  }, [message.content]);

  const handleEditSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && onEdit) {
      onEdit(message.id, trimmed);
    }
    setIsEditing(false);
  }, [editValue, message.id, onEdit]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    }
    if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(message.content);
    }
  }, [handleEditSave, message.content]);

  const actionBtnClass = "flex items-center justify-center w-7 h-7 rounded-md hover:bg-white/8 text-gray-500 hover:text-gray-300 transition-colors";

  return (
    <div className={cn("flex w-full mb-7 animate-fade-in group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div
          className="shrink-0 mr-3 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
          style={{ background: "linear-gradient(135deg, #1A73E8, #4FC3F7)" }}
        >
          <Sparkles size={14} className="text-white" />
        </div>
      )}

      <div className={cn("flex flex-col", isUser ? "items-end max-w-[80%]" : "flex-1 max-w-3xl")}>
        {/* Edit mode for user messages */}
        {isUser && isEditing ? (
          <div className="w-full">
            <textarea
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={3}
              className="w-full px-4 py-2.5 bg-surface-2 text-foreground text-[15px] leading-relaxed rounded-[18px_18px_4px_18px] border border-white/12 outline-none resize-none focus:border-surya-500/50"
            />
            <div className="flex gap-2 mt-1.5 justify-end">
              <button
                onClick={() => { setIsEditing(false); setEditValue(message.content); }}
                className="px-3 py-1 text-xs text-gray-400 hover:text-white rounded-md hover:bg-white/8 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="px-3 py-1 text-xs bg-surya-500 hover:bg-surya-500/80 text-white rounded-md transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              isUser
                ? "px-4 py-2.5 bg-surface-2 text-foreground text-[15px] leading-relaxed whitespace-pre-wrap"
                : "text-foreground leading-relaxed"
            )}
            style={isUser ? { borderRadius: "18px 18px 4px 18px" } : undefined}
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
              <p>{displayContent}</p>
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

            {/* Powered by Gemini badge */}
            {!isUser && message.artifacts?.some(a => a.type === "document" && a.title.startsWith("Research:")) && (
              <div className="flex items-center gap-1.5 mt-2">
                <Sparkles size={10} className="text-surya-accent" />
                <span className="text-[10px] text-surya-accent font-medium tracking-wide">Powered by Gemini</span>
              </div>
            )}

            {/* Citation cards strip */}
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
          </div>
        )}

        {/* Action bar — user messages (copy + edit) on hover */}
        {isUser && !isEditing && (
          <div className="flex gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} className={actionBtnClass} title="Copy message">
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </button>
            {onEdit && (
              <button onClick={() => { setIsEditing(true); setEditValue(message.content); }} className={actionBtnClass} title="Edit message">
                <Edit3 size={13} />
              </button>
            )}
          </div>
        )}

        {/* Action bar — assistant messages (copy + speak + Google Docs) */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} className={actionBtnClass} title="Copy response">
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </button>
            <button onClick={handleSpeak} className={actionBtnClass} title={isSpeaking ? "Stop speaking" : "Read aloud"}>
              {isSpeaking ? <VolumeX size={13} className="text-surya-accent" /> : <Volume2 size={13} />}
            </button>
            <div className="relative">
              <button
                onClick={handleGoogleDocs}
                disabled={docsLoading}
                className={cn(actionBtnClass, docsLoading && "cursor-not-allowed")}
                title="Export to Google Docs"
              >
                {docsLoading ? <Loader2 size={13} className="animate-spin" /> : <FileOutput size={13} />}
              </button>
              {docsError && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-surface-3 border border-white/10 rounded text-[11px] text-red-400 whitespace-nowrap z-10">
                  {docsError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
