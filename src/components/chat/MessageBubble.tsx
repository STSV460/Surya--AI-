"use client";

import { memo, useEffect, useRef, useState } from "react";
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
  X,
} from "lucide-react";
import { CitationCard } from "./CitationCard";
import { CrewProgress } from "./CrewProgress";
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

function pickPreferredVoice(voices: SpeechSynthesisVoice[]) {
  const normalized = (value: string) => value.toLowerCase();
  const englishVoices = voices.filter((voice) => normalized(voice.lang).startsWith("en"));
  const candidates = englishVoices.length > 0 ? englishVoices : voices;
  const badVoicePattern =
    /whisper|novelty|bells|boing|bubbles|cellos|deranged|hysterical|pipe|princess|trinoids|zarvox|bahh|organ|good news|bad news|jester|superstar|albert|fred|junior|ralph|reed|rocko|shelley|sandy|grandma|grandpa|flo|eddy/i;
  const preferredNames = [
    "samantha",
    "ava",
    "allison",
    "victoria",
    "karen",
    "moira",
    "tessa",
    "veena",
    "rishi",
    "google us english",
    "google uk english female",
    "microsoft aria",
    "microsoft jenny",
    "microsoft emma",
    "microsoft guy",
    "daniel",
  ];

  const cleanCandidates = candidates.filter((voice) => !badVoicePattern.test(voice.name));
  const scored = cleanCandidates.map((voice) => {
    const name = normalized(voice.name);
    const lang = normalized(voice.lang);
    let score = 0;

    const preferredIndex = preferredNames.findIndex((preferred) => name.includes(preferred));
    if (preferredIndex >= 0) score += 100 - preferredIndex;
    if (lang === "en-us") score += 20;
    if (lang === "en-in") score += 18;
    if (lang === "en-gb") score += 16;
    if (lang.startsWith("en-")) score += 10;
    if (/natural|premium|enhanced|neural|google|microsoft|samantha|ava|allison|joanna|aria|jenny|emma|olivia|daniel|karen|victoria|moira|tessa|veena/i.test(voice.name)) {
      score += 30;
    }
    if (/female|woman|samantha|ava|allison|joanna|aria|jenny|emma|olivia|karen|victoria|moira|tessa|veena/i.test(name)) score += 8;
    if (!voice.localService) score += 4;

    return { voice, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice ?? cleanCandidates[0] ?? candidates[0] ?? null;
}

let activeSpeechId = 0;

function stopSpeech() {
  activeSpeechId += 1;
  window.speechSynthesis.onvoiceschanged = null;
  window.speechSynthesis.cancel();
  // Chrome can leave an utterance queued after rapid toggles. Second cancel
  // clears that queue without changing user-visible behavior.
  window.setTimeout(() => window.speechSynthesis.cancel(), 0);
}

function splitSpeechText(text: string) {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = `${current} ${sentence}`.trim();
    if (next.length > 900 && current) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

function waitForVoices() {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const timer = window.setTimeout(() => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices());
    }, 800);

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timer);
      window.speechSynthesis.onvoiceschanged = null;
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function speakWithBetterVoice(text: string, voices: SpeechSynthesisVoice[], onDone: () => void, onError: (message: string) => void) {
  stopSpeech();
  const speechId = activeSpeechId;
  const voice = pickPreferredVoice(voices);
  const chunks = splitSpeechText(text);
  let index = 0;
  let started = false;
  const resumeTimer = window.setInterval(() => {
    if (speechId !== activeSpeechId || !window.speechSynthesis.speaking) {
      window.clearInterval(resumeTimer);
      return;
    }
    window.speechSynthesis.resume();
  }, 350);

  const speakNext = () => {
    if (speechId !== activeSpeechId) {
      window.clearInterval(resumeTimer);
      return;
    }

    const chunk = chunks[index];
    if (!chunk) {
      window.clearInterval(resumeTimer);
      onDone();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => {
      started = true;
    };
    utterance.onend = () => {
      index += 1;
      speakNext();
    };
    utterance.onerror = (event) => {
      window.clearInterval(resumeTimer);
      if (speechId === activeSpeechId) {
        const reason = event.error ? `Speech failed: ${event.error}` : "Speech failed.";
        onError(started ? reason : "Speech was blocked by the browser. Try clicking the button again.");
        onDone();
      }
    };

    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume();
  };

  speakNext();
  return () => {
    window.clearInterval(resumeTimer);
    if (speechId === activeSpeechId) stopSpeech();
  };
}

function waitForAudioStart(audio: HTMLAudioElement) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      window.clearTimeout(timer);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Audio playback failed."));
    };
    const onPlaying = () => finish();
    const onCanPlay = () => { if (!audio.paused) finish(); };
    const onEnded = () => finish(); // short audio that ends before timeout = success
    const onError = () => fail();
    const timer = window.setTimeout(() => {
      if (audio.ended || !audio.paused) finish();
      else fail();
    }, 2500);

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
  });
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
  const cancelSpeechRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [docStatus, setDocStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [docError, setDocError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const isUser = message.role === "user";
  const displayContent = isStreaming ? streamingContent : message.content;

  useEffect(() => {
    return () => {
      cancelSpeechRef.current?.();
      cancelSpeechRef.current = null;
      stopAudioPlayback();
    };
  }, []);

  function copyMessage() {
    navigator.clipboard.writeText(displayContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function stopAudioPlayback() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  function detectSpeechLanguage(text: string) {
    if (/[\u0C00-\u0C7F]/.test(text)) return "te";
    if (/[\u0900-\u097F]/.test(text)) return "hi";
    if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
    return "en";
  }

  async function playTtsAudio(text: string) {
    const res = await fetch("/api/chat/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        language: detectSpeechLanguage(text),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? `TTS failed: ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audio.muted = false;
    audio.volume = 1;
    audio.preload = "auto";
    audioRef.current = audio;
    audio.onended = () => {
      stopAudioPlayback();
      setSpeaking(false);
    };
    audio.onerror = () => {
      stopAudioPlayback();
      setSpeaking(false);
      setDocError("Audio playback failed.");
    };
    await audio.play();
    await waitForAudioStart(audio);
  }

  async function speakMessage() {
    if (speaking) {
      stopAudioPlayback();
      cancelSpeechRef.current?.();
      cancelSpeechRef.current = null;
      stopSpeech();
      setSpeaking(false);
      return;
    }
    const text = toPlainText(displayContent);
    if (!text) {
      setDocError("Nothing to read aloud.");
      return;
    }

    setSpeaking(true);
    setDocError(null);

    try {
      await playTtsAudio(text);
    } catch (err) {
      stopAudioPlayback();
      console.warn("[read-aloud] TTS fallback:", err);
      if (!("speechSynthesis" in window)) {
        setSpeaking(false);
        setDocError("Audio unavailable. Check browser sound permission and system volume.");
        return;
      }
      const voices = await waitForVoices();
      const cancel = speakWithBetterVoice(
        text,
        voices,
        () => {
          cancelSpeechRef.current = null;
          setSpeaking(false);
        },
        (message) => {
          cancelSpeechRef.current = null;
          setSpeaking(false);
          setDocError(message);
        }
      );
      cancelSpeechRef.current = cancel ?? null;
    }
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

  function startEditing() {
    setEditValue(displayContent);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditValue("");
  }

  function submitEdit() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === displayContent.trim()) {
      cancelEditing();
      return;
    }
    onEdit?.(trimmed);
    setEditing(false);
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
        {isUser && editing ? (
          <div className="min-w-[min(680px,78vw)]">
            <textarea
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  submitEdit();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEditing();
                }
              }}
              autoFocus
              rows={Math.min(8, Math.max(2, editValue.split("\n").length))}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[15px] leading-relaxed text-foreground outline-none focus:border-surya-500/50 focus:ring-[3px] focus:ring-surya-500/12"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEditing}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-gray-300 hover:bg-white/10"
              >
                <X size={13} />
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={!editValue.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check size={13} />
                Send
              </button>
            </div>
          </div>
        ) : isUser ? (
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

        {/* Powered by Surya AI badge — shown for research document artifacts */}
        {!isUser && message.artifacts?.some(a => a.type === "document" && a.title.startsWith("Research:")) && (
          <div className="flex items-center gap-1.5 mt-2">
            <Sparkles size={10} className="text-surya-accent" />
            <span className="text-[10px] text-surya-accent font-medium tracking-wide">Powered by Surya AI</span>
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

        {!isUser && message.crewSteps && message.crewSteps.length > 0 && (
          <div className="mt-3">
            <CrewProgress events={message.crewSteps} isRunning={false} embedded />
          </div>
        )}

        {!isStreaming && displayContent && !editing && (
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
                onClick={startEditing}
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
    .replace(/[\u{1f300}-\u{1faff}\u{2600}-\u{27bf}]/gu, "")
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
