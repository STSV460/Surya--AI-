"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const TRANSLIT_LANGS = new Set([
  "hi", "ta", "te", "kn", "ml", "mr", "bn", "gu", "pa", "or", "as",
]);

interface Props {
  value: string;
  onChange: (v: string) => void;
  language: string;
  placeholder?: string;
  rows?: number;
  className?: string;
}

interface Suggestion {
  word: string;
  options: string[];
}

async function fetchSuggestions(text: string, lang: string): Promise<string[]> {
  if (!text.trim() || !TRANSLIT_LANGS.has(lang)) return [];
  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(text)}&itc=${lang}-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as [string, [[string, string[]]]];
    if (data[0] !== "SUCCESS") return [];
    return data[1]?.[0]?.[1] ?? [];
  } catch {
    return [];
  }
}

export function TransliterationInput({
  value,
  onChange,
  language,
  placeholder,
  rows = 5,
  className,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const langActive = TRANSLIT_LANGS.has(language);

  const lookup = useCallback(
    (raw: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const ta = taRef.current;
        if (!ta) return;
        const cursor = ta.selectionStart;
        const before = raw.slice(0, cursor);
        const word = before.split(/[\s\n.,;:!?]/).pop() ?? "";
        if (!word || !/^[a-zA-Z]+$/.test(word)) {
          setSuggestion(null);
          return;
        }
        const opts = await fetchSuggestions(word, language);
        if (opts.length) {
          setSuggestion({ word, options: opts });
          setActiveIdx(0);
        } else {
          setSuggestion(null);
        }
      }, 200);
    },
    [language],
  );

  function applySuggestion(pick: string) {
    const ta = taRef.current;
    if (!ta || !suggestion) return;
    const cursor = ta.selectionStart;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const wordStart = cursor - suggestion.word.length;
    const next = value.slice(0, wordStart) + pick + " " + after;
    onChange(next);
    setSuggestion(null);
    requestAnimationFrame(() => {
      const pos = wordStart + pick.length + 1;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
    void before;
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestion) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestion.options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + suggestion.options.length) % suggestion.options.length);
    } else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      applySuggestion(suggestion.options[activeIdx]);
    } else if (e.key === "Escape") {
      setSuggestion(null);
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (langActive) lookup(e.target.value);
        }}
        onKeyDown={handleKey}
        onBlur={() => setTimeout(() => setSuggestion(null), 150)}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          "w-full px-3 py-2 bg-surface-2 border border-white/8 rounded-lg text-sm text-white placeholder:text-white/30 outline-none focus:border-surya-500/50",
          className,
        )}
      />
      {suggestion && langActive && (
        <div className="absolute left-2 top-full mt-1 z-30 flex flex-wrap gap-1 p-1.5 bg-surface-2 border border-white/12 rounded-lg shadow-xl max-w-full">
          {suggestion.options.map((opt, i) => (
            <button
              key={opt + i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(opt)}
              className={cn(
                "px-2 py-1 rounded text-sm transition-colors",
                i === activeIdx
                  ? "bg-surya-500 text-white"
                  : "bg-surface-1 text-white/80 hover:bg-white/10",
              )}
            >
              {opt}
            </button>
          ))}
          <span className="text-[10px] text-white/30 self-center px-1">
            Tab/Enter to pick · Esc to dismiss
          </span>
        </div>
      )}
      {langActive && (
        <p className="text-[10px] text-white/40 mt-1">
          Type Latin letters → suggestions appear in selected script
        </p>
      )}
    </div>
  );
}
