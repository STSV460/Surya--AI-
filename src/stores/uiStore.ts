import { create } from "zustand";
import type { ArtifactType } from "@/types/chat";

export type ModelId = "sonnet" | "opus";

interface UIStore {
  sidebarOpen: boolean;
  artifactPanelOpen: boolean;
  activeArtifact: ArtifactType | null;
  voiceModalOpen: boolean;
  searchEnabled: boolean;
  selectedModel: ModelId;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setArtifactPanel: (open: boolean, artifact?: ArtifactType) => void;
  setVoiceModalOpen: (open: boolean) => void;
  setSearchEnabled: (enabled: boolean) => void;
  setSelectedModel: (model: ModelId) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  artifactPanelOpen: false,
  activeArtifact: null,
  voiceModalOpen: false,
  searchEnabled: false,
  selectedModel: "opus",

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setArtifactPanel: (open, artifact) =>
    set({ artifactPanelOpen: open, activeArtifact: artifact ?? null }),
  setVoiceModalOpen: (open) => set({ voiceModalOpen: open }),
  setSearchEnabled: (enabled) => set({ searchEnabled: enabled }),
  setSelectedModel: (model) => set({ selectedModel: model }),
}));
