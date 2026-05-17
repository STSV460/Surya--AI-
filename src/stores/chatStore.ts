import { create } from "zustand";
import type { Conversation, CrewName, CrewProgressEvent, Message } from "@/types/chat";

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
  enableCrew: boolean;
  crewMode: CrewName;
  crewEvents: CrewProgressEvent[];

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  replaceFromEditedMessage: (messageId: string, content: string) => void;
  updateStreamingContent: (content: string) => void;
  setIsStreaming: (isStreaming: boolean) => void;
  setThinkingEnabled: (enabled: boolean) => void;
  setEnableConnectors: (enabled: boolean) => void;
  setEnableWebSearch: (enabled: boolean) => void;
  setEnableImageGen: (enabled: boolean) => void;
  setEnableVideoGen: (enabled: boolean) => void;
  setEnableCrew: (enabled: boolean) => void;
  setCrewMode: (mode: CrewName) => void;
  resetCrewEvents: () => void;
  addCrewEvent: (event: CrewProgressEvent) => void;
  resetStream: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  thinkingEnabled: true,
  enableConnectors: false,
  enableWebSearch: true,
  enableImageGen: false,
  enableVideoGen: false,
  enableCrew: false,
  crewMode: "research",
  crewEvents: [],

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  replaceFromEditedMessage: (messageId, content) =>
    set((s) => {
      const index = s.messages.findIndex((message) => message.id === messageId);
      if (index === -1) return s;
      const next = s.messages.slice(0, index + 1);
      next[index] = { ...next[index], content };
      return { messages: next };
    }),
  updateStreamingContent: (content) => set({ streamingContent: content }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setThinkingEnabled: (thinkingEnabled) => set({ thinkingEnabled }),
  setEnableConnectors: (enableConnectors) => set({ enableConnectors }),
  setEnableWebSearch: (enableWebSearch) => set({ enableWebSearch }),
  setEnableImageGen: (enableImageGen) => set({ enableImageGen }),
  setEnableVideoGen: (enableVideoGen) => set({ enableVideoGen }),
  setEnableCrew: (enableCrew) => set({ enableCrew }),
  setCrewMode: (crewMode) => set({ crewMode }),
  resetCrewEvents: () => set({ crewEvents: [] }),
  addCrewEvent: (event) => set((s) => ({ crewEvents: [...s.crewEvents, event] })),
  resetStream: () => set({ streamingContent: "", isStreaming: false }),
}));
