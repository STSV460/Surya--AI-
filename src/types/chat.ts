export type MessageRole = "user" | "assistant" | "system";

export interface ArtifactType {
  id: string;
  type: "code" | "document" | "interactive" | "image" | "video";
  title: string;
  content: string;
  language?: string;
  /** For image/video artifacts */
  url?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

/** A single web search result used for inline citations */
export interface SearchResult {
  index: number;      // 1-based citation number [1], [2] etc.
  title: string;
  url: string;
  domain: string;     // hostname without www. — used for favicon
  snippet: string;
  favicon: string;    // https://www.google.com/s2/favicons?domain=X&sz=32
}

/** Stage of an ongoing Deep Research run */
export type ResearchStage =
  | "generating_queries"
  | "searching"
  | "scraping"
  | "synthesizing"
  | "done";

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  artifacts?: ArtifactType[];
  thinking?: string;
  tokens?: number;
  searchResults?: SearchResult[];   // populated when web_search tool was used
  /** DB stores this as `timestamp` — aliased here for compat */
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  /** Auto-selected model stored at conversation level for reference */
  model?: string;
  projectId?: string;
  messages?: Message[];
  updatedAt: string;
  createdAt: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  /** Model is now auto-selected server-side — this field is ignored */
  model?: string;
  projectId?: string;
  thinking?: boolean;
  enableConnectors?: boolean;
  enableWebSearch?: boolean;
  enableImageGen?: boolean;
  enableVideoGen?: boolean;
  attachments?: { name: string; content: string; type: string }[];
}

export interface StreamEvent {
  type:
    | "text"
    | "artifact_start"
    | "artifact_end"
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "search_results"      // carries SearchResult[] for inline citation cards
    | "research_progress"   // carries { stage, detail } for Deep Research UI
    | "done"
    | "error";
  content?: string;
  artifact?: Partial<ArtifactType>;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  searchResults?: SearchResult[];
  researchProgress?: { stage: ResearchStage; detail?: string };
  error?: string;
}
