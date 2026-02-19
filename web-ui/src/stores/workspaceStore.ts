import { create } from 'zustand';

export type WorkspaceAnalysisTab = 'overview' | 'sentiment' | 'order';

interface WorkspaceStore {
  selectedTicker: string | null;
  analysisTab: WorkspaceAnalysisTab;
  runScreenerTrigger: number;
  setSelectedTicker: (ticker: string | null) => void;
  clearSelectedTicker: () => void;
  setAnalysisTab: (tab: WorkspaceAnalysisTab) => void;
  requestRunScreener: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  selectedTicker: null,
  analysisTab: 'overview',
  runScreenerTrigger: 0,
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker ? ticker.trim().toUpperCase() : null }),
  clearSelectedTicker: () => set({ selectedTicker: null, analysisTab: 'overview' }),
  setAnalysisTab: (tab) => set({ analysisTab: tab }),
  requestRunScreener: () => set((state) => ({ runScreenerTrigger: state.runScreenerTrigger + 1 })),
}));
