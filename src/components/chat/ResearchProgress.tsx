"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, MessageSquareText, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ResearchStage, ResearchCouncilUpdate } from "@/types/chat";
import { cn } from "@/lib/utils";

const STAGES: { key: ResearchStage; label: string }[] = [
  { key: "generating_queries", label: "Planning queries" },
  { key: "searching",          label: "Searching web" },
  { key: "scraping",           label: "Reading sources" },
  { key: "debating",           label: "Model council" },
  { key: "synthesizing",       label: "Writing report" },
];

const STAGE_ORDER: ResearchStage[] = [
  "generating_queries",
  "searching",
  "scraping",
  "debating",
  "synthesizing",
  "done",
];

interface ResearchProgressProps {
  stage: ResearchStage | null;
  detail?: string;
  isRunning: boolean;
  councilUpdates?: ResearchCouncilUpdate[];
}

function phaseLabel(phase: ResearchCouncilUpdate["phase"]) {
  if (phase === "reading") return "Reading sources";
  if (phase === "memo") return "Answer";
  if (phase === "debate") return "Discussion";
  return "Final chair";
}

function shortContent(content?: string) {
  if (!content) return "";
  const trimmed = content.replace(/\s+/g, " ").trim();
  return trimmed.length > 360 ? `${trimmed.slice(0, 357)}...` : trimmed;
}

function statusLabel(update: ResearchCouncilUpdate) {
  if (update.status === "thinking") return "Thinking...";
  if (update.status === "error") return "Unavailable";
  return "Submitted";
}

export function ResearchProgress({ stage, detail, isRunning, councilUpdates = [] }: ResearchProgressProps) {
  const currentIndex = stage ? STAGE_ORDER.indexOf(stage) : -1;
  const visibleCouncil = councilUpdates;
  const [selectedCard, setSelectedCard] = useState<ResearchCouncilUpdate | null>(null);

  return (
    <AnimatePresence>
      {isRunning && (
        <motion.div
          key="research-progress"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mb-6"
        >
          <div className="rounded-xl border border-surya-500/20 bg-surya-500/5 px-4 py-3">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <Loader2 size={14} className="text-surya-accent animate-spin" />
              <span className="text-xs font-medium text-surya-accent">Deep Research in Progress</span>
            </div>

            {/* Stage steps */}
            <div className="flex items-center mb-3">
              {STAGES.map((s, i) => {
                const stageIdx = STAGE_ORDER.indexOf(s.key);
                const isComplete = currentIndex > stageIdx;
                const isActive = currentIndex === stageIdx;

                return (
                  <div key={s.key} className="flex items-center flex-1 min-w-0">
                    {/* Step */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <motion.div
                        animate={{
                          backgroundColor: isComplete
                            ? "#1A73E8"
                            : isActive
                            ? "rgba(26,115,232,0.3)"
                            : "rgba(255,255,255,0.05)",
                          borderColor: isComplete || isActive
                            ? "#1A73E8"
                            : "rgba(255,255,255,0.1)",
                        }}
                        transition={{ duration: 0.3 }}
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                      >
                        {isComplete ? (
                          <CheckCircle2 size={12} className="text-white" />
                        ) : isActive ? (
                          <motion.div
                            animate={{ scale: [1, 1.3, 1] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                            className="w-2 h-2 rounded-full bg-surya-500"
                          />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-white/20 block" />
                        )}
                      </motion.div>
                      <span className={cn(
                        "text-[10px] text-center leading-tight w-16 truncate",
                        isComplete ? "text-surya-500" : isActive ? "text-white" : "text-gray-600"
                      )}>
                        {s.label}
                      </span>
                    </div>

                    {/* Connector line (not after last) */}
                    {i < STAGES.length - 1 && (
                      <motion.div
                        className="flex-1 h-px mx-1 mb-5"
                        animate={{
                          backgroundColor: isComplete ? "#1A73E8" : "rgba(255,255,255,0.08)",
                        }}
                        transition={{ duration: 0.4 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Detail string */}
            <AnimatePresence mode="wait">
              {detail && (
                <motion.p
                  key={detail}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-[11px] text-gray-400 font-mono"
                >
                  {detail}
                </motion.p>
              )}
            </AnimatePresence>

            {visibleCouncil.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {visibleCouncil.map((update) => (
                  <motion.div
                    key={update.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => update.content ? setSelectedCard(update) : undefined}
                    className={cn(
                      "rounded-lg border border-white/8 bg-black/15 px-3 py-2",
                      update.content && "cursor-pointer hover:border-surya-500/40 hover:bg-surya-500/5 transition-colors"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {update.status === "thinking" ? (
                        <Loader2 size={12} className="text-surya-accent animate-spin shrink-0" />
                      ) : update.status === "done" ? (
                        <CheckCircle2 size={12} className="text-green-400 shrink-0" />
                      ) : (
                        <MessageSquareText size={12} className="text-red-400 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-white">
                          {update.label}
                        </p>
                        <p className="truncate text-[10px] text-gray-500">
                          {statusLabel(update)} · {phaseLabel(update.phase)} · {update.provider}
                        </p>
                      </div>
                      {update.content && (
                        <span className="text-[9px] text-gray-600 shrink-0">tap to expand</span>
                      )}
                    </div>
                    {update.content && (
                      <p className="mt-2 text-[11px] leading-relaxed text-gray-300">
                        {shortContent(update.content)}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Model answer full-screen popup */}
            {selectedCard && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                onClick={() => setSelectedCard(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#1A1D27] shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
                    <div>
                      <p className="font-semibold text-sm text-white">{selectedCard.label}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {statusLabel(selectedCard)} · {phaseLabel(selectedCard.phase)} · {selectedCard.provider}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCard(null)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-white/8 hover:text-white transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {/* Scrollable content */}
                  <div className="overflow-y-auto flex-1 px-5 py-4">
                    <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1.5">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedCard.content ?? ""}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
