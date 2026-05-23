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
  planPrompt?: string;
  planImages?: string[];
  agentEvents?: AgentTimelineEvent[];
  warRoomEvents?: WarRoomEvent[];
  replay?: BuildReplayData;
}

export interface AgentTimelineEvent {
  role: string;
  label: string;
  status: "running" | "done";
  summary: string;
}

export interface WarRoomEvent {
  role: string;
  text: string;
}

export interface BuildReplayData {
  built: string[];
  files: string[];
  security: string[];
  bugsFixed: string[];
  next: string[];
}

export type SuryaCodeView = "preview" | "diff" | "terminal" | "files" | "tasks" | "plan";

export interface BackgroundTask {
  id: string;
  title: string;
  owner: string;
  status: "queued" | "running" | "done" | "blocked" | "error";
  filesTouched?: string[];
  risk?: "low" | "medium" | "high";
  result?: string;
  createdAt: string;
}

export interface Checkpoint {
  id: string;
  label: string;
  files: Record<string, string>;
  activeView: SuryaCodeView;
  changedFiles: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityReplayEvent {
  id: string;
  action: string;
  command?: string;
  agent?: string;
  permissionChoice?: "allow_once" | "always_allow" | "deny";
  filesTouched?: string[];
  tokensAccessed?: boolean;
  networkCalls?: string[];
  deployTarget?: string;
  checkpointAvailable?: boolean;
  createdAt: string;
}

export interface WorkspaceState {
  activeView: SuryaCodeView;
  diffBaseFiles: Record<string, string>;
  backgroundTasks: BackgroundTask[];
  routines: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
  mcps: Array<Record<string, unknown>>;
  checkpoints: Checkpoint[];
  permissions: Record<string, unknown>;
  terminalHistory: Array<Record<string, unknown>>;
  repo: Record<string, unknown> | null;
  repoBrain: Record<string, unknown>;
  pullRequests: Array<Record<string, unknown>>;
  reviewComments: Array<Record<string, unknown>>;
  hooks: Array<Record<string, unknown>>;
  customAgents: Array<Record<string, unknown>>;
  costMeter: Record<string, unknown>;
  qualityScore: Record<string, unknown>;
  env: Record<string, unknown>;
  observability: Array<Record<string, unknown>>;
  visionInputs: Array<Record<string, unknown>>;
  securityReplay: SecurityReplayEvent[];
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
  workspaceState: WorkspaceState;

  // Mutators
  setProject: (p: { id: string; name: string }) => void;
  clearProject: () => void;
  loadProject: (p: {
    id: string;
    name: string;
    files: Record<string, string>;
    messages: AppBuilderMessage[];
    previewMode: "srcdoc" | "webcontainer" | "none";
    workspaceState?: Partial<WorkspaceState>;
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
  setWorkspaceView: (view: SuryaCodeView) => void;
  addBackgroundTask: (task: Omit<BackgroundTask, "id" | "createdAt"> & Partial<Pick<BackgroundTask, "id" | "createdAt">>) => void;
  updateBackgroundTask: (id: string, patch: Partial<BackgroundTask>) => void;
  createCheckpoint: (label: string) => Checkpoint;
  restoreCheckpoint: (id: string) => void;
  setPermissions: (patch: Record<string, unknown>) => void;
  appendTerminalLog: (entry: Record<string, unknown>) => void;
  setRepo: (repo: Record<string, unknown> | null) => void;
  updateRepoBrain: (patch: Record<string, unknown>) => void;
  upsertPullRequest: (pr: Record<string, unknown> & { id?: string; number?: number }) => void;
  upsertReviewComment: (comment: Record<string, unknown> & { id?: string }) => void;
  addHook: (hook: Record<string, unknown>) => void;
  addCustomAgent: (agent: Record<string, unknown>) => void;
  updateCostMeter: (patch: Record<string, unknown>) => void;
  updateQualityScore: (patch: Record<string, unknown>) => void;
  updateEnvState: (patch: Record<string, unknown>) => void;
  addDeployObservation: (event: Record<string, unknown>) => void;
  addSecurityReplay: (event: Omit<SecurityReplayEvent, "id" | "createdAt"> & Partial<Pick<SecurityReplayEvent, "id" | "createdAt">>) => void;
  reset: () => void;
}

export const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  activeView: "preview",
  diffBaseFiles: {},
  backgroundTasks: [],
  routines: [
    { id: "landing", label: "Build landing page" },
    { id: "fix-bug", label: "Fix bug" },
    { id: "auth", label: "Add auth" },
    { id: "test-deploy", label: "Run tests and deploy" },
    { id: "review-pr", label: "Review PR" },
  ],
  skills: [
    { id: "coding-style", label: "Coding style" },
    { id: "ui-style", label: "UI style" },
    { id: "testing-rules", label: "Testing rules" },
    { id: "deployment-rules", label: "Deployment rules" },
    { id: "database-rules", label: "Database rules" },
  ],
  mcps: [],
  checkpoints: [],
  permissions: {},
  terminalHistory: [],
  repo: null,
  repoBrain: {},
  pullRequests: [],
  reviewComments: [],
  hooks: [
    { id: "after-edit", label: "After edit: lint/typecheck", enabled: true },
    { id: "before-commit", label: "Before commit: tests", enabled: true },
    { id: "before-deploy", label: "Before deploy: build", enabled: true },
    { id: "after-bug-fix", label: "After bug fix: checkpoint", enabled: true },
    { id: "before-secret-read", label: "Before secret read: permission", enabled: true },
  ],
  customAgents: [
    { id: "security-reviewer", label: "Security Reviewer" },
    { id: "nextjs-expert", label: "Next.js Expert" },
    { id: "db-optimizer", label: "DB Optimizer" },
    { id: "ui-polish", label: "UI Polish" },
    { id: "test-writer", label: "Test Writer" },
  ],
  costMeter: { model: "Opus 4.6", tokens: 0, estimatedCost: 0, durationMs: 0, filesChanged: 0 },
  qualityScore: { overall: 0, build: 0, security: 0, testing: 0, performance: 0, accessibility: 0, suggestions: [] },
  env: { missing: [], detected: [] },
  observability: [],
  visionInputs: [],
  securityReplay: [],
};

export function normalizeWorkspaceState(input?: Partial<WorkspaceState>): WorkspaceState {
  return {
    ...DEFAULT_WORKSPACE_STATE,
    ...(input ?? {}),
    diffBaseFiles: input?.diffBaseFiles ?? {},
    backgroundTasks: input?.backgroundTasks ?? [],
    routines: input?.routines ?? DEFAULT_WORKSPACE_STATE.routines,
    skills: input?.skills ?? DEFAULT_WORKSPACE_STATE.skills,
    mcps: input?.mcps ?? [],
    checkpoints: input?.checkpoints ?? [],
    permissions: input?.permissions ?? {},
    terminalHistory: input?.terminalHistory ?? [],
    repo: input?.repo ?? null,
    repoBrain: input?.repoBrain ?? {},
    pullRequests: input?.pullRequests ?? [],
    reviewComments: input?.reviewComments ?? [],
    hooks: input?.hooks ?? DEFAULT_WORKSPACE_STATE.hooks,
    customAgents: input?.customAgents ?? DEFAULT_WORKSPACE_STATE.customAgents,
    costMeter: input?.costMeter ?? DEFAULT_WORKSPACE_STATE.costMeter,
    qualityScore: input?.qualityScore ?? DEFAULT_WORKSPACE_STATE.qualityScore,
    env: input?.env ?? DEFAULT_WORKSPACE_STATE.env,
    observability: input?.observability ?? [],
    visionInputs: input?.visionInputs ?? [],
    securityReplay: input?.securityReplay ?? [],
  };
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
  workspaceState: normalizeWorkspaceState(),
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
  loadProject: ({ id, name, files, messages, previewMode, workspaceState }) =>
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
      workspaceState: normalizeWorkspaceState(workspaceState),
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
  setBuildTab: (buildTab) => set((s) => ({
    buildTab,
    workspaceState: { ...s.workspaceState, activeView: buildTab === "code" ? "files" : "preview" },
  })),
  setPreviewMode: (previewMode) => set({ previewMode }),
  setViewport: (viewport) => set({ viewport }),
  setIsStreaming: (isStreaming) => set({ isStreaming }),
  setElapsedSeconds: (elapsedSeconds) => set({ elapsedSeconds }),
  setLastUserPrompt: (lastUserPrompt) => set({ lastUserPrompt }),
  setSelectedElement: (selectedElement) => set({ selectedElement }),
  setBuildError: (buildError) => set({ buildError }),

  setWorkspaceView: (activeView) => set((s) => ({
    buildTab: activeView === "preview" ? "preview" : activeView === "files" ? "code" : s.buildTab,
    workspaceState: { ...s.workspaceState, activeView },
  })),
  addBackgroundTask: (task) => set((s) => ({
    workspaceState: {
      ...s.workspaceState,
      backgroundTasks: [
        {
          id: task.id ?? crypto.randomUUID(),
          createdAt: task.createdAt ?? new Date().toISOString(),
          title: task.title,
          owner: task.owner,
          status: task.status,
          filesTouched: task.filesTouched,
          risk: task.risk,
          result: task.result,
        },
        ...s.workspaceState.backgroundTasks,
      ],
    },
  })),
  updateBackgroundTask: (id, patch) => set((s) => ({
    workspaceState: {
      ...s.workspaceState,
      backgroundTasks: s.workspaceState.backgroundTasks.map((task) => task.id === id ? { ...task, ...patch } : task),
    },
  })),
  createCheckpoint: (label) => {
    let created: Checkpoint | null = null;
    set((s) => ({
      workspaceState: (() => {
        const checkpoint: Checkpoint = {
          id: crypto.randomUUID(),
          label,
          files: s.files,
          activeView: s.workspaceState.activeView,
          changedFiles: Object.keys(s.files),
          createdAt: new Date().toISOString(),
        };
        created = checkpoint;
        return {
          ...s.workspaceState,
          diffBaseFiles: s.files,
          checkpoints: [checkpoint, ...s.workspaceState.checkpoints].slice(0, 25),
        };
      })(),
    }));
    return created ?? {
      id: crypto.randomUUID(),
      label,
      files: {},
      activeView: "preview",
      changedFiles: [],
      createdAt: new Date().toISOString(),
    };
  },
  restoreCheckpoint: (id) => set((s) => {
    const checkpoint = s.workspaceState.checkpoints.find((item) => item.id === id);
    if (!checkpoint) return {};
    return {
      files: checkpoint.files,
      activeFile: Object.keys(checkpoint.files)[0] ?? null,
      workspaceState: { ...s.workspaceState, activeView: checkpoint.activeView },
    };
  }),
  setPermissions: (patch) => set((s) => ({
    workspaceState: { ...s.workspaceState, permissions: { ...s.workspaceState.permissions, ...patch } },
  })),
  appendTerminalLog: (entry) => set((s) => ({
    workspaceState: { ...s.workspaceState, terminalHistory: [...s.workspaceState.terminalHistory, { ...entry, createdAt: new Date().toISOString() }] },
  })),
  setRepo: (repo) => set((s) => ({ workspaceState: { ...s.workspaceState, repo } })),
  updateRepoBrain: (patch) => set((s) => ({
    workspaceState: { ...s.workspaceState, repoBrain: { ...s.workspaceState.repoBrain, ...patch } },
  })),
  upsertPullRequest: (pr) => set((s) => {
    const key = String(pr.id ?? pr.number ?? "");
    const pullRequests = s.workspaceState.pullRequests.filter((item) => String(item.id ?? item.number ?? "") !== key);
    return { workspaceState: { ...s.workspaceState, pullRequests: [pr, ...pullRequests] } };
  }),
  upsertReviewComment: (comment) => set((s) => {
    const key = String(comment.id ?? crypto.randomUUID());
    const reviewComments = s.workspaceState.reviewComments.filter((item) => String(item.id ?? "") !== key);
    return { workspaceState: { ...s.workspaceState, reviewComments: [{ ...comment, id: key }, ...reviewComments] } };
  }),
  addHook: (hook) => set((s) => ({ workspaceState: { ...s.workspaceState, hooks: [hook, ...s.workspaceState.hooks] } })),
  addCustomAgent: (agent) => set((s) => ({ workspaceState: { ...s.workspaceState, customAgents: [agent, ...s.workspaceState.customAgents] } })),
  updateCostMeter: (patch) => set((s) => ({
    workspaceState: { ...s.workspaceState, costMeter: { ...s.workspaceState.costMeter, ...patch } },
  })),
  updateQualityScore: (patch) => set((s) => ({
    workspaceState: { ...s.workspaceState, qualityScore: { ...s.workspaceState.qualityScore, ...patch } },
  })),
  updateEnvState: (patch) => set((s) => ({
    workspaceState: { ...s.workspaceState, env: { ...s.workspaceState.env, ...patch } },
  })),
  addDeployObservation: (event) => set((s) => ({
    workspaceState: { ...s.workspaceState, observability: [{ ...event, createdAt: new Date().toISOString() }, ...s.workspaceState.observability] },
  })),
  addSecurityReplay: (event) => set((s) => ({
    workspaceState: {
      ...s.workspaceState,
      securityReplay: [
        { ...event, id: event.id ?? crypto.randomUUID(), createdAt: event.createdAt ?? new Date().toISOString() },
        ...s.workspaceState.securityReplay,
      ],
    },
  })),

  reset: () => set({ ...SESSION_DEFAULTS }),
}));
