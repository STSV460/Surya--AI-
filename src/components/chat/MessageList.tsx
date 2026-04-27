"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { useUserStore } from "@/stores/userStore";
import type { Message } from "@/types/chat";

const SUGGESTED_PROMPTS = [
  {
    emoji: "💻",
    title: "Write code",
    subtitle: "Build a REST API with authentication",
    action: "Build a REST API with FastAPI that handles user authentication with JWT tokens",
  },
  {
    emoji: "🔍",
    title: "Deep Research",
    subtitle: "Comprehensive multi-source analysis",
    action: "Research the current state of large language models and their impact on software development in 2025",
  },
  {
    emoji: "✍️",
    title: "Draft content",
    subtitle: "Blog post, email, or report",
    action: "Write a compelling blog post about the future of AI assistants in 2025",
  },
  {
    emoji: "📊",
    title: "Analyze data",
    subtitle: "Python, SQL, or spreadsheet help",
    action: "Help me analyze a CSV dataset with pandas and create visualizations",
  },
];

function WelcomeScreen({ onSend }: { onSend: (text: string) => void }) {
  const user = useUserStore((s) => s.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto scrollbar-none">
      {/* Icon + greeting */}
      <div className="text-center mb-10">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "linear-gradient(135deg, #1A73E8, #4FC3F7)", boxShadow: "0 0 40px rgba(26,115,232,0.3)" }}
        >
          <Sparkles size={26} className="text-white" />
        </div>
        <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-white mb-1.5">
          {greeting}, {firstName}
        </h1>
        <p className="text-[15px] text-gray-500">How can I help you today?</p>
      </div>

      {/* Suggestion grid */}
      <div className="grid grid-cols-2 gap-2.5 w-full max-w-[600px] mb-8">
        {SUGGESTED_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => onSend(p.action)}
            className="flex items-start gap-3 p-4 rounded-[14px] bg-surface-1 border border-white/8 hover:bg-surface-2 hover:border-white/14 text-left transition-all duration-150"
          >
            <span className="text-xl leading-none mt-0.5">{p.emoji}</span>
            <div>
              <p className="text-[13px] font-medium text-white mb-0.5">{p.title}</p>
              <p className="text-[12px] text-gray-500 leading-snug">{p.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  onSend?: (text: string) => void;
}

export function MessageList({ messages, isStreaming, streamingContent, onSend }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
    } else if (wasStreamingRef.current) {
      wasStreamingRef.current = false;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isStreaming]);

  if (messages.length === 0 && !isStreaming) {
    return <WelcomeScreen onSend={onSend ?? (() => {})} />;
  }

  return (
    <ScrollArea className="flex-1 px-4">
      <div className="max-w-3xl mx-auto py-8">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming assistant message */}
        {isStreaming && streamingContent && (
          <MessageBubble
            message={{
              id: "streaming",
              conversationId: "",
              role: "assistant",
              content: streamingContent,
              artifacts: [],
              createdAt: new Date().toISOString(),
            }}
            isStreaming={true}
            streamingContent={streamingContent}
          />
        )}

        {/* Thinking animation — before first streaming token */}
        {isStreaming && !streamingContent && (
          <div className="flex items-center gap-3 mb-7">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #1A73E8, #4FC3F7)" }}
            >
              <Sparkles size={14} className="text-white animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="block w-2 h-2 rounded-full bg-surya-accent animate-bounce"
                  style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
