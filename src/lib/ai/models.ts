/**
 * AI model constants — safe to import in client-side code.
 * Does NOT instantiate the AI client.
 */

function modelId(value: string | undefined, fallback: string) {
  const aliases: Record<string, string> = {
    "claude-sonnet-4-6": "anthropic/claude-sonnet-4.6",
    "claude-opus-4-6": "anthropic/claude-opus-4.6",
    "gemini-3-1-pro": "google/gemini-3.1-pro-preview",
    "gemini-3.1-pro": "google/gemini-3.1-pro-preview",
    "gemini-3.1-pro-preview": "google/gemini-3.1-pro-preview",
    "gemini-3.1-pro-preview-05-06": "google/gemini-3.1-pro-preview",
    "google/gemini-3.1-pro": "google/gemini-3.1-pro-preview",
    "google/gemini-3-pro-image-preview": "google/gemini-3.1-pro-preview",
  };
  const configured = value?.trim();
  if (!configured) return fallback;
  return aliases[configured] ?? configured;
}

export const MODEL_MAP = {
  gpt54:  modelId(process.env.GPT_5_4_MODEL ?? process.env.OPENAI_RESEARCH_MODEL, "openai/gpt-5.4"),
  sonnet: modelId(process.env.MEDIUM_MODEL, "anthropic/claude-sonnet-4.6"),
  opus:   modelId(process.env.LARGE_MODEL ?? process.env.Large_MODEL, "anthropic/claude-opus-4.6"),
  gemini: modelId(
    process.env.GEMINI_RESEARCH_MODEL ?? process.env.WEB_SEARCH_MODEL ?? process.env.DEFAULT_MODEL,
    "google/gemini-3.1-pro-preview"
  ),
  deepseek: modelId(process.env.DEEPSEEK_MODEL, "deepseek/deepseek-chat"),
  qwen:     modelId(process.env.QWEN_MODEL, "qwen/qwen3-max"),
  kimi:   modelId(process.env.KIMI_MODEL, "moonshotai/kimi-k2.5"),
} as const;

export type ModelKey = keyof typeof MODEL_MAP;

export const DEFAULT_MODEL: ModelKey = "opus";

export const MAX_TOKENS: Record<ModelKey, number> = {
  gpt54:  16000,
  sonnet: 8192,
  opus:   16000,
  gemini: 8192,
  deepseek: 8192,
  qwen:     8192,
  kimi:   16000,
} as const;

export const RESEARCH_COUNCIL_MODEL_OPTIONS = [
  {
    id: "gpt54",
    label: "GPT 5.4",
    provider: "OpenAI",
    lens: "frontier reasoning, concise judgment, practical tradeoffs",
  },
  {
    id: "opus",
    label: "Claude Opus",
    provider: "Anthropic",
    lens: "deep reasoning, contradictions, edge cases, long-term consequences",
  },
  {
    id: "sonnet",
    label: "Claude Sonnet",
    provider: "Anthropic",
    lens: "balanced reasoning, clear user explanation, practical implications",
  },
  {
    id: "gemini",
    label: "Gemini 3 Pro",
    provider: "Google",
    lens: "web-grounded factual synthesis, source coverage, missing evidence",
  },
] as const satisfies ReadonlyArray<{
  id: ModelKey;
  label: string;
  provider: string;
  lens: string;
}>;

export type ResearchCouncilModelId = (typeof RESEARCH_COUNCIL_MODEL_OPTIONS)[number]["id"];

export const DEFAULT_RESEARCH_COUNCIL_MODELS = [
  "gpt54",
  "opus",
  "sonnet",
  "gemini",
] as const satisfies ReadonlyArray<ResearchCouncilModelId>;

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
