/**
 * InsForge AI Gateway client.
 * SERVER ONLY — never import this in client components.
 */

if (typeof window !== "undefined") {
  throw new Error("@/lib/ai/client must only be used server-side");
}

export type { ModelKey } from "./models";
export { MODEL_MAP, DEFAULT_MODEL, MAX_TOKENS, THINKING_BUDGET } from "./models";

import { insforge } from "@/lib/insforge";

export const aiClient = insforge.ai;
