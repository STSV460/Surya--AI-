"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, SkipForward } from "lucide-react";
import type { ClarifyQuestion } from "@/stores/appBuilderStore";

interface Props {
  messageId: string;
  questions: ClarifyQuestion[];
  answered: boolean;
  initialAnswers: Record<string, string>;
  onSubmit: (messageId: string, answers: Record<string, string>) => void;
  onSkip: (messageId: string) => void;
  disabled: boolean;
}

export function ClarifyQuestions({
  messageId,
  questions,
  answered,
  initialAnswers,
  onSubmit,
  onSkip,
  disabled,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);

  const setAnswer = (qId: string, value: string) =>
    setAnswers((a) => ({ ...a, [qId]: value }));

  const allAnswered = questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center gap-1.5 text-xs text-surya-500 font-medium">
        <Sparkles size={12} />
        <span>A few quick questions before I build</span>
      </div>

      {questions.map((q, idx) => {
        const current = answers[q.id] ?? "";
        return (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="rounded-xl bg-surface-2/60 border border-white/5 p-3 space-y-2"
          >
            <p className="text-xs text-gray-200 font-medium">{q.q}</p>
            <div className="flex flex-wrap gap-1.5">
              {q.suggestions.map((s) => {
                const selected = current === s;
                return (
                  <button
                    key={s}
                    disabled={answered || disabled}
                    onClick={() => setAnswer(q.id, s)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                      selected
                        ? "bg-surya-500/20 text-surya-500 border-surya-500/40"
                        : "bg-surface-2 text-gray-400 border-white/10 hover:border-white/20 hover:text-gray-200"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {!answered && !disabled && (
              <input
                value={current && !q.suggestions.includes(current) ? current : ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Or type your own…"
                className="w-full bg-transparent border border-white/5 rounded-md px-2 py-1 text-[11px] text-gray-200 placeholder:text-gray-600 outline-none focus:border-surya-500/40"
              />
            )}
          </motion.div>
        );
      })}

      {!answered && (
        <div className="flex items-center gap-2">
          <button
            disabled={disabled || !allAnswered}
            onClick={() => onSubmit(messageId, answers)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surya-500 hover:bg-surya-500/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-all"
          >
            Build it
            <ArrowRight size={11} />
          </button>
          <button
            disabled={disabled}
            onClick={() => onSkip(messageId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-2/80 border border-white/5 text-gray-400 hover:text-gray-200 text-xs transition-colors"
          >
            <SkipForward size={11} />
            Skip
          </button>
        </div>
      )}

      {answered && (
        <p className="text-[10px] text-gray-500">Answers locked. Building now…</p>
      )}
    </div>
  );
}
