import { create } from "zustand";
import type { Conversation, Message } from "@/types/chat";

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  /** Deep thinking — when true, server routes to Opus automatically */
  thinkingEnabled: boolean;
  /** When true, Claude is given tool definitions to call Google/GitHub connectors */
  enableConnectors: boolean;
  /** When true, the chat API will perform web search before responding */
  enableWebSearch: boolean;
  /** When true, chat generates images from the user's prompt */
  enableImageGen: boolean;
  /** When true, chat attempts video generation (experimental) */
  enableVideoGen: boolean;

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  /**
   * ChatGPT-style edit: replace the message at `messageId` with `newContent`
   * and drop every message after it (forks the conversation).
   */
  replaceMessageAndTruncate: (messageId: string, newContent: string) => void;
  updateStreamingContent: (content: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setThinkingEnabled: (enabled: boolean) => void;
  setEnableConnectors: (enabled: boolean) => void;
  setEnableWebSearch: (enabled: boolean) => void;
  setEnableImageGen: (enabled: boolean) => void;
  setEnableVideoGen: (enabled: boolean) => void;
  resetStream: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  thinkingEnabled: false,
  enableConnectors: false,
  enableWebSearch: false,
  enableImageGen: false,
  enableVideoGen: false,

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  replaceMessageAndTruncate: (messageId, newContent) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return s;
      const updated = { ...s.messages[idx], content: newContent };
      return { messages: [...s.messages.slice(0, idx), updated] };
    }),
  updateStreamingContent: (content) => set({ streamingContent: content }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setThinkingEnabled: (thinkingEnabled) => set({ thinkingEnabled }),
  setEnableConnectors: (enableConnectors) => set({ enableConnectors }),
  setEnableWebSearch: (enableWebSearch) => set({ enableWebSearch }),
  setEnableImageGen: (enableImageGen) => set({ enableImageGen }),
  setEnableVideoGen: (enableVideoGen) => set({ enableVideoGen }),
  resetStream: () => set({ streamingContent: "", isStreaming: false }),
}));
