import { create } from 'zustand';

export type WorkspaceAnalysisTab = 'overview' | 'sentiment' | 'order';

interface WorkspaceStore {
  selectedTicker: string | null;
  analysisTab: WorkspaceAnalysisTab;
  tradeThesisByTicker: Record<string, string>;
  runScreenerTrigger: number;
  setSelectedTicker: (ticker: string | null) => void;
  clearSelectedTicker: () => void;
  setAnalysisTab: (tab: WorkspaceAnalysisTab) => void;
  setTradeThesis: (ticker: string, thesis: string) => void;
  clearTradeThesis: (ticker: string) => void;
  requestRunScreener: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  selectedTicker: null,
  analysisTab: 'overview',
  tradeThesisByTicker: {},
  runScreenerTrigger: 0,
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker ? ticker.trim().toUpperCase() : null }),
  clearSelectedTicker: () => set({ selectedTicker: null, analysisTab: 'overview' }),
  setAnalysisTab: (tab) => set({ analysisTab: tab }),
  setTradeThesis: (ticker, thesis) =>
    set((state) => ({
      tradeThesisByTicker: {
        ...state.tradeThesisByTicker,
        [ticker.trim().toUpperCase()]: thesis,
      },
    })),
  clearTradeThesis: (ticker) =>
    set((state) => {
      const key = ticker.trim().toUpperCase();
      const { [key]: _removed, ...rest } = state.tradeThesisByTicker;
      return { tradeThesisByTicker: rest };
    }),
  requestRunScreener: () => set((state) => ({ runScreenerTrigger: state.runScreenerTrigger + 1 })),
}));
