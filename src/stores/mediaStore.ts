import { create } from "zustand";
import type { MediaAsset, MediaTab } from "@/types/media";

interface MediaStore {
  activeTab: MediaTab;
  assets: MediaAsset[];
  selectedAsset: MediaAsset | null;
  isGenerating: boolean;
  pendingJobIds: string[];

  setActiveTab: (tab: MediaTab) => void;
  setAssets: (assets: MediaAsset[]) => void;
  addAsset: (asset: MediaAsset) => void;
  updateAsset: (id: string, patch: Partial<MediaAsset>) => void;
  removeAsset: (id: string) => void;
  setSelectedAsset: (asset: MediaAsset | null) => void;
  setGenerating: (v: boolean) => void;
  trackJob: (id: string) => void;
  untrackJob: (id: string) => void;
}

export const useMediaStore = create<MediaStore>((set) => ({
  activeTab: "video",
  assets: [],
  selectedAsset: null,
  isGenerating: false,
  pendingJobIds: [],

  setActiveTab: (activeTab) => set({ activeTab }),
  setAssets: (assets) => set({ assets }),
  addAsset: (asset) => set((s) => ({ assets: [asset, ...s.assets] })),
  updateAsset: (id, patch) =>
    set((s) => ({
      assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      selectedAsset:
        s.selectedAsset?.id === id ? { ...s.selectedAsset, ...patch } : s.selectedAsset,
    })),
  removeAsset: (id) =>
    set((s) => ({
      assets: s.assets.filter((a) => a.id !== id),
      selectedAsset: s.selectedAsset?.id === id ? null : s.selectedAsset,
    })),
  setSelectedAsset: (selectedAsset) => set({ selectedAsset }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  trackJob: (id) => set((s) => ({ pendingJobIds: [...s.pendingJobIds, id] })),
  untrackJob: (id) =>
    set((s) => ({ pendingJobIds: s.pendingJobIds.filter((j) => j !== id) })),
}));
