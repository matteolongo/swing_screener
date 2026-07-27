import { create } from 'zustand';
import type { WorkspaceAnalysisTab } from '@/components/domain/workspace/types';

export type SelectedTickerSource = 'screener' | 'portfolio' | null;
export type WorkspaceMode = 'split' | 'expanded';

interface WorkspaceStore {
  selectedTicker: string | null;
  selectedTickerSource: SelectedTickerSource;
  analysisTab: WorkspaceAnalysisTab;
  runScreenerTrigger: number;
  workspaceMode: WorkspaceMode;
  selectionVersion: number;
  activityDrawerOpen: boolean;
  fullscreen: boolean;
  setSelectedTicker: (ticker: string | null, source?: SelectedTickerSource) => void;
  clearSelectedTicker: () => void;
  collapseWorkspace: () => void;
  setActivityDrawerOpen: (open: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setAnalysisTab: (tab: WorkspaceAnalysisTab) => void;
  requestRunScreener: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  selectedTicker: null,
  selectedTickerSource: null,
  analysisTab: 'overview',
  runScreenerTrigger: 0,
  workspaceMode: 'split',
  selectionVersion: 0,
  activityDrawerOpen: false,
  fullscreen: false,
  setSelectedTicker: (ticker, source = 'screener') => {
    const normalized = ticker?.trim();
    const upper = normalized ? normalized.toUpperCase() : null;
    set((state) => ({
      selectedTicker: upper,
      selectedTickerSource: upper ? source : null,
      workspaceMode: upper ? 'expanded' : state.workspaceMode,
      selectionVersion:
        upper && upper !== state.selectedTicker ? state.selectionVersion + 1 : state.selectionVersion,
    }));
  },
  clearSelectedTicker: () =>
    set({
      selectedTicker: null,
      selectedTickerSource: null,
      analysisTab: 'overview',
      workspaceMode: 'split',
      fullscreen: false,
    }),
  collapseWorkspace: () =>
    set((state) => ({ workspaceMode: state.workspaceMode === 'expanded' ? 'split' : state.workspaceMode })),
  setActivityDrawerOpen: (activityDrawerOpen) => set({ activityDrawerOpen }),
  setFullscreen: (fullscreen) => set({ fullscreen }),
  setAnalysisTab: (tab) => set({ analysisTab: tab }),
  requestRunScreener: () => set((state) => ({ runScreenerTrigger: state.runScreenerTrigger + 1 })),
}));
