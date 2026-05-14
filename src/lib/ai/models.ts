/**
 * AI model constants — safe to import in client-side code.
 * Does NOT instantiate the AI client.
 */

export const MODEL_MAP = {
  sonnet: "anthropic/claude-sonnet-4.6", // default chat + simple App Builder apps
  opus:   "anthropic/claude-opus-4.6",   // Extended Thinking + complex full-stack apps
  gemini: process.env.WEB_SEARCH_MODEL ?? "anthropic/claude-sonnet-4.6", // legacy alias
  // Kimi K2.5 via InsForge gateway — used for Web Search, Deep Research,
  // and Google Slides/Sheets/Docs connector content generation.
  kimi:   process.env.KIMI_MODEL ?? "moonshotai/kimi-k2.5",
} as const;

export type ModelKey = keyof typeof MODEL_MAP;

export const DEFAULT_MODEL: ModelKey = "sonnet";

export const MAX_TOKENS: Record<ModelKey, number> = {
  sonnet: 8192,
  opus:   16000,
  gemini: 8192,
  kimi:   16000,
} as const;

/**
 * Task-based model routing.
 * - Chat: Sonnet (default) / Opus (thinking)
 * - App Builder: Sonnet (simple apps — calculator, portfolio) / Opus (full-stack)
 * - Web Search + Deep Research: Kimi K2.5 (InsForge gateway, long context, fast)
 * - Slides/Sheets/Docs (Google Workspace export): Kimi K2.5
 * - Media (image/video/audio): dedicated providers, not in this map.
 */
export const TASK_MODEL_MAP = {
  webSearch:    "kimi",
  deepResearch: "kimi",
  slides:       "kimi",
  sheets:       "kimi",
  docs:         "kimi",
  flashcards:   "kimi",
  studyGuide:   "kimi",
  quiz:         "kimi",
} as const satisfies Partial<Record<string, ModelKey>>;

export const THINKING_BUDGET = 10000;

/**
 * Auto-select the best model based on message content and thinking toggle.
 * Users never choose the model — Surya AI picks for them.
 */
export function selectModel(message: string, thinkingEnabled: boolean): ModelKey {
  if (thinkingEnabled) return "opus";

  const len = message.length;
  const complexPattern =
    /analyz|research|explain in detail|write a (full|complete|detailed)|debug|refactor|architect|compare|summarize|review my|create a plan|strategy|step[- ]by[- ]step|in depth|comprehensive/i;

  if (len > 1500 || complexPattern.test(message)) return "opus";
  return "sonnet";
}
