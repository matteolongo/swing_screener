import { create } from 'zustand';

interface WorkspaceStore {
  selectedTicker: string | null;
  tradeThesisByTicker: Record<string, string>;
  setSelectedTicker: (ticker: string | null) => void;
  clearSelectedTicker: () => void;
  setTradeThesis: (ticker: string, thesis: string) => void;
  clearTradeThesis: (ticker: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()((set) => ({
  selectedTicker: null,
  tradeThesisByTicker: {},
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker ? ticker.trim().toUpperCase() : null }),
  clearSelectedTicker: () => set({ selectedTicker: null }),
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
}));
