import { create } from 'zustand';

export type WorkspaceAnalysisTab = 'overview' | 'fundamentals' | 'intelligence' | 'order';
export type SelectedTickerSource = 'screener' | 'portfolio' | null;

interface WorkspaceStore {
  selectedTicker: string | null;
  selectedTickerSource: SelectedTickerSource;
  analysisTab: WorkspaceAnalysisTab;
  runScreenerTrigger: number;
  setSelectedTicker: (ticker: string | null, source?: SelectedTickerSource) => void;
  clearSelectedTicker: () => void;
  setAnalysisTab: (tab: WorkspaceAnalysisTab) => void;
  requestRunScreener: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  selectedTicker: null,
  selectedTickerSource: null,
  analysisTab: 'overview',
  runScreenerTrigger: 0,
  setSelectedTicker: (ticker, source = 'screener') => {
    const normalized = ticker?.trim();
    const upper = normalized ? normalized.toUpperCase() : null;
    set({ selectedTicker: upper, selectedTickerSource: upper ? source : null });
  },
  clearSelectedTicker: () => set({ selectedTicker: null, selectedTickerSource: null, analysisTab: 'overview' }),
  setAnalysisTab: (tab) => set({ analysisTab: tab }),
  requestRunScreener: () => set((state) => ({ runScreenerTrigger: state.runScreenerTrigger + 1 })),
}));
