"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { BarChart3, Code2, FileText, Search, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { useUserStore } from "@/stores/userStore";
import type { Message } from "@/types/chat";

const SUGGESTED_PROMPTS = [
  {
    icon: Code2,
    title: "Write code",
    subtitle: "Build a REST API with authentication",
    action: "Build a REST API with FastAPI that handles user authentication with JWT tokens",
  },
  {
    icon: Search,
    title: "Deep Research",
    subtitle: "Comprehensive multi-source analysis",
    action: "Research the current state of large language models and their impact on software development in 2025",
  },
  {
    icon: FileText,
    title: "Draft content",
    subtitle: "Blog post, email, or report",
    action: "Write a compelling blog post about the future of AI assistants in 2025",
  },
  {
    icon: BarChart3,
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
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 overflow-y-auto scrollbar-none">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="text-center mb-9"
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-surya-500 shadow-[0_18px_45px_rgba(26,115,232,0.18)]">
          <Sparkles size={22} className="text-white" />
        </div>
        <h1 className="text-[28px] font-semibold text-white mb-2">
          {greeting}, {firstName}
        </h1>
        <p className="text-[15px] text-gray-400">What are we working on?</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-[640px] mb-8">
        {SUGGESTED_PROMPTS.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.035 }}
              onClick={() => onSend(p.action)}
              className="flex items-start gap-3 p-4 rounded-xl bg-surface-1/80 border border-white/8 hover:bg-surface-2 hover:border-white/14 text-left transition-all duration-150"
            >
              <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-surya-accent">
                <Icon size={15} />
              </span>
              <div>
                <p className="text-[13px] font-medium text-white mb-0.5">{p.title}</p>
                <p className="text-[12px] text-gray-500 leading-snug">{p.subtitle}</p>
              </div>
            </motion.button>
          );
        })}
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
    <ScrollArea className="flex-1 min-h-0 px-4">
      <div className="max-w-3xl mx-auto py-8">
        {messages.map((msg, index) => {
          const previousUser = [...messages.slice(0, index)]
            .reverse()
            .find((m) => m.role === "user");
          const isLastAssistant =
            msg.role === "assistant" &&
            index === messages.length - 1 &&
            !isStreaming &&
            !!previousUser;
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              canRegenerate={isLastAssistant}
              onRegenerate={previousUser && onSend ? () => onSend(previousUser.content) : undefined}
            />
          );
        })}

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
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-surya-500">
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
