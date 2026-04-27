import { create } from "zustand";

export interface ClarifyQuestion {
  id: string;
  q: string;
  suggestions: string[];
}

export interface AppBuilderMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  error?: boolean;
  elapsed?: number;
  kind?: "text" | "clarify";
  questions?: ClarifyQuestion[];
  answers?: Record<string, string>;
  answered?: boolean;
  plan?: string;
  thoughtSeconds?: number;
  followUps?: string[];
}

export interface AppBuilderProjectMeta {
  id: string;
  name: string;
  previewMode: "srcdoc" | "webcontainer" | "none";
  createdAt: string;
  updatedAt: string;
}

interface AppBuilderStore {
  // Project
  projectId: string | null;
  projectName: string;
  projects: AppBuilderProjectMeta[];
  projectsLoaded: boolean;

  messages: AppBuilderMessage[];
  isStreaming: boolean;
  elapsedSeconds: number;
  files: Record<string, string>;
  activeFile: string | null;
  buildTab: "preview" | "code";
  previewMode: "srcdoc" | "webcontainer" | "none";
  viewport: "mobile" | "tablet" | "desktop";
  lastUserPrompt: string | null;
  selectedElement: string | null;
  buildError: string | null;

  // Mutators
  setProject: (p: { id: string; name: string }) => void;
  clearProject: () => void;
  loadProject: (p: {
    id: string;
    name: string;
    files: Record<string, string>;
    messages: AppBuilderMessage[];
    previewMode: "srcdoc" | "webcontainer" | "none";
  }) => void;
  setProjects: (list: AppBuilderProjectMeta[]) => void;
  upsertProjectMeta: (meta: AppBuilderProjectMeta) => void;
  removeProjectMeta: (id: string) => void;

  addMessage: (msg: AppBuilderMessage) => void;
  updateLastAssistantMessage: (
    content: string,
    isStreaming: boolean,
    opts?: { error?: boolean; elapsed?: number }
  ) => void;
  patchMessage: (id: string, patch: Partial<AppBuilderMessage>) => void;
  setFiles: (files: Record<string, string>) => void;
  patchFiles: (changed: Record<string, string>) => void;
  setActiveFile: (path: string | null) => void;
  setBuildTab: (tab: "preview" | "code") => void;
  setPreviewMode: (mode: "srcdoc" | "webcontainer" | "none") => void;
  setViewport: (v: "mobile" | "tablet" | "desktop") => void;
  setIsStreaming: (v: boolean) => void;
  setElapsedSeconds: (s: number) => void;
  setLastUserPrompt: (p: string | null) => void;
  setSelectedElement: (data: string | null) => void;
  setBuildError: (e: string | null) => void;
  reset: () => void;
}

const SESSION_DEFAULTS = {
  messages: [] as AppBuilderMessage[],
  isStreaming: false,
  elapsedSeconds: 0,
  files: {} as Record<string, string>,
  activeFile: null as string | null,
  buildTab: "preview" as const,
  previewMode: "none" as const,
  viewport: "desktop" as const,
  lastUserPrompt: null as string | null,
  selectedElement: null as string | null,
  buildError: null as string | null,
};

export const useAppBuilderStore = create<AppBuilderStore>((set) => ({
  projectId: null,
  projectName: "",
  projects: [],
  projectsLoaded: false,
  ...SESSION_DEFAULTS,

  setProject: ({ id, name }) => set({ projectId: id, projectName: name }),
  clearProject: () =>
    set({ projectId: null, projectName: "", ...SESSION_DEFAULTS }),
  loadProject: ({ id, name, files, messages, previewMode }) =>
    set({
      projectId: id,
      projectName: name,
      files,
      messages,
      previewMode,
      activeFile: Object.keys(files)[0] ?? null,
      isStreaming: false,
      elapsedSeconds: 0,
      lastUserPrompt: null,
      selectedElement: null,
      buildError: null,
      buildTab: "preview",
      viewport: "desktop",
    }),
  setProjects: (projects) => set({ projects, projectsLoaded: true }),
  upsertProjectMeta: (meta) =>
    set((s) => {
      const idx = s.projects.findIndex((p) => p.id === meta.id);
      const next = [...s.projects];
      if (idx >= 0) next[idx] = meta;
      else next.unshift(meta);
      next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      return { projects: next };
    }),
  removeProjectMeta: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  updateLastAssistantMessage: (content, isStreaming, opts) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant") {
        msgs[msgs.length - 1] = {
          ...last,
          content,
          isStreaming,
          error: opts?.error ?? last.error,
          elapsed: opts?.elapsed ?? last.elapsed,
        };
      }
      return { messages: msgs };
    }),

  patchMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  setFiles: (files) => set({ files }),
  patchFiles: (changed) => set((s) => ({ files: { ...s.files, ...changed } })),
  setActiveFile: (activeFile) => set({ activeFile }),
  setBuildTab: (buildTab) => set({ buildTab }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  setViewport: (viewport) => set({ viewport }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setElapsedSeconds: (elapsedSeconds) => set({ elapsedSeconds }),
  setLastUserPrompt: (lastUserPrompt) => set({ lastUserPrompt }),
  setSelectedElement: (selectedElement) => set({ selectedElement }),
  setBuildError: (buildError) => set({ buildError }),

  reset: () => set({ ...SESSION_DEFAULTS }),
}));
